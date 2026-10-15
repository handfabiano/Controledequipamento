import React, { useState } from 'react';
import { auth, mensagemDeErro } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { rotuloPerfil } from '../perfis';

const FORM_VAZIO = { senhaAtual: '', novaSenha: '', confirmacao: '' };

function MinhaConta() {
  const { user } = useAuth();
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [aviso, setAviso] = useState(null); // { tipo: 'success' | 'danger', texto }
  const [salvando, setSalvando] = useState(false);

  const campo = (nome) => ({
    value: formData[nome],
    onChange: (e) => setFormData({ ...formData, [nome]: e.target.value }),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.novaSenha !== formData.confirmacao) {
      setAviso({ tipo: 'danger', texto: 'A confirmação não confere com a nova senha' });
      return;
    }
    setSalvando(true);
    try {
      await auth.trocarSenha(formData.senhaAtual, formData.novaSenha);
      setFormData(FORM_VAZIO);
      setAviso({ tipo: 'success', texto: 'Senha alterada. Use a nova senha no próximo login.' });
    } catch (error) {
      setAviso({ tipo: 'danger', texto: mensagemDeErro(error, 'Erro ao trocar a senha') });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="minha-conta-page">
      <div className="page-header">
        <h1>Minha conta</h1>
      </div>

      <div className="card">
        <p><strong>{user?.nome}</strong></p>
        <p>{user?.email}</p>
        <p>{rotuloPerfil(user?.tipo)}</p>
      </div>

      <div className="card">
        <h2>Trocar senha</h2>
        {aviso && <div className={`alert alert-${aviso.tipo}`} role="status">{aviso.texto}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="senha-atual">Senha atual *</label>
            <input id="senha-atual" type="password" autoComplete="current-password" required {...campo('senhaAtual')} />
          </div>
          <div className="form-group">
            <label htmlFor="nova-senha">Nova senha *</label>
            <input id="nova-senha" type="password" autoComplete="new-password" minLength={8} required {...campo('novaSenha')} />
            <small>Mínimo de 8 caracteres; senhas muito comuns são recusadas.</small>
          </div>
          <div className="form-group">
            <label htmlFor="confirmacao">Confirme a nova senha *</label>
            <input id="confirmacao" type="password" autoComplete="new-password" required {...campo('confirmacao')} />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Trocar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MinhaConta;
