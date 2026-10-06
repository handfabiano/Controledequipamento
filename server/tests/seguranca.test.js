const test = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const { iniciarServidor, USUARIOS, SENHA_SEED, SENHA_VALIDA } = require('./helpers');
const seguranca = require('../services/seguranca');

let srv;
let tokenCoordenador;
let tokenTecnico;
const linhas = [];

test.before(async () => {
  srv = await iniciarServidor();
  tokenCoordenador = await srv.login(USUARIOS.coordenador.email);
  tokenTecnico = await srv.login(USUARIOS.tecnico.email);
  seguranca.definirDestino((linha) => linhas.push(linha));
});
test.after(() => srv.fechar());
test.beforeEach(() => { linhas.length = 0; });

const eventos = (nome) => linhas.map((l) => JSON.parse(l)).filter((e) => e.evento === nome);

test('login válido registra login_sucesso sem token nem senha', async () => {
  const r = await srv.req('POST', '/api/auth/login', {
    body: { email: USUARIOS.coordenador.email, senha: SENHA_SEED }
  });
  assert.strictEqual(r.status, 200);

  const [e] = eventos('login_sucesso');
  assert.ok(e, 'deveria registrar login_sucesso');
  assert.strictEqual(e.usuario_id, USUARIOS.coordenador.id);
  assert.ok(e.ts && e.ip);

  const tudo = linhas.join('\n');
  assert.ok(!tudo.includes(r.body.token), 'o token não pode ir para o log');
  assert.ok(!tudo.includes(SENHA_SEED), 'a senha não pode ir para o log');
});

test('login falho registra o motivo (só no log) e não repete como acesso_negado', async () => {
  const inexistente = await srv.req('POST', '/api/auth/login', {
    body: { email: 'ninguem@sistema.com', senha: 'senha-que-nao-vai-pro-log' }
  });
  const errada = await srv.req('POST', '/api/auth/login', {
    body: { email: USUARIOS.coordenador.email, senha: 'senha-que-nao-vai-pro-log' }
  });
  assert.strictEqual(inexistente.status, 401);
  assert.deepStrictEqual(inexistente.body, errada.body, 'o cliente não deve ver o motivo');

  const falhas = eventos('login_falha');
  assert.deepStrictEqual(falhas.map((e) => e.motivo), ['usuario_inexistente', 'senha_incorreta']);
  assert.strictEqual(falhas[0].email, 'ninguem@sistema.com');
  assert.ok(!linhas.join('\n').includes('senha-que-nao-vai-pro-log'));
  assert.strictEqual(eventos('acesso_negado').length, 0, 'login_falha já cobre esse 401');
});

test('401 e 403 viram acesso_negado com rota sem query string', async () => {
  await srv.req('GET', '/api/equipamentos?search=termo-secreto');
  const [semToken] = eventos('acesso_negado');
  assert.strictEqual(semToken.status, 401);
  assert.strictEqual(semToken.metodo, 'GET');
  assert.strictEqual(semToken.rota, '/api/equipamentos');
  assert.ok(!linhas.join('\n').includes('termo-secreto'));

  linhas.length = 0;
  const negado = await srv.req('POST', '/api/auth/register', {
    token: tokenTecnico,
    body: { nome: 'X', email: 'x@x.com', senha: SENHA_VALIDA, tipo: 'tecnico' }
  });
  assert.strictEqual(negado.status, 403);
  const [proibido] = eventos('acesso_negado');
  assert.strictEqual(proibido.status, 403);
  assert.strictEqual(proibido.usuario_id, USUARIOS.tecnico.id);
});

test('429 também é registrado como acesso_negado', () => {
  const req = { method: 'POST', originalUrl: '/api/auth/login?x=1', ip: '203.0.113.9' };
  const res = Object.assign(new EventEmitter(), { statusCode: 429, locals: {} });
  seguranca.registrarAcessosNegados(req, res, () => {});
  res.emit('finish');
  const [e] = eventos('acesso_negado');
  assert.strictEqual(e.status, 429);
  assert.strictEqual(e.rota, '/api/auth/login');
  assert.strictEqual(e.ip, '203.0.113.9');
});

test('cadastro de usuário registra usuario_criado com quem criou', async () => {
  const r = await srv.req('POST', '/api/auth/register', {
    token: tokenCoordenador,
    body: { nome: 'Auditado', email: 'auditado@x.com', senha: SENHA_VALIDA, tipo: 'tecnico' }
  });
  assert.strictEqual(r.status, 201);
  const [e] = eventos('usuario_criado');
  assert.strictEqual(e.usuario_id, r.body.id);
  assert.strictEqual(e.tipo, 'tecnico');
  assert.strictEqual(e.criado_por, USUARIOS.coordenador.id);
  assert.ok(!linhas.join('\n').includes(SENHA_VALIDA));
});

test('entrada com quebra de linha não forja outra linha de log', async () => {
  await srv.req('POST', '/api/auth/login', {
    body: { email: 'a@x.com\n{"evento":"login_sucesso","usuario_id":1}', senha: 'qualquer' }
  });
  assert.strictEqual(linhas.length, 1, 'uma tentativa = uma linha');
  assert.ok(!linhas[0].includes('\n'));
  assert.strictEqual(eventos('login_sucesso').length, 0);
});

test('campos longos são truncados', () => {
  seguranca.registrar('login_falha', { email: 'a'.repeat(5000) });
  assert.ok(JSON.parse(linhas[0]).email.length <= 200);
});
