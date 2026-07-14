const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { usePostgres, runAsync, getAsync, allAsync } = require('./db');

// Seed de demonstração: ativo por padrão fora de produção,
// ou quando SEED_DEMO_DATA=true for definido explicitamente.
const seedHabilitado =
  process.env.SEED_DEMO_DATA === 'true' ||
  (process.env.NODE_ENV !== 'production' && process.env.SEED_DEMO_DATA !== 'false');

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

    const userCount = await getAsync('SELECT COUNT(*) as count FROM usuarios');

    if (userCount.count === 0 && seedHabilitado) {
      console.log('Inserindo dados iniciais de demonstração...');
      await insertInitialData();
      console.log('Dados iniciais inseridos com sucesso!');
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
  const senhaHash = await bcrypt.hash('123456', 10);

  // Usuários
  await runAsync(`
    INSERT INTO usuarios (nome, email, senha, tipo) VALUES
    ('Coordenador Principal', 'coordenador@sistema.com', ?, 'coordenador'),
    ('João Silva', 'joao@sistema.com', ?, 'responsavel_entrega'),
    ('Maria Santos', 'maria@sistema.com', ?, 'responsavel_recebimento'),
    ('Pedro Oliveira', 'pedro@sistema.com', ?, 'tecnico')
  `, [senhaHash, senhaHash, senhaHash, senhaHash]);

  // Depósitos
  await runAsync(`
    INSERT INTO depositos (nome, endereco, responsavel_id) VALUES
    ('Depósito Central', 'Rua Principal, 100', 1),
    ('Depósito Zona Norte', 'Av. Norte, 200', 2),
    ('Depósito Zona Sul', 'Av. Sul, 300', 3)
  `);

  // Categorias de Equipamentos
  await runAsync(`
    INSERT INTO categorias_equipamentos (nome, tipo, descricao) VALUES
    ('Microfone com Fio', 'som', 'Microfones profissionais com cabo'),
    ('Microfone sem Fio', 'som', 'Microfones profissionais wireless'),
    ('Caixa de Som', 'som', 'Caixas amplificadas e passivas'),
    ('Mesa de Som', 'som', 'Mesas de mixagem'),
    ('Refletor LED', 'iluminacao', 'Refletores de LED RGB'),
    ('Moving Head', 'iluminacao', 'Iluminação inteligente'),
    ('Par LED', 'iluminacao', 'Iluminação PAR LED'),
    ('Mesa de Luz', 'iluminacao', 'Controlador DMX'),
    ('Palco Modular', 'palco', 'Estrutura de palco'),
    ('Treliça', 'palco', 'Estrutura metálica para suporte')
  `);

  // Templates de Eventos
  await runAsync(`
    INSERT INTO templates_eventos (nome, tamanho, descricao) VALUES
    ('Evento Pequeno', 'pequeno', 'Eventos até 100 pessoas'),
    ('Evento Médio', 'medio', 'Eventos de 100 a 500 pessoas'),
    ('Evento Grande', 'grande', 'Eventos de 500 a 2000 pessoas'),
    ('Evento Extra Grande', 'extra_grande', 'Eventos acima de 2000 pessoas')
  `);

  // Checklists para Evento Médio
  await runAsync(`
    INSERT INTO checklist_template (template_id, categoria_id, quantidade_minima, obrigatorio) VALUES
    (2, 1, 2, 1),
    (2, 2, 1, 1),
    (2, 3, 4, 1),
    (2, 4, 1, 1),
    (2, 5, 4, 0),
    (2, 7, 8, 0)
  `);

  // Equipamentos de exemplo
  const equipamentos = [
    // Microfones com fio
    { codigo: 'MIC0001', tombamento: 'TOMB-2025-000001', nome: 'Microfone Shure SM58', categoria_id: 1, marca: 'Shure', modelo: 'SM58', deposito_id: 1 },
    { codigo: 'MIC0002', tombamento: 'TOMB-2025-000002', nome: 'Microfone Shure SM58', categoria_id: 1, marca: 'Shure', modelo: 'SM58', deposito_id: 1 },
    { codigo: 'MIC0003', tombamento: 'TOMB-2025-000003', nome: 'Microfone Sennheiser E835', categoria_id: 1, marca: 'Sennheiser', modelo: 'E835', deposito_id: 1 },

    // Microfones wireless
    { codigo: 'MIW0001', tombamento: 'TOMB-2025-000004', nome: 'Microfone Wireless Shure', categoria_id: 2, marca: 'Shure', modelo: 'BLX24', deposito_id: 1 },
    { codigo: 'MIW0002', tombamento: 'TOMB-2025-000005', nome: 'Microfone Wireless Sennheiser', categoria_id: 2, marca: 'Sennheiser', modelo: 'EW 135', deposito_id: 2 },

    // Caixas de Som
    { codigo: 'CAI0001', tombamento: 'TOMB-2025-000006', nome: 'Caixa JBL PRX815', categoria_id: 3, marca: 'JBL', modelo: 'PRX815', deposito_id: 1 },
    { codigo: 'CAI0002', tombamento: 'TOMB-2025-000007', nome: 'Caixa JBL PRX815', categoria_id: 3, marca: 'JBL', modelo: 'PRX815', deposito_id: 1 },
    { codigo: 'CAI0003', tombamento: 'TOMB-2025-000008', nome: 'Caixa QSC K12.2', categoria_id: 3, marca: 'QSC', modelo: 'K12.2', deposito_id: 2 },
    { codigo: 'CAI0004', tombamento: 'TOMB-2025-000009', nome: 'Caixa QSC K12.2', categoria_id: 3, marca: 'QSC', modelo: 'K12.2', deposito_id: 2 },

    // Mesas de Som
    { codigo: 'MES0001', tombamento: 'TOMB-2025-000010', nome: 'Mesa Behringer X32', categoria_id: 4, marca: 'Behringer', modelo: 'X32', deposito_id: 1 },
    { codigo: 'MES0002', tombamento: 'TOMB-2025-000011', nome: 'Mesa Yamaha MG16XU', categoria_id: 4, marca: 'Yamaha', modelo: 'MG16XU', deposito_id: 2 },

    // Iluminação - Refletores
    { codigo: 'REF0001', tombamento: 'TOMB-2025-000012', nome: 'Refletor LED RGB 200W', categoria_id: 5, marca: 'Cromus', modelo: 'RGBW-200', deposito_id: 1 },
    { codigo: 'REF0002', tombamento: 'TOMB-2025-000013', nome: 'Refletor LED RGB 200W', categoria_id: 5, marca: 'Cromus', modelo: 'RGBW-200', deposito_id: 1 },

    // Moving Head
    { codigo: 'MOV0001', tombamento: 'TOMB-2025-000014', nome: 'Moving Head Beam', categoria_id: 6, marca: 'Blizzard', modelo: 'Blade RGBW', deposito_id: 1, condicao: 'regular', observacoes: 'Motor com ruído estranho' },

    // Par LED
    { codigo: 'PAR0001', tombamento: 'TOMB-2025-000015', nome: 'Par LED 54x3W', categoria_id: 7, marca: 'Generic', modelo: 'PAR54', deposito_id: 1 }
  ];

  let movingHeadId = null;
  for (const eq of equipamentos) {
    const result = await runAsync(`
      INSERT INTO equipamentos (codigo, tombamento, nome, categoria_id, marca, modelo, deposito_id, condicao, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [eq.codigo, eq.tombamento, eq.nome, eq.categoria_id, eq.marca, eq.modelo, eq.deposito_id, eq.condicao || 'bom', eq.observacoes || null]);

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
  usePostgres
};
