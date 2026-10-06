const { verificar, tokenDaRequisicao } = require('../services/token');

const authMiddleware = (req, res, next) => {
  try {
    const token = tokenDaRequisicao(req);

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    req.user = verificar(token);
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.tipo)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};

module.exports = { authMiddleware, checkRole };
