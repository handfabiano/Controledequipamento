const { getAsync, allAsync, runAsync } = require('../database/init');
const { criarNotificacao, notificarUsuarios } = require('../services/notificacoes');
const { recalcularStatus } = require('../services/equipamentoStatus');
const { ehEquipeDoEvento, eventoAtivo, AREAS } = require('../services/eventos');
const {
  TIPOS_LOCAL,
  TIPOS_APROVACAO,
  STATUS_TRANSFERENCIA_ATIVA,
  condicaoVisibilidade,
  podeVer,
  statusPelasAprovacoes
} = require('../services/transferencias');

const FINALIZADAS = ['concluida', 'cancelada'];
const marcadores = (valores) => valores.map(() => '?').join(', ');

// Converte "12" / 12 em 12; qualquer outra coisa vira null
const inteiro = (valor) => {
  const n = Number(valor);
  return valor !== null && valor !== '' && valor !== undefined && Number.isInteger(n) ? n : null;
};

// Confere se o local (depósito, evento ou usuário) existe. Devolve a mensagem de erro
// ou null quando está tudo certo.
async function validarLocal(tipo, id, rotulo) {
  const consulta = {
    deposito: ['SELECT id FROM depositos WHERE id = ?', 'Depósito'],
    evento: ['SELECT id FROM eventos WHERE id = ?', 'Evento'],
    usuario: ['SELECT id FROM usuarios WHERE id = ? AND ativo = 1', 'Usuário']
  }[tipo];

  const encontrado = await getAsync(consulta[0], [id]);
  return encontrado ? null : `${rotulo}: ${consulta[1].toLowerCase()} ${id} não encontrado`;
}

// Valida os responsáveis informados na solicitação (todos opcionais)
async function validarResponsaveis({ responsavel_entrega_id, responsavel_recebimento_id, coordenador_id }) {
  const papeis = [
    ['responsavel_entrega_id', responsavel_entrega_id],
    ['responsavel_recebimento_id', responsavel_recebimento_id],
    ['coordenador_id', coordenador_id]
  ];

  for (const [campo, valor] of papeis) {
    if (valor === undefined || valor === null || valor === '') continue;

    const id = inteiro(valor);
    if (id === null) return `${campo} inválido`;

    const usuario = await getAsync('SELECT id, tipo FROM usuarios WHERE id = ? AND ativo = 1', [id]);
    if (!usuario) return `Usuário de ${campo} não encontrado`;

    // Só coordenadores podem dar a aprovação de coordenador: designar outro perfil
    // deixaria a transferência impossível de aprovar.
    if (campo === 'coordenador_id' && usuario.tipo !== 'coordenador') {
      return 'coordenador_id deve ser um usuário do tipo coordenador';
    }
  }
  return null;
}

async function transferenciaAtiva(equipamentoId) {
  return getAsync(
    `SELECT id FROM transferencias
     WHERE equipamento_id = ? AND status IN (${marcadores(STATUS_TRANSFERENCIA_ATIVA)})
     LIMIT 1`,
    [equipamentoId, ...STATUS_TRANSFERENCIA_ATIVA]
  );
}

const idOuNull = (valor) => {
  const id = inteiro(valor);
  return id === null ? null : id;
};

// Ao concluir uma transferência com evento envolvido, a alocação acompanha o equipamento:
// sai do evento de origem (marcada como devolvida) e entra no de destino. Sem isso, o fim
// do evento de origem liberaria um equipamento que está fisicamente em outro evento.
async function moverAlocacaoEmEventos(transferencia) {
  if (transferencia.origem_tipo === 'evento' && transferencia.origem_id) {
    await runAsync(
      `UPDATE equipamentos_evento SET status = 'devolvido'
       WHERE evento_id = ? AND equipamento_id = ? AND status != 'devolvido'`,
      [transferencia.origem_id, transferencia.equipamento_id]
    );
  }

  if (transferencia.destino_tipo !== 'evento') return;

  const destino = await getAsync('SELECT * FROM eventos WHERE id = ?', [transferencia.destino_id]);
  if (!destino || !eventoAtivo(destino)) return;

  const jaAlocado = await getAsync(
    `SELECT id FROM equipamentos_evento
     WHERE evento_id = ? AND equipamento_id = ? AND status != 'devolvido'`,
    [transferencia.destino_id, transferencia.equipamento_id]
  );
  if (jaAlocado) return;

  const origem = transferencia.origem_tipo === 'evento'
    ? await getAsync(
      'SELECT responsavel_id, area, quantidade FROM equipamentos_evento WHERE evento_id = ? AND equipamento_id = ? ORDER BY id DESC LIMIT 1',
      [transferencia.origem_id, transferencia.equipamento_id]
    )
    : null;

  await runAsync(
    `INSERT INTO equipamentos_evento (evento_id, equipamento_id, responsavel_id, area, quantidade, status, observacoes)
     VALUES (?, ?, ?, ?, ?, 'entregue', ?)`,
    [transferencia.destino_id, transferencia.equipamento_id,
     origem?.responsavel_id || transferencia.responsavel_recebimento_id || null,
     origem?.area || 'geral', origem?.quantidade || 1,
     `Recebido pela transferência #${transferencia.id}`]
  );
}

const transferenciasController = {
  // Listar transferências visíveis ao usuário
  async listar(req, res) {
    try {
      const { status } = req.query;
      const { clause, params } = condicaoVisibilidade(req.user);

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
        WHERE ${clause}
      `;

      const valores = [...params];

      if (status) {
        query += ' AND t.status = ?';
        valores.push(status);
      }

      query += ' ORDER BY t.data_solicitacao DESC, t.id DESC';

      const transferencias = await allAsync(query, valores);
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

      if (!podeVer(req.user, transferencia)) {
        return res.status(403).json({ error: 'Sem permissão para visualizar esta transferência' });
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

      if (!TIPOS_LOCAL.includes(origem_tipo) || !TIPOS_LOCAL.includes(destino_tipo)) {
        return res.status(400).json({ error: `Tipos de origem/destino devem ser: ${TIPOS_LOCAL.join(', ')}` });
      }

      const equipamentoId = inteiro(equipamento_id);
      const destinoId = inteiro(destino_id);
      if (equipamentoId === null || destinoId === null) {
        return res.status(400).json({ error: 'equipamento_id e destino_id devem ser números inteiros' });
      }

      // Verificar se equipamento existe e está disponível para transferência
      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [equipamentoId]);

      if (!equipamento) {
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      if (equipamento.status === 'manutencao') {
        return res.status(400).json({ error: 'Equipamento em manutenção não pode ser transferido' });
      }

      if (await transferenciaAtiva(equipamentoId)) {
        return res.status(400).json({ error: 'Este equipamento já possui uma transferência em andamento' });
      }

      // A tela de solicitação deixa a origem opcional: para depósito, assume o atual
      // do equipamento; sem informação, grava 0 ("não informado").
      let origemId = idOuNull(origem_id);
      if (origem_id !== undefined && origem_id !== null && origem_id !== '' && origemId === null) {
        return res.status(400).json({ error: 'origem_id deve ser um número inteiro' });
      }
      if (origemId === null) {
        origemId = origem_tipo === 'deposito' ? (equipamento.deposito_id || 0) : 0;
      } else {
        const erroOrigem = await validarLocal(origem_tipo, origemId, 'Origem');
        if (erroOrigem) return res.status(400).json({ error: erroOrigem });
      }

      const erroDestino = await validarLocal(destino_tipo, destinoId, 'Destino');
      if (erroDestino) return res.status(400).json({ error: erroDestino });

      const erroResponsaveis = await validarResponsaveis(req.body);
      if (erroResponsaveis) return res.status(400).json({ error: erroResponsaveis });

      const entregaId = idOuNull(responsavel_entrega_id);
      const recebimentoId = idOuNull(responsavel_recebimento_id);
      const coordenadorId = idOuNull(coordenador_id);

      const result = await runAsync(
        `INSERT INTO transferencias
         (equipamento_id, origem_tipo, origem_id, destino_tipo, destino_id,
          solicitante_id, responsavel_entrega_id, responsavel_recebimento_id,
          coordenador_id, motivo, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [equipamentoId, origem_tipo, origemId, destino_tipo, destinoId,
         req.user.id, entregaId, recebimentoId, coordenadorId, motivo || null, observacoes || null]
      );

      // O equipamento passa a "transferencia" (ou continua "com_problema")
      await recalcularStatus(equipamentoId);

      // Notificar envolvidos na aprovação
      await notificarUsuarios(
        [coordenadorId, entregaId, recebimentoId],
        'transferencia_pendente',
        'Nova transferência pendente',
        `Transferência do equipamento ${equipamento.codigo} (${equipamento.nome}) aguarda sua aprovação.`,
        '/transferencias'
      );

      res.status(201).json({
        message: 'Transferência solicitada com sucesso',
        id: result.lastID
      });
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
      const usuario = req.user;

      if (!TIPOS_APROVACAO.includes(tipo_aprovacao)) {
        return res.status(400).json({ error: 'Tipo de aprovação inválido' });
      }

      const transferencia = await getAsync('SELECT * FROM transferencias WHERE id = ?', [id]);

      if (!transferencia) {
        return res.status(404).json({ error: 'Transferência não encontrada' });
      }

      if (FINALIZADAS.includes(transferencia.status)) {
        return res.status(400).json({ error: 'Transferência já finalizada' });
      }

      const campo = `aprovacao_${tipo_aprovacao}`;
      if (transferencia[campo]) {
        return res.status(400).json({ error: 'Esta etapa já foi aprovada' });
      }

      // Autorização por etapa. Com responsável designado, só ele aprova; sem designado
      // (o caso da tela de solicitação), vale o perfil do usuário — a mesma regra que a
      // tela usa para mostrar os botões.
      switch (tipo_aprovacao) {
        case 'coordenador':
          if (usuario.tipo !== 'coordenador') {
            return res.status(403).json({ error: 'Apenas coordenadores podem dar esta aprovação' });
          }
          if (transferencia.coordenador_id && transferencia.coordenador_id !== usuario.id) {
            return res.status(403).json({ error: 'Você não é o coordenador desta transferência' });
          }
          break;

        case 'entrega':
          if (transferencia.responsavel_entrega_id) {
            if (transferencia.responsavel_entrega_id !== usuario.id) {
              return res.status(403).json({ error: 'Você não é o responsável pela entrega' });
            }
          } else if (!['responsavel_entrega', 'coordenador'].includes(usuario.tipo)) {
            return res.status(403).json({ error: 'Apenas o responsável pela entrega ou um coordenador pode confirmar a entrega' });
          }
          break;

        case 'recebimento':
          if (transferencia.responsavel_recebimento_id) {
            if (transferencia.responsavel_recebimento_id !== usuario.id) {
              return res.status(403).json({ error: 'Você não é o responsável pelo recebimento' });
            }
          } else if (!['responsavel_recebimento', 'coordenador'].includes(usuario.tipo)) {
            return res.status(403).json({ error: 'Apenas o responsável pelo recebimento ou um coordenador pode confirmar o recebimento' });
          }
          if (!transferencia.aprovacao_entrega) {
            return res.status(400).json({ error: 'Aguardando a confirmação da entrega' });
          }
          break;

        default:
          break;
      }

      // 1) Registra a aprovação de forma atômica: se outra requisição aprovou a mesma
      //    etapa (ou finalizou a transferência) no meio tempo, nada é alterado.
      const registrada = await runAsync(
        `UPDATE transferencias
         SET ${campo} = 1${tipo_aprovacao === 'coordenador' ? ', data_aprovacao = CURRENT_TIMESTAMP' : ''}
         WHERE id = ? AND ${campo} = 0 AND status NOT IN (${marcadores(FINALIZADAS)})`,
        [id, ...FINALIZADAS]
      );

      if (registrada.changes === 0) {
        return res.status(409).json({ error: 'A transferência foi alterada por outra requisição. Atualize e tente novamente.' });
      }

      // 2) O status é derivado das aprovações reais (relidas), não do que esta
      //    requisição viu: duas aprovações simultâneas não deixam a transferência travada.
      const atual = await getAsync('SELECT * FROM transferencias WHERE id = ?', [id]);
      const novoStatus = statusPelasAprovacoes({
        coordenador: Boolean(atual.aprovacao_coordenador),
        entrega: Boolean(atual.aprovacao_entrega),
        recebimento: Boolean(atual.aprovacao_recebimento)
      });

      if (novoStatus === 'concluida') {
        const concluida = await runAsync(
          `UPDATE transferencias SET status = 'concluida', data_conclusao = CURRENT_TIMESTAMP
           WHERE id = ? AND status NOT IN (${marcadores(FINALIZADAS)})`,
          [id, ...FINALIZADAS]
        );

        // Só quem de fato concluiu aplica os efeitos (uma única vez)
        if (concluida.changes === 1) {
          await runAsync(
            'UPDATE equipamentos SET deposito_id = ? WHERE id = ?',
            [atual.destino_tipo === 'deposito' ? atual.destino_id : null, atual.equipamento_id]
          );

          await moverAlocacaoEmEventos(atual);
          await recalcularStatus(atual.equipamento_id);

          await runAsync(
            `INSERT INTO historico_movimentacoes
             (equipamento_id, tipo_movimentacao, origem, destino, usuario_id, observacoes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [atual.equipamento_id,
             'transferencia',
             `${atual.origem_tipo}: ${atual.origem_id || 'N/A'}`,
             `${atual.destino_tipo}: ${atual.destino_id}`,
             usuario.id,
             `Transferência #${id} concluída`]
          );
        }
      } else if (novoStatus !== atual.status) {
        await runAsync(
          `UPDATE transferencias SET status = ? WHERE id = ? AND status NOT IN (${marcadores(FINALIZADAS)})`,
          [novoStatus, id, ...FINALIZADAS]
        );
      }

      // Notificar o solicitante sobre o andamento
      if (transferencia.solicitante_id !== usuario.id) {
        const descricaoStatus = {
          aprovada_coordenador: 'foi aprovada pelo coordenador',
          em_transito: 'está em trânsito',
          concluida: 'foi concluída'
        };
        await criarNotificacao(
          transferencia.solicitante_id,
          'transferencia_atualizada',
          'Transferência atualizada',
          `Sua transferência #${id} ${descricaoStatus[novoStatus] || `recebeu aprovação de ${tipo_aprovacao}`}.`,
          '/transferencias'
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

      if (transferencia.status === 'cancelada') {
        return res.status(400).json({ error: 'Transferência já está cancelada' });
      }

      // Apenas coordenador ou solicitante podem cancelar
      if (req.user.tipo !== 'coordenador' && transferencia.solicitante_id !== userId) {
        return res.status(403).json({ error: 'Sem permissão para cancelar esta transferência' });
      }

      // O motivo é acrescentado às observações (antes substituía o que já havia)
      const observacoes = [transferencia.observacoes, motivo ? `Cancelamento: ${motivo}` : null]
        .filter(Boolean)
        .join('\n') || null;

      const cancelada = await runAsync(
        `UPDATE transferencias SET status = 'cancelada', observacoes = ?
         WHERE id = ? AND status NOT IN (${marcadores(FINALIZADAS)})`,
        [observacoes, id, ...FINALIZADAS]
      );

      if (cancelada.changes === 0) {
        return res.status(409).json({ error: 'A transferência foi alterada por outra requisição. Atualize e tente novamente.' });
      }

      // O equipamento volta ao status que de fato lhe cabe (em evento, com problema...),
      // e não, cegamente, a "disponível"
      await recalcularStatus(transferencia.equipamento_id);

      // Notificar o solicitante, caso não tenha sido ele a cancelar
      if (transferencia.solicitante_id !== userId) {
        await criarNotificacao(
          transferencia.solicitante_id,
          'transferencia_cancelada',
          'Transferência cancelada',
          `Sua transferência #${id} foi cancelada.${motivo ? ` Motivo: ${motivo}` : ''}`,
          '/transferencias'
        );
      }

      res.json({ message: 'Transferência cancelada com sucesso' });
    } catch (error) {
      console.error('Erro ao cancelar transferência:', error);
      res.status(500).json({ error: 'Erro ao cancelar transferência' });
    }
  },

  // Transferência rápida entre responsáveis (no mesmo evento)
  async transferirEntreResponsaveis(req, res) {
    try {
      const { equipamento_id, evento_id, responsavel_destino_id, area, motivo } = req.body;

      if (!equipamento_id || !evento_id || !responsavel_destino_id) {
        return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
      }

      const equipamentoId = inteiro(equipamento_id);
      const eventoId = inteiro(evento_id);
      const destinoId = inteiro(responsavel_destino_id);
      if (equipamentoId === null || eventoId === null || destinoId === null) {
        return res.status(400).json({ error: 'equipamento_id, evento_id e responsavel_destino_id devem ser números inteiros' });
      }

      if (area !== undefined && area !== null && area !== '' && !AREAS.includes(area)) {
        return res.status(400).json({ error: `Área inválida. Opções: ${AREAS.join(', ')}` });
      }

      const evento = await getAsync('SELECT * FROM eventos WHERE id = ?', [eventoId]);
      if (!evento) {
        return res.status(404).json({ error: 'Evento não encontrado' });
      }

      if (!eventoAtivo(evento)) {
        return res.status(400).json({ error: 'O evento já foi encerrado' });
      }

      // Verificar se equipamento está no evento
      const equipamentoEvento = await getAsync(
        `SELECT * FROM equipamentos_evento
         WHERE equipamento_id = ? AND evento_id = ? AND status != 'devolvido'`,
        [equipamentoId, eventoId]
      );

      if (!equipamentoEvento) {
        return res.status(404).json({ error: 'Equipamento não encontrado neste evento' });
      }

      // Quem pode passar o equipamento adiante: o responsável atual ou a equipe do evento
      // (coordenadores, criador e responsáveis cadastrados). O servidor não confia no
      // "responsável de origem" enviado pelo cliente: a origem é sempre a real.
      const ehResponsavelAtual = equipamentoEvento.responsavel_id === req.user.id;
      if (!ehResponsavelAtual && !(await ehEquipeDoEvento(req.user, evento))) {
        return res.status(403).json({ error: 'Sem permissão para transferir este equipamento' });
      }

      const origemId = equipamentoEvento.responsavel_id || req.user.id;

      if (destinoId === equipamentoEvento.responsavel_id) {
        return res.status(400).json({ error: 'O equipamento já está com este responsável' });
      }

      const destino = await getAsync('SELECT id, nome FROM usuarios WHERE id = ? AND ativo = 1', [destinoId]);
      if (!destino) {
        return res.status(400).json({ error: 'Responsável de destino não encontrado' });
      }

      // Atualizar responsável do equipamento no evento
      await runAsync(
        'UPDATE equipamentos_evento SET responsavel_id = ?, area = ? WHERE id = ?',
        [destinoId, area || equipamentoEvento.area, equipamentoEvento.id]
      );

      // Registrar transferência no sistema (já concluída, sem fluxo de aprovação)
      const result = await runAsync(
        `INSERT INTO transferencias
         (equipamento_id, origem_tipo, origem_id, destino_tipo, destino_id,
          solicitante_id, responsavel_entrega_id, responsavel_recebimento_id,
          status, motivo, aprovacao_coordenador, aprovacao_entrega, aprovacao_recebimento,
          data_conclusao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, CURRENT_TIMESTAMP)`,
        [equipamentoId, 'usuario', origemId, 'usuario', destinoId,
         req.user.id, origemId, destinoId,
         'concluida', motivo || 'Transferência entre responsáveis no mesmo evento']
      );

      await runAsync(
        `INSERT INTO historico_movimentacoes
         (equipamento_id, tipo_movimentacao, origem, destino, usuario_id, observacoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [equipamentoId, 'transferencia_responsavel', `usuario: ${origemId}`, `usuario: ${destinoId}`,
         req.user.id, `Evento "${evento.nome}": responsável alterado`]
      );

      // Notificar o novo responsável
      await criarNotificacao(
        destinoId,
        'equipamento_recebido',
        'Equipamento transferido para você',
        `Você agora é responsável pelo equipamento #${equipamentoId} no evento "${evento.nome}".`,
        '/transferencias'
      );

      res.json({
        message: 'Equipamento transferido com sucesso',
        transferencia_id: result.lastID
      });
    } catch (error) {
      console.error('Erro ao transferir entre responsáveis:', error);
      res.status(500).json({ error: 'Erro ao transferir equipamento' });
    }
  },

  // Transferência entre eventos simultâneos
  async transferirEntreEventos(req, res) {
    try {
      const {
        equipamento_id,
        evento_origem_id,
        evento_destino_id,
        responsavel_entrega_id,
        responsavel_recebimento_id,
        coordenador_id,
        motivo,
        observacoes
      } = req.body;

      if (!equipamento_id || !evento_origem_id || !evento_destino_id) {
        return res.status(400).json({ error: 'Equipamento e eventos de origem/destino são obrigatórios' });
      }

      const equipamentoId = inteiro(equipamento_id);
      const origemId = inteiro(evento_origem_id);
      const destinoId = inteiro(evento_destino_id);
      if (equipamentoId === null || origemId === null || destinoId === null) {
        return res.status(400).json({ error: 'Os ids devem ser números inteiros' });
      }

      if (origemId === destinoId) {
        return res.status(400).json({ error: 'Os eventos de origem e destino devem ser diferentes' });
      }

      // Verificar se equipamento está no evento de origem
      const equipamentoEventoOrigem = await getAsync(
        `SELECT * FROM equipamentos_evento
         WHERE equipamento_id = ? AND evento_id = ? AND status != 'devolvido'`,
        [equipamentoId, origemId]
      );

      if (!equipamentoEventoOrigem) {
        return res.status(404).json({ error: 'Equipamento não encontrado no evento de origem' });
      }

      // Verificar se ambos os eventos existem e estão em andamento ou aprovados
      const eventoOrigem = await getAsync(
        'SELECT * FROM eventos WHERE id = ? AND status IN (?, ?)',
        [origemId, 'em_andamento', 'aprovado']
      );

      const eventoDestino = await getAsync(
        'SELECT * FROM eventos WHERE id = ? AND status IN (?, ?)',
        [destinoId, 'em_andamento', 'aprovado']
      );

      if (!eventoOrigem || !eventoDestino) {
        return res.status(400).json({ error: 'Os eventos precisam estar aprovados ou em andamento' });
      }

      // Verificar se os eventos são simultâneos (se há sobreposição de datas)
      const dataInicioOrigem = new Date(eventoOrigem.data_inicio);
      const dataFimOrigem = new Date(eventoOrigem.data_fim);
      const dataInicioDestino = new Date(eventoDestino.data_inicio);
      const dataFimDestino = new Date(eventoDestino.data_fim);

      const eventosSimultaneos = (
        (dataInicioDestino >= dataInicioOrigem && dataInicioDestino <= dataFimOrigem) ||
        (dataFimDestino >= dataInicioOrigem && dataFimDestino <= dataFimOrigem) ||
        (dataInicioDestino <= dataInicioOrigem && dataFimDestino >= dataFimOrigem)
      );

      if (!eventosSimultaneos) {
        return res.status(400).json({
          error: 'Os eventos não são simultâneos',
          mensagem: 'Esta transferência é específica para eventos que ocorrem ao mesmo tempo em locais diferentes'
        });
      }

      const equipamento = await getAsync('SELECT * FROM equipamentos WHERE id = ?', [equipamentoId]);
      if (equipamento.status === 'manutencao') {
        return res.status(400).json({ error: 'Equipamento em manutenção não pode ser transferido' });
      }

      if (await transferenciaAtiva(equipamentoId)) {
        return res.status(400).json({ error: 'Este equipamento já possui uma transferência em andamento' });
      }

      const erroResponsaveis = await validarResponsaveis(req.body);
      if (erroResponsaveis) return res.status(400).json({ error: erroResponsaveis });

      const entregaId = idOuNull(responsavel_entrega_id);
      const recebimentoId = idOuNull(responsavel_recebimento_id);
      const coordenadorId = idOuNull(coordenador_id);

      // Criar transferência com aprovação tripla
      const result = await runAsync(
        `INSERT INTO transferencias
         (equipamento_id, origem_tipo, origem_id, destino_tipo, destino_id,
          solicitante_id, responsavel_entrega_id, responsavel_recebimento_id,
          coordenador_id, motivo, observacoes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [equipamentoId, 'evento', origemId, 'evento', destinoId,
         req.user.id, entregaId, recebimentoId, coordenadorId,
         motivo || 'Transferência urgente entre eventos simultâneos', observacoes || null]
      );

      await recalcularStatus(equipamentoId);

      // Adicionar observação sobre transferência urgente
      await runAsync(
        `INSERT INTO historico_movimentacoes
         (equipamento_id, tipo_movimentacao, origem, destino, usuario_id, observacoes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [equipamentoId,
         'transferencia_urgente',
         `Evento: ${eventoOrigem.nome}`,
         `Evento: ${eventoDestino.nome}`,
         req.user.id,
         'Transferência entre eventos simultâneos']
      );

      // Notificar envolvidos na aprovação
      await notificarUsuarios(
        [coordenadorId, entregaId, recebimentoId],
        'transferencia_pendente',
        'Transferência urgente entre eventos',
        `Transferência do equipamento #${equipamentoId} de "${eventoOrigem.nome}" para "${eventoDestino.nome}" aguarda sua aprovação.`,
        '/transferencias'
      );

      res.status(201).json({
        message: 'Transferência entre eventos criada com sucesso',
        id: result.lastID,
        info: {
          evento_origem: eventoOrigem.nome,
          evento_destino: eventoDestino.nome,
          requer_aprovacoes: true
        }
      });
    } catch (error) {
      console.error('Erro ao transferir entre eventos:', error);
      res.status(500).json({ error: 'Erro ao criar transferência entre eventos' });
    }
  }
};

module.exports = transferenciasController;
