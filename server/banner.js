// Texto exibido quando o servidor local sobe; só lista as credenciais de demonstração se `credenciaisDemo`.

function montarBanner({ porta, credenciaisDemo }) {
  const credenciais = credenciaisDemo
    ? `
║  Credenciais de demonstração (senha 123456):                 ║
║  - coordenador@sistema.com                                   ║
║  - joao@sistema.com                                          ║
║  - maria@sistema.com                                         ║
║                                                              ║`
    : '';

  return `
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  Sistema de Gestão de Equipamentos de Som e Iluminação      ║
║                                                              ║
║  Servidor rodando na porta ${porta}                              ║
║  API disponível em: http://localhost:${porta}/api               ║
║                                                              ║${credenciais}
╚══════════════════════════════════════════════════════════════╝
`;
}

module.exports = { montarBanner };
