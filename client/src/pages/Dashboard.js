import React, { useState, useEffect } from 'react';
import { equipamentos, transferencias, eventos } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalEquipamentos: 0,
    equipamentosDisponiveis: 0,
    equipamentosEmUso: 0,
    equipamentosComProblema: 0,
    transferenciaPendentes: 0,
    eventosAtivos: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const [equipResponse, transferenciaResponse, eventoResponse] = await Promise.all([
        equipamentos.listar(),
        transferencias.listar(),
        eventos.listar({ status: 'em_andamento' }),
      ]);

      const equips = equipResponse.data;
      const transferList = transferenciaResponse.data;
      const eventosList = eventoResponse.data;

      setStats({
        totalEquipamentos: equips.length,
        equipamentosDisponiveis: equips.filter(e => e.status === 'disponivel').length,
        equipamentosEmUso: equips.filter(e => e.status === 'em_uso').length,
        equipamentosComProblema: equips.filter(e => e.status === 'com_problema').length,
        transferenciaPendentes: transferList.filter(t => t.status === 'pendente').length,
        eventosAtivos: eventosList.length,
      });

      // Atividades recentes
      const activities = [];

      // Transferências pendentes
      transferList
        .filter(t => t.status === 'pendente' || t.status === 'aprovada_coordenador')
        .slice(0, 5)
        .forEach(t => {
          activities.push({
            tipo: 'transferencia',
            descricao: `Transferência de ${t.equipamento_nome} - ${t.status}`,
            data: t.data_solicitacao,
          });
        });

      // Equipamentos com problema
      equips
        .filter(e => e.problemas_ativos && e.problemas_ativos.length > 0)
        .slice(0, 5)
        .forEach(e => {
          activities.push({
            tipo: 'problema',
            descricao: `${e.codigo} - ${e.nome} com problema reportado`,
            data: e.problemas_ativos[0].data_relato,
          });
        });

      setRecentActivity(activities.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 10));

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Carregando dashboard...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Bem-vindo, {user?.nome}!</h1>
        <p>Visão geral do sistema de equipamentos</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <p>Total de Equipamentos</p>
          <h3>{stats.totalEquipamentos}</h3>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' }}>
          <p>Disponíveis</p>
          <h3>{stats.equipamentosDisponiveis}</h3>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)' }}>
          <p>Em Uso</p>
          <h3>{stats.equipamentosEmUso}</h3>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)' }}>
          <p>Com Problema</p>
          <h3>{stats.equipamentosComProblema}</h3>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #17a2b8 0%, #138496 100%)' }}>
          <p>Transferências Pendentes</p>
          <h3>{stats.transferenciaPendentes}</h3>
        </div>

        <div className="stat-card" style={{ background: 'linear-gradient(135deg, #6610f2 0%, #6f42c1 100%)' }}>
          <p>Eventos Ativos</p>
          <h3>{stats.eventosAtivos}</h3>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="card">
          <h2>Atividades Recentes</h2>
          {recentActivity.length === 0 ? (
            <p className="empty-state">Nenhuma atividade recente</p>
          ) : (
            <ul className="activity-list">
              {recentActivity.map((activity, index) => (
                <li key={index} className={`activity-item activity-${activity.tipo}`}>
                  <div className="activity-icon">
                    {activity.tipo === 'transferencia' ? '🔄' : '⚠️'}
                  </div>
                  <div className="activity-details">
                    <p>{activity.descricao}</p>
                    <small>{new Date(activity.data).toLocaleString('pt-BR')}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Ações Rápidas</h2>
          <div className="quick-actions">
            <a href="/equipamentos" className="quick-action-btn">
              <span>📦</span>
              <span>Gerenciar Equipamentos</span>
            </a>
            <a href="/transferencias" className="quick-action-btn">
              <span>🔄</span>
              <span>Transferências</span>
            </a>
            <a href="/eventos" className="quick-action-btn">
              <span>📅</span>
              <span>Eventos</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
