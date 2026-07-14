const { getAsync, allAsync, runAsync } = require('../database/init');

const notificacoesController = {
  // Listar notificações do usuário logado (mais recentes primeiro)
  async listar(req, res) {
    try {
      const { apenas_nao_lidas, limit = 30 } = req.query;

      let query = 'SELECT * FROM notificacoes WHERE usuario_id = ?';
      const params = [req.user.id];

      if (apenas_nao_lidas === 'true') {
        query += ' AND lida = 0';
      }

      query += ' ORDER BY criado_em DESC LIMIT ?';
      params.push(parseInt(limit));

      const notificacoes = await allAsync(query, params);
      res.json(notificacoes);
    } catch (error) {
      console.error('Erro ao listar notificações:', error);
      res.status(500).json({ error: 'Erro ao listar notificações' });
    }
  },

  // Contador de não lidas (para o badge do sino)
  async contarNaoLidas(req, res) {
    try {
      const result = await getAsync(
        'SELECT COUNT(*) as count FROM notificacoes WHERE usuario_id = ? AND lida = 0',
        [req.user.id]
      );
      res.json({ count: result.count });
    } catch (error) {
      console.error('Erro ao contar notificações:', error);
      res.status(500).json({ error: 'Erro ao contar notificações' });
    }
  },

  // Marcar uma notificação como lida
  async marcarLida(req, res) {
    try {
      const { id } = req.params;

      const result = await runAsync(
        'UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?',
        [id, req.user.id]
      );

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Notificação não encontrada' });
      }

      res.json({ message: 'Notificação marcada como lida' });
    } catch (error) {
      console.error('Erro ao marcar notificação:', error);
      res.status(500).json({ error: 'Erro ao marcar notificação' });
    }
  },

  // Marcar todas como lidas
  async marcarTodasLidas(req, res) {
    try {
      await runAsync(
        'UPDATE notificacoes SET lida = 1 WHERE usuario_id = ? AND lida = 0',
        [req.user.id]
      );
      res.json({ message: 'Todas as notificações foram marcadas como lidas' });
    } catch (error) {
      console.error('Erro ao marcar notificações:', error);
      res.status(500).json({ error: 'Erro ao marcar notificações' });
    }
  }
};

module.exports = notificacoesController;
