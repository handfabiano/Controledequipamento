import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { rotuloPerfil } from '../perfis';
import './Layout.css';

function Layout() {
  const { user, logout, isCoordenador } = useAuth();
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
          {isCoordenador() && (
            <>
              <Link to="/cadastros" className={isActive('/cadastros') ? 'active' : ''}>
                Cadastros
              </Link>
              <Link to="/usuarios" className={isActive('/usuarios') ? 'active' : ''}>
                Usuários
              </Link>
            </>
          )}
        </div>
        <div className="navbar-user">
          <NotificationBell />
          <Link to="/minha-conta" title="Minha conta e troca de senha">{user?.nome}</Link>
          <span className="badge badge-info">{rotuloPerfil(user?.tipo)}</span>
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
