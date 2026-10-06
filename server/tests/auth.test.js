const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS } = require('./helpers');

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

test('login com credenciais válidas retorna token e não vaza a senha', async () => {
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: USUARIOS.coordenador.email, senha: '123456' }
  });
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.token);
  assert.strictEqual(r.body.usuario.senha, undefined);
});

test('login com senha errada retorna 401', async () => {
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: USUARIOS.coordenador.email, senha: 'errada' }
  });
  assert.strictEqual(r.status, 401);
});

test('login ignora diferença de maiúsculas/minúsculas e espaços no e-mail', async () => {
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: '  Coordenador@Sistema.COM ', senha: '123456' }
  });
  assert.strictEqual(r.status, 200);
});

test('login rejeita e-mail/senha que não sejam texto (400, não 500)', async () => {
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: { $ne: null }, senha: ['x'] }
  });
  assert.strictEqual(r.status, 400);
});

test('JSON malformado retorna 400', async () => {
  const r = await srv.req('POST', '/api/auth/login', { body: '{"email": ' });
  assert.strictEqual(r.status, 400);
});

test('rotas protegidas exigem token', async () => {
  const r = await srv.req('GET', '/api/equipamentos');
  assert.strictEqual(r.status, 401);
});

test('registro: sem token é negado depois do primeiro usuário', async () => {
  const r = await srv.req('POST', '/api/auth/register', {
    body: { nome: 'Intruso', email: 'intruso@x.com', senha: 'abcdef', tipo: 'coordenador' }
  });
  assert.strictEqual(r.status, 401);
});

test('registro: só coordenador cadastra usuários', async () => {
  const body = { nome: 'Novo', email: 'novo@x.com', senha: 'abcdef', tipo: 'tecnico' };
  const negado = await srv.req('POST', '/api/auth/register', { token: t.tecnico, body });
  assert.strictEqual(negado.status, 403);

  const ok = await srv.req('POST', '/api/auth/register', { token: t.coordenador, body });
  assert.strictEqual(ok.status, 201);
});

test('registro: e-mail duplicado é detectado ignorando maiúsculas', async () => {
  const r = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Dup', email: 'JOAO@SISTEMA.COM', senha: 'abcdef', tipo: 'tecnico' }
  });
  assert.strictEqual(r.status, 400);
});

test('registro: valida formato de e-mail e tipos dos campos (400, não 500)', async () => {
  const emailRuim = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'X', email: 'nao-e-email', senha: 'abcdef', tipo: 'tecnico' }
  });
  assert.strictEqual(emailRuim.status, 400);

  const senhaNumero = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'X', email: 'x@x.com', senha: 1234567, tipo: 'tecnico' }
  });
  assert.strictEqual(senhaNumero.status, 400);
});

test('registro: e-mail é gravado em minúsculas e permite login', async () => {
  const reg = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Maiusculo', email: 'Maiusculo@Teste.com', senha: 'abcdef', tipo: 'tecnico' }
  });
  assert.strictEqual(reg.status, 201);
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: 'maiusculo@teste.com', senha: 'abcdef' }
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.usuario.email, 'maiusculo@teste.com');
});
