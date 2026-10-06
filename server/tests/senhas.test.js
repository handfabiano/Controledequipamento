const test = require('node:test');
const assert = require('node:assert');
const bcrypt = require('bcryptjs');
const { hashSenha, compararSenha, CUSTO_BCRYPT, HASH_FICTICIO } = require('../services/senhas');

test('o hash fictício do login tem o mesmo custo dos hashes reais', async () => {
  assert.strictEqual(bcrypt.getRounds(HASH_FICTICIO), CUSTO_BCRYPT);
  assert.strictEqual(bcrypt.getRounds(await hashSenha('qualquer-senha')), CUSTO_BCRYPT);
});

test('compararSenha confere a senha e nunca aceita quando não há hash', async () => {
  const hash = await hashSenha('senha-segura-9');
  assert.strictEqual(await compararSenha('senha-segura-9', hash), true);
  assert.strictEqual(await compararSenha('outra-senha-1', hash), false);
  assert.strictEqual(await compararSenha('senha-segura-9', undefined), false);
  assert.strictEqual(await compararSenha('senha-segura-9', null), false);
});
