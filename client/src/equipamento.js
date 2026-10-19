// Rótulos e cores de equipamento usados na lista e no detalhe. As chaves espelham os valores
// aceitos pelo servidor (equipamentoStatus.js, equipamentoValidator.js e o histórico).

export const STATUS_EQUIPAMENTO = {
  disponivel: { rotulo: 'Disponível', badge: 'badge-success' },
  em_uso: { rotulo: 'Em uso', badge: 'badge-warning' },
  manutencao: { rotulo: 'Manutenção', badge: 'badge-secondary' },
  com_problema: { rotulo: 'Com problema', badge: 'badge-danger' },
  transferencia: { rotulo: 'Em transferência', badge: 'badge-info' },
};

export const CONDICOES = {
  excelente: { rotulo: 'Excelente', badge: 'badge-success' },
  bom: { rotulo: 'Bom', badge: 'badge-success' },
  regular: { rotulo: 'Regular', badge: 'badge-warning' },
  ruim: { rotulo: 'Ruim', badge: 'badge-danger' },
  quebrado: { rotulo: 'Quebrado', badge: 'badge-danger' },
};

export const GRAVIDADES = {
  baixa: { rotulo: 'Baixa', badge: 'badge-secondary' },
  media: { rotulo: 'Média', badge: 'badge-warning' },
  alta: { rotulo: 'Alta', badge: 'badge-danger' },
  critica: { rotulo: 'Crítica', badge: 'badge-danger' },
};

// Tipos de movimentação do histórico
export const TIPOS_MOVIMENTACAO = {
  criacao: { rotulo: 'Cadastro' },
  atualizacao: { rotulo: 'Atualização' },
  status: { rotulo: 'Mudança de status' },
  transferencia: { rotulo: 'Transferência' },
  transferencia_responsavel: { rotulo: 'Troca de responsável' },
  transferencia_urgente: { rotulo: 'Entre eventos' },
};

export const rotulo = (tabela, valor) => tabela[valor]?.rotulo || valor;

// <option> para cada valor de uma das tabelas acima
export const Opcoes = ({ tabela }) =>
  Object.entries(tabela).map(([valor, { rotulo: texto }]) => (
    <option key={valor} value={valor}>{texto}</option>
  ));

// <span> com a cor e o rótulo de um valor de uma das tabelas acima
export const Badge = ({ tabela, valor }) => (
  <span className={`badge ${tabela[valor]?.badge || 'badge-secondary'}`}>
    {rotulo(tabela, valor)}
  </span>
);
