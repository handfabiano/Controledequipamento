const { runAsync } = require('../database/init');

// Registra uma movimentação no histórico do equipamento
const registrarMovimentacao = ({ equipamentoId, tipo, origem = null, destino = null, usuarioId, observacoes = null }) =>
  runAsync(
    `INSERT INTO historico_movimentacoes
     (equipamento_id, tipo_movimentacao, origem, destino, usuario_id, observacoes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [equipamentoId, tipo, origem, destino, usuarioId, observacoes]
  );

module.exports = { registrarMovimentacao };
