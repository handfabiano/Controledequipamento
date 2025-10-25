import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../services/api';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }

    setLoading(false);
  }, []);

  const login = async (email, senha) => {
    try {
      const response = await auth.login(email, senha);
      const { token, usuario } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(usuario));
      setUser(usuario);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Erro ao fazer login'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const isCoordenador = () => user?.tipo === 'coordenador';
  const isResponsavelEntrega = () => user?.tipo === 'responsavel_entrega';
  const isResponsavelRecebimento = () => user?.tipo === 'responsavel_recebimento';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isCoordenador,
        isResponsavelEntrega,
        isResponsavelRecebimento,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export default AuthContext;
