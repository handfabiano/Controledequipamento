// Utilitários para testes de integração: sobem o app Express em porta efêmera,
// com um banco temporário e dados de demonstração. Cada arquivo *.test.js roda
// em um processo próprio (node --test), então cada um tem seu banco isolado.
// Banco: SQLite num diretório temporário; com TEST_DATABASE_URL (Postgres com permissão de criar
// bancos), um banco novo por arquivo, apagado no fim.
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipamentos-test-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_PATH = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.RATE_LIMIT_MAX = '100000';
process.env.LOGIN_RATE_LIMIT_MAX = '100000';
const urlPostgres = process.env.TEST_DATABASE_URL;
const bancoPostgres = urlPostgres && `teste_${process.pid}_${Date.now()}`;
if (bancoPostgres) {
  const url = new URL(urlPostgres);
  url.pathname = `/${bancoPostgres}`;
  process.env.DATABASE_URL = url.toString();
} else {
  // Vazio, e não apagado: o dotenv do index.js só preenche variáveis ausentes, e um DATABASE_URL do
  // .env de quem roda os testes os levaria para o banco de verdade
  process.env.DATABASE_URL = '';
}
delete process.env.TRUST_PROXY;
delete process.env.VERCEL;

// Senha dos usuários do seed e uma senha que cumpre a política de novas senhas
const SENHA_SEED = '123456';
const SENHA_VALIDA = 'senha-segura-9';

// Usuários criados pelo seed (senha: SENHA_SEED)
const USUARIOS = {
  coordenador: { id: 1, email: 'coordenador@sistema.com', tipo: 'coordenador' },
  entrega: { id: 2, email: 'joao@sistema.com', tipo: 'responsavel_entrega' },
  recebimento: { id: 3, email: 'maria@sistema.com', tipo: 'responsavel_recebimento' },
  tecnico: { id: 4, email: 'pedro@sistema.com', tipo: 'tecnico' }
};

// Comando administrativo (criar/apagar o banco do arquivo) pela URL de TEST_DATABASE_URL
async function comandoPostgres(sql) {
  const { Client } = require('pg');
  const { opcoesSsl } = require('../database/ssl');
  const cliente = new Client({ connectionString: urlPostgres, ssl: opcoesSsl(urlPostgres) });
  await cliente.connect();
  try {
    await cliente.query(sql);
  } finally {
    await cliente.end();
  }
}

// Banco Postgres do arquivo (FORCE: derruba conexões que ainda estejam fechando) e diretório temporário
async function apagarRecursos() {
  try {
    if (bancoPostgres) await comandoPostgres(`DROP DATABASE IF EXISTS ${bancoPostgres} WITH (FORCE)`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function iniciarServidor() {
  if (bancoPostgres) await comandoPostgres(`CREATE DATABASE ${bancoPostgres}`);
  let app;
  try {
    app = require('../index');
  } catch (erro) {
    await apagarRecursos();
    throw erro;
  }
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function req(metodo, rota, { token, body, headers = {} } = {}) {
    const resposta = await fetch(`${base}${rota}`, {
      method: metodo,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
    });
    const texto = await resposta.text();
    let json;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      json = undefined;
    }
    return { status: resposta.status, body: json, text: texto, headers: resposta.headers };
  }

  async function login(email, senha = SENHA_SEED) {
    const r = await req('POST', '/api/auth/login', { body: { email, senha } });
    if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${r.status} ${r.text}`);
    return r.body.token;
  }

  // Cadastra um usuário (como coordenador) e devolve { id, token } do novo usuário
  async function criarUsuario({ nome, email, tipo = 'tecnico' }, tokenCoordenador) {
    const r = await req('POST', '/api/auth/register', {
      token: tokenCoordenador,
      body: { nome, email, senha: SENHA_VALIDA, tipo }
    });
    if (r.status !== 201) throw new Error(`Cadastro falhou para ${email}: ${r.status} ${r.text}`);
    return { id: r.body.id, token: await login(email, SENHA_VALIDA) };
  }

  // Devolve { coordenador, entrega, recebimento, tecnico } => token. O JWT é assinado direto: o login
  // custa ~200 ms de bcrypt por usuário e já é exercitado em auth.test.js.
  async function tokens() {
    const { assinar } = require('../services/token'); // depois de iniciarServidor: config lê o ambiente ao carregar
    return Object.fromEntries(
      Object.entries(USUARIOS).map(([papel, u]) => [papel, assinar({ id: u.id, email: u.email, tipo: u.tipo })])
    );
  }

  async function fechar() {
    try {
      await new Promise((resolve) => server.close(resolve));
      await require('../database/db').encerrar();
    } finally {
      await apagarRecursos();
    }
  }

  return { base, req, login, criarUsuario, tokens, fechar };
}

module.exports = { iniciarServidor, USUARIOS, SENHA_SEED, SENHA_VALIDA };
