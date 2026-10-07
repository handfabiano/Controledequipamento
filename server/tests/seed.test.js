const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rodarNoServidor } = require('./processo-filho');
const { montarBanner } = require('../banner');

// A tabela env → seedDemoData está em config.test.js; aqui só se confere que o init.js a respeita
function contarUsuarios(env) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-test-'));
  try {
    const saida = rodarNoServidor(`
      const { initializeDatabase, getAsync } = require('./database/init');
      initializeDatabase()
        .then(() => getAsync('SELECT COUNT(*) AS n FROM usuarios'))
        .then((r) => console.log('USUARIOS=' + r.n));
    `, { SQLITE_PATH: path.join(dir, 'seed.db'), ...env });
    return Number(/USUARIOS=(\d+)/.exec(saida)[1]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('sem NODE_ENV o banco novo nasce sem usuários de demonstração', () => {
  assert.strictEqual(contarUsuarios({}), 0);
});

test('com seed habilitado o banco novo recebe os usuários de demonstração', () => {
  assert.strictEqual(contarUsuarios({ SEED_DEMO_DATA: 'true' }), 4);
});

test('o banner só mostra as credenciais de demonstração quando elas existem', () => {
  const sem = montarBanner({ porta: 3001, credenciaisDemo: false });
  assert.ok(sem.includes('3001'));
  assert.ok(!sem.includes('123456') && !sem.includes('@sistema.com'), 'nenhuma credencial no banner');

  assert.ok(montarBanner({ porta: 3001, credenciaisDemo: true }).includes('coordenador@sistema.com'));
});
