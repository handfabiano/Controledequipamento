const { runAsync } = require('../database/init');

// Cria uma notificação para um usuário. Falhas são logadas mas não
// interrompem o fluxo principal (notificação é efeito colateral).
async function criarNotificacao(usuarioId, tipo, titulo, mensagem, link = null) {
  if (!usuarioId) return;

  try {
    await runAsync(
      'INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem, link) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, tipo, titulo, mensagem, link]
    );
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
  }
}

// Notifica vários usuários de uma vez, ignorando ids nulos e duplicados
async function notificarUsuarios(usuarioIds, tipo, titulo, mensagem, link = null) {
  const ids = [...new Set(usuarioIds.filter(Boolean))];
  for (const id of ids) {
    await criarNotificacao(id, tipo, titulo, mensagem, link);
  }
}

module.exports = { criarNotificacao, notificarUsuarios };
