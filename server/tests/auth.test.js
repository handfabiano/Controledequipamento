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
    body: { nome: 'Intruso', email: 'intruso@x.com', senha: 'senha-segura-9', tipo: 'coordenador' }
  });
  assert.strictEqual(r.status, 401);
});

test('registro: só coordenador cadastra usuários', async () => {
  const body = { nome: 'Novo', email: 'novo@x.com', senha: 'senha-segura-9', tipo: 'tecnico' };
  const negado = await srv.req('POST', '/api/auth/register', { token: t.tecnico, body });
  assert.strictEqual(negado.status, 403);

  const ok = await srv.req('POST', '/api/auth/register', { token: t.coordenador, body });
  assert.strictEqual(ok.status, 201);
});

test('registro: e-mail duplicado é detectado ignorando maiúsculas', async () => {
  const r = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Dup', email: 'JOAO@SISTEMA.COM', senha: 'senha-segura-9', tipo: 'tecnico' }
  });
  assert.strictEqual(r.status, 400);
});

test('registro: valida formato de e-mail e tipos dos campos (400, não 500)', async () => {
  const emailRuim = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'X', email: 'nao-e-email', senha: 'senha-segura-9', tipo: 'tecnico' }
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
    body: { nome: 'Maiusculo', email: 'Maiusculo@Teste.com', senha: 'senha-segura-9', tipo: 'tecnico' }
  });
  assert.strictEqual(reg.status, 201);
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: 'maiusculo@teste.com', senha: 'senha-segura-9' }
  });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.usuario.email, 'maiusculo@teste.com');
});

// --- Política de senha (A07-003) ---

const registrarComSenha = (senha, extra = {}) =>
  srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Teste Senha', email: `senha${Math.random().toString(36).slice(2)}@x.com`, senha, tipo: 'tecnico', ...extra }
  });

test('registro: senha com menos de 8 caracteres é recusada', async () => {
  const r = await registrarComSenha('abc1234');
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /8 caracteres/);
});

test('registro: senhas comuns são recusadas mesmo com 8+ caracteres', async () => {
  for (const comum of ['12345678', 'password', 'SENHA123', 'Qwerty123', '00000000']) {
    const r = await registrarComSenha(comum);
    assert.strictEqual(r.status, 400, `"${comum}" deveria ser recusada`);
    assert.match(r.body.error, /comum/);
  }
});

test('registro: senha igual ao e-mail ou formada por um só caractere é recusada', async () => {
  const igualEmail = await registrarComSenha('usuario@x.com', { email: 'usuario@x.com' });
  assert.strictEqual(igualEmail.status, 400);

  const repetida = await registrarComSenha('zzzzzzzzzz');
  assert.strictEqual(repetida.status, 400);
});

test('registro: senha acima de 72 bytes é recusada (bcrypt truncaria em silêncio)', async () => {
  const r = await registrarComSenha('a1'.repeat(37)); // 74 bytes
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /72/);
});

test('registro: senha de exatamente 8 caracteres não comum é aceita', async () => {
  const r = await registrarComSenha('tr0ca-me');
  assert.strictEqual(r.status, 201);
});
