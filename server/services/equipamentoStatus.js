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

const { getAsync, runAsync, placeholders } = require('../database/init');
const { STATUS_TRANSFERENCIA_ATIVA } = require('./transferencias');
const { STATUS_EVENTO_ATIVO } = require('./eventos');

const STATUS_EQUIPAMENTO = ['disponivel', 'em_uso', 'com_problema', 'transferencia', 'manutencao'];
// Os únicos que o usuário define; os demais são derivados
const STATUS_MANUAIS = ['disponivel', 'manutencao'];

const GRAVIDADES_GRAVES = ['alta', 'critica'];

// A prioridade acima, calculada pelo banco numa única consulta
const SQL_STATUS_DERIVADO = `CASE
  WHEN EXISTS (SELECT 1 FROM problemas_equipamentos p
               WHERE p.equipamento_id = e.id AND p.resolvido = 0
                 AND p.gravidade IN (${placeholders(GRAVIDADES_GRAVES)})) THEN 'com_problema'
  WHEN EXISTS (SELECT 1 FROM transferencias t
               WHERE t.equipamento_id = e.id
                 AND t.status IN (${placeholders(STATUS_TRANSFERENCIA_ATIVA)})) THEN 'transferencia'
  WHEN EXISTS (SELECT 1 FROM equipamentos_evento ee JOIN eventos ev ON ev.id = ee.evento_id
               WHERE ee.equipamento_id = e.id AND ee.status != 'devolvido'
                 AND ev.status IN (${placeholders(STATUS_EVENTO_ATIVO)})) THEN 'em_uso'
  ELSE 'disponivel'
END`;

const PARAMS_STATUS_DERIVADO = [...GRAVIDADES_GRAVES, ...STATUS_TRANSFERENCIA_ATIVA, ...STATUS_EVENTO_ATIVO];

// { atual, novo } do equipamento, ou undefined se não existe
const consultarStatus = (equipamentoId) =>
  getAsync(
    `SELECT e.status AS atual, ${SQL_STATUS_DERIVADO} AS novo FROM equipamentos e WHERE e.id = ?`,
    [...PARAMS_STATUS_DERIVADO, equipamentoId]
  );

// Status que o equipamento deve ter agora (null se não existe), sem gravar nada
async function calcularStatus(equipamentoId) {
  const consulta = await consultarStatus(equipamentoId);
  return consulta ? consulta.novo : null;
}

// Recalcula e grava o status. Devolve o status final (ou null se o equipamento não existe).
async function recalcularStatus(equipamentoId) {
  const consulta = await consultarStatus(equipamentoId);
  if (!consulta) return null;
  if (consulta.atual === 'manutencao') return 'manutencao';

  if (consulta.novo !== consulta.atual) {
    await runAsync(
      'UPDATE equipamentos SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?',
      [consulta.novo, equipamentoId]
    );
  }
  return consulta.novo;
}

async function temProblemaGrave(equipamentoId) {
  const problema = await getAsync(
    `SELECT id FROM problemas_equipamentos
     WHERE equipamento_id = ? AND resolvido = 0 AND gravidade IN (${placeholders(GRAVIDADES_GRAVES)})
     LIMIT 1`,
    [equipamentoId, ...GRAVIDADES_GRAVES]
  );
  return Boolean(problema);
}

async function temTransferenciaAtiva(equipamentoId) {
  const transferencia = await getAsync(
    `SELECT id FROM transferencias
     WHERE equipamento_id = ? AND status IN (${placeholders(STATUS_TRANSFERENCIA_ATIVA)})
     LIMIT 1`,
    [equipamentoId, ...STATUS_TRANSFERENCIA_ATIVA]
  );
  return Boolean(transferencia);
}

module.exports = {
  STATUS_EQUIPAMENTO,
  STATUS_MANUAIS,
  GRAVIDADES_GRAVES,
  calcularStatus,
  recalcularStatus,
  temProblemaGrave,
  temTransferenciaAtiva
};
