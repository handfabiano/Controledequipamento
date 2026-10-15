const { getAsync } = require('../database/init');

// Perfis aceitos pelo CHECK de usuarios.tipo (o client tem os rótulos em client/src/perfis.js)
const TIPOS_USUARIO = ['coordenador', 'responsavel_entrega', 'responsavel_recebimento', 'tecnico'];

// O que a API mostra de um usuário (nunca a senha)
const COLUNAS_PUBLICAS = 'id, nome, email, tipo, ativo, criado_em';

// Linha do banco => usuário da API: só as colunas públicas e ativo como booleano (é INTEGER nos
// dois bancos)
const usuarioPublico = ({ id, nome, email, tipo, ativo, criado_em }) =>
  ({ id, nome, email, tipo, ativo: ativo === 1, criado_em });

// Usuário ativo ({ id, nome, email, tipo }) ou undefined
const buscarUsuarioAtivo = (id) =>
  getAsync('SELECT id, nome, email, tipo FROM usuarios WHERE id = ? AND ativo = 1', [id]);

module.exports = { TIPOS_USUARIO, COLUNAS_PUBLICAS, usuarioPublico, buscarUsuarioAtivo };
