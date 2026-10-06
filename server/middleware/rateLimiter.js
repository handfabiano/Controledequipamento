const rateLimit = require('express-rate-limit');
const { rateLimitMax, loginRateLimitMax } = require('../config');

// Limite geral da API (o SPA faz polling de notificações e várias chamadas por tela,
// por isso o padrão é mais folgado que o do login). Configurável via RATE_LIMIT_MAX.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: rateLimitMax,
  message: {
    error: 'Muitas requisições. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite mais restrito para login (apenas tentativas falhas contam)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginRateLimitMax,
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos.'
  },
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, authLimiter };
