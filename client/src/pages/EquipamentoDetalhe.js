import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { equipamentos, depositos, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import CamposEquipamento, { CAMPOS_VAZIOS } from '../components/CamposEquipamento';
import ReportarProblemaModal from '../components/ReportarProblemaModal';
import { STATUS_EQUIPAMENTO, CONDICOES, GRAVIDADES, TIPOS_MOVIMENTACAO, Badge, rotulo } from '../equipamento';
import { dataHora } from '../formatacao';
import './EquipamentoDetalhe.css';

// Só dá para entrar em manutenção estando no depósito (o servidor recusa em evento ou em
// transferência); sair dela é sempre possível
const PODE_ALTERNAR_MANUTENCAO = ['disponivel', 'com_problema', 'manutencao'];

// "Origem → Destino" de uma movimentação; na mudança de status, os dois status por extenso
const deOndeParaOnde = ({ tipo_movimentacao: tipo, origem, destino }) => {
  if (!origem && !destino) return '-';
  const texto = (valor) => (tipo === 'status' ? rotulo(STATUS_EQUIPAMENTO, valor) : valor) || '-';
  return `${texto(origem)} → ${texto(destino)}`;
};

function EquipamentoDetalhe() {
  const { id } = useParams();
  const { isGestor } = useAuth();
  const gestor = isGestor();
  const [equipamento, setEquipamento] = useState(null);
  const [erro, setErro] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [listaDepositos, setListaDepositos] = useState([]);
  // Dados do formulário de edição (null = fechado) e os valores lidos ao abri-lo
  const [edicao, setEdicao] = useState(null);
  const [original, setOriginal] = useState(null);
  const [reportando, setReportando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await equipamentos.buscarPorId(id);
      setEquipamento(data);
      setErro(null);
    } catch (error) {
      console.error('Erro ao carregar equipamento:', error);
      setErro(mensagemDeErro(error, 'Erro ao carregar equipamento'));
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // O formulário parte do equipamento relido do servidor (a tela pode estar desatualizada).
  // Categorias e depósitos só servem à edição: lidos na primeira vez que ela abre.
  const abrirEdicao = async () => {
    try {
      const [{ data: atual }, listas] = await Promise.all([
        equipamentos.buscarPorId(id),
        categorias.length === 0 ? Promise.all([equipamentos.listarCategorias(), depositos.listar()]) : null,
      ]);
      if (listas) {
        setCategorias(listas[0].data);
        setListaDepositos(listas[1].data);
      }
      const valores = Object.fromEntries(Object.keys(CAMPOS_VAZIOS).map((campo) => [campo, String(atual[campo] ?? '')]));
      setOriginal(valores);
      setEdicao(valores);
    } catch (error) {
      console.error('Erro ao carregar categorias e depósitos:', error);
      alert(mensagemDeErro(error, 'Erro ao carregar categorias e depósitos'));
    }
  };

  // Executa uma ação, recarrega o detalhe e avisa; devolve se deu certo
  const executar = async (acao, sucesso, erroPadrao) => {
    try {
      await acao();
    } catch (error) {
      console.error(erroPadrao, error);
      alert(mensagemDeErro(error, erroPadrao));
      return false;
    }
    await carregar();
    alert(sucesso);
    return true;
  };

  const atualizar = (dados, sucesso) =>
    executar(() => equipamentos.atualizar(id, dados), sucesso, 'Erro ao atualizar equipamento');

  // Envia só o que a pessoa mudou: o resto (ex.: depósito alterado por uma transferência
  // concluída enquanto o formulário estava aberto) fica como está no servidor
  const salvarEdicao = async (e) => {
    e.preventDefault();
    const dados = edicao;
    const alterados = Object.fromEntries(Object.entries(dados).filter(([campo, valor]) => valor !== original[campo]));
    setEdicao(null);
    if (Object.keys(alterados).length === 0) return;
    // Se falhar, reabre o formulário com o que foi digitado
    if (!(await atualizar(alterados, 'Equipamento atualizado com sucesso!'))) setEdicao(dados);
  };

  const alternarManutencao = () => {
    if (equipamento.status === 'manutencao') {
      atualizar({ status: 'disponivel' }, 'Equipamento liberado da manutenção.');
    } else if (window.confirm(`Colocar ${equipamento.codigo} em manutenção? Ele não poderá ser transferido nem alocado em evento até ser liberado.`)) {
      atualizar({ status: 'manutencao' }, 'Equipamento em manutenção.');
    }
  };

  const resolverProblema = (problema) => {
    if (!window.confirm(`Marcar como resolvido: "${problema.descricao}"?`)) return;
    executar(() => equipamentos.resolverProblema(id, problema.id), 'Problema resolvido!', 'Erro ao resolver problema');
  };

  if (erro) {
    return (
      <div className="equipamento-detalhe">
        <Link to="/equipamentos">← Equipamentos</Link>
        <p className="alert alert-danger">{erro}</p>
      </div>
    );
  }

  if (!equipamento) {
    return <LoadingSpinner size="large" message="Carregando equipamento..." />;
  }

  const informacoes = [
    ['Categoria', equipamento.categoria_nome],
    ['Depósito', equipamento.deposito_nome],
    ['Marca', equipamento.marca],
    ['Modelo', equipamento.modelo],
    ['Número de série', equipamento.numero_serie],
    ['Tombamento', equipamento.tombamento],
    ['Cadastrado em', dataHora(equipamento.criado_em)],
    ['Observações', equipamento.observacoes],
  ];
  const problemasAbertos = equipamento.problemas.filter((p) => !p.resolvido);

  return (
    <div className="equipamento-detalhe">
      <Link to="/equipamentos">← Equipamentos</Link>

      <div className="page-header">
        <h1>{equipamento.codigo} · {equipamento.nome}</h1>
        <div className="page-header-actions">
          <button className="btn btn-warning" onClick={() => setReportando(true)}>
            Reportar Problema
          </button>
          {gestor && (
            <>
              {PODE_ALTERNAR_MANUTENCAO.includes(equipamento.status) && (
                <button className="btn btn-secondary" onClick={alternarManutencao}>
                  {equipamento.status === 'manutencao' ? 'Liberar da manutenção' : 'Colocar em manutenção'}
                </button>
              )}
              <button className="btn btn-primary" onClick={abrirEdicao}>
                Editar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card">
        <div className="detalhe-status">
          <span>Status: <Badge tabela={STATUS_EQUIPAMENTO} valor={equipamento.status} /></span>
          <span>Condição: <Badge tabela={CONDICOES} valor={equipamento.condicao} /></span>
        </div>
        <dl className="detalhe-info">
          {informacoes.map(([titulo, valor]) => (
            <div key={titulo}>
              <dt>{titulo}</dt>
              <dd>{valor || '-'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h2>Problemas {problemasAbertos.length > 0 && <small>({problemasAbertos.length} em aberto)</small>}</h2>
        {equipamento.problemas.length === 0 ? (
          <p className="empty-state">Nenhum problema reportado</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Gravidade</th>
                <th>Descrição</th>
                <th>Reportado</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {equipamento.problemas.map((p) => (
                <tr key={p.id}>
                  <td><Badge tabela={GRAVIDADES} valor={p.gravidade} /></td>
                  <td>{p.descricao}</td>
                  <td>{p.reportado_por_nome}<br /><small>{dataHora(p.data_relato)}</small></td>
                  <td>
                    {p.resolvido ? (
                      <>Resolvido<br /><small>{dataHora(p.data_resolucao)}</small></>
                    ) : gestor ? (
                      <button className="btn btn-sm btn-success" onClick={() => resolverProblema(p)}>
                        Resolver
                      </button>
                    ) : (
                      'Em aberto'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Histórico <small>(últimas 20 movimentações)</small></h2>
        {equipamento.historico.length === 0 ? (
          <p className="empty-state">Nenhuma movimentação registrada</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Origem → Destino</th>
                <th>Por</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              {equipamento.historico.map((h) => (
                <tr key={h.id}>
                  <td>{dataHora(h.data_movimentacao)}</td>
                  <td>{rotulo(TIPOS_MOVIMENTACAO, h.tipo_movimentacao)}</td>
                  <td>{deOndeParaOnde(h)}</td>
                  <td>{h.usuario_nome}</td>
                  <td>{h.observacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reportando && (
        <ReportarProblemaModal
          equipamento={equipamento}
          onClose={() => setReportando(false)}
          onReportado={() => {
            setReportando(false);
            carregar();
          }}
        />
      )}

      {edicao && (
        <div className="modal-overlay" onClick={() => setEdicao(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar {equipamento.codigo}</h2>
              <button className="close-btn" onClick={() => setEdicao(null)}>×</button>
            </div>

            <form onSubmit={salvarEdicao}>
              <CamposEquipamento
                dados={edicao}
                onChange={setEdicao}
                categorias={categorias}
                depositos={listaDepositos}
                prefixoId="editar"
              />

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEdicao(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EquipamentoDetalhe;
