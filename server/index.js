require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeDatabase } = require('./database/init');
const routes = require('./routes');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3001;

// Inicializar banco de dados (necessário para ambos os ambientes)
let dbInitialized = false;

async function ensureDatabase() {
  if (!dbInitialized) {
    console.log('Inicializando banco de dados...');
    await initializeDatabase();
    console.log('Banco de dados inicializado com sucesso!');
    dbInitialized = true;
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Middleware para garantir que o banco está inicializado ANTES de processar requisições
app.use(async (req, res, next) => {
  try {
    await ensureDatabase();
    next();
  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
    res.status(500).json({ error: 'Erro ao inicializar banco de dados' });
  }
});

// Rate limiting
app.use('/api', apiLimiter);

// Rotas
app.use('/api', routes);

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handler para rotas não encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    method: req.method
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// Inicializar servidor local (não executado em ambiente serverless)
async function start() {
  try {
    await ensureDatabase();

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

// Iniciar servidor apenas se não estiver em ambiente Vercel
if (require.main === module) {
  start();
}

// Exportar app para Vercel
module.exports = app;
