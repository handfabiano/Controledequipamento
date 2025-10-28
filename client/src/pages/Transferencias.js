import React, { useState, useEffect } from 'react';
import { transferencias, equipamentos } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Transferencias.css';

function Transferencias() {
  const { user } = useAuth();
  const [transferenciasList, setTransferenciasList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [equipamentosList, setEquipamentosList] = useState([]);

  const [formData, setFormData] = useState({
    equipamento_id: '',
    origem_tipo: 'deposito',
    origem_id: '',
    destino_tipo: 'deposito',
    destino_id: '',
    motivo: '',
    observacoes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transferResponse, equipResponse] = await Promise.all([
        transferencias.listar(),
        equipamentos.listar(),
      ]);

      // Suporte para resposta paginada (nova estrutura) e array direto (retrocompatibilidade)
      setTransferenciasList(transferResponse.data.data || transferResponse.data);
      setEquipamentosList(equipResponse.data.data || equipResponse.data);
    } catch (error) {
      console.error('Erro ao carregar transferências:', error);
      alert('Erro ao carregar transferências');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await transferencias.criar(formData);
      alert('Transferência solicitada com sucesso!');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Erro ao criar transferência:', error);
      alert(error.response?.data?.error || 'Erro ao criar transferência');
    }
  };

  const handleAprovar = async (id, tipo) => {
    try {
      await transferencias.aprovar(id, tipo);
      alert('Aprovação registrada com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      alert(error.response?.data?.error || 'Erro ao aprovar transferência');
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
      alert(error.response?.data?.error || 'Erro ao cancelar transferência');
    }
  };

  const resetForm = () => {
    setFormData({
      equipamento_id: '',
      origem_tipo: 'deposito',
      origem_id: '',
      destino_tipo: 'deposito',
      destino_id: '',
      motivo: '',
      observacoes: '',
    });
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

  const canApprove = (transferencia, tipo) => {
    if (transferencia.status === 'concluida' || transferencia.status === 'cancelada') {
      return false;
    }

    switch (tipo) {
      case 'coordenador':
        return user?.tipo === 'coordenador' && !transferencia.aprovacao_coordenador;
      case 'entrega':
        return (user?.tipo === 'responsavel_entrega' || user?.tipo === 'coordenador') &&
               !transferencia.aprovacao_entrega;
      case 'recebimento':
        return (user?.tipo === 'responsavel_recebimento' || user?.tipo === 'coordenador') &&
               !transferencia.aprovacao_recebimento &&
               transferencia.aprovacao_entrega;
      default:
        return false;
    }
  };

  if (loading) {
    return <div className="loading">Carregando transferências...</div>;
  }

  return (
    <div className="transferencias-page">
      <div className="page-header">
        <h1>Transferências</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
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
                  <span className="badge badge-secondary">{trans.origem_tipo}</span>
                  →
                  <span className="badge badge-secondary">{trans.destino_tipo}</span>
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
                    {canApprove(trans, 'coordenador') && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'coordenador')}
                      >
                        Aprovar (Coord)
                      </button>
                    )}
                    {canApprove(trans, 'entrega') && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'entrega')}
                      >
                        Confirmar Entrega
                      </button>
                    )}
                    {canApprove(trans, 'recebimento') && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAprovar(trans.id, 'recebimento')}
                      >
                        Confirmar Recebimento
                      </button>
                    )}
                    {trans.status !== 'concluida' && trans.status !== 'cancelada' && (
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nova Transferência</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Equipamento *</label>
                <select
                  value={formData.equipamento_id}
                  onChange={(e) => setFormData({ ...formData, equipamento_id: e.target.value })}
                  required
                >
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

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Origem</label>
                  <select
                    value={formData.origem_tipo}
                    onChange={(e) => setFormData({ ...formData, origem_tipo: e.target.value })}
                  >
                    <option value="deposito">Depósito</option>
                    <option value="evento">Evento</option>
                    <option value="usuario">Usuário</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>ID Origem</label>
                  <input
                    type="number"
                    value={formData.origem_id}
                    onChange={(e) => setFormData({ ...formData, origem_id: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tipo de Destino *</label>
                  <select
                    value={formData.destino_tipo}
                    onChange={(e) => setFormData({ ...formData, destino_tipo: e.target.value })}
                    required
                  >
                    <option value="deposito">Depósito</option>
                    <option value="evento">Evento</option>
                    <option value="usuario">Usuário</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>ID Destino *</label>
                  <input
                    type="number"
                    value={formData.destino_id}
                    onChange={(e) => setFormData({ ...formData, destino_id: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Motivo</label>
                <input
                  type="text"
                  value={formData.motivo}
                  onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                  placeholder="Motivo da transferência..."
                />
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações adicionais..."
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
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
