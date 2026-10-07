const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, SENHA_VALIDA } = require('./helpers');

// Banco vazio (sem seed) e com BOOTSTRAP_TOKEN: o primeiro cadastro exige o segredo.
// O app lê o ambiente ao ser carregado, então isto vem antes de iniciarServidor().
process.env.SEED_DEMO_DATA = 'false';
process.env.BOOTSTRAP_TOKEN = 'segredo-inicial-de-teste';

let srv;
test.before(async () => { srv = await iniciarServidor(); });
test.after(() => srv.fechar());

const cadastro = (email, { headers, token } = {}) =>
  srv.req('POST', '/api/auth/register', {
    token,
    headers,
    body: { nome: 'Teste', email, senha: SENHA_VALIDA, tipo: 'coordenador' }
  });

test('primeiro cadastro sem o token inicial, ou com um errado, é recusado', async () => {
  for (const headers of [undefined, { 'X-Bootstrap-Token': 'x' }, { 'X-Bootstrap-Token': 'segredo-inicial-de-tesT' }]) {
    const r = await cadastro('invasor@x.com', { headers });
    assert.strictEqual(r.status, 401, JSON.stringify(headers));
    assert.match(r.body.error, /inicial/i);
  }
});

test('com o token inicial certo o primeiro coordenador é criado (e prova que nada foi criado antes)', async () => {
  const r = await cadastro('dono@x.com', { headers: { 'X-Bootstrap-Token': 'segredo-inicial-de-teste' } });
  assert.strictEqual(r.status, 201);
});

test('depois do primeiro usuário o token inicial não abre mais o cadastro; coordenador autenticado cadastra', async () => {
  const comTokenInicial = await cadastro('outro@x.com', { headers: { 'X-Bootstrap-Token': 'segredo-inicial-de-teste' } });
  assert.strictEqual(comTokenInicial.status, 401);
  assert.match(comTokenInicial.body.error, /coordenadores/i, 'recusado pela regra de coordenador, não pela do token inicial');

  const token = await srv.login('dono@x.com', SENHA_VALIDA);
  assert.strictEqual((await cadastro('outro@x.com', { token })).status, 201);
});
