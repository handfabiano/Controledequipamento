const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, SENHA_VALIDA } = require('./helpers');

// Sem BOOTSTRAP_TOKEN o cadastro inicial continua aberto (comportamento anterior, opt-in do token)
process.env.SEED_DEMO_DATA = 'false';
delete process.env.BOOTSTRAP_TOKEN;

let srv;
test.before(async () => { srv = await iniciarServidor(); });
test.after(() => srv.fechar());

test('sem BOOTSTRAP_TOKEN o primeiro usuário se cadastra livremente, e só ele', async () => {
  const body = { nome: 'Dono', email: 'dono@x.com', senha: SENHA_VALIDA, tipo: 'coordenador' };
  assert.strictEqual((await srv.req('POST', '/api/auth/register', { body })).status, 201);
  assert.strictEqual((await srv.req('POST', '/api/auth/register', { body: { ...body, email: 'b@x.com' } })).status, 401);
});
