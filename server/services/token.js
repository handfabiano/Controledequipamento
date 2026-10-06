const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');

// Único lugar que assina e verifica o JWT. O algoritmo é fixo nos dois sentidos: o servidor nunca
// aceita o que vier no cabeçalho do token, então quem verifica não precisa lembrar de fixá-lo.
const ALGORITMO = 'HS256';

const assinar = (payload) =>
  jwt.sign(payload, jwtSecret, { algorithm: ALGORITMO, expiresIn: '24h' });

const verificar = (token) => jwt.verify(token, jwtSecret, { algorithms: [ALGORITMO] });

// Só o esquema "Bearer": um token enviado como "Basic ..." ou outro esquema não vale.
const tokenDaRequisicao = (req) => /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '')?.[1];

module.exports = { assinar, verificar, tokenDaRequisicao };
