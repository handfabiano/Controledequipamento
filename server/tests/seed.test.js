const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { montarBanner } = require('../banner');

// O seed roda ao inicializar o banco, que lê o ambiente ao ser carregado: um processo filho por caso
function contarUsuarios(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));
  try {
    const saida = execFileSync(
      process.execPath,
      ['-e', `
        const { initializeDatabase, getAsync } = require('./database/init');
        initializeDatabase()
          .then(() => getAsync('SELECT COUNT(*) AS n FROM usuarios'))
          .then((r) => console.log('USUARIOS=' + r.n));
      `],
      {
        cwd: path.join(__dirname, '..'),
        env: { PATH: process.env.PATH, JWT_SECRET: 'x', SQLITE_PATH: path.join(dir, 'seed.db'), ...env },
        encoding: 'utf8'
      }
    );
    return Number(/USUARIOS=(\d+)/.exec(saida)[1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('sem NODE_ENV o banco novo nasce sem usuários de demonstração', () => {
  assert.strictEqual(contarUsuarios({}), 0);
});

test('em produção o banco novo nasce sem usuários de demonstração', () => {
  assert.strictEqual(contarUsuarios({ NODE_ENV: 'production' }), 0);
});

test('em desenvolvimento o banco novo recebe os usuários de demonstração', () => {
  assert.strictEqual(contarUsuarios({ NODE_ENV: 'development' }), 4);
});

test('SEED_DEMO_DATA=true força o seed e =false o impede', () => {
  assert.strictEqual(contarUsuarios({ SEED_DEMO_DATA: 'true' }), 4);
  assert.strictEqual(contarUsuarios({ NODE_ENV: 'development', SEED_DEMO_DATA: 'false' }), 0);
});

test('o banner só mostra as credenciais de demonstração quando elas existem', () => {
  const sem = montarBanner({ porta: 3001, credenciaisDemo: false });
  assert.ok(sem.includes('3001'));
  assert.ok(!sem.includes('123456'), 'a senha de demonstração não pode aparecer');
  assert.ok(!sem.includes('@sistema.com'));

  const com = montarBanner({ porta: 3001, credenciaisDemo: true });
  assert.ok(com.includes('coordenador@sistema.com'));
});
