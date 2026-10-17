const path = require('path');
const fs = require('fs');
const { hashSenha } = require('../services/senhas');
const { seedDemoData, bootstrapToken } = require('../config');
const { usePostgres, runAsync, getAsync, allAsync, placeholders } = require('./db');
const { garantirCatalogo, idPorNome, DEPOSITO_PADRAO } = require('./catalogo');

async function initializeDatabase() {
  try {
    console.log(`Inicializando banco de dados (${usePostgres ? 'Postgres' : 'SQLite'})...`);

    const schemaFile = usePostgres ? 'schema.pg.sql' : 'schema.sql';
    const schema = fs.readFileSync(path.join(__dirname, schemaFile), 'utf8');
    const statements = schema.split(';').filter(stmt => stmt.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        await runAsync(statement);
      }
    }

    console.log('Schema criado com sucesso!');

    // Categorias, templates e depósito padrão: necessários também em produção
    await garantirCatalogo();

    const userCount = await getAsync('SELECT COUNT(*) as count FROM usuarios');

    if (userCount.count === 0 && seedDemoData) {
      console.log('Inserindo dados iniciais de demonstração...');
      await insertInitialData();
      console.log('Dados iniciais inseridos com sucesso!');
    } else if (userCount.count === 0 && !bootstrapToken) {
      console.warn(
        'AVISO: banco sem usuários e BOOTSTRAP_TOKEN não definido — qualquer pessoa pode fazer o primeiro ' +
        'cadastro (POST /api/auth/register) até ele existir. Defina BOOTSTRAP_TOKEN.'
      );
    }

    console.log('Banco de dados pronto!');
  } catch (error) {
    console.error('Erro ao inicializar banco de dados:', error);
    throw error;
  }
}

// Função para gerar número de tombamento (uso interno)
function gerarTombamento() {
  const ano = new Date().getFullYear();
  const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  return `TOMB-${ano}-${random}`;
}

// Função para gerar código no formato XXX0000
async function gerarCodigo(prefixo) {
  // Buscar o último código com esse prefixo
  const ultimo = await getAsync(
    'SELECT codigo FROM equipamentos WHERE codigo LIKE ? ORDER BY codigo DESC LIMIT 1',
    [`${prefixo}%`]
  );

  let numero = 1;
  if (ultimo) {
    // Extrair o número do código (últimos 4 dígitos)
    const numeroStr = ultimo.codigo.slice(-4);
    numero = parseInt(numeroStr, 10) + 1;
  }

  // Formatar como XXX0000
  return `${prefixo}${numero.toString().padStart(4, '0')}`;
}

async function insertInitialData() {
  const senhaHash = await hashSenha('123456');

  // Usuários
  await runAsync(`
    INSERT INTO usuarios (nome, email, senha, tipo) VALUES
    ('Coordenador Principal', 'coordenador@sistema.com', ?, 'coordenador'),
    ('João Silva', 'joao@sistema.com', ?, 'responsavel_entrega'),
    ('Maria Santos', 'maria@sistema.com', ?, 'responsavel_recebimento'),
    ('Pedro Oliveira', 'pedro@sistema.com', ?, 'tecnico')
  `, [senhaHash, senhaHash, senhaHash, senhaHash]);

  // Depósitos além do Depósito Central, que vem do catálogo básico (catalogo.js) junto com as
  // categorias usadas abaixo. Os testes contam com os ids 1, 2 e 3, na ordem.
  await runAsync(`
    INSERT INTO depositos (nome, endereco, responsavel_id) VALUES
    ('Depósito Zona Norte', 'Av. Norte, 200', 2),
    ('Depósito Zona Sul', 'Av. Sul, 300', 3)
  `);
  await runAsync(
    "UPDATE depositos SET endereco = 'Rua Principal, 100', responsavel_id = 1 WHERE nome = ? AND endereco IS NULL",
    [DEPOSITO_PADRAO]
  );

  // Equipamentos de exemplo
  const equipamentos = [
    // Microfones com fio
    { codigo: 'MIC0001', tombamento: 'TOMB-2025-000001', nome: 'Microfone Shure SM58', categoria: 'Microfone com Fio', marca: 'Shure', modelo: 'SM58', deposito: 'Depósito Central' },
    { codigo: 'MIC0002', tombamento: 'TOMB-2025-000002', nome: 'Microfone Shure SM58', categoria: 'Microfone com Fio', marca: 'Shure', modelo: 'SM58', deposito: 'Depósito Central' },
    { codigo: 'MIC0003', tombamento: 'TOMB-2025-000003', nome: 'Microfone Sennheiser E835', categoria: 'Microfone com Fio', marca: 'Sennheiser', modelo: 'E835', deposito: 'Depósito Central' },

    // Microfones wireless
    { codigo: 'MIW0001', tombamento: 'TOMB-2025-000004', nome: 'Microfone Wireless Shure', categoria: 'Microfone sem Fio', marca: 'Shure', modelo: 'BLX24', deposito: 'Depósito Central' },
    { codigo: 'MIW0002', tombamento: 'TOMB-2025-000005', nome: 'Microfone Wireless Sennheiser', categoria: 'Microfone sem Fio', marca: 'Sennheiser', modelo: 'EW 135', deposito: 'Depósito Zona Norte' },

    // Caixas de Som
    { codigo: 'CAI0001', tombamento: 'TOMB-2025-000006', nome: 'Caixa JBL PRX815', categoria: 'Caixa de Som', marca: 'JBL', modelo: 'PRX815', deposito: 'Depósito Central' },
    { codigo: 'CAI0002', tombamento: 'TOMB-2025-000007', nome: 'Caixa JBL PRX815', categoria: 'Caixa de Som', marca: 'JBL', modelo: 'PRX815', deposito: 'Depósito Central' },
    { codigo: 'CAI0003', tombamento: 'TOMB-2025-000008', nome: 'Caixa QSC K12.2', categoria: 'Caixa de Som', marca: 'QSC', modelo: 'K12.2', deposito: 'Depósito Zona Norte' },
    { codigo: 'CAI0004', tombamento: 'TOMB-2025-000009', nome: 'Caixa QSC K12.2', categoria: 'Caixa de Som', marca: 'QSC', modelo: 'K12.2', deposito: 'Depósito Zona Norte' },

    // Mesas de Som
    { codigo: 'MES0001', tombamento: 'TOMB-2025-000010', nome: 'Mesa Behringer X32', categoria: 'Mesa de Som', marca: 'Behringer', modelo: 'X32', deposito: 'Depósito Central' },
    { codigo: 'MES0002', tombamento: 'TOMB-2025-000011', nome: 'Mesa Yamaha MG16XU', categoria: 'Mesa de Som', marca: 'Yamaha', modelo: 'MG16XU', deposito: 'Depósito Zona Norte' },

    // Iluminação - Refletores
    { codigo: 'REF0001', tombamento: 'TOMB-2025-000012', nome: 'Refletor LED RGB 200W', categoria: 'Refletor LED', marca: 'Cromus', modelo: 'RGBW-200', deposito: 'Depósito Central' },
    { codigo: 'REF0002', tombamento: 'TOMB-2025-000013', nome: 'Refletor LED RGB 200W', categoria: 'Refletor LED', marca: 'Cromus', modelo: 'RGBW-200', deposito: 'Depósito Central' },

    // Moving Head
    { codigo: 'MOV0001', tombamento: 'TOMB-2025-000014', nome: 'Moving Head Beam', categoria: 'Moving Head', marca: 'Blizzard', modelo: 'Blade RGBW', deposito: 'Depósito Central', condicao: 'regular', observacoes: 'Motor com ruído estranho' },

    // Par LED
    { codigo: 'PAR0001', tombamento: 'TOMB-2025-000015', nome: 'Par LED 54x3W', categoria: 'Par LED', marca: 'Generic', modelo: 'PAR54', deposito: 'Depósito Central' }
  ];

  // Categorias e depósitos são referenciados pelo nome, não por id
  const categorias = await idPorNome('categorias_equipamentos');
  const depositos = await idPorNome('depositos');

  let movingHeadId = null;
  // Categoria renomeada antes do seed: o equipamento de exemplo fica de fora (não quebra a subida)
  for (const eq of equipamentos.filter((item) => categorias.has(item.categoria))) {
    const result = await runAsync(`
      INSERT INTO equipamentos (codigo, tombamento, nome, categoria_id, marca, modelo, deposito_id, condicao, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [eq.codigo, eq.tombamento, eq.nome, categorias.get(eq.categoria), eq.marca, eq.modelo, depositos.get(eq.deposito) ?? null, eq.condicao || 'bom', eq.observacoes || null]);

    if (eq.codigo === 'MOV0001') {
      movingHeadId = result.lastID;
    }
  }

  // Adicionar um problema no Moving Head
  if (movingHeadId) {
    await runAsync(`
      INSERT INTO problemas_equipamentos (equipamento_id, descricao, gravidade, reportado_por)
      VALUES (?, 'Motor fazendo ruído estranho ao movimentar. Pode falhar durante o evento.', 'media', 4)
    `, [movingHeadId]);
  }
}

module.exports = {
  initializeDatabase,
  runAsync,
  getAsync,
  allAsync,
  gerarTombamento,
  gerarCodigo,
  placeholders,
  usePostgres
};
