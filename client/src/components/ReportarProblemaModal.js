import React, { useState } from 'react';
import { equipamentos, mensagemDeErro } from '../services/api';
import { GRAVIDADES, Opcoes } from '../equipamento';

// Formulário de problema de um equipamento; chama onReportado depois de gravar
function ReportarProblemaModal({ equipamento, onClose, onReportado }) {
  const [dados, setDados] = useState({ descricao: '', gravidade: 'media' });

  const enviar = async (e) => {
    e.preventDefault();
    try {
      await equipamentos.reportarProblema(equipamento.id, dados);
      alert('Problema reportado com sucesso!');
      onReportado();
    } catch (error) {
      console.error('Erro ao reportar problema:', error);
      alert(mensagemDeErro(error, 'Erro ao reportar problema'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Reportar Problema</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="equipamento-info">
          <strong>{equipamento.codigo}</strong> - {equipamento.nome}
        </div>

        <form onSubmit={enviar}>
          <div className="form-group">
            <label htmlFor="problema-gravidade">Gravidade *</label>
            <select
              id="problema-gravidade"
              value={dados.gravidade}
              onChange={(e) => setDados({ ...dados, gravidade: e.target.value })}
            >
              <Opcoes tabela={GRAVIDADES} />
            </select>
            <small>Alta e crítica tiram o equipamento de uso até o problema ser resolvido.</small>
          </div>

          <div className="form-group">
            <label htmlFor="problema-descricao">Descrição do Problema *</label>
            <textarea
              id="problema-descricao"
              value={dados.descricao}
              onChange={(e) => setDados({ ...dados, descricao: e.target.value })}
              placeholder="Descreva o problema encontrado (mínimo de 10 caracteres)..."
              minLength={10}
              maxLength={500}
              required
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-danger">
              Reportar Problema
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportarProblemaModal;
