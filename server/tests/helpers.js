// Utilitários para testes de integração: sobem o app Express em porta efêmera,
// com um SQLite temporário e dados de demonstração. Cada arquivo *.test.js roda
// em um processo próprio (node --test), então cada um tem seu banco isolado.
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'equipamentos-test-'));

process.env.NODE_ENV = 'test';
process.env.SQLITE_PATH = path.join(tmpDir, 'test.db');
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.RATE_LIMIT_MAX = '100000';
process.env.LOGIN_RATE_LIMIT_MAX = '100000';
delete process.env.DATABASE_URL;
delete process.env.TRUST_PROXY;
delete process.env.VERCEL;

// Usuários criados pelo seed (senha: 123456)
const USUARIOS = {
  coordenador: { id: 1, email: 'coordenador@sistema.com' },
  entrega: { id: 2, email: 'joao@sistema.com' },
  recebimento: { id: 3, email: 'maria@sistema.com' },
  tecnico: { id: 4, email: 'pedro@sistema.com' }
};

async function iniciarServidor() {
  const app = require('../index');
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

  async function login(email, senha = '123456') {
    const r = await req('POST', '/api/auth/login', { body: { email, senha } });
    if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${r.status} ${r.text}`);
    return r.body.token;
  }

  // Devolve { coordenador, entrega, recebimento, tecnico } => token
  async function tokens() {
    const out = {};
    for (const [papel, u] of Object.entries(USUARIOS)) {
      out[papel] = await login(u.email);
    }
    return out;
  }

  async function fechar() {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return { base, req, login, tokens, fechar };
}

module.exports = { iniciarServidor, USUARIOS };
