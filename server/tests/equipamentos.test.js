const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor } = require('./helpers');

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

async function criarEquipamento(extra = {}) {
  const r = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Equipamento de teste', categoria_id: 1, prefixo: 'TST', ...extra }
  });
  assert.strictEqual(r.status, 201, r.text);
  return r.body.id;
}

const obter = async (id) => (await srv.req('GET', `/api/equipamentos/${id}`, { token: t.coordenador })).body;
const reportar = (id, gravidade) =>
  srv.req('POST', `/api/equipamentos/${id}/problemas`, {
    token: t.tecnico,
    body: { descricao: `Problema ${gravidade} de teste`, gravidade }
  });
const resolver = (id, problemaId) =>
  srv.req('PUT', `/api/equipamentos/${id}/problemas/${problemaId}/resolver`, { token: t.coordenador });

test('listagem paginada: limit/page, hasNext e limites do validador', async () => {
  const p1 = await srv.req('GET', '/api/equipamentos?limit=5&page=1', { token: t.coordenador });
  assert.strictEqual(p1.status, 200);
  assert.strictEqual(p1.body.data.length, 5);
  assert.strictEqual(p1.body.pagination.total, 15);
  assert.strictEqual(p1.body.pagination.totalPages, 3);
  assert.strictEqual(p1.body.pagination.hasNext, true);
  assert.strictEqual(p1.body.pagination.hasPrev, false);

  const p3 = await srv.req('GET', '/api/equipamentos?limit=5&page=3', { token: t.coordenador });
  assert.strictEqual(p3.body.pagination.hasNext, false);

  const grande = await srv.req('GET', '/api/equipamentos?limit=101', { token: t.coordenador });
  assert.strictEqual(grande.status, 400);
});

test('busca por texto e filtro de status', async () => {
  const busca = await srv.req('GET', '/api/equipamentos?search=shure', { token: t.coordenador });
  assert.ok(busca.body.data.length >= 3);
  assert.ok(busca.body.data.every((e) => /shure/i.test(`${e.marca} ${e.nome}`)));
});

test('criar equipamento por prefixo gera código sequencial e histórico', async () => {
  const id1 = await criarEquipamento({ prefixo: 'MIC' });
  const eq = await obter(id1);
  assert.strictEqual(eq.codigo, 'MIC0004'); // seed tem MIC0001..MIC0003
  assert.strictEqual(eq.historico[0].tipo_movimentacao, 'criacao');
});

test('criar equipamento: código duplicado, categoria e depósito inexistentes dão 400', async () => {
  const dup = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Duplicado', categoria_id: 1, codigo: 'MIC0001' }
  });
  assert.strictEqual(dup.status, 400);

  const semCategoria = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Sem categoria', categoria_id: 9999, prefixo: 'TST' }
  });
  assert.strictEqual(semCategoria.status, 400);

  const semDeposito = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Sem deposito', categoria_id: 1, prefixo: 'TST', deposito_id: 9999 }
  });
  assert.strictEqual(semDeposito.status, 400);
});

test('etiqueta escapa HTML dos dados do equipamento (XSS armazenado)', async () => {
  const id = await criarEquipamento({
    nome: '<img src=x onerror=alert(1)>',
    marca: '"><script>alert(2)</script>'
  });
  const r = await srv.req('GET', `/api/equipamentos/${id}/etiqueta`, { token: t.coordenador });
  assert.strictEqual(r.status, 200);
  assert.ok(!r.text.includes('<img src=x'), 'tag <img> injetada não deve aparecer crua');
  assert.ok(!r.text.includes('<script>alert(2)'), 'tag <script> injetada não deve aparecer crua');
  assert.ok(r.text.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.match(r.headers.get('content-security-policy') || '', /default-src 'none'/);
  assert.match(r.headers.get('content-type'), /charset=utf-8/i);
});

test('problema grave marca com_problema/condição; resolver restaura só quando não restam graves', async () => {
  const id = await criarEquipamento();

  const alta = await reportar(id, 'alta');
  assert.strictEqual(alta.status, 201);
  let eq = await obter(id);
  assert.strictEqual(eq.status, 'com_problema');
  assert.strictEqual(eq.condicao, 'ruim');

  const critica = await reportar(id, 'critica');
  eq = await obter(id);
  assert.strictEqual(eq.condicao, 'quebrado');

  // Resolver a "alta" não libera: ainda existe a crítica
  await resolver(id, alta.body.id);
  eq = await obter(id);
  assert.strictEqual(eq.status, 'com_problema');

  await resolver(id, critica.body.id);
  eq = await obter(id);
  assert.strictEqual(eq.status, 'disponivel');
  assert.strictEqual(eq.condicao, 'bom');
});

test('problema leve não muda status; resolver problema já resolvido dá 400', async () => {
  const id = await criarEquipamento();
  const leve = await reportar(id, 'baixa');
  assert.strictEqual((await obter(id)).status, 'disponivel');

  assert.strictEqual((await resolver(id, leve.body.id)).status, 200);
  assert.strictEqual((await obter(id)).status, 'disponivel');
  assert.strictEqual((await resolver(id, leve.body.id)).status, 400);
});

test('manutenção é manual: problemas não a sobrescrevem', async () => {
  const id = await criarEquipamento();
  const put = await srv.req('PUT', `/api/equipamentos/${id}`, {
    token: t.coordenador,
    body: { status: 'manutencao' }
  });
  assert.strictEqual(put.status, 200);

  const grave = await reportar(id, 'critica');
  assert.strictEqual((await obter(id)).status, 'manutencao');
  await resolver(id, grave.body.id);
  assert.strictEqual((await obter(id)).status, 'manutencao');

  // Voltar a "disponivel" manualmente recalcula pelo estado real
  await srv.req('PUT', `/api/equipamentos/${id}`, { token: t.coordenador, body: { status: 'disponivel' } });
  assert.strictEqual((await obter(id)).status, 'disponivel');
});

test('atualizar: status controlados pelo sistema não podem ser forçados', async () => {
  const id = await criarEquipamento();
  for (const status of ['em_uso', 'transferencia', 'com_problema']) {
    const r = await srv.req('PUT', `/api/equipamentos/${id}`, { token: t.coordenador, body: { status } });
    assert.strictEqual(r.status, 400, `status ${status} deveria ser recusado`);
  }
  assert.strictEqual((await obter(id)).status, 'disponivel');
});

test('atualizar: permite limpar campos opcionais e valida referências', async () => {
  const id = await criarEquipamento({ marca: 'Marca X', modelo: 'M1' });
  const limpa = await srv.req('PUT', `/api/equipamentos/${id}`, {
    token: t.coordenador,
    body: { marca: '' }
  });
  assert.strictEqual(limpa.status, 200);
  const eq = await obter(id);
  assert.ok(!eq.marca, 'marca deveria ter sido limpa');
  assert.strictEqual(eq.modelo, 'M1');

  const categoriaRuim = await srv.req('PUT', `/api/equipamentos/${id}`, {
    token: t.coordenador,
    body: { categoria_id: 9999 }
  });
  assert.strictEqual(categoriaRuim.status, 400);

  const inexistente = await srv.req('PUT', '/api/equipamentos/999999', {
    token: t.coordenador,
    body: { nome: 'Nada' }
  });
  assert.strictEqual(inexistente.status, 404);
});
