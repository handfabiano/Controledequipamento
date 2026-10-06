const { getAsync } = require('../database/init');

// Usuário ativo ({ id, nome, tipo }) ou undefined
const buscarUsuarioAtivo = (id) =>
  getAsync('SELECT id, nome, tipo FROM usuarios WHERE id = ? AND ativo = 1', [id]);

module.exports = { buscarUsuarioAtivo };
