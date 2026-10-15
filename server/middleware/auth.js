const { verificar, tokenDaRequisicao, ehErroDeToken } = require('../services/token');
const { buscarUsuarioAtivo } = require('../services/usuarios');

// Usuário do token conferido no banco: desativado ou removido, a sessão acaba na hora (não só no
// próximo login), e o perfil vale pelo banco, não pelo que foi gravado no token. Lança se o token
// for inválido; devolve undefined se o usuário não estiver mais ativo.
async function usuarioDoToken(token) {
  const { id } = verificar(token);
  return buscarUsuarioAtivo(id);
}

const authMiddleware = async (req, res, next) => {
  const token = tokenDaRequisicao(req);

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  let usuario;
  try {
    usuario = await usuarioDoToken(token);
  } catch (error) {
    if (ehErroDeToken(error)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    return next(error);
  }

  if (!usuario) {
    return res.status(401).json({ error: 'Usuário inativo ou inexistente' });
  }

  req.user = usuario;
  next();
};

const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.tipo)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    next();
  };
};

module.exports = { authMiddleware, checkRole, usuarioDoToken };
