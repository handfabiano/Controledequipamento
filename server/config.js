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

module.exports = {
  isProduction,
  jwtSecret: jwtSecret || 'dev_secret_apenas_para_desenvolvimento',
  corsOrigins
};
