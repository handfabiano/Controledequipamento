const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor } = require('./helpers');

// Banco de produção recém-criado: sem dados de demonstração. Mesmo assim o sistema precisa
// nascer com o catálogo básico (categorias, templates e um depósito), senão não há como
// cadastrar o primeiro equipamento. O app lê o ambiente ao ser carregado.
process.env.SEED_DEMO_DATA = 'false';

let srv;
let token;

test.before(async () => {
  srv = await iniciarServidor();
  ({ token } = await srv.criarUsuario({ nome: 'Dona', email: 'dona@x.com', tipo: 'coordenador' }));
});
test.after(() => srv.fechar());

test('banco novo sem dados de demonstração já tem categorias', async () => {
  const r = await srv.req('GET', '/api/equipamentos/categorias', { token });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.length > 0, 'nenhuma categoria no banco novo');
});

test('banco novo tem templates de evento com checklist', async () => {
  const r = await srv.req('GET', '/api/eventos/templates', { token });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.length > 0, 'nenhum template no banco novo');
  assert.ok(r.body.some((t) => t.checklist.length > 0), 'nenhum template com checklist');
});

test('primeiro equipamento é cadastrado no depósito padrão (o que a tela envia)', async () => {
  const { body: categorias } = await srv.req('GET', '/api/equipamentos/categorias', { token });
  const r = await srv.req('POST', '/api/equipamentos', {
    token,
    body: { prefixo: 'MIC', nome: 'Microfone de teste', categoria_id: categorias[0].id, deposito_id: 1 }
  });
  assert.strictEqual(r.status, 201, r.text);
  assert.strictEqual(r.body.codigo, 'MIC0001');
});

test('reiniciar não duplica o catálogo', async () => {
  const { initializeDatabase, getAsync } = require('../database/init');
  const contar = async () => (await Promise.all(
    ['categorias_equipamentos', 'templates_eventos', 'checklist_template', 'depositos']
      .map((tabela) => getAsync(`SELECT COUNT(*) AS n FROM ${tabela}`))
  )).map((linha) => linha.n);

  const antes = await contar();
  await initializeDatabase();
  assert.deepStrictEqual(await contar(), antes);
});

test('catálogo editado depois não é recriado ao reiniciar', async () => {
  const { initializeDatabase, getAsync, runAsync } = require('../database/init');
  await runAsync("UPDATE categorias_equipamentos SET nome = 'Microfone (renomeado)' WHERE nome = 'Microfone com Fio'");
  await initializeDatabase();
  const r = await getAsync("SELECT COUNT(*) AS n FROM categorias_equipamentos WHERE nome = 'Microfone com Fio'");
  assert.strictEqual(r.n, 0);
});
