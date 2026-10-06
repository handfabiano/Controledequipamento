// Configurações sensíveis centralizadas.
// Em produção, JWT_SECRET é obrigatório — sem fallback hardcoded.

const isProduction = process.env.NODE_ENV === 'production';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && isProduction) {
  throw new Error(
    'JWT_SECRET não definido. Configure a variável de ambiente JWT_SECRET antes de rodar em produção.'
  );
}

if (!jwtSecret) {
  console.warn('AVISO: JWT_SECRET não definido — usando chave de desenvolvimento. NÃO use em produção.');
}

// Origens permitidas para CORS: lista separada por vírgula em CORS_ORIGIN.
// Se não definida, qualquer origem é aceita (com aviso em produção).
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : null;

if (!corsOrigins && isProduction) {
  console.warn('AVISO: CORS_ORIGIN não definido — a API aceita requisições de qualquer origem.');
}

// Atrás de proxy reverso (Vercel, Heroku, nginx...) o IP real do cliente vem em
// X-Forwarded-For. Sem "trust proxy" o rate limit enxerga o IP do proxy e todos
// os usuários passam a dividir o mesmo contador (5 logins errados travariam o login
// de todo mundo). TRUST_PROXY aceita número de hops (ex.: 1), "false" ou valores
// do Express ("loopback", sub-redes...). Na Vercel o padrão é 1 hop.
function lerTrustProxy(valor, naVercel) {
  if (valor === undefined || valor === '') return naVercel ? 1 : false;
  if (valor === 'false') return false;
  if (/^\d+$/.test(valor)) return parseInt(valor, 10);
  return valor;
}

const trustProxy = lerTrustProxy(process.env.TRUST_PROXY, Boolean(process.env.VERCEL));

function inteiroPositivo(valor, padrao) {
  const n = parseInt(valor, 10);
  return Number.isInteger(n) && n > 0 ? n : padrao;
}

// Limites de requisições por IP a cada 15 minutos
const rateLimitMax = inteiroPositivo(process.env.RATE_LIMIT_MAX, 300);
const loginRateLimitMax = inteiroPositivo(process.env.LOGIN_RATE_LIMIT_MAX, 5);

module.exports = {
  isProduction,
  jwtSecret: jwtSecret || 'dev_secret_apenas_para_desenvolvimento',
  corsOrigins,
  trustProxy,
  rateLimitMax,
  loginRateLimitMax
};
