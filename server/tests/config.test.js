const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

// config.js lê o ambiente ao ser carregado, então cada caso roda em um processo filho
function lerConfig(env) {
  const saida = execFileSync(
    process.execPath,
    ['-e', "console.log(JSON.stringify(require('./config')))"],
    {
      cwd: path.join(__dirname, '..'),
      env: { PATH: process.env.PATH, JWT_SECRET: 'x', ...env },
      encoding: 'utf8'
    }
  );
  return JSON.parse(saida.trim().split('\n').pop());
}

test('trust proxy fica desligado por padrão', () => {
  assert.strictEqual(lerConfig({}).trustProxy, false);
});

test('na Vercel o padrão é confiar em 1 proxy (IP real por usuário no rate limit)', () => {
  assert.strictEqual(lerConfig({ VERCEL: '1' }).trustProxy, 1);
});

test('TRUST_PROXY numérico, "false" e valores do Express', () => {
  assert.strictEqual(lerConfig({ TRUST_PROXY: '2' }).trustProxy, 2);
  assert.strictEqual(lerConfig({ VERCEL: '1', TRUST_PROXY: 'false' }).trustProxy, false);
  assert.strictEqual(lerConfig({ TRUST_PROXY: 'loopback' }).trustProxy, 'loopback');
});

test('TRUST_PROXY=true vira 1 proxy (o "true" do Express confiaria em qualquer cabeçalho)', () => {
  assert.strictEqual(lerConfig({ TRUST_PROXY: 'true' }).trustProxy, 1);
});

test('TRUST_PROXY inválido derruba o boot com mensagem clara', () => {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, ['-e', "require('./index')"], {
    cwd: path.join(__dirname, '..'),
    env: { PATH: process.env.PATH, JWT_SECRET: 'x', TRUST_PROXY: 'talvez' },
    encoding: 'utf8'
  });
  assert.notStrictEqual(r.status, 0);
  assert.match(r.stderr, /TRUST_PROXY inválido/);
});

test('limites de requisição: padrões e valores inválidos', () => {
  const padrao = lerConfig({});
  assert.strictEqual(padrao.rateLimitMax, 300);
  assert.strictEqual(padrao.loginRateLimitMax, 5);

  const custom = lerConfig({ RATE_LIMIT_MAX: '50', LOGIN_RATE_LIMIT_MAX: '10' });
  assert.strictEqual(custom.rateLimitMax, 50);
  assert.strictEqual(custom.loginRateLimitMax, 10);

  const invalido = lerConfig({ RATE_LIMIT_MAX: 'abc', LOGIN_RATE_LIMIT_MAX: '-3' });
  assert.strictEqual(invalido.rateLimitMax, 300);
  assert.strictEqual(invalido.loginRateLimitMax, 5);
});
