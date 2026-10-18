import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Equipamentos from './pages/Equipamentos';
import Transferencias from './pages/Transferencias';
import Eventos from './pages/Eventos';
import Usuarios from './pages/Usuarios';
import MinhaConta from './pages/MinhaConta';
import Cadastros from './pages/Cadastros';
import Layout from './components/Layout';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Carregando...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Só esconde a tela; quem barra é o servidor
const SoCoordenador = ({ children }) => {
  const { isCoordenador } = useAuth();
  return isCoordenador() ? children : <Navigate to="/" />;
};

function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="equipamentos" element={<Equipamentos />} />
          <Route path="transferencias" element={<Transferencias />} />
          <Route path="eventos" element={<Eventos />} />
          <Route path="usuarios" element={<SoCoordenador><Usuarios /></SoCoordenador>} />
          <Route path="cadastros" element={<SoCoordenador><Cadastros /></SoCoordenador>} />
          <Route path="minha-conta" element={<MinhaConta />} />
        </Route>
      </Routes>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
