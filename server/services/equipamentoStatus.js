// O status de um equipamento é DERIVADO do que está acontecendo com ele, em vez de
// cada controller sobrescrevê-lo "na mão" (o que fazia, por exemplo, um equipamento
// alocado em evento voltar a "disponível" ao resolver um problema, ou ficar
// "em_uso" para sempre depois do evento acabar).
//
// Prioridade:
//   1. problema grave (alta/crítica) não resolvido  -> com_problema
//   2. transferência em andamento                   -> transferencia
//   3. alocado em evento planejado/aprovado/andamento -> em_uso
//   4. caso contrário                               -> disponivel
// "manutencao" é decisão manual e nunca é sobrescrita automaticamente.

const { getAsync, runAsync } = require('../database/init');

const STATUS_TRANSFERENCIA_ATIVA = ['pendente', 'aprovada_coordenador', 'em_transito'];
const STATUS_EVENTO_ATIVO = ['planejamento', 'aprovado', 'em_andamento'];
const GRAVIDADES_GRAVES = ['alta', 'critica'];

const lista = (valores) => valores.map(() => '?').join(', ');

async function calcularStatus(equipamentoId) {
  const problemaGrave = await getAsync(
    `SELECT id FROM problemas_equipamentos
     WHERE equipamento_id = ? AND resolvido = 0 AND gravidade IN (${lista(GRAVIDADES_GRAVES)})
     LIMIT 1`,
    [equipamentoId, ...GRAVIDADES_GRAVES]
  );
  if (problemaGrave) return 'com_problema';

  const transferencia = await getAsync(
    `SELECT id FROM transferencias
     WHERE equipamento_id = ? AND status IN (${lista(STATUS_TRANSFERENCIA_ATIVA)})
     LIMIT 1`,
    [equipamentoId, ...STATUS_TRANSFERENCIA_ATIVA]
  );
  if (transferencia) return 'transferencia';

  const alocacao = await getAsync(
    `SELECT ee.id FROM equipamentos_evento ee
     JOIN eventos ev ON ev.id = ee.evento_id
     WHERE ee.equipamento_id = ? AND ee.status != 'devolvido'
       AND ev.status IN (${lista(STATUS_EVENTO_ATIVO)})
     LIMIT 1`,
    [equipamentoId, ...STATUS_EVENTO_ATIVO]
  );
  if (alocacao) return 'em_uso';

  return 'disponivel';
}

// Recalcula e grava o status. Devolve o status final (ou null se o equipamento não existe).
async function recalcularStatus(equipamentoId) {
  const equipamento = await getAsync('SELECT status FROM equipamentos WHERE id = ?', [equipamentoId]);
  if (!equipamento) return null;
  if (equipamento.status === 'manutencao') return 'manutencao';

  const novoStatus = await calcularStatus(equipamentoId);
  if (novoStatus !== equipamento.status) {
    await runAsync(
      'UPDATE equipamentos SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [novoStatus, equipamentoId]
    );
  }
  return novoStatus;
}

async function temProblemaGrave(equipamentoId) {
  const problema = await getAsync(
    `SELECT id FROM problemas_equipamentos
     WHERE equipamento_id = ? AND resolvido = 0 AND gravidade IN (${lista(GRAVIDADES_GRAVES)})
     LIMIT 1`,
    [equipamentoId, ...GRAVIDADES_GRAVES]
  );
  return Boolean(problema);
}

module.exports = {
  STATUS_TRANSFERENCIA_ATIVA,
  STATUS_EVENTO_ATIVO,
  GRAVIDADES_GRAVES,
  calcularStatus,
  recalcularStatus,
  temProblemaGrave
};
