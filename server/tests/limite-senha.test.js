const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, SENHA_VALIDA } = require('./helpers');

// O app lê o ambiente ao ser carregado: limite baixo só neste processo
process.env.LOGIN_RATE_LIMIT_MAX = '2';

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

const trocar = (token, senhaAtual) =>
  srv.req('PUT', '/api/auth/senha', { token, body: { senha_atual: senhaAtual, nova_senha: 'outra-senha-forte-7' } });

test('nova senha fraca não conta como tentativa', async () => {
  for (let i = 0; i < 3; i++) {
    const r = await srv.req('PUT', '/api/auth/senha', { token: t.recebimento, body: { senha_atual: '123456', nova_senha: '1234' } });
    assert.strictEqual(r.status, 400, `tentativa ${i + 1}`);
  }
});

test('tentativas erradas de troca de senha são limitadas por usuário, sem bloquear o login', async () => {
  assert.strictEqual((await trocar(t.tecnico, 'errada-1')).status, 400);
  assert.strictEqual((await trocar(t.tecnico, 'errada-2')).status, 400);
  const bloqueada = await trocar(t.tecnico, SENHA_VALIDA);
  assert.strictEqual(bloqueada.status, 429);
  assert.match(bloqueada.body.error, /troca de senha/);

  // Mesmo IP, outro usuário: contador próprio
  assert.strictEqual((await trocar(t.entrega, 'errada-1')).status, 400);
  // O login tem contador separado
  assert.strictEqual((await srv.req('POST', '/api/auth/login', { body: { email: 'pedro@sistema.com', senha: '123456' } })).status, 200);
});
