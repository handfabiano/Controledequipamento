import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-brand">
          <h1>Sistema de Equipamentos</h1>
        </div>
        <div className="navbar-menu">
          <Link to="/" className={isActive('/') ? 'active' : ''}>
            Dashboard
          </Link>
          <Link to="/equipamentos" className={isActive('/equipamentos') ? 'active' : ''}>
            Equipamentos
          </Link>
          <Link to="/transferencias" className={isActive('/transferencias') ? 'active' : ''}>
            Transferências
          </Link>
          <Link to="/eventos" className={isActive('/eventos') ? 'active' : ''}>
            Eventos
          </Link>
        </div>
        <div className="navbar-user">
          <span>{user?.nome}</span>
          <span className="badge badge-info">{user?.tipo?.replace('_', ' ')}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Sair
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
