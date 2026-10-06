const { getAsync, allAsync, runAsync } = require('../database/init');
const cache = require('../cache');
const { recalcularStatus } = require('../services/equipamentoStatus');
const {
  AREAS,
  AREAS_RESPONSAVEL,
  TIPOS_RESPONSAVEL,
  TRANSICOES_STATUS,
  eventoAtivo,
  ehEquipeDoEvento
} = require('../services/eventos');

// Converte "12" / 12 em 12; qualquer outra coisa vira null
const inteiro = (valor) => {
  const n = Number(valor);
  return valor !== null && valor !== '' && valor !== undefined && Number.isInteger(n) ? n : null;
};

const textoValido = (valor) => typeof valor === 'string' && valor.trim().length > 0;

// Checklist obrigatório do template: devolve a primeira categoria que não atinge a
// quantidade mínima, ou null quando está completo.
async function primeiroItemObrigatorioFaltando(evento) {
  if (!evento.template_id) return null;

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
    WHERE ee.evento_id = ? AND ee.status != 'devolvido'
  `, [evento.id]);

  for (const item of checklist) {
    const qtdAtual = equipamentosEvento
      .filter(eq => eq.categoria_id === item.categoria_id)
      .reduce((sum, eq) => sum + (eq.quantidade || 1), 0);

    if (qtdAtual < item.quantidade_minima) {
      return { categoria: item.categoria_nome, atual: qtdAtual, minimo: item.quantidade_minima };
    }
  }
  return null;
}

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

      if (!textoValido(nome) || !textoValido(local)) {
        return res.status(400).json({ error: 'Nome e local devem ser texto não vazio' });
      }

      const inicio = new Date(data_inicio);
      const fim = new Date(data_fim);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        return res.status(400).json({ error: 'Datas inválidas' });
      }
      if (fim < inicio) {
        return res.status(400).json({ error: 'A data de fim não pode ser anterior à data de início' });
      }

      if (template_id) {
        const template = await getAsync('SELECT id FROM templates_eventos WHERE id = ?', [template_id]);
        if (!template) {
          return res.status(400).json({ error: 'Template não encontrado' });
        }
      }

      // Valida todos os responsáveis ANTES de gravar, para não deixar evento pela metade
      if (responsaveis !== undefined && !Array.isArray(responsaveis)) {
        return res.status(400).json({ error: 'responsaveis deve ser uma lista' });
      }

      for (const resp of responsaveis || []) {
        const usuarioId = inteiro(resp && resp.usuario_id);
        if (usuarioId === null || !(await getAsync('SELECT id FROM usuarios WHERE id = ? AND ativo = 1', [usuarioId]))) {
          return res.status(400).json({ error: `Responsável ${resp && resp.usuario_id} não encontrado` });
        }
        if (!AREAS_RESPONSAVEL.includes(resp.area)) {
          return res.status(400).json({ error: `Área inválida para responsável. Opções: ${AREAS_RESPONSAVEL.join(', ')}` });
        }
        if (!TIPOS_RESPONSAVEL.includes(resp.tipo)) {
          return res.status(400).json({ error: `Tipo inválido para responsável. Opções: ${TIPOS_RESPONSAVEL.join(', ')}` });
        }
      }

      const result = await runAsync(
        `INSERT INTO eventos (nome, local, template_id, data_inicio, data_fim, observacoes, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [nome.trim(), local.trim(), template_id || null, data_inicio, data_fim, observacoes || null, req.user.id]
      );

      const eventoId = result.lastID;

      for (const resp of responsaveis || []) {
        await runAsync(
          'INSERT INTO responsaveis_evento (evento_id, usuario_id, area, tipo) VALUES (?, ?, ?, ?)',
          [eventoId, resp.usuario_id, resp.area, resp.tipo]
        );
      }

      res.status(201).json({
        message: 'Evento criado com sucesso',
        id: eventoId
      });
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

      if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
        return res.status(400).json({ error: 'Lista de equipamentos vazia' });
      }

      if (equipamentos.length > 200) {
        return res.status(400).json({ error: 'No máximo 200 equipamentos por requisição' });
      }

      const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [id]);

      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (!eventoAtivo(evento)) {
        return res.status(400).json({ error: 'Não é possível alocar equipamentos em evento concluído ou cancelado' });
      }

      if (!(await ehEquipeDoEvento(req.user, evento))) {
        return res.status(403).json({ error: 'Apenas coordenadores, o criador ou os responsáveis do evento podem alocar equipamentos' });
      }

      // Valida o lote inteiro antes de gravar: ou entra tudo, ou nada
      const problemas = [];
      const vistos = new Set();
      const itens = [];

      for (const eq of equipamentos) {
        const equipamentoId = inteiro(eq && eq.equipamento_id);
        if (equipamentoId === null) {
          problemas.push('equipamento_id inválido');
          continue;
        }

        if (vistos.has(equipamentoId)) {
          problemas.push(`Equipamento ${equipamentoId} repetido na lista`);
          continue;
        }
        vistos.add(equipamentoId);

        const equipamento = await getAsync('SELECT id, codigo, status FROM equipamentos WHERE id = ?', [equipamentoId]);
        if (!equipamento) {
          problemas.push(`Equipamento ${equipamentoId} não encontrado`);
          continue;
        }

        if (equipamento.status !== 'disponivel') {
          problemas.push(`${equipamento.codigo} não está disponível (status: ${equipamento.status})`);
          continue;
        }

        const area = eq.area || 'geral';
        if (!AREAS.includes(area)) {
          problemas.push(`${equipamento.codigo}: área inválida "${area}"`);
          continue;
        }

        const quantidade = eq.quantidade === undefined ? 1 : inteiro(eq.quantidade);
        if (quantidade === null || quantidade < 1) {
          problemas.push(`${equipamento.codigo}: quantidade inválida`);
          continue;
        }

        let responsavelId = null;
        if (eq.responsavel_id) {
          responsavelId = inteiro(eq.responsavel_id);
          if (responsavelId === null || !(await getAsync('SELECT id FROM usuarios WHERE id = ? AND ativo = 1', [responsavelId]))) {
            problemas.push(`${equipamento.codigo}: responsável ${eq.responsavel_id} não encontrado`);
            continue;
          }
        }

        itens.push({ equipamentoId, area, quantidade, responsavelId });
      }

      if (problemas.length > 0) {
        return res.status(400).json({
          error: `Não foi possível adicionar os equipamentos: ${problemas.join('; ')}`,
          detalhes: problemas
        });
      }

      for (const item of itens) {
        await runAsync(
          `INSERT INTO equipamentos_evento (evento_id, equipamento_id, responsavel_id, area, quantidade, status)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.equipamentoId, item.responsavelId, item.area, item.quantidade, 'planejado']
        );

        // Status derivado: em_uso (ou com_problema/transferencia, se for o caso)
        await recalcularStatus(item.equipamentoId);
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

      const statusValidos = Object.keys(TRANSICOES_STATUS);

      if (!statusValidos.includes(status)) {
        return res.status(400).json({ error: 'Status inválido' });
      }

      const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [id]);

      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (evento.status === status) {
        return res.status(400).json({ error: `O evento já está com o status "${status}"` });
      }

      if (!TRANSICOES_STATUS[evento.status].includes(status)) {
        const permitidas = TRANSICOES_STATUS[evento.status];
        return res.status(400).json({
          error: permitidas.length
            ? `Não é possível passar de "${evento.status}" para "${status}". Opções: ${permitidas.join(', ')}`
            : `Evento ${evento.status} não pode mais mudar de status`
        });
      }

      // Aprovar, iniciar, concluir e voltar ao planejamento são do coordenador.
      // Cancelar também pode ser feito por quem criou o evento.
      const ehCoordenador = req.user.tipo === 'coordenador';
      const podeCancelar = status === 'cancelado' && evento.criado_por === req.user.id;

      if (!ehCoordenador && !podeCancelar) {
        return res.status(403).json({
          error: status === 'cancelado'
            ? 'Apenas coordenadores ou quem criou o evento podem cancelá-lo'
            : 'Apenas coordenadores podem alterar o status do evento'
        });
      }

      // Para aprovar, o checklist obrigatório do template precisa estar completo
      if (status === 'aprovado') {
        const faltando = await primeiroItemObrigatorioFaltando(evento);
        if (faltando) {
          return res.status(400).json({
            error: 'Checklist incompleto',
            mensagem: `Faltam itens obrigatórios: ${faltando.categoria} (${faltando.atual}/${faltando.minimo})`
          });
        }
      }

      await runAsync('UPDATE eventos SET status = ? WHERE id = ?', [status, id]);

      // Evento encerrado: as alocações são devolvidas e os equipamentos liberados
      // (cada um volta ao status que de fato lhe cabe: disponível, com problema, em
      // transferência, em manutenção ou ainda alocado em outro evento)
      if (status === 'concluido' || status === 'cancelado') {
        const alocados = await allAsync(
          "SELECT DISTINCT equipamento_id FROM equipamentos_evento WHERE evento_id = ? AND status != 'devolvido'",
          [id]
        );

        await runAsync(
          "UPDATE equipamentos_evento SET status = 'devolvido' WHERE evento_id = ? AND status != 'devolvido'",
          [id]
        );

        for (const { equipamento_id } of alocados) {
          await recalcularStatus(equipamento_id);
        }
      }

      res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  },

  // Listar templates
  async listarTemplates(req, res) {
    try {
      const cacheKey = 'templates:all';

      // Tentar buscar do cache
      let templates = cache.get(cacheKey);

      if (!templates) {
        // Buscar do banco
        templates = await allAsync('SELECT * FROM templates_eventos ORDER BY tamanho');

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

        // Salvar no cache por 24 horas (86400 segundos)
        cache.set(cacheKey, templates, 86400);
      }

      res.json(templates);
    } catch (error) {
      console.error('Erro ao listar templates:', error);
      res.status(500).json({ error: 'Erro ao listar templates' });
    }
  }
};

module.exports = eventosController;
