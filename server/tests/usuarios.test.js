const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS, SENHA_VALIDA } = require('./helpers');

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

const loginStatus = async (email, senha) => (await srv.req('POST', '/api/auth/login', { body: { email, senha } })).status;
const definirAtivo = (id, ativo, token = t.coordenador) =>
  srv.req('PUT', `/api/usuarios/${id}/ativo`, { token, body: { ativo } });

test('coordenador lista os usuários, sem a senha', async () => {
  const r = await srv.req('GET', '/api/usuarios', { token: t.coordenador });
  assert.strictEqual(r.status, 200, r.text);
  const coordenador = r.body.find((u) => u.id === USUARIOS.coordenador.id);
  assert.ok(coordenador, 'coordenador do seed na lista');
  assert.strictEqual(coordenador.email, USUARIOS.coordenador.email);
  assert.ok(r.body.every((u) => !('senha' in u)), 'a lista não pode trazer o hash da senha');
  assert.ok(r.body.every((u) => typeof u.ativo === 'boolean'), 'ativo vem como booleano nos dois drivers');
});

test('só coordenador lista usuários', async () => {
  for (const papel of ['entrega', 'recebimento', 'tecnico']) {
    assert.strictEqual((await srv.req('GET', '/api/usuarios', { token: t[papel] })).status, 403, papel);
  }
  assert.strictEqual((await srv.req('GET', '/api/usuarios')).status, 401);
});

test('usuário cadastrado pelo coordenador aparece na lista', async () => {
  const { id } = await srv.criarUsuario({ nome: 'Novo Técnico', email: 'novo.tecnico@x.com' }, t.coordenador);
  const { body } = await srv.req('GET', '/api/usuarios', { token: t.coordenador });
  assert.deepStrictEqual(
    (({ nome, email, tipo, ativo }) => ({ nome, email, tipo, ativo }))(body.find((u) => u.id === id)),
    { nome: 'Novo Técnico', email: 'novo.tecnico@x.com', tipo: 'tecnico', ativo: true }
  );
});

test('usuário desativado não loga; reativado volta a logar', async () => {
  const email = 'desativado@x.com';
  const { id } = await srv.criarUsuario({ nome: 'Vai Sair', email }, t.coordenador);

  const desativar = await definirAtivo(id, false);
  assert.strictEqual(desativar.status, 200, desativar.text);
  assert.strictEqual(desativar.body.ativo, false);
  assert.strictEqual(await loginStatus(email, SENHA_VALIDA), 401);

  const reativar = await definirAtivo(id, true);
  assert.strictEqual(reativar.status, 200, reativar.text);
  assert.strictEqual(await loginStatus(email, SENHA_VALIDA), 200);
});

test('só coordenador ativa ou desativa usuários', async () => {
  const { id } = await srv.criarUsuario({ nome: 'Alvo', email: 'alvo@x.com' }, t.coordenador);
  for (const papel of ['entrega', 'recebimento', 'tecnico']) {
    assert.strictEqual((await definirAtivo(id, false, t[papel])).status, 403, papel);
  }
  assert.strictEqual(await loginStatus('alvo@x.com', SENHA_VALIDA), 200, 'continua ativo');
});

test('coordenador não desativa a própria conta', async () => {
  const r = await definirAtivo(USUARIOS.coordenador.id, false);
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /própria conta/);
});

test('desativar valida o corpo e o usuário', async () => {
  assert.strictEqual((await definirAtivo(USUARIOS.tecnico.id, 'nao')).status, 400, 'ativo precisa ser booleano');
  assert.strictEqual((await definirAtivo(USUARIOS.tecnico.id, undefined)).status, 400, 'ativo é obrigatório');
  assert.strictEqual((await definirAtivo(99999, false)).status, 404);
  assert.strictEqual((await definirAtivo('abc', false)).status, 400);
});

test('troca da própria senha: exige a senha atual e aplica a política', async () => {
  const email = 'troca@x.com';
  const { token } = await srv.criarUsuario({ nome: 'Troca', email }, t.coordenador);
  const trocar = (body, tk = token) => srv.req('PUT', '/api/auth/senha', { token: tk, body });
  const nova = 'outra-senha-forte-7';

  const errada = await trocar({ senha_atual: 'senha-errada-1', nova_senha: nova });
  // 400 e não 401: o client trata 401 como sessão expirada e desloga
  assert.strictEqual(errada.status, 400);
  assert.match(errada.body.error, /Senha atual incorreta/);

  assert.strictEqual((await trocar({ senha_atual: SENHA_VALIDA, nova_senha: '1234' })).status, 400, 'senha curta');
  assert.strictEqual((await trocar({ senha_atual: SENHA_VALIDA, nova_senha: SENHA_VALIDA })).status, 400, 'igual à atual');
  assert.strictEqual((await trocar({ senha_atual: SENHA_VALIDA })).status, 400, 'nova obrigatória');
  assert.strictEqual((await trocar({ senha_atual: 1, nova_senha: nova })).status, 400, 'texto');
  assert.strictEqual(await loginStatus(email, SENHA_VALIDA), 200, 'tentativas recusadas não mudam a senha');

  const ok = await trocar({ senha_atual: SENHA_VALIDA, nova_senha: nova });
  assert.strictEqual(ok.status, 200, ok.text);
  assert.strictEqual(await loginStatus(email, SENHA_VALIDA), 401, 'a senha antiga deixa de valer');
  assert.strictEqual(await loginStatus(email, nova), 200);
});

test('troca de senha exige login e conta ativa', async () => {
  assert.strictEqual((await srv.req('PUT', '/api/auth/senha', { body: { senha_atual: 'x', nova_senha: 'y' } })).status, 401);

  const { id, token } = await srv.criarUsuario({ nome: 'Inativo', email: 'inativo@x.com' }, t.coordenador);
  await definirAtivo(id, false);
  const r = await srv.req('PUT', '/api/auth/senha', { token, body: { senha_atual: SENHA_VALIDA, nova_senha: 'outra-senha-forte-7' } });
  assert.strictEqual(r.status, 401, 'conta desativada não troca a senha com um token antigo');
});

// R-023: desativar encerra as sessões abertas e o perfil vale pelo banco, não pelo token
test('token de usuário desativado deixa de valer em todas as rotas', async () => {
  const { id, token } = await srv.criarUsuario({ nome: 'Sessão Aberta', email: 'sessao@x.com' }, t.coordenador);
  assert.strictEqual((await srv.req('GET', '/api/dashboard/resumo', { token })).status, 200);

  await definirAtivo(id, false);
  const r = await srv.req('GET', '/api/dashboard/resumo', { token });
  assert.strictEqual(r.status, 401);
  assert.strictEqual((await srv.req('GET', '/api/auth/me', { token })).status, 401);

  await definirAtivo(id, true);
  assert.strictEqual((await srv.req('GET', '/api/auth/me', { token })).status, 200, 'reativado, o token volta a valer');
});

test('coordenador desativado não age com o token antigo', async () => {
  const { id, token } = await srv.criarUsuario({ nome: 'Ex Coordenador', email: 'ex.coord@x.com', tipo: 'coordenador' }, t.coordenador);
  await definirAtivo(id, false);

  assert.strictEqual((await definirAtivo(USUARIOS.coordenador.id, false, token)).status, 401, 'não derruba quem o desativou');
  const cadastro = await srv.req('POST', '/api/auth/register', {
    token, body: { nome: 'Intruso', email: 'intruso@x.com', senha: SENHA_VALIDA, tipo: 'coordenador' }
  });
  assert.strictEqual(cadastro.status, 401, 'nem cadastra outro coordenador');
  assert.strictEqual(await loginStatus(USUARIOS.coordenador.email, '123456'), 200);
});

test('token de usuário inexistente não vale', async () => {
  const { assinar } = require('../services/token');
  const fantasma = assinar({ id: 99999, email: 'fantasma@x.com', tipo: 'coordenador' });
  assert.strictEqual((await srv.req('GET', '/api/usuarios', { token: fantasma })).status, 401);
});
