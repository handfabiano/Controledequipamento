import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Autenticação
export const auth = {
  login: (email, senha) => api.post('/auth/login', { email, senha }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

// Equipamentos
export const equipamentos = {
  listar: (params) => api.get('/equipamentos', { params }),
  buscarPorId: (id) => api.get(`/equipamentos/${id}`),
  criar: (data) => api.post('/equipamentos', data),
  atualizar: (id, data) => api.put(`/equipamentos/${id}`, data),
  reportarProblema: (id, data) => api.post(`/equipamentos/${id}/problemas`, data),
  resolverProblema: (id, problemaId) => api.put(`/equipamentos/${id}/problemas/${problemaId}/resolver`),
  listarCategorias: () => api.get('/equipamentos/categorias'),
};

// Transferências
export const transferencias = {
  listar: (params) => api.get('/transferencias', { params }),
  buscarPorId: (id) => api.get(`/transferencias/${id}`),
  criar: (data) => api.post('/transferencias', data),
  aprovar: (id, tipo_aprovacao) => api.post(`/transferencias/${id}/aprovar`, { tipo_aprovacao }),
  cancelar: (id, motivo) => api.post(`/transferencias/${id}/cancelar`, { motivo }),
  transferirRapida: (data) => api.post('/transferencias/rapida', data),
};

// Eventos
export const eventos = {
  listar: (params) => api.get('/eventos', { params }),
  buscarPorId: (id) => api.get(`/eventos/${id}`),
  criar: (data) => api.post('/eventos', data),
  adicionarEquipamentos: (id, equipamentos) => api.post(`/eventos/${id}/equipamentos`, { equipamentos }),
  validarChecklist: (id) => api.get(`/eventos/${id}/validar-checklist`),
  atualizarStatus: (id, status) => api.put(`/eventos/${id}/status`, { status }),
  listarTemplates: () => api.get('/eventos/templates'),
};

export default api;
