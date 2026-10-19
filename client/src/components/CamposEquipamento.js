import React from 'react';
import { CONDICOES, Opcoes } from '../equipamento';

// Formulário vazio com os campos abaixo (cadastro), e a lista do que a edição envia
export const CAMPOS_VAZIOS = {
  nome: '',
  categoria_id: '',
  deposito_id: '',
  marca: '',
  modelo: '',
  numero_serie: '',
  condicao: 'bom',
  observacoes: '',
};

// Campos comuns ao cadastro e à edição de equipamento (o código fica de fora: só se escolhe
// ao cadastrar). `dados` usa os nomes da API; `prefixoId` evita ids repetidos na página.
function CamposEquipamento({ dados, onChange, categorias, depositos, prefixoId }) {
  const campo = (nome) => ({
    id: `${prefixoId}-${nome}`,
    value: dados[nome] ?? '',
    onChange: (e) => onChange({ ...dados, [nome]: e.target.value }),
  });

  return (
    <>
      <div className="form-group">
        <label htmlFor={`${prefixoId}-nome`}>Nome *</label>
        <input type="text" {...campo('nome')} minLength={3} maxLength={100} required />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${prefixoId}-categoria_id`}>Categoria *</label>
          <select {...campo('categoria_id')} required>
            <option value="">Selecione...</option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.nome} ({cat.tipo})</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor={`${prefixoId}-deposito_id`}>Depósito *</label>
          <select {...campo('deposito_id')} required>
            <option value="">Selecione...</option>
            {depositos.map((dep) => (
              <option key={dep.id} value={dep.id}>{dep.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${prefixoId}-marca`}>Marca</label>
          <input type="text" {...campo('marca')} maxLength={50} />
        </div>

        <div className="form-group">
          <label htmlFor={`${prefixoId}-modelo`}>Modelo</label>
          <input type="text" {...campo('modelo')} maxLength={50} />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`${prefixoId}-numero_serie`}>Número de Série</label>
          <input type="text" {...campo('numero_serie')} maxLength={100} />
        </div>

        <div className="form-group">
          <label htmlFor={`${prefixoId}-condicao`}>Condição</label>
          <select {...campo('condicao')}>
            <Opcoes tabela={CONDICOES} />
          </select>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor={`${prefixoId}-observacoes`}>Observações</label>
        <textarea {...campo('observacoes')} maxLength={500} />
      </div>
    </>
  );
}

export default CamposEquipamento;
