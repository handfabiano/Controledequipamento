// Catálogo básico que todo banco precisa para o sistema funcionar: sem categoria não se cadastra
// equipamento, e a tela de cadastro envia o depósito 1. Diferente do seed de demonstração (init.js),
// vale também em produção. Cada tabela só é preenchida enquanto está vazia: o que for editado
// depois não volta a cada reinício (ver docs/DECISOES.md, D-009).

const { getAsync, allAsync, runAsync } = require('./db');

const CATEGORIAS = [
  ['Microfone com Fio', 'som', 'Microfones profissionais com cabo'],
  ['Microfone sem Fio', 'som', 'Microfones profissionais wireless'],
  ['Caixa de Som', 'som', 'Caixas amplificadas e passivas'],
  ['Mesa de Som', 'som', 'Mesas de mixagem'],
  ['Refletor LED', 'iluminacao', 'Refletores de LED RGB'],
  ['Moving Head', 'iluminacao', 'Iluminação inteligente'],
  ['Par LED', 'iluminacao', 'Iluminação PAR LED'],
  ['Mesa de Luz', 'iluminacao', 'Controlador DMX'],
  ['Palco Modular', 'palco', 'Estrutura de palco'],
  ['Treliça', 'palco', 'Estrutura metálica para suporte']
];

// [nome, tamanho, descrição, checklist: [categoria, quantidade mínima, obrigatório]]
const TEMPLATES = [
  ['Evento Pequeno', 'pequeno', 'Eventos até 100 pessoas', []],
  ['Evento Médio', 'medio', 'Eventos de 100 a 500 pessoas', [
    ['Microfone com Fio', 2, 1],
    ['Microfone sem Fio', 1, 1],
    ['Caixa de Som', 4, 1],
    ['Mesa de Som', 1, 1],
    ['Refletor LED', 4, 0],
    ['Par LED', 8, 0]
  ]],
  ['Evento Grande', 'grande', 'Eventos de 500 a 2000 pessoas', []],
  ['Evento Extra Grande', 'extra_grande', 'Eventos acima de 2000 pessoas', []]
];

const DEPOSITO_PADRAO = 'Depósito Central';

// Uma instrução INSERT com várias linhas: atômica (não deixa a tabela pela metade) e uma viagem só
const inserirLinhas = (tabela, colunas, linhas) =>
  runAsync(
    `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES ${linhas.map(() => `(${colunas.map(() => '?').join(', ')})`).join(', ')}`,
    linhas.flat()
  );

// nome => id de uma tabela com colunas id e nome
const idPorNome = async (tabela) =>
  new Map((await allAsync(`SELECT id, nome FROM ${tabela}`)).map((linha) => [linha.nome, linha.id]));

async function garantirCatalogo() {
  // Uma consulta só: roda a cada cold start e, com o banco já populado, é o único custo
  const existe = await getAsync(`SELECT
    EXISTS (SELECT 1 FROM categorias_equipamentos) AS categorias,
    EXISTS (SELECT 1 FROM templates_eventos) AS templates,
    EXISTS (SELECT 1 FROM depositos) AS depositos`);

  if (!existe.categorias) {
    await inserirLinhas('categorias_equipamentos', ['nome', 'tipo', 'descricao'], CATEGORIAS);
  }

  if (!existe.templates) {
    await inserirLinhas('templates_eventos', ['nome', 'tamanho', 'descricao'], TEMPLATES.map(([nome, tamanho, descricao]) => [nome, tamanho, descricao]));

    const [templates, categorias] = await Promise.all([idPorNome('templates_eventos'), idPorNome('categorias_equipamentos')]);
    // Categoria renomeada ou removida: o item fica de fora (não há a que ligá-lo)
    const itens = TEMPLATES.flatMap(([template, , , checklist]) =>
      checklist
        .filter(([categoria]) => categorias.has(categoria))
        .map(([categoria, quantidade, obrigatorio]) => [templates.get(template), categorias.get(categoria), quantidade, obrigatorio]));
    if (itens.length > 0) {
      await inserirLinhas('checklist_template', ['template_id', 'categoria_id', 'quantidade_minima', 'obrigatorio'], itens);
    }
  }

  if (!existe.depositos) {
    await runAsync('INSERT INTO depositos (nome) VALUES (?)', [DEPOSITO_PADRAO]);
  }
}

module.exports = { garantirCatalogo, idPorNome, DEPOSITO_PADRAO };
