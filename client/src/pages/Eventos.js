import React, { useState, useEffect } from 'react';
import { eventos, equipamentos as equipamentosAPI } from '../services/api';
import './Eventos.css';

function Eventos() {
  const [eventosList, setEventosList] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEquipamentosModal, setShowEquipamentosModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState(null);
  const [checklistResult, setChecklistResult] = useState(null);
  const [equipamentosList, setEquipamentosList] = useState([]);

  const [formData, setFormData] = useState({
    nome: '',
    local: '',
    template_id: '',
    data_inicio: '',
    data_fim: '',
    observacoes: '',
  });

  const [selectedEquipamentos, setSelectedEquipamentos] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventosResponse, templatesResponse, equipamentosResponse] = await Promise.all([
        eventos.listar(),
        eventos.listarTemplates(),
        equipamentosAPI.listar(),
      ]);

      setEventosList(eventosResponse.data);
      setTemplates(templatesResponse.data);
      setEquipamentosList(equipamentosResponse.data);
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      alert('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await eventos.criar(formData);
      alert('Evento criado com sucesso!');
      setShowModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      alert(error.response?.data?.error || 'Erro ao criar evento');
    }
  };

  const handleAdicionarEquipamentos = async (e) => {
    e.preventDefault();

    if (selectedEquipamentos.length === 0) {
      alert('Selecione pelo menos um equipamento');
      return;
    }

    try {
      const equipamentosData = selectedEquipamentos.map(id => ({
        equipamento_id: id,
        area: 'geral',
        quantidade: 1,
      }));

      await eventos.adicionarEquipamentos(selectedEvento.id, equipamentosData);
      alert('Equipamentos adicionados com sucesso!');
      setShowEquipamentosModal(false);
      setSelectedEquipamentos([]);
      loadData();
    } catch (error) {
      console.error('Erro ao adicionar equipamentos:', error);
      alert('Erro ao adicionar equipamentos');
    }
  };

  const handleValidarChecklist = async (evento) => {
    try {
      const response = await eventos.validarChecklist(evento.id);
      setChecklistResult(response.data);
      setSelectedEvento(evento);
      setShowChecklistModal(true);
    } catch (error) {
      console.error('Erro ao validar checklist:', error);
      alert('Erro ao validar checklist');
    }
  };

  const handleAtualizarStatus = async (eventoId, novoStatus) => {
    try {
      await eventos.atualizarStatus(eventoId, novoStatus);
      alert('Status atualizado com sucesso!');
      loadData();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(error.response?.data?.error || 'Erro ao atualizar status');
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      local: '',
      template_id: '',
      data_inicio: '',
      data_fim: '',
      observacoes: '',
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      planejamento: 'badge-secondary',
      aprovado: 'badge-success',
      em_andamento: 'badge-primary',
      concluido: 'badge-info',
      cancelado: 'badge-danger',
    };
    return badges[status] || 'badge-secondary';
  };

  const toggleEquipamento = (id) => {
    if (selectedEquipamentos.includes(id)) {
      setSelectedEquipamentos(selectedEquipamentos.filter(eqId => eqId !== id));
    } else {
      setSelectedEquipamentos([...selectedEquipamentos, id]);
    }
  };

  if (loading) {
    return <div className="loading">Carregando eventos...</div>;
  }

  return (
    <div className="eventos-page">
      <div className="page-header">
        <h1>Gestão de Eventos</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo Evento
        </button>
      </div>

      <div className="info-box card">
        <h3>Sistema de Checklist Automático</h3>
        <p>
          Ao criar um evento com template, o sistema valida automaticamente se todos os equipamentos
          obrigatórios foram incluídos. Isso previne esquecimentos e garante que o evento tenha
          tudo que precisa!
        </p>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Local</th>
              <th>Template</th>
              <th>Data</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {eventosList.map((evento) => (
              <tr key={evento.id}>
                <td><strong>{evento.nome}</strong></td>
                <td>{evento.local}</td>
                <td>
                  {evento.template_nome ? (
                    <span className="badge badge-info">{evento.template_nome}</span>
                  ) : (
                    <span className="badge badge-secondary">Sem template</span>
                  )}
                </td>
                <td>
                  {new Date(evento.data_inicio).toLocaleDateString('pt-BR')}
                  {' - '}
                  {new Date(evento.data_fim).toLocaleDateString('pt-BR')}
                </td>
                <td>
                  <span className={`badge ${getStatusBadge(evento.status)}`}>
                    {evento.status}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setSelectedEvento(evento);
                        setShowEquipamentosModal(true);
                      }}
                    >
                      Adicionar Equipamentos
                    </button>
                    {evento.template_id && (
                      <button
                        className="btn btn-sm btn-warning"
                        onClick={() => handleValidarChecklist(evento)}
                      >
                        Validar Checklist
                      </button>
                    )}
                    {evento.status === 'planejamento' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleAtualizarStatus(evento.id, 'aprovado')}
                      >
                        Aprovar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {eventosList.length === 0 && (
          <p className="empty-state">Nenhum evento encontrado</p>
        )}
      </div>

      {/* Modal de Novo Evento */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo Evento</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome do Evento *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Local *</label>
                <input
                  type="text"
                  value={formData.local}
                  onChange={(e) => setFormData({ ...formData, local: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Template do Evento</label>
                <select
                  value={formData.template_id}
                  onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
                >
                  <option value="">Sem template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.nome} ({template.tamanho})
                    </option>
                  ))}
                </select>
                <small>Templates incluem checklists automáticos de equipamentos</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Data de Início *</label>
                  <input
                    type="datetime-local"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Data de Fim *</label>
                  <input
                    type="datetime-local"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Evento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Adicionar Equipamentos */}
      {showEquipamentosModal && selectedEvento && (
        <div className="modal-overlay" onClick={() => setShowEquipamentosModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Equipamentos - {selectedEvento.nome}</h2>
              <button className="close-btn" onClick={() => setShowEquipamentosModal(false)}>×</button>
            </div>

            <form onSubmit={handleAdicionarEquipamentos}>
              <div className="equipamentos-list">
                {equipamentosList
                  .filter(eq => eq.status === 'disponivel')
                  .map((eq) => (
                    <label key={eq.id} className="equipamento-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedEquipamentos.includes(eq.id)}
                        onChange={() => toggleEquipamento(eq.id)}
                      />
                      <div className="equipamento-info-inline">
                        <strong>{eq.codigo}</strong> - {eq.nome}
                        <span className="badge badge-secondary">{eq.categoria_nome}</span>
                      </div>
                    </label>
                  ))}
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEquipamentosModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Adicionar {selectedEquipamentos.length} Equipamento(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Resultado do Checklist */}
      {showChecklistModal && checklistResult && selectedEvento && (
        <div className="modal-overlay" onClick={() => setShowChecklistModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Resultado do Checklist</h2>
              <button className="close-btn" onClick={() => setShowChecklistModal(false)}>×</button>
            </div>

            <div className={`alert ${checklistResult.valido ? 'alert-success' : 'alert-warning'}`}>
              <strong>{checklistResult.mensagem}</strong>
            </div>

            {checklistResult.avisos && checklistResult.avisos.length > 0 && (
              <div className="checklist-avisos">
                <h3>Itens do Checklist:</h3>
                <ul>
                  {checklistResult.avisos.map((aviso, index) => (
                    <li key={index} className={aviso.obrigatorio ? 'obrigatorio' : 'opcional'}>
                      <span className={aviso.obrigatorio ? 'badge badge-danger' : 'badge badge-warning'}>
                        {aviso.obrigatorio ? 'OBRIGATÓRIO' : 'Opcional'}
                      </span>
                      {' '}
                      {aviso.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-primary" onClick={() => setShowChecklistModal(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Eventos;
