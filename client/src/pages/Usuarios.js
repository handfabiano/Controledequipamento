import React, { useState, useEffect } from 'react';
import { auth, usuarios, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PERFIS, rotuloPerfil } from '../perfis';

const FORM_VAZIO = { nome: '', email: '', senha: '', tipo: 'tecnico' };

function Usuarios() {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState(null); // { tipo: 'success' | 'danger', texto }
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [erroForm, setErroForm] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    try {
      const { data } = await usuarios.listar();
      setLista(data);
    } catch (error) {
      setAviso({ tipo: 'danger', texto: mensagemDeErro(error, 'Erro ao carregar usuários') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const campo = (nome) => ({
    value: formData[nome],
    onChange: (e) => setFormData({ ...formData, [nome]: e.target.value }),
  });

  const fecharModal = () => {
    setShowModal(false);
    setFormData(FORM_VAZIO);
    setErroForm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await auth.register(formData);
      setAviso({ tipo: 'success', texto: `Usuário ${formData.nome} cadastrado` });
      fecharModal();
      carregar();
    } catch (error) {
      setErroForm(mensagemDeErro(error, 'Erro ao cadastrar usuário'));
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (usuario) => {
    if (usuario.ativo && !window.confirm(`Desativar ${usuario.nome}? A pessoa não conseguirá mais entrar no sistema.`)) {
      return;
    }
    try {
      const { data } = await usuarios.definirAtivo(usuario.id, !usuario.ativo);
      setLista((atual) => atual.map((u) => (u.id === data.id ? data : u)));
      setAviso({ tipo: 'success', texto: `${data.nome} ${data.ativo ? 'reativado' : 'desativado'}` });
    } catch (error) {
      setAviso({ tipo: 'danger', texto: mensagemDeErro(error, 'Erro ao atualizar usuário') });
    }
  };

  if (loading) {
    return <div className="loading">Carregando usuários...</div>;
  }

  return (
    <div className="usuarios-page">
      <div className="page-header">
        <h1>Usuários</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Novo Usuário
        </button>
      </div>

      {aviso && <div className={`alert alert-${aviso.tipo}`} role="status">{aviso.texto}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Perfil</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((usuario) => (
              <tr key={usuario.id}>
                <td><strong>{usuario.nome}</strong></td>
                <td>{usuario.email}</td>
                <td>{rotuloPerfil(usuario.tipo)}</td>
                <td>
                  <span className={`badge ${usuario.ativo ? 'badge-success' : 'badge-secondary'}`}>
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td>
                  {usuario.id === user?.id ? (
                    <span className="badge badge-info">Você</span>
                  ) : (
                    <button
                      className={`btn btn-sm ${usuario.ativo ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => alternarAtivo(usuario)}
                    >
                      {usuario.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Novo Usuário</h2>
              <button className="close-btn" onClick={fecharModal}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {erroForm && <div className="alert alert-danger" role="alert">{erroForm}</div>}

              <div className="form-group">
                <label htmlFor="usuario-nome">Nome *</label>
                <input
                  id="usuario-nome"
                  type="text"
                  {...campo('nome')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="usuario-email">Email *</label>
                <input
                  id="usuario-email"
                  type="email"
                  {...campo('email')}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="usuario-senha">Senha inicial *</label>
                <input
                  id="usuario-senha"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  {...campo('senha')}
                  required
                />
                <small>Mínimo de 8 caracteres. Peça para a pessoa trocar no primeiro acesso.</small>
              </div>

              <div className="form-group">
                <label htmlFor="usuario-tipo">Perfil *</label>
                <select
                  id="usuario-tipo"
                  {...campo('tipo')}
                >
                  {Object.entries(PERFIS).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>{rotulo}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModal}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;
