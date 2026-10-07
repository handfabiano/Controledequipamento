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

const cadastro = (nome, email, headers = {}, token) =>
  srv.req('POST', '/api/auth/register', {
    token,
    headers,
    body: { nome, email, senha: SENHA_VALIDA, tipo: 'coordenador' }
  });

test('primeiro cadastro sem o token inicial é recusado e nada é criado', async () => {
  const r = await cadastro('Invasor', 'invasor@x.com');
  assert.strictEqual(r.status, 401);
  assert.match(r.body.error, /inicial/i);
});

test('primeiro cadastro com token inicial errado é recusado', async () => {
  for (const errado of ['segredo-inicial-de-tesT', 'x', 'segredo-inicial-de-teste-e-mais']) {
    const r = await cadastro('Invasor', 'invasor@x.com', { 'X-Bootstrap-Token': errado });
    assert.strictEqual(r.status, 401, errado);
  }
  const login = await srv.req('POST', '/api/auth/login', { body: { email: 'invasor@x.com', senha: SENHA_VALIDA } });
  assert.strictEqual(login.status, 401, 'nenhum usuário pode ter sido criado');
});

test('com o token inicial certo o primeiro coordenador é criado', async () => {
  const r = await cadastro('Dono', 'dono@x.com', { 'X-Bootstrap-Token': 'segredo-inicial-de-teste' });
  assert.strictEqual(r.status, 201);
});

test('depois do primeiro usuário o token inicial não abre mais o cadastro', async () => {
  const r = await cadastro('Outro', 'outro@x.com', { 'X-Bootstrap-Token': 'segredo-inicial-de-teste' });
  assert.strictEqual(r.status, 401, 'agora só coordenador autenticado cadastra');

  const token = await srv.login('dono@x.com', SENHA_VALIDA);
  const ok = await cadastro('Outro', 'outro@x.com', {}, token);
  assert.strictEqual(ok.status, 201);
});
