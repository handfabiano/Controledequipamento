// Regras compartilhadas de transferências: quem pode ver, e qual o status
// resultante das aprovações.

const TIPOS_LOCAL = ['deposito', 'evento', 'usuario'];
const TIPOS_APROVACAO = ['coordenador', 'entrega', 'recebimento'];

// Transferência em andamento "segura" o equipamento; concluída e cancelada são finais
const STATUS_TRANSFERENCIA_ATIVA = ['pendente', 'aprovada_coordenador', 'em_transito'];
const FINALIZADAS = ['concluida', 'cancelada'];

// Colunas que ligam um usuário à transferência
const CAMPOS_ENVOLVIDOS = ['solicitante_id', 'responsavel_entrega_id', 'responsavel_recebimento_id', 'coordenador_id'];

// Perfil que enxerga as transferências ainda sem responsável designado para o seu papel
// (a tela de solicitação não designa ninguém, então sem isso só o solicitante as
// enxergaria para aprová-las)
const CAMPO_SEM_DESIGNADO = {
  responsavel_entrega: 'responsavel_entrega_id',
  responsavel_recebimento: 'responsavel_recebimento_id'
};

// Coordenador vê tudo. Os demais veem as transferências em que estão envolvidos, mais as
// sem designado do seu papel.
function condicaoVisibilidade(usuario) {
  if (usuario.tipo === 'coordenador') {
    return { clause: '1 = 1', params: [] };
  }

  const clauses = CAMPOS_ENVOLVIDOS.map((campo) => `t.${campo} = ?`);
  const params = CAMPOS_ENVOLVIDOS.map(() => usuario.id);

  const semDesignado = CAMPO_SEM_DESIGNADO[usuario.tipo];
  if (semDesignado) {
    clauses.push(`t.${semDesignado} IS NULL`);
  }

  return { clause: `(${clauses.join(' OR ')})`, params };
}

// Mesma regra de condicaoVisibilidade, aplicada a uma transferência já carregada
function podeVer(usuario, transferencia) {
  if (usuario.tipo === 'coordenador') return true;
  if (CAMPOS_ENVOLVIDOS.some((campo) => transferencia[campo] === usuario.id)) return true;

  const semDesignado = CAMPO_SEM_DESIGNADO[usuario.tipo];
  return Boolean(semDesignado) && !transferencia[semDesignado];
}

// O status é sempre derivado das três aprovações (colunas 0/1 da linha), qualquer que
// seja a ordem em que foram dadas — assim a transferência nunca fica "travada" com
// tudo aprovado.
function statusPelasAprovacoes(transferencia) {
  const { aprovacao_coordenador: coordenador, aprovacao_entrega: entrega, aprovacao_recebimento: recebimento } = transferencia;
  if (coordenador && entrega && recebimento) return 'concluida';
  if (coordenador && entrega) return 'em_transito';
  if (coordenador) return 'aprovada_coordenador';
  return 'pendente';
}

module.exports = {
  TIPOS_LOCAL,
  TIPOS_APROVACAO,
  STATUS_TRANSFERENCIA_ATIVA,
  FINALIZADAS,
  condicaoVisibilidade,
  podeVer,
  statusPelasAprovacoes
};
