import React, { useState, useEffect } from 'react';
import { depositos, equipamentos, usuarios, mensagemDeErro } from '../services/api';

// Mesmos valores do CHECK de categorias_equipamentos.tipo no banco
const TIPOS_CATEGORIA = { som: 'Som', iluminacao: 'Iluminação', palco: 'Palco', outro: 'Outro' };

// Cada cadastro diz como salvar e quais campos o formulário começa
const CADASTROS = {
  deposito: {
    titulo: 'Depósito',
    novo: 'Novo depósito',
    salvo: 'salvo',
    vazio: { nome: '', endereco: '', responsavel_id: '' },
    doRegistro: (d) => ({ nome: d.nome, endereco: d.endereco || '', responsavel_id: d.responsavel_id || '' }),
    salvar: (id, dados) => {
      const corpo = { ...dados, responsavel_id: dados.responsavel_id || null };
      return id ? depositos.atualizar(id, corpo) : depositos.criar(corpo);
    },
  },
  categoria: {
    titulo: 'Categoria',
    novo: 'Nova categoria',
    salvo: 'salva',
    vazio: { nome: '', tipo: 'som', descricao: '' },
    doRegistro: (c) => ({ nome: c.nome, tipo: c.tipo, descricao: c.descricao || '' }),
    salvar: (id, dados) => (id ? equipamentos.atualizarCategoria(id, dados) : equipamentos.criarCategoria(dados)),
  },
};

function Cadastros() {
  const [listaDepositos, setListaDepositos] = useState([]);
  const [listaCategorias, setListaCategorias] = useState([]);
  const [responsaveis, setResponsaveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState(null); // { tipo: 'success' | 'danger', texto }
  const [edicao, setEdicao] = useState(null); // { cadastro: 'deposito' | 'categoria', id, responsavelAtual, dados }
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const [dep, cat, usu] = await Promise.all([depositos.listar(), equipamentos.listarCategorias(), usuarios.listar()]);
      setListaDepositos(dep.data);
      setListaCategorias(cat.data);
      setResponsaveis(usu.data);
    } catch (error) {
      setAviso({ tipo: 'danger', texto: mensagemDeErro(error, 'Erro ao carregar os cadastros') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrir = (cadastro, registro) => {
    const { vazio, doRegistro } = CADASTROS[cadastro];
    setEdicao({ cadastro, id: registro?.id, responsavelAtual: registro?.responsavel_id, dados: registro ? doRegistro(registro) : vazio });
    setErroForm('');
  };

  const campo = (nome) => ({
    value: edicao.dados[nome],
    onChange: (e) => setEdicao({ ...edicao, dados: { ...edicao.dados, [nome]: e.target.value } }),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { cadastro, id, dados } = edicao;
    const { salvar, titulo, salvo } = CADASTROS[cadastro];
    setSalvando(true);
    try {
      const { data } = await salvar(id, dados);
      setAviso({ tipo: 'success', texto: `${titulo} ${data.nome} ${salvo}` });
      setEdicao(null);
      carregar();
    } catch (error) {
      setErroForm(mensagemDeErro(error, 'Erro ao salvar'));
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando cadastros...</div>;
  }

  return (
    <div className="cadastros-page">
      <div className="page-header">
        <h1>Depósitos e categorias</h1>
      </div>

      {aviso && <div className={`alert alert-${aviso.tipo}`} role="status">{aviso.texto}</div>}

      <div className="card">
        <div className="page-header">
          <h2>Depósitos</h2>
          <button className="btn btn-primary" onClick={() => abrir('deposito')}>+ Novo Depósito</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Endereço</th>
              <th>Responsável</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaDepositos.map((deposito) => (
              <tr key={deposito.id}>
                <td><strong>{deposito.nome}</strong></td>
                <td>{deposito.endereco || '-'}</td>
                <td>{deposito.responsavel_nome || '-'}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => abrir('deposito', deposito)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="page-header">
          <h2>Categorias de equipamento</h2>
          <button className="btn btn-primary" onClick={() => abrir('categoria')}>+ Nova Categoria</button>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaCategorias.map((categoria) => (
              <tr key={categoria.id}>
                <td><strong>{categoria.nome}</strong></td>
                <td>{TIPOS_CATEGORIA[categoria.tipo] || categoria.tipo}</td>
                <td>{categoria.descricao || '-'}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => abrir('categoria', categoria)}>Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edicao && (
        <div className="modal-overlay" onClick={() => setEdicao(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{edicao.id ? `Editar ${CADASTROS[edicao.cadastro].titulo.toLowerCase()}` : CADASTROS[edicao.cadastro].novo}</h2>
              <button className="close-btn" onClick={() => setEdicao(null)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {erroForm && <div className="alert alert-danger" role="alert">{erroForm}</div>}

              <div className="form-group">
                <label htmlFor="cadastro-nome">Nome *</label>
                <input id="cadastro-nome" type="text" maxLength={100} required {...campo('nome')} />
              </div>

              {edicao.cadastro === 'deposito' ? (
                <>
                  <div className="form-group">
                    <label htmlFor="cadastro-endereco">Endereço</label>
                    <input id="cadastro-endereco" type="text" maxLength={255} {...campo('endereco')} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="cadastro-responsavel">Responsável</label>
                    <select id="cadastro-responsavel" {...campo('responsavel_id')}>
                      <option value="">Sem responsável</option>
                      {/* Ativos, e o responsável atual mesmo que tenha sido desativado */}
                      {responsaveis
                        .filter((u) => u.ativo || u.id === edicao.responsavelAtual)
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.ativo ? u.nome : `${u.nome} (inativo)`}</option>
                        ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="cadastro-tipo">Tipo *</label>
                    <select id="cadastro-tipo" {...campo('tipo')}>
                      {Object.entries(TIPOS_CATEGORIA).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>{rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="cadastro-descricao">Descrição</label>
                    <input id="cadastro-descricao" type="text" maxLength={255} {...campo('descricao')} />
                  </div>
                </>
              )}

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEdicao(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Cadastros;
