// Configurações sensíveis centralizadas.
// Em produção, JWT_SECRET é obrigatório. Fora dela, sem JWT_SECRET, a chave é aleatória
// por processo: NÃO existe chave fixa no código (uma chave pública permitiria forjar tokens
// de qualquer usuário em quem subisse o servidor sem NODE_ENV=production).

const crypto = require('crypto');

const isProduction = process.env.NODE_ENV === 'production';

let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && isProduction) {
  throw new Error(
    'JWT_SECRET não definido. Configure a variável de ambiente JWT_SECRET antes de rodar em produção.'
  );
}

if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    'AVISO: JWT_SECRET não definido — usando uma chave aleatória temporária; os tokens deixam de valer ' +
    'quando o servidor reinicia. Defina JWT_SECRET (obrigatório em produção).'
  );
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
  // "true" no Express significa "confie em qualquer X-Forwarded-For" (o cliente forjaria o
  // próprio IP e o rate limit perderia o sentido); interpretamos como 1 proxy.
  if (valor === 'true') return 1;
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

// Usuários de demonstração têm senha conhecida (123456, inclusive um coordenador), então só
// nascem quando o ambiente é de desenvolvimento/teste ou quando SEED_DEMO_DATA=true pede
// explicitamente. Sem NODE_ENV (o padrão do Node) o servidor NÃO semeia: falha segura.
// SEED_DEMO_DATA=false desliga mesmo em desenvolvimento.
const seedDemoData =
  process.env.SEED_DEMO_DATA === 'true' ||
  (['development', 'test'].includes(process.env.NODE_ENV) && process.env.SEED_DEMO_DATA !== 'false');

if (seedDemoData && isProduction) {
  console.warn(
    'AVISO: SEED_DEMO_DATA=true em produção — usuários de demonstração com senha conhecida serão criados ' +
    'em banco vazio. Use apenas para testes e troque as senhas em seguida.'
  );
}

// Segredo opcional para o PRIMEIRO cadastro (banco sem usuários), enviado no cabeçalho
// X-Bootstrap-Token. Sem ele, quem chegar primeiro cria o coordenador.
const bootstrapToken = process.env.BOOTSTRAP_TOKEN || null;

module.exports = {
  isProduction,
  seedDemoData,
  bootstrapToken,
  jwtSecret,
  corsOrigins,
  trustProxy,
  rateLimitMax,
  loginRateLimitMax
};
