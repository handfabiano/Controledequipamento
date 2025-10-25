const { db, getAsync, allAsync, runAsync } = require('../database/init');

const eventosController = {
  // Listar eventos
  async listar(req, res) {
    try {
      const { status, data_inicio, data_fim } = req.query;

      let query = `
        SELECT e.*, t.nome as template_nome, t.tamanho as template_tamanho,
               u.nome as criado_por_nome
        FROM eventos e
        LEFT JOIN templates_eventos t ON e.template_id = t.id
        LEFT JOIN usuarios u ON e.criado_por = u.id
        WHERE 1=1
      `;

      const params = [];

      if (status) {
        query += ' AND e.status = ?';
        params.push(status);
      }

      if (data_inicio) {
        query += ' AND e.data_inicio >= ?';
        params.push(data_inicio);
      }

      if (data_fim) {
        query += ' AND e.data_fim <= ?';
        params.push(data_fim);
      }

      query += ' ORDER BY e.data_inicio DESC';

      const eventos = await allAsync(query, params);
      res.json(eventos);
    } catch (error) {
      console.error('Erro ao listar eventos:', error);
      res.status(500).json({ error: 'Erro ao listar eventos' });
    }
  },

  // Buscar evento por ID
  async buscarPorId(req, res) {
    try {
      const { id } = req.params;

      const evento = await getAsync(`
        SELECT e.*, t.nome as template_nome, t.tamanho as template_tamanho,
               u.nome as criado_por_nome
        FROM eventos e
        LEFT JOIN templates_eventos t ON e.template_id = t.id
        LEFT JOIN usuarios u ON e.criado_por = u.id
        WHERE e.id = ?
      `, [id]);

      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      // Buscar responsáveis
      const responsaveis = await allAsync(`
        SELECT r.*, u.nome as usuario_nome, u.email as usuario_email
        FROM responsaveis_evento r
        LEFT JOIN usuarios u ON r.usuario_id = u.id
        WHERE r.evento_id = ?
      `, [id]);

      // Buscar equipamentos
      const equipamentos = await allAsync(`
        SELECT ee.*, e.codigo, e.nome, e.status as equipamento_status,
               c.nome as categoria_nome, c.tipo as categoria_tipo,
               u.nome as responsavel_nome
        FROM equipamentos_evento ee
        LEFT JOIN equipamentos e ON ee.equipamento_id = e.id
        LEFT JOIN categorias_equipamentos c ON e.categoria_id = c.id
        LEFT JOIN usuarios u ON ee.responsavel_id = u.id
        WHERE ee.evento_id = ?
      `, [id]);

      evento.responsaveis = responsaveis;
      evento.equipamentos = equipamentos;

      res.json(evento);
    } catch (error) {
      console.error('Erro ao buscar evento:', error);
      res.status(500).json({ error: 'Erro ao buscar evento' });
    }
  },

  // Criar evento
  async criar(req, res) {
    try {
      const { nome, local, template_id, data_inicio, data_fim, observacoes, responsaveis } = req.body;

      if (!nome || !local || !data_inicio || !data_fim) {
        return res.status(400).json({ error: 'Nome, local e datas são obrigatórios' });
      }

      db.run(
        `INSERT INTO eventos (nome, local, template_id, data_inicio, data_fim, observacoes, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome, local, template_id || null, data_inicio, data_fim, observacoes || null, req.user.id],
        async function(err) {
          if (err) {
            console.error('Erro ao criar evento:', err);
            return res.status(500).json({ error: 'Erro ao criar evento' });
          }

          const eventoId = this.lastID;

          // Adicionar responsáveis se fornecidos
          if (responsaveis && responsaveis.length > 0) {
            for (const resp of responsaveis) {
              await runAsync(
                'INSERT INTO responsaveis_evento (evento_id, usuario_id, area, tipo) VALUES (?, ?, ?, ?)',
                [eventoId, resp.usuario_id, resp.area, resp.tipo]
              );
            }
          }

          res.status(201).json({
            message: 'Evento criado com sucesso',
            id: eventoId
          });
        }
      );
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      res.status(500).json({ error: 'Erro ao criar evento' });
    }
  },

  // Adicionar equipamentos ao evento
  async adicionarEquipamentos(req, res) {
    try {
      const { id } = req.params;
      const { equipamentos } = req.body; // Array de { equipamento_id, responsavel_id, area, quantidade }

      if (!equipamentos || equipamentos.length === 0) {
        return res.status(400).json({ error: 'Lista de equipamentos vazia' });
      }

      const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [id]);

      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      for (const eq of equipamentos) {
        await runAsync(
          `INSERT INTO equipamentos_evento (evento_id, equipamento_id, responsavel_id, area, quantidade, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, eq.equipamento_id, eq.responsavel_id || null, eq.area || 'geral', eq.quantidade || 1, 'planejado']
        );

        // Atualizar status do equipamento
        await runAsync(
          'UPDATE equipamentos SET status = ? WHERE id = ?',
          ['em_uso', eq.equipamento_id]
        );
      }

      res.json({ message: 'Equipamentos adicionados com sucesso' });
    } catch (error) {
      console.error('Erro ao adicionar equipamentos:', error);
      res.status(500).json({ error: 'Erro ao adicionar equipamentos' });
    }
  },

  // Validar checklist do evento
  async validarChecklist(req, res) {
    try {
      const { id } = req.params;

      const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [id]);

      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (!evento.template_id) {
        return res.json({
          valido: true,
          mensagem: 'Evento sem template - validação não aplicável',
          avisos: []
        });
      }

      // Buscar checklist do template
      const checklist = await allAsync(`
        SELECT ct.*, c.nome as categoria_nome, c.tipo as categoria_tipo
        FROM checklist_template ct
        LEFT JOIN categorias_equipamentos c ON ct.categoria_id = c.id
        WHERE ct.template_id = ?
      `, [evento.template_id]);

      // Buscar equipamentos do evento
      const equipamentosEvento = await allAsync(`
        SELECT ee.*, e.categoria_id
        FROM equipamentos_evento ee
        LEFT JOIN equipamentos e ON ee.equipamento_id = e.id
        WHERE ee.evento_id = ?
      `, [id]);

      const avisos = [];
      let valido = true;

      // Verificar cada item do checklist
      for (const item of checklist) {
        const qtdAtual = equipamentosEvento
          .filter(eq => eq.categoria_id === item.categoria_id)
          .reduce((sum, eq) => sum + (eq.quantidade || 1), 0);

        if (qtdAtual < item.quantidade_minima) {
          const aviso = {
            categoria: item.categoria_nome,
            tipo: item.categoria_tipo,
            quantidade_minima: item.quantidade_minima,
            quantidade_atual: qtdAtual,
            obrigatorio: item.obrigatorio === 1,
            mensagem: `${item.categoria_nome}: ${qtdAtual}/${item.quantidade_minima} - Faltam ${item.quantidade_minima - qtdAtual}`
          };

          avisos.push(aviso);

          if (item.obrigatorio === 1) {
            valido = false;
          }
        }
      }

      res.json({
        valido,
        mensagem: valido ? 'Checklist validado com sucesso' : 'Checklist incompleto - itens obrigatórios faltando',
        avisos
      });
    } catch (error) {
      console.error('Erro ao validar checklist:', error);
      res.status(500).json({ error: 'Erro ao validar checklist' });
    }
  },

  // Atualizar status do evento
  async atualizarStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const statusValidos = ['planejamento', 'aprovado', 'em_andamento', 'concluido', 'cancelado'];

      if (!statusValidos.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      // Se estiver tentando aprovar, validar checklist primeiro
      if (status === 'aprovado') {
        const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [id]);

        if (evento && evento.template_id) {
          const checklist = await allAsync(`
            SELECT ct.*, c.nome as categoria_nome
            FROM checklist_template ct
            LEFT JOIN categorias_equipamentos c ON ct.categoria_id = c.id
            WHERE ct.template_id = ? AND ct.obrigatorio = 1
          `, [evento.template_id]);

          const equipamentosEvento = await allAsync(`
            SELECT ee.*, e.categoria_id
            FROM equipamentos_evento ee
            LEFT JOIN equipamentos e ON ee.equipamento_id = e.id
            WHERE ee.evento_id = ?
          `, [id]);

          for (const item of checklist) {
            const qtdAtual = equipamentosEvento
              .filter(eq => eq.categoria_id === item.categoria_id)
              .reduce((sum, eq) => sum + (eq.quantidade || 1), 0);

            if (qtdAtual < item.quantidade_minima) {
              return res.status(400).json({
                error: 'Checklist incompleto',
                mensagem: `Faltam itens obrigatórios: ${item.categoria_nome} (${qtdAtual}/${item.quantidade_minima})`
              });
            }
          }
        }
      }

      await runAsync('UPDATE eventos SET status = ? WHERE id = ?', [status, id]);

      res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  },

  // Listar templates
  async listarTemplates(req, res) {
    try {
      const templates = await allAsync('SELECT * FROM templates_eventos ORDER BY tamanho');

      // Para cada template, buscar o checklist
      for (const template of templates) {
        const checklist = await allAsync(`
          SELECT ct.*, c.nome as categoria_nome, c.tipo as categoria_tipo
          FROM checklist_template ct
          LEFT JOIN categorias_equipamentos c ON ct.categoria_id = c.id
          WHERE ct.template_id = ?
          ORDER BY c.tipo, c.nome
        `, [template.id]);

        template.checklist = checklist;
      }

      res.json(templates);
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      res.status(500).json({ error: 'Erro ao listar templates' });
    }
  }
};

module.exports = eventosController;
