const test = require('node:test');
const assert = require('node:assert');
const { opcoesSsl } = require('../database/ssl');

const REMOTO = 'postgresql://u:p@db.exemplo.com:5432/banco';

test('conexão local não usa TLS', () => {
  assert.strictEqual(opcoesSsl('postgresql://u:p@localhost:5432/banco', {}), false);
  assert.strictEqual(opcoesSsl('postgresql://u:p@127.0.0.1:5432/banco', { DATABASE_SSL_VERIFY: 'true' }), false);
});

test('conexão remota criptografa sem verificar o certificado por padrão (comportamento anterior)', () => {
  assert.deepStrictEqual(opcoesSsl(REMOTO, {}), { rejectUnauthorized: false });
  assert.deepStrictEqual(opcoesSsl(REMOTO, { DATABASE_SSL_VERIFY: 'false' }), { rejectUnauthorized: false });
  assert.deepStrictEqual(opcoesSsl(REMOTO, { DATABASE_SSL_VERIFY: 'talvez' }), { rejectUnauthorized: false });
});

test('DATABASE_SSL_VERIFY=true passa a verificar o certificado do servidor', () => {
  assert.deepStrictEqual(opcoesSsl(REMOTO, { DATABASE_SSL_VERIFY: 'true' }), { rejectUnauthorized: true });
});

test('DATABASE_SSL_CA fornece a autoridade certificadora (\\n literal vira quebra de linha)', () => {
  const ssl = opcoesSsl(REMOTO, {
    DATABASE_SSL_VERIFY: 'true',
    DATABASE_SSL_CA: '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----'
  });
  assert.strictEqual(ssl.rejectUnauthorized, true);
  assert.strictEqual(ssl.ca, '-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----');
});

test('DATABASE_SSL_CA sozinho não liga a verificação', () => {
  assert.deepStrictEqual(opcoesSsl(REMOTO, { DATABASE_SSL_CA: 'qualquer' }), { rejectUnauthorized: false });
});
