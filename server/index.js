require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/init');
const routes = require('./routes');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Rate limiting
app.use('/api', apiLimiter);

// Rotas
app.use('/api', routes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializar banco de dados e servidor
async function start() {
  try {
    console.log('Inicializando banco de dados...');
    await initializeDatabase();
    console.log('Banco de dados inicializado com sucesso!');

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  Sistema de Gestão de Equipamentos de Som e Iluminação      ║
║                                                              ║
║  Servidor rodando na porta ${PORT}                              ║
║  API disponível em: http://localhost:${PORT}/api               ║
║                                                              ║
║  Credenciais de teste:                                      ║
║  - coordenador@sistema.com / 123456                          ║
║  - joao@sistema.com / 123456                                 ║
║  - maria@sistema.com / 123456                                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();
