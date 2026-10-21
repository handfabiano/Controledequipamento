import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { equipamentos, depositos, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import QRScanner from '../components/QRScanner';
import CamposEquipamento, { CAMPOS_VAZIOS } from '../components/CamposEquipamento';
import ReportarProblemaModal from '../components/ReportarProblemaModal';
import { STATUS_EQUIPAMENTO, CONDICOES, Badge, Opcoes } from '../equipamento';
import './Equipamentos.css';

const FORM_VAZIO = { codigo: '', ...CAMPOS_VAZIOS };

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
  const [showScanner, setShowScanner] = useState(false);
  // Equipamento cujo problema está sendo reportado (null = formulário fechado)
  const [problemaDe, setProblemaDe] = useState(null);
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

  // Fechar, por qualquer caminho, descarta o que foi digitado e volta ao código automático
  const fecharModal = () => {
    setShowModal(false);
    setFormData(FORM_VAZIO);
    setCodigoAutomatico(true);
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
              <Opcoes tabela={STATUS_EQUIPAMENTO} />
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
                <td><Link to={`/equipamentos/${eq.id}`}><strong>{eq.codigo}</strong></Link></td>
                <td>{eq.nome}</td>
                <td>
                  <span className="badge badge-secondary">{eq.categoria_nome}</span>
                </td>
                <td>{eq.marca} {eq.modelo}</td>
                <td>
                  <Badge tabela={STATUS_EQUIPAMENTO} valor={eq.status} />
                </td>
                <td>
                  <Badge tabela={CONDICOES} valor={eq.condicao} />
                  {eq.problemas_ativos && eq.problemas_ativos.length > 0 && (
                    <span className="problema-indicator" title={eq.problemas_ativos[0].descricao}>
                      ⚠️
                    </span>
                  )}
                </td>
                <td>{eq.deposito_nome || '-'}</td>
                <td>
                  <div className="action-buttons">
                    <Link className="btn btn-sm btn-secondary" to={`/equipamentos/${eq.id}`}>
                      Detalhes
                    </Link>
                    <button className="btn btn-sm btn-warning" onClick={() => setProblemaDe(eq)}>
                      Reportar Problema
                    </button>
                  </div>
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

              <CamposEquipamento
                dados={formData}
                onChange={setFormData}
                categorias={categorias}
                depositos={listaDepositos}
                prefixoId="novo"
              />

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

      {problemaDe && (
        <ReportarProblemaModal
          equipamento={problemaDe}
          onClose={() => setProblemaDe(null)}
          onReportado={() => {
            setProblemaDe(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default Equipamentos;
