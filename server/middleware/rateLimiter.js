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

// Limite para quem confere senha: só as tentativas falhas contam
const limiteDeFalhas = (mensagem, opcoes = {}) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max: loginRateLimitMax,
  message: { error: mensagem },
  skipSuccessfulRequests: true,
  ...opcoes,
});

const authLimiter = limiteDeFalhas('Muitas tentativas de login. Aguarde 15 minutos.');

// Troca de senha: contador próprio (um erro aqui não bloqueia o login) e por usuário, porque o risco
// é um token roubado testar a senha atual. Só a senha atual errada conta: nova senha fraca não é
// tentativa de adivinhar. Roda depois do authMiddleware, então req.user existe.
const senhaLimiter = limiteDeFalhas('Muitas tentativas de troca de senha. Aguarde 15 minutos.', {
  keyGenerator: (req) => `usuario:${req.user.id}`,
  requestWasSuccessful: (req, res) => !res.locals.senhaAtualIncorreta,
});

module.exports = { apiLimiter, authLimiter, senhaLimiter };
