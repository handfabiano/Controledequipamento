import React, { useState, useEffect } from 'react';
import { transferencias, equipamentos, depositos, eventos, usuarios, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PERFIS } from '../perfis';
import { STATUS_EVENTO_ATIVO } from '../statusEvento';
import './Transferencias.css';

const TIPOS_LOCAL = { deposito: 'Depósito', evento: 'Evento', usuario: 'Usuário' };

const LADOS = [
  { lado: 'origem', rotulo: 'Origem', obrigatorio: false },
  { lado: 'destino', rotulo: 'Destino', obrigatorio: true },
];

// Quem pode ser designado em cada etapa: o perfil da etapa ou um coordenador
const RESPONSAVEIS = [
  { campo: 'coordenador_id', rotulo: PERFIS.coordenador, perfis: ['coordenador'] },
  { campo: 'responsavel_entrega_id', rotulo: PERFIS.responsavel_entrega, perfis: ['responsavel_entrega', 'coordenador'] },
  { campo: 'responsavel_recebimento_id', rotulo: PERFIS.responsavel_recebimento, perfis: ['responsavel_recebimento', 'coordenador'] },
];

const FORM_VAZIO = {
  equipamento_id: '',
  origem_tipo: 'deposito',
  origem_id: '',
  destino_tipo: 'deposito',
  destino_id: '',
  coordenador_id: '',
  responsavel_entrega_id: '',
  responsavel_recebimento_id: '',
  motivo: '',
  observacoes: '',
};

function Transferencias() {
  const { user, isCoordenador } = useAuth();
  const [transferenciasList, setTransferenciasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [equipamentosList, setEquipamentosList] = useState([]);
  // Locais e pessoas para escolher pelo nome, relidos a cada abertura do formulário
  const [referencias, setReferencias] = useState({ depositos: [], eventos: [], pessoas: [] });
  const [formData, setFormData] = useState(FORM_VAZIO);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transferResponse, equipamentosTodos] = await Promise.all([
        transferencias.listar(),
        equipamentos.listarTodos(),
      ]);
      setTransferenciasList(transferResponse.data);
      setEquipamentosList(equipamentosTodos);
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
      alert(mensagemDeErro(error, 'Erro ao carregar transferências'));
    } finally {
      setLoading(false);
    }
  };

  const carregarReferencias = async () => {
    try {
      const [depositosResponse, eventosResponse, pessoasResponse] = await Promise.all([
        depositos.listar(),
        eventos.listar(),
        usuarios.ativos(),
      ]);
      setReferencias({
        depositos: depositosResponse.data,
        eventos: eventosResponse.data.filter((ev) => STATUS_EVENTO_ATIVO.includes(ev.status)),
        pessoas: pessoasResponse.data,
      });
    } catch (error) {
      console.error('Erro ao carregar locais e pessoas:', error);
      alert(mensagemDeErro(error, 'Erro ao carregar locais e pessoas'));
    }
  };

  // Opções por nome de cada tipo de local (só eventos ainda abertos recebem equipamento)
  const opcoesDoLocal = {
    deposito: referencias.depositos,
    evento: referencias.eventos.map(({ id, nome, local }) => ({ id, nome: `${nome} (${local})` })),
    usuario: referencias.pessoas,
  };

  const campo = (nome, extra = {}) => ({
    value: formData[nome],
    onChange: (e) => setFormData({ ...formData, [nome]: e.target.value, ...extra }),
  });

  // Escolher o equipamento sugere como origem o depósito onde ele está. Em uso, ele está num
  // evento ou com alguém, então a origem fica para a pessoa escolher.
  const escolherEquipamento = (e) => {
    const equipamento = equipamentosList.find((eq) => String(eq.id) === e.target.value);
    const noDeposito = equipamento?.status === 'disponivel' && equipamento.deposito_id;
    setFormData({
      ...formData,
      equipamento_id: e.target.value,
      ...(noDeposito
        ? { origem_tipo: 'deposito', origem_id: String(equipamento.deposito_id) }
        : { origem_id: '' }),
    });
  };

  const abrirModal = () => {
    setShowModal(true);
    carregarReferencias();
  };

  const fecharModal = () => {
    setShowModal(false);
    setFormData(FORM_VAZIO);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await transferencias.criar(formData);
      alert('Transferência solicitada com sucesso!');
      fecharModal();
      loadData();
    } catch (error) {
      console.error('Erro ao criar transferência:', error);
      alert(mensagemDeErro(error, 'Erro ao criar transferência'));
    }
  };

  const handleAprovar = async (id, tipo) => {
    try {
      await transferencias.aprovar(id, tipo);
      alert('Aprovação registrada com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      alert(mensagemDeErro(error, 'Erro ao aprovar transferência'));
    }
  };

  const handleCancelar = async (id) => {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;

    try {
      await transferencias.cancelar(id, motivo);
      alert('Transferência cancelada!');
      loadData();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      alert(mensagemDeErro(error, 'Erro ao cancelar transferência'));
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pendente: 'badge-warning',
      aprovada_coordenador: 'badge-info',
      em_transito: 'badge-primary',
      concluida: 'badge-success',
      cancelada: 'badge-danger',
    };
    return badges[status] || 'badge-secondary';
  };

  if (loading) {
    return <div className="loading">Carregando transferências...</div>;
  }

  return (
    <div className="transferencias-page">
      <div className="page-header">
        <h1>Transferências</h1>
        <button className="btn btn-primary" onClick={abrirModal}>
          + Nova Transferência
        </button>
      </div>

      <div className="info-box card">
        <h3>Sistema de Aprovação Tripla</h3>
        <p>Todas as transferências precisam de aprovação em 3 etapas:</p>
        <ol>
          <li><strong>Coordenador:</strong> Aprova a transferência</li>
          <li><strong>Responsável pela Entrega:</strong> Confirma a retirada</li>
          <li><strong>Responsável pelo Recebimento:</strong> Confirma o recebimento</li>
        </ol>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Equipamento</th>
              <th>Origem → Destino</th>
              <th>Solicitante</th>
              <th>Status</th>
              <th>Aprovações</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {transferenciasList.map((trans) => (
              <tr key={trans.id}>
                <td><strong>#{trans.id}</strong></td>
                <td>
                  {trans.equipamento_codigo}<br />
                  <small>{trans.equipamento_nome}</small>
                </td>
                <td>
                  {trans.origem_nome || 'Não informada'} <small>({TIPOS_LOCAL[trans.origem_tipo]})</small>
                  {' → '}
                  {trans.destino_nome} <small>({TIPOS_LOCAL[trans.destino_tipo]})</small>
                </td>
                <td>{trans.solicitante_nome}</td>
                <td>
                  <span className={`badge ${getStatusBadge(trans.status)}`}>
                    {trans.status.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <div className="aprovacoes">
                    <span className={trans.aprovacao_coordenador ? 'aprovado' : 'pendente'}>
                      Coord: {trans.aprovacao_coordenador ? '✓' : '⏳'}
                    </span>
                    <span className={trans.aprovacao_entrega ? 'aprovado' : 'pendente'}>
                      Entrega: {trans.aprovacao_entrega ? '✓' : '⏳'}
                    </span>
                    <span className={trans.aprovacao_recebimento ? 'aprovado' : 'pendente'}>
                      Receb: {trans.aprovacao_recebimento ? '✓' : '⏳'}
                    </span>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    {trans.pode_aprovar?.coordenador && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'coordenador')}
                      >
                        Aprovar (Coord)
                      </button>
                    )}
                    {trans.pode_aprovar?.entrega && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'entrega')}
                      >
                        Confirmar Entrega
                      </button>
                    )}
                    {trans.pode_aprovar?.recebimento && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'recebimento')}
                      >
                        Confirmar Recebimento
                      </button>
                    )}
                    {trans.status !== 'concluida' && trans.status !== 'cancelada' &&
                      (isCoordenador() || trans.solicitante_id === user?.id) && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleCancelar(trans.id)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {transferenciasList.length === 0 && (
          <p className="empty-state">Nenhuma transferência encontrada</p>
        )}
      </div>

      {/* Modal de Nova Transferência */}
      {showModal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova Transferência</h2>
              <button className="close-btn" onClick={fecharModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="transf-equipamento">Equipamento *</label>
                <select id="transf-equipamento" value={formData.equipamento_id} onChange={escolherEquipamento} required>
                  <option value="">Selecione...</option>
                  {equipamentosList
                    .filter(eq => eq.status === 'disponivel' || eq.status === 'em_uso')
                    .map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.codigo} - {eq.nome} ({eq.status})
                      </option>
                    ))}
                </select>
              </div>

              {LADOS.map(({ lado, rotulo, obrigatorio }) => (
                <div className="form-row" key={lado}>
                  <div className="form-group">
                    <label htmlFor={`transf-${lado}-tipo`}>{rotulo}: tipo{obrigatorio && ' *'}</label>
                    {/* Trocar o tipo limpa o local escolhido: ids de tipos diferentes não se misturam */}
                    <select id={`transf-${lado}-tipo`} {...campo(`${lado}_tipo`, { [`${lado}_id`]: '' })}>
                      {Object.entries(TIPOS_LOCAL).map(([valor, nome]) => (
                        <option key={valor} value={valor}>{nome}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor={`transf-${lado}-id`}>{rotulo}{obrigatorio && ' *'}</label>
                    <select id={`transf-${lado}-id`} {...campo(`${lado}_id`)} required={obrigatorio}>
                      <option value="">{obrigatorio ? 'Selecione...' : 'Não informar'}</option>
                      {opcoesDoLocal[formData[`${lado}_tipo`]].map((local) => (
                        <option key={local.id} value={local.id}>{local.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}

              <fieldset className="responsaveis">
                <legend>Quem aprova cada etapa (opcional)</legend>
                <small>Sem ninguém designado, qualquer pessoa do perfil da etapa pode aprovar.</small>
                {RESPONSAVEIS.map(({ campo: nome, rotulo, perfis }) => (
                  <div className="form-group" key={nome}>
                    <label htmlFor={`transf-${nome}`}>{rotulo}</label>
                    <select id={`transf-${nome}`} {...campo(nome)}>
                      <option value="">Qualquer um do perfil</option>
                      {referencias.pessoas
                        .filter((p) => perfis.includes(p.tipo))
                        .map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                    </select>
                  </div>
                ))}
              </fieldset>

              <div className="form-group">
                <label htmlFor="transf-motivo">Motivo</label>
                <input id="transf-motivo" type="text" {...campo('motivo')} placeholder="Motivo da transferência..." />
              </div>

              <div className="form-group">
                <label htmlFor="transf-observacoes">Observações</label>
                <textarea id="transf-observacoes" {...campo('observacoes')} placeholder="Observações adicionais..." />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Solicitar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transferencias;
