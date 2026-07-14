import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificacoes as notificacoesApi } from '../services/api';
import './NotificationBell.css';

const POLL_INTERVAL_MS = 60000;

function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const loadCount = useCallback(async () => {
    try {
      const response = await notificacoesApi.contarNaoLidas();
      setCount(response.data.count);
    } catch (error) {
      // Silencioso: badge de notificação não deve interromper a navegação
    }
  }, []);

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadCount]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOpen = async () => {
    const willOpen = !open;
    setOpen(willOpen);

    if (willOpen) {
      try {
        const response = await notificacoesApi.listar({ limit: 15 });
        setItems(response.data);
      } catch (error) {
        console.error('Erro ao carregar notificações:', error);
      }
    }
  };

  const handleItemClick = async (notificacao) => {
    if (!notificacao.lida) {
      try {
        await notificacoesApi.marcarLida(notificacao.id);
        setCount((c) => Math.max(0, c - 1));
        setItems((prev) =>
          prev.map((n) => (n.id === notificacao.id ? { ...n, lida: 1 } : n))
        );
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }

    setOpen(false);
    if (notificacao.link) {
      navigate(notificacao.link);
    }
  };

  const handleMarcarTodas = async () => {
    try {
      await notificacoesApi.marcarTodasLidas();
      setCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, lida: 1 })));
    } catch (error) {
      console.error('Erro ao marcar notificações como lidas:', error);
    }
  };

  const formatarData = (data) => {
    try {
      return new Date(data).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="notification-bell" ref={containerRef}>
      <button className="bell-button" onClick={toggleOpen} title="Notificações">
        <span role="img" aria-label="Notificações">🔔</span>
        {count > 0 && <span className="bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-header">
            <strong>Notificações</strong>
            {count > 0 && (
              <button className="bell-mark-all" onClick={handleMarcarTodas}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="bell-dropdown-list">
            {items.length === 0 && (
              <div className="bell-empty">Nenhuma notificação</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                className={`bell-item ${n.lida ? '' : 'bell-item-unread'}`}
                onClick={() => handleItemClick(n)}
              >
                <div className="bell-item-title">{n.titulo}</div>
                <div className="bell-item-message">{n.mensagem}</div>
                <div className="bell-item-date">{formatarData(n.criado_em)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
