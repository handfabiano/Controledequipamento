const { isProduction } = require('../config');

// Cabeçalhos de segurança das respostas do servidor (A02-001). Sem dependência extra:
// o Express só serve JSON e a etiqueta HTML (que define a própria CSP restritiva);
// o SPA é servido estático pela Vercel, onde os mesmos cabeçalhos vêm do vercel.json.
function cabecalhosDeSeguranca({ producao = isProduction } = {}) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    // A câmera é usada pelo leitor de QR Code do próprio site; o resto fica desligado.
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(), payment=()');
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

module.exports = { cabecalhosDeSeguranca };
