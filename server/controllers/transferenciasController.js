const { db, getAsync, allAsync, runAsync } = require('../database/init');

const transferenciasController = {
  // Listar transferências
  async listar(req, res) {
    try {
      const { status } = req.query;
      const userId = req.user.id;

      let query = `
        SELECT t.*,
               e.codigo as equipamento_codigo, e.nome as equipamento_nome,
               sol.nome as solicitante_nome,
               ent.nome as responsavel_entrega_nome,
               rec.nome as responsavel_recebimento_nome,
               coord.nome as coordenador_nome
        FROM transferencias t
        LEFT JOIN equipamentos e ON t.equipamento_id = e.id
        LEFT JOIN usuarios sol ON t.solicitante_id = sol.id
        LEFT JOIN usuarios ent ON t.responsavel_entrega_id = ent.id
        LEFT JOIN usuarios rec ON t.responsavel_recebimento_id = rec.id
        LEFT JOIN usuarios coord ON t.coordenador_id = coord.id
        WHERE (t.solicitante_id = ? OR t.responsavel_entrega_id = ? OR
               t.responsavel_recebimento_id = ? OR t.coordenador_id = ?)
      `;

      const params = [userId, userId, userId, userId];

      if (status) {
        query += ' AND t.status = ?';
        params.push(status);
      }

      query += ' ORDER BY t.data_solicitacao DESC';

      const transferencias = await allAsync(query, params);
      res.json(transferencias);
    } catch (error) {
      console.error('Erro ao listar transferências:', error);
      res.status(500).json({ error: 'Erro ao listar transferências' });
    }
  },

  // Buscar transferência por ID
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      const transferencia = await getAsync(`
        SELECT t.*,
               e.codigo as equipamento_codigo, e.nome as equipamento_nome, e.status as equipamento_status,
               sol.nome as solicitante_nome, sol.email as solicitante_email,
               ent.nome as responsavel_entrega_nome, ent.email as responsavel_entrega_email,
               rec.nome as responsavel_recebimento_nome, rec.email as responsavel_recebimento_email,
               coord.nome as coordenador_nome, coord.email as coordenador_email
        FROM transferencias t
        LEFT JOIN equipamentos e ON t.equipamento_id = e.id
        LEFT JOIN usuarios sol ON t.solicitante_id = sol.id
        LEFT JOIN usuarios ent ON t.responsavel_entrega_id = ent.id
        LEFT JOIN usuarios rec ON t.responsavel_recebimento_id = rec.id
        LEFT JOIN usuarios coord ON t.coordenador_id = coord.id
        WHERE t.id = ?
      `, [id]);

      if (!transferencia) {
        return res.status(404).json({ error: 'Transferência não encontrada' });
      }

      res.json(transferencia);
    } catch (error) {
      console.error('Erro ao buscar transferência:', error);
      res.status(500).json({ error: 'Erro ao buscar transferência' });
    }
  },

  // Criar transferência
  async criar(req, res) {
    try {
      const {
        equipamento_id,
        origem_tipo,
        origem_id,
        destino_tipo,
        destino_id,
        responsavel_entrega_id,
        responsavel_recebimento_id,
        coordenador_id,
        motivo,
        observacoes
      } = req.body;

      if (!equipamento_id || !origem_tipo || !destino_tipo || !destino_id) {
        return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
      }

      // Verificar se equipamento existe e está disponível para transferência
      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [equipamento_id]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      if (equipamento.status === 'manutencao') {
        return res.status(400).json({ error: 'Equipamento em manutenção não pode ser transferido' });
      }

      db.run(
        `INSERT INTO transferencias
         (equipamento_id, origem_tipo, origem_id, destino_tipo, destino_id,
          solicitante_id, responsavel_entrega_id, responsavel_recebimento_id,
          coordenador_id, motivo, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [equipamento_id, origem_tipo, origem_id || null, destino_tipo, destino_id,
         req.user.id, responsavel_entrega_id || null, responsavel_recebimento_id || null,
         coordenador_id || null, motivo || null, observacoes || null],
        async function(err) {
          if (err) {
            console.error('Erro ao criar transferência:', err);
            return res.status(500).json({ error: 'Erro ao criar transferência' });
          }

          // Atualizar status do equipamento
          await runAsync(
            'UPDATE equipamentos SET status = ? WHERE id = ?',
            ['transferencia', equipamento_id]
          );

          res.status(201).json({
            message: 'Transferência solicitada com sucesso',
            id: this.lastID
          });
        }
      );
    } catch (error) {
      console.error('Erro ao criar transferência:', error);
      res.status(500).json({ error: 'Erro ao criar transferência' });
    }
  },

  // Aprovar transferência (coordenador, entrega ou recebimento)
  async aprovar(req, res) {
    try {
      const { id } = req.params;
      const { tipo_aprovacao } = req.body; // 'coordenador', 'entrega', 'recebimento'
      const userId = req.user.id;

      const transferencia = await getAsync('SELECT * FROM transferencias WHERE id = ?', [id]);

      if (!transferencia) {
        return res.status(404).json({ error: 'Transferência não encontrada' });
      }

      if (transferencia.status === 'concluida' || transferencia.status === 'cancelada') {
        return res.status(400).json({ error: 'Transferência já finalizada' });
      }

      let updates = {};
      let novoStatus = transferencia.status;

      switch (tipo_aprovacao) {
        case 'coordenador':
          if (transferencia.coordenador_id && transferencia.coordenador_id !== userId) {
            return res.status(403).json({ error: 'Você não é o coordenador desta transferência' });
          }
          updates.aprovacao_coordenador = 1;
          novoStatus = 'aprovada_coordenador';
          break;

        case 'entrega':
          if (transferencia.responsavel_entrega_id && transferencia.responsavel_entrega_id !== userId) {
            return res.status(403).json({ error: 'Você não é o responsável pela entrega' });
          }
          updates.aprovacao_entrega = 1;
          if (transferencia.aprovacao_coordenador) {
            novoStatus = 'em_transito';
          }
          break;

        case 'recebimento':
          if (transferencia.responsavel_recebimento_id && transferencia.responsavel_recebimento_id !== userId) {
            return res.status(403).json({ error: 'Você não é o responsável pelo recebimento' });
          }
          updates.aprovacao_recebimento = 1;
          // Se todas as aprovações foram dadas, concluir transferência
          if (transferencia.aprovacao_coordenador && transferencia.aprovacao_entrega) {
            novoStatus = 'concluida';
            updates.data_conclusao = new Date().toISOString();

            // Atualizar localização do equipamento
            await runAsync(
              'UPDATE equipamentos SET deposito_id = ?, status = ? WHERE id = ?',
              [transferencia.destino_tipo === 'deposito' ? transferencia.destino_id : null,
               'disponivel',
               transferencia.equipamento_id]
            );

            // Registrar no histórico
            await runAsync(
              `INSERT INTO historico_movimentacoes
               (equipamento_id, tipo_movimentacao, origem, destino, usuario_id, observacoes)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [transferencia.equipamento_id,
               'transferencia',
               `${transferencia.origem_tipo}: ${transferencia.origem_id || 'N/A'}`,
               `${transferencia.destino_tipo}: ${transferencia.destino_id}`,
               userId,
               `Transferência #${id} concluída`]
            );
          }
          break;

        default:
          return res.status(400).json({ error: 'Tipo de aprovação inválido' });
      }

      const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updates), novoStatus];

      if (!transferencia.data_aprovacao && tipo_aprovacao === 'coordenador') {
        await runAsync(
          `UPDATE transferencias SET ${setClauses}, status = ?, data_aprovacao = CURRENT_TIMESTAMP WHERE id = ?`,
          [...values, id]
        );
      } else {
        await runAsync(
          `UPDATE transferencias SET ${setClauses}, status = ? WHERE id = ?`,
          [...values, id]
        );
      }

      res.json({ message: 'Aprovação registrada com sucesso', status: novoStatus });
    } catch (error) {
      console.error('Erro ao aprovar transferência:', error);
      res.status(500).json({ error: 'Erro ao aprovar transferência' });
    }
  },

  // Cancelar transferência
  async cancelar(req, res) {
    try {
      const { id } = req.params;
      const { motivo } = req.body;
      const userId = req.user.id;

      const transferencia = await getAsync('SELECT * FROM transferencias WHERE id = ?', [id]);

      if (!transferencia) {
        return res.status(404).json({ error: 'Transferência não encontrada' });
      }

      if (transferencia.status === 'concluida') {
        return res.status(400).json({ error: 'Não é possível cancelar transferência concluída' });
      }

      // Apenas coordenador ou solicitante podem cancelar
      if (req.user.tipo !== 'coordenador' && transferencia.solicitante_id !== userId) {
        return res.status(403).json({ error: 'Sem permissão para cancelar esta transferência' });
      }

      await runAsync(
        'UPDATE transferencias SET status = ?, observacoes = ? WHERE id = ?',
        ['cancelada', motivo || transferencia.observacoes, id]
      );

      // Restaurar status do equipamento
      await runAsync(
        'UPDATE equipamentos SET status = ? WHERE id = ?',
        ['disponivel', transferencia.equipamento_id]
      );

      res.json({ message: 'Transferência cancelada com sucesso' });
    } catch (error) {
      console.error('Erro ao cancelar transferência:', error);
      res.status(500).json({ error: 'Erro ao cancelar transferência' });
    }
  },

  // Transferência rápida entre responsáveis (no mesmo evento)
  async transferirEntreResponsaveis(req, res) {
    try {
      const { equipamento_id, evento_id, responsavel_origem_id, responsavel_destino_id, area, motivo } = req.body;

      if (!equipamento_id || !evento_id || !responsavel_destino_id) {
        return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
      }

      // Verificar se equipamento está no evento
      const equipamentoEvento = await getAsync(
        'SELECT * FROM equipamentos_evento WHERE equipamento_id = ? AND evento_id = ?',
        [equipamento_id, evento_id]
      );

      if (!equipamentoEvento) {
        return res.status(404).json({ error: 'Equipamento não encontrado neste evento' });
      }

      // Atualizar responsável do equipamento no evento
      await runAsync(
        'UPDATE equipamentos_evento SET responsavel_id = ?, area = ? WHERE equipamento_id = ? AND evento_id = ?',
        [responsavel_destino_id, area || equipamentoEvento.area, equipamento_id, evento_id]
      );

      // Registrar transferência no sistema
      db.run(
        `INSERT INTO transferencias
         (equipamento_id, origem_tipo, origem_id, destino_tipo, destino_id,
          solicitante_id, responsavel_entrega_id, responsavel_recebimento_id,
          status, motivo, aprovacao_coordenador, aprovacao_entrega, aprovacao_recebimento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)`,
        ['usuario', responsavel_origem_id || req.user.id, 'usuario', responsavel_destino_id,
         req.user.id, req.user.id, responsavel_destino_id,
         'concluida', motivo || 'Transferência entre responsáveis no mesmo evento'],
        function(err) {
          if (err) {
            console.error('Erro ao registrar transferência:', err);
            return res.status(500).json({ error: 'Erro ao registrar transferência' });
          }

          res.json({
            message: 'Equipamento transferido com sucesso',
            transferencia_id: this.lastID
          });
        }
      );
    } catch (error) {
      console.error('Erro ao transferir entre responsáveis:', error);
      res.status(500).json({ error: 'Erro ao transferir equipamento' });
    }
  }
};

module.exports = transferenciasController;
