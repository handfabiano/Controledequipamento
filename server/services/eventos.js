// Regras compartilhadas de eventos.

const { getAsync } = require('../database/init');

const AREAS = ['som', 'iluminacao', 'palco', 'geral'];
const AREAS_RESPONSAVEL = [...AREAS, 'coordenacao'];
const TIPOS_RESPONSAVEL = ['entrega', 'recebimento', 'coordenador'];

// Eventos que ainda "seguram" equipamentos
const STATUS_EVENTO_ATIVO = ['planejamento', 'aprovado', 'em_andamento'];
// Entre eventos simultâneos só vale para eventos já aprovados ou em andamento
const STATUS_EVENTO_TRANSFERIVEL = ['aprovado', 'em_andamento'];

// Máquina de estados do evento; concluído e cancelado são finais
const TRANSICOES_STATUS = {
  planejamento: ['aprovado', 'cancelado'],
  aprovado: ['planejamento', 'em_andamento', 'cancelado'],
  em_andamento: ['concluido', 'cancelado'],
  concluido: [],
  cancelado: []
};

const eventoAtivo = (evento) => STATUS_EVENTO_ATIVO.includes(evento.status);

// Equipe do evento: coordenadores, quem criou o evento e os responsáveis cadastrados nele
async function ehEquipeDoEvento(usuario, evento) {
  if (usuario.tipo === 'coordenador') return true;
  if (evento.criado_por === usuario.id) return true;

  const responsavel = await getAsync(
    'SELECT id FROM responsaveis_evento WHERE evento_id = ? AND usuario_id = ? LIMIT 1',
    [evento.id, usuario.id]
  );
  return Boolean(responsavel);
}

module.exports = {
  AREAS,
  AREAS_RESPONSAVEL,
  TIPOS_RESPONSAVEL,
  STATUS_EVENTO_ATIVO,
  STATUS_EVENTO_TRANSFERIVEL,
  TRANSICOES_STATUS,
  eventoAtivo,
  ehEquipeDoEvento
};
