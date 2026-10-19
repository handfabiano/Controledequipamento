import React, { useState, useEffect, useCallback } from 'react';
import { equipamentos, depositos, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import QRScanner from '../components/QRScanner';
import './Equipamentos.css';

const FORM_VAZIO = {
  codigo: '',
  nome: '',
  categoria_id: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  deposito_id: '',
  condicao: 'bom',
  observacoes: '',
};

// Como o campo de código se comporta em cada modo; `campo` é o nome enviado à API, que
// converte para maiúsculas (na tela, só o CSS mostra em maiúsculas)
const FORMATO_CODIGO = {
  automatico: {
    campo: 'prefixo', rotulo: 'Prefixo *', maxLength: 3, pattern: '[A-Za-z]{3}', placeholder: 'MIC',
    title: '3 letras, ex.: MIC', dica: 'O sistema numera em sequência: MIC0001, MIC0002...',
  },
  manual: {
    campo: 'codigo', rotulo: 'Código *', maxLength: 7, pattern: '[A-Za-z]{3}[0-9]{4}', placeholder: 'MIC0001',
    title: '3 letras e 4 números, ex.: MIC0001', dica: 'Formato XXX0000, ex.: MIC0001',
  },
};

function Equipamentos() {
  const { isGestor } = useAuth();
  const [equipamentosList, setEquipamentosList] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [listaDepositos, setListaDepositos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedEquipamento, setSelectedEquipamento] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [filters, setFilters] = useState({
    status: '',
    categoria_id: '',
    search: '',
  });

  const [formData, setFormData] = useState(FORM_VAZIO);
  // Com o código automático, o campo de código guarda só o prefixo (MIC → MIC0001, MIC0002...)
  const [codigoAutomatico, setCodigoAutomatico] = useState(true);
  const formatoCodigo = FORMATO_CODIGO[codigoAutomatico ? 'automatico' : 'manual'];

  const [problemaData, setProblemaData] = useState({
    descricao: '',
    gravidade: 'media',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      };

      const equipResponse = await equipamentos.listar(params);

      // Handle new pagination response format
      if (equipResponse.data.data) {
        setEquipamentosList(equipResponse.data.data);
        setPagination(equipResponse.data.pagination);
      } else {
        // Fallback for backward compatibility
        setEquipamentosList(equipResponse.data);
      }

    } catch (error) {
      console.error('Erro ao carregar equipamentos:', error);
      alert('Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Categorias e depósitos não mudam com filtro nem página: carregam uma vez
  useEffect(() => {
    Promise.all([equipamentos.listarCategorias(), depositos.listar()])
      .then(([categoriasResponse, depositosResponse]) => {
        setCategorias(categoriasResponse.data);
        setListaDepositos(depositosResponse.data);
      })
      .catch((error) => {
        console.error('Erro ao carregar categorias e depósitos:', error);
        alert('Erro ao carregar categorias e depósitos');
      });
  }, []);

  const handleScan = useCallback(async (decodedText) => {
    setShowScanner(false);

    try {
      // A etiqueta guarda o tombamento (TOMB-AAAA-NNNNNN)
      const response = await equipamentos.buscarPorTombamento(decodedText.trim());
      const eq = response.data;
      // Filtrar a lista pelo código encontrado para exibir o equipamento
      setPagination((prev) => ({ ...prev, page: 1 }));
      setFilters({ status: '', categoria_id: '', search: eq.codigo });
      alert(`Equipamento encontrado: ${eq.codigo} - ${eq.nome}`);
    } catch (error) {
      if (error.response?.status === 404) {
        // Pode ser um QR com o próprio código do equipamento — usar como busca
        setPagination((prev) => ({ ...prev, page: 1 }));
        setFilters({ status: '', categoria_id: '', search: decodedText.trim() });
      } else {
        console.error('Erro ao buscar equipamento escaneado:', error);
        alert('Erro ao buscar equipamento escaneado');
      }
    }
  }, []);

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { codigo, ...dados } = formData;
    try {
      const { data } = await equipamentos.criar({ ...dados, [formatoCodigo.campo]: codigo });
      alert(`Equipamento ${data.codigo} criado com sucesso!`);
      fecharModal();
      loadData();
    } catch (error) {
      console.error('Erro ao criar equipamento:', error);
      alert(mensagemDeErro(error, 'Erro ao criar equipamento'));
    }
  };

  const handleReportarProblema = async (e) => {
    e.preventDefault();

    try {
      await equipamentos.reportarProblema(selectedEquipamento.id, problemaData);
      alert('Problema reportado com sucesso!');
      setShowProblemaModal(false);
      setProblemaData({ descricao: '', gravidade: 'media' });
      loadData();
    } catch (error) {
      console.error('Erro ao reportar problema:', error);
      alert('Erro ao reportar problema');
    }
  };

  // Fechar, por qualquer caminho, descarta o que foi digitado e volta ao código automático
  const fecharModal = () => {
    setShowModal(false);
    setFormData(FORM_VAZIO);
    setCodigoAutomatico(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      disponivel: 'badge-success',
      em_uso: 'badge-warning',
      manutencao: 'badge-secondary',
      com_problema: 'badge-danger',
      transferencia: 'badge-info',
    };
    return badges[status] || 'badge-secondary';
  };

  const getCondicaoBadge = (condicao) => {
    const badges = {
      excelente: 'badge-success',
      bom: 'badge-success',
      regular: 'badge-warning',
      ruim: 'badge-danger',
      quebrado: 'badge-danger',
    };
    return badges[condicao] || 'badge-secondary';
  };

  if (loading && equipamentosList.length === 0) {
    return <LoadingSpinner size="large" message="Carregando equipamentos..." />;
  }

  return (
    <div className="equipamentos-page">
      <div className="page-header">
        <h1>Gestão de Equipamentos</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => setShowScanner(true)}>
            📷 Escanear QR
          </button>
          {isGestor() && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Novo Equipamento
            </button>
          )}
        </div>
      </div>

      <div className="filters card">
        <div className="filters-grid">
          <div className="form-group">
            <label>Buscar</label>
            <input
              type="text"
              placeholder="Código, nome, marca..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="disponivel">Disponível</option>
              <option value="em_uso">Em Uso</option>
              <option value="manutencao">Manutenção</option>
              <option value="com_problema">Com Problema</option>
              <option value="transferencia">Em Transferência</option>
            </select>
          </div>

          <div className="form-group">
            <label>Categoria</label>
            <select
              value={filters.categoria_id}
              onChange={(e) => setFilters({ ...filters, categoria_id: e.target.value })}
            >
              <option value="">Todas</option>
              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome} ({cat.tipo})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Marca/Modelo</th>
              <th>Status</th>
              <th>Condição</th>
              <th>Depósito</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {equipamentosList.map((eq) => (
              <tr key={eq.id}>
                <td><strong>{eq.codigo}</strong></td>
                <td>{eq.nome}</td>
                <td>
                  <span className="badge badge-secondary">{eq.categoria_nome}</span>
                </td>
                <td>{eq.marca} {eq.modelo}</td>
                <td>
                  <span className={`badge ${getStatusBadge(eq.status)}`}>
                    {eq.status.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  <span className={`badge ${getCondicaoBadge(eq.condicao)}`}>
                    {eq.condicao}
                  </span>
                  {eq.problemas_ativos && eq.problemas_ativos.length > 0 && (
                    <span className="problema-indicator" title={eq.problemas_ativos[0].descricao}>
                      ⚠️
                    </span>
                  )}
                </td>
                <td>{eq.deposito_nome || '-'}</td>
                <td>
                  <button
                    className="btn btn-sm btn-warning"
                    onClick={() => {
                      setSelectedEquipamento(eq);
                      setShowProblemaModal(true);
                    }}
                  >
                    Reportar Problema
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {equipamentosList.length === 0 && (
          <p className="empty-state">Nenhum equipamento encontrado</p>
        )}
      </div>

      {/* Paginação */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={!pagination.hasPrev}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            ← Anterior
          </button>

          <div className="pagination-info">
            <span>
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <span className="text-muted">
              ({pagination.total} equipamentos)
            </span>
          </div>

          <button
            className="btn btn-secondary"
            disabled={!pagination.hasNext}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            Próxima →
          </button>
        </div>
      )}

      {/* Scanner de QR Code */}
      {showScanner && (
        <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* Modal de Novo Equipamento */}
      {showModal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo Equipamento</h2>
              <button className="close-btn" onClick={fecharModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="equipamento-codigo">{formatoCodigo.rotulo}</label>
                  <input
                    id="equipamento-codigo"
                    type="text"
                    value={formData.codigo}
                    className="maiusculas"
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    maxLength={formatoCodigo.maxLength}
                    pattern={formatoCodigo.pattern}
                    title={formatoCodigo.title}
                    placeholder={formatoCodigo.placeholder}
                    required
                  />
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={codigoAutomatico}
                      onChange={(e) => {
                        setCodigoAutomatico(e.target.checked);
                        setFormData({ ...formData, codigo: '' });
                      }}
                    />
                    Numerar automaticamente
                  </label>
                  <small>{formatoCodigo.dica}</small>
                </div>

                <div className="form-group">
                  <label>Nome *</label>
                  <input
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Categoria *</label>
                <select
                  value={formData.categoria_id}
                  onChange={(e) => setFormData({ ...formData, categoria_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome} ({cat.tipo})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Depósito *</label>
                <select
                  value={formData.deposito_id}
                  onChange={(e) => setFormData({ ...formData, deposito_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {listaDepositos.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Marca</label>
                  <input
                    type="text"
                    value={formData.marca}
                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Modelo</label>
                  <input
                    type="text"
                    value={formData.modelo}
                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Número de Série</label>
                <input
                  type="text"
                  value={formData.numero_serie}
                  onChange={(e) => setFormData({ ...formData, numero_serie: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Condição</label>
                <select
                  value={formData.condicao}
                  onChange={(e) => setFormData({ ...formData, condicao: e.target.value })}
                >
                  <option value="excelente">Excelente</option>
                  <option value="bom">Bom</option>
                  <option value="regular">Regular</option>
                  <option value="ruim">Ruim</option>
                </select>
              </div>

              <div className="form-group">
                <label>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Criar Equipamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Reportar Problema */}
      {showProblemaModal && (
        <div className="modal-overlay" onClick={() => setShowProblemaModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reportar Problema</h2>
              <button className="close-btn" onClick={() => setShowProblemaModal(false)}>×</button>
            </div>

            {selectedEquipamento && (
              <div className="equipamento-info">
                <strong>{selectedEquipamento.codigo}</strong> - {selectedEquipamento.nome}
              </div>
            )}

            <form onSubmit={handleReportarProblema}>
              <div className="form-group">
                <label>Gravidade *</label>
                <select
                  value={problemaData.gravidade}
                  onChange={(e) => setProblemaData({ ...problemaData, gravidade: e.target.value })}
                  required
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>

              <div className="form-group">
                <label>Descrição do Problema *</label>
                <textarea
                  value={problemaData.descricao}
                  onChange={(e) => setProblemaData({ ...problemaData, descricao: e.target.value })}
                  placeholder="Descreva o problema encontrado..."
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProblemaModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-danger">
                  Reportar Problema
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Equipamentos;
