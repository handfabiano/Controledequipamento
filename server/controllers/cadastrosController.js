const { allAsync, getAsync, runAsync } = require('../database/init');
const { informado, idValido, ErroDeEntrada, textoOuNulo, textoObrigatorio, tratarErros } = require('../services/validacao');
const { buscarUsuarioAtivo } = require('../services/usuarios');

// Mesmos valores do CHECK de categorias_equipamentos.tipo (schema.sql e schema.pg.sql)
const TIPOS_CATEGORIA = ['som', 'iluminacao', 'palco', 'outro'];

const SELECT_DEPOSITO = `
  SELECT d.id, d.nome, d.endereco, d.responsavel_id, u.nome as responsavel_nome, d.criado_em
  FROM depositos d
  LEFT JOIN usuarios u ON d.responsavel_id = u.id`;

// Os selects das telas mostram só o nome: dois registros iguais ficariam indistinguíveis
async function nomeLivre(tabela, nome, mensagem, id = 0) {
  const repetido = await getAsync(`SELECT id FROM ${tabela} WHERE LOWER(nome) = LOWER(?) AND id <> ?`, [nome, id]);
  if (repetido) throw new ErroDeEntrada(mensagem);
  return nome;
}

// Responsável precisa estar ativo; manter o atual vale mesmo que ele tenha sido desativado depois
async function responsavelValido(valor, atual) {
  if (!informado(valor)) return null;
  const id = idValido(valor);
  if (id && id === atual) return id;
  if (!id || !(await buscarUsuarioAtivo(id))) {
    throw new ErroDeEntrada('Responsável não encontrado ou inativo');
  }
  return id;
}

// Criar e editar recebem o registro inteiro (a tela sempre envia todos os campos)
const camposDeposito = async (body, atual = {}) => [
  await nomeLivre('depositos', textoObrigatorio(body.nome, 'Nome', 100), 'Já existe um depósito com esse nome', atual.id),
  textoOuNulo(body.endereco, 'Endereço', 255),
  await responsavelValido(body.responsavel_id, atual.responsavel_id)
];

async function camposCategoria(body, atual = {}) {
  if (!TIPOS_CATEGORIA.includes(body.tipo)) throw new ErroDeEntrada('Tipo de categoria inválido');
  return [
    await nomeLivre('categorias_equipamentos', textoObrigatorio(body.nome, 'Nome', 100), 'Já existe uma categoria com esse nome', atual.id),
    body.tipo,
    textoOuNulo(body.descricao, 'Descrição', 255)
  ];
}

function idDaRota(req) {
  const id = idValido(req.params.id);
  if (!id) throw new ErroDeEntrada('ID inválido');
  return id;
}

const buscarDeposito = (id) => getAsync(`${SELECT_DEPOSITO} WHERE d.id = ?`, [id]);
const buscarCategoria = (id) => getAsync('SELECT * FROM categorias_equipamentos WHERE id = ?', [id]);

const cadastrosController = {
  listarDepositos: tratarErros('Erro ao listar depósitos', async (req, res) => {
    res.json(await allAsync(`${SELECT_DEPOSITO} ORDER BY d.nome`));
  }),

  criarDeposito: tratarErros('Erro ao criar depósito', async (req, res) => {
    const { lastID } = await runAsync(
      'INSERT INTO depositos (nome, endereco, responsavel_id) VALUES (?, ?, ?)',
      await camposDeposito(req.body)
    );
    res.status(201).json(await buscarDeposito(lastID));
  }),

  atualizarDeposito: tratarErros('Erro ao atualizar depósito', async (req, res) => {
    const id = idDaRota(req);
    const atual = await buscarDeposito(id);
    if (!atual) return res.status(404).json({ error: 'Depósito não encontrado' });

    await runAsync(
      'UPDATE depositos SET nome = ?, endereco = ?, responsavel_id = ? WHERE id = ?',
      [...(await camposDeposito(req.body, atual)), id]
    );
    res.json(await buscarDeposito(id));
  }),

  // Sem cache: em produção cada instância serverless teria o seu, e uma edição feita numa
  // não limparia o das outras. A tabela é pequena.
  listarCategorias: tratarErros('Erro ao listar categorias', async (req, res) => {
    res.json(await allAsync('SELECT * FROM categorias_equipamentos ORDER BY tipo, nome'));
  }),

  criarCategoria: tratarErros('Erro ao criar categoria', async (req, res) => {
    const { lastID } = await runAsync(
      'INSERT INTO categorias_equipamentos (nome, tipo, descricao) VALUES (?, ?, ?)',
      await camposCategoria(req.body)
    );
    res.status(201).json(await buscarCategoria(lastID));
  }),

  atualizarCategoria: tratarErros('Erro ao atualizar categoria', async (req, res) => {
    const id = idDaRota(req);
    const atual = await buscarCategoria(id);
    if (!atual) return res.status(404).json({ error: 'Categoria não encontrada' });

    await runAsync(
      'UPDATE categorias_equipamentos SET nome = ?, tipo = ?, descricao = ? WHERE id = ?',
      [...(await camposCategoria(req.body, atual)), id]
    );
    res.json(await buscarCategoria(id));
  })
};

module.exports = cadastrosController;
