const { getAsync, allAsync } = require('../database/init');
const { condicaoVisibilidade } = require('../services/transferencias');

const STATUS_EQUIPAMENTO = ['disponivel', 'em_uso', 'com_problema', 'transferencia', 'manutencao'];

const dashboardController = {
  // Números do painel inicial, calculados no banco: o cliente só recebe a primeira
  // página da listagem de equipamentos e não tem como contar o inventário inteiro.
  async resumo(req, res) {
    try {
      const { clause, params } = condicaoVisibilidade(req.user);

      const [porStatus, pendentes, eventosAtivos, transferencias, problemas] = await Promise.all([
        allAsync('SELECT status, COUNT(*) AS total FROM equipamentos GROUP BY status'),
        getAsync(
          `SELECT COUNT(*) AS total FROM transferencias t WHERE ${clause} AND t.status = 'pendente'`,
          params
        ),
        getAsync("SELECT COUNT(*) AS total FROM eventos WHERE status = 'em_andamento'"),
        allAsync(
          `SELECT t.status, t.data_solicitacao, e.nome AS equipamento_nome
           FROM transferencias t
           LEFT JOIN equipamentos e ON t.equipamento_id = e.id
           WHERE ${clause} AND t.status IN ('pendente', 'aprovada_coordenador')
           ORDER BY t.data_solicitacao DESC, t.id DESC
           LIMIT 5`,
          params
        ),
        allAsync(
          `SELECT p.data_relato, e.codigo, e.nome
           FROM problemas_equipamentos p
           JOIN equipamentos e ON p.equipamento_id = e.id
           WHERE p.resolvido = 0
           ORDER BY p.data_relato DESC, p.id DESC
           LIMIT 5`
        )
      ]);

      const equipamentos = { total: 0 };
      STATUS_EQUIPAMENTO.forEach((status) => { equipamentos[status] = 0; });
      porStatus.forEach(({ status, total }) => {
        equipamentos[status] = total;
        equipamentos.total += total;
      });

      const atividades = [
        ...transferencias.map((t) => ({
          tipo: 'transferencia',
          descricao: `Transferência de ${t.equipamento_nome} - ${t.status}`,
          data: t.data_solicitacao
        })),
        ...problemas.map((p) => ({
          tipo: 'problema',
          descricao: `${p.codigo} - ${p.nome} com problema reportado`,
          data: p.data_relato
        }))
      ]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .slice(0, 10);

      res.json({
        equipamentos,
        transferencias_pendentes: pendentes.total,
        eventos_ativos: eventosAtivos.total,
        atividades
      });
    } catch (error) {
      console.error('Erro ao montar resumo do dashboard:', error);
      res.status(500).json({ error: 'Erro ao carregar o resumo' });
    }
  }
};

module.exports = dashboardController;
