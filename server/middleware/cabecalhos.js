const { isProduction } = require('../config');

// Cabeçalhos de segurança das respostas do servidor. Sem dependência extra: o Express só serve
// JSON e a etiqueta HTML (que define a própria CSP restritiva); o SPA é servido estático pela
// Vercel, onde estes mesmos cabeçalhos vêm da rota catch-all do vercel.json (um teste confere
// que os dois não divergem).
// A câmera é usada pelo leitor de QR Code do próprio site; o resto fica desligado.
const CABECALHOS_BASE = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()'
};

function cabecalhosDeSeguranca({ producao = isProduction } = {}) {
  return (req, res, next) => {
    for (const [nome, valor] of Object.entries(CABECALHOS_BASE)) {
      res.setHeader(nome, valor);
    }
    if (producao) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }
    // Dados autenticados não devem ficar em cache de navegador/proxy compartilhado.
    if (req.path.startsWith('/api')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  };
}

module.exports = { cabecalhosDeSeguranca, CABECALHOS_BASE };
