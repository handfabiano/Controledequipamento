const rateLimit = require('express-rate-limit');

// Limite geral da API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: {
    error: 'Muitas requisições. Tente novamente em 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite mais restrito para login
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentativas de login
  message: {
    error: 'Muitas tentativas de login. Aguarde 15 minutos.'
  },
  skipSuccessfulRequests: true,
});

module.exports = { apiLimiter, authLimiter };
