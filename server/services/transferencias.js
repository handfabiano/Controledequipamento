// Regras compartilhadas de transferências: quem pode ver, e qual o status
// resultante das aprovações.

const { STATUS_TRANSFERENCIA_ATIVA } = require('./equipamentoStatus');

const TIPOS_LOCAL = ['deposito', 'evento', 'usuario'];
const TIPOS_APROVACAO = ['coordenador', 'entrega', 'recebimento'];

// Coordenador vê tudo. Os demais veem as transferências em que estão envolvidos; os
// responsáveis de entrega/recebimento também veem as que ainda não têm responsável
// designado para o seu papel (a tela de solicitação não designa ninguém, então sem
// isso ninguém além do solicitante enxergaria a transferência para aprová-la).
function condicaoVisibilidade(usuario) {
  if (usuario.tipo === 'coordenador') {
    return { clause: '1 = 1', params: [] };
  }

  const clauses = [
    't.solicitante_id = ?',
    't.responsavel_entrega_id = ?',
    't.responsavel_recebimento_id = ?',
    't.coordenador_id = ?'
  ];
  const params = [usuario.id, usuario.id, usuario.id, usuario.id];

  if (usuario.tipo === 'responsavel_entrega') {
    clauses.push('t.responsavel_entrega_id IS NULL');
  }
  if (usuario.tipo === 'responsavel_recebimento') {
    clauses.push('t.responsavel_recebimento_id IS NULL');
  }

  return { clause: `(${clauses.join(' OR ')})`, params };
}

// Mesma regra de condicaoVisibilidade, aplicada a uma transferência já carregada
function podeVer(usuario, transferencia) {
  if (usuario.tipo === 'coordenador') return true;

  const envolvidos = [
    transferencia.solicitante_id,
    transferencia.responsavel_entrega_id,
    transferencia.responsavel_recebimento_id,
    transferencia.coordenador_id
  ];
  if (envolvidos.includes(usuario.id)) return true;

  if (usuario.tipo === 'responsavel_entrega' && !transferencia.responsavel_entrega_id) return true;
  if (usuario.tipo === 'responsavel_recebimento' && !transferencia.responsavel_recebimento_id) return true;
  return false;
}

// O status é sempre derivado das três aprovações, qualquer que seja a ordem em que
// foram dadas — assim a transferência nunca fica "travada" com tudo aprovado.
function statusPelasAprovacoes({ coordenador, entrega, recebimento }) {
  if (coordenador && entrega && recebimento) return 'concluida';
  if (coordenador && entrega) return 'em_transito';
  if (coordenador) return 'aprovada_coordenador';
  return 'pendente';
}

module.exports = {
  TIPOS_LOCAL,
  TIPOS_APROVACAO,
  STATUS_TRANSFERENCIA_ATIVA,
  condicaoVisibilidade,
  podeVer,
  statusPelasAprovacoes
};
