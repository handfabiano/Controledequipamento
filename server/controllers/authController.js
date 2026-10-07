const { createHash, timingSafeEqual } = require('crypto');
const { getAsync, runAsync } = require('../database/init');
const { bootstrapToken } = require('../config');
const { validarSenha, hashSenha, compararSenha } = require('../services/senhas');
const { registrar, registrarNegacao } = require('../services/seguranca');
const { assinar, verificar, tokenDaRequisicao } = require('../services/token');
const { normalizarEmail } = require('../services/validacao');

// Compara os dois por resumo SHA-256 (mesmo tamanho) em tempo constante
const resumo = (texto) => createHash('sha256').update(texto).digest();
const tokenInicialConfere = (informado) =>
  typeof informado === 'string' && timingSafeEqual(resumo(informado), resumo(bootstrapToken));

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authController = {
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      if (typeof email !== 'string' || typeof senha !== 'string') {
        return res.status(400).json({ error: 'Email e senha devem ser texto' });
      }

      const emailNormalizado = normalizarEmail(email);

      const usuario = await getAsync(
        'SELECT * FROM usuarios WHERE LOWER(email) = ? AND ativo = 1',
        [emailNormalizado]
      );

      // Sem usuário a comparação roda mesmo assim (contra um hash fictício): o tempo de resposta
      // não pode revelar quais e-mails existem.
      const senhaValida = await compararSenha(senha, usuario?.senha);

      if (!usuario || !senhaValida) {
        registrarNegacao(res, 'login_falha', {
          email: emailNormalizado,
          motivo: usuario ? 'senha_incorreta' : 'usuario_inexistente',
          ip: req.ip
        });
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const token = assinar({ id: usuario.id, email: usuario.email, tipo: usuario.tipo });

      registrar('login_sucesso', { usuario_id: usuario.id, ip: req.ip });

      // Não retornar a senha
      delete usuario.senha;

      res.json({ token, usuario });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  },

  async register(req, res) {
    try {
      const { nome, email, senha, tipo } = req.body;

      if (!nome || !email || !senha || !tipo) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
      }

      if ([nome, email, senha, tipo].some((campo) => typeof campo !== 'string')) {
        return res.status(400).json({ error: 'Nome, email, senha e tipo devem ser texto' });
      }

      if (!nome.trim()) {
        return res.status(400).json({ error: 'Nome não pode ser vazio' });
      }

      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: 'Email inválido' });
      }

      const tiposValidos = ['coordenador', 'responsavel_entrega', 'responsavel_recebimento', 'tecnico'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de usuário inválido' });
      }

      const emailNormalizado = normalizarEmail(email);

      const erroSenha = validarSenha(senha, emailNormalizado);
      if (erroSenha) {
        return res.status(400).json({ error: erroSenha });
      }

      // Cadastro aberto apenas para o primeiro usuário (bootstrap do sistema).
      // Depois disso, somente um coordenador autenticado pode registrar novos usuários.
      const userCount = await getAsync('SELECT COUNT(*) as count FROM usuarios');

      if (userCount.count === 0 && bootstrapToken && !tokenInicialConfere(req.get('X-Bootstrap-Token'))) {
        return res.status(401).json({ error: 'Token de cadastro inicial inválido ou ausente' });
      }

      if (userCount.count > 0) {
        const token = tokenDaRequisicao(req);

        if (!token) {
          return res.status(401).json({ error: 'Apenas coordenadores podem registrar novos usuários' });
        }

        let decoded;
        try {
          decoded = verificar(token);
        } catch (err) {
          return res.status(401).json({ error: 'Token inválido' });
        }

        req.user = decoded; // para o registro de segurança saber quem tentou
        if (decoded.tipo !== 'coordenador') {
          return res.status(403).json({ error: 'Apenas coordenadores podem registrar novos usuários' });
        }
      }

      const usuarioExiste = await getAsync(
        'SELECT id FROM usuarios WHERE LOWER(email) = ?',
        [emailNormalizado]
      );

      if (usuarioExiste) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      const senhaHash = await hashSenha(senha);

      const result = await runAsync(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
        [nome.trim(), emailNormalizado, senhaHash, tipo]
      );

      registrar('usuario_criado', {
        usuario_id: result.lastID,
        tipo,
        criado_por: req.user?.id ?? null, // null = cadastro inicial (bootstrap)
        ip: req.ip
      });

      res.status(201).json({
        message: 'Usuário registrado com sucesso',
        id: result.lastID
      });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
  },

  async me(req, res) {
    try {
      const usuario = await getAsync(
        'SELECT id, nome, email, tipo, criado_em FROM usuarios WHERE id = ?',
        [req.user.id]
      );

      if (!usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.json(usuario);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
    }
  }
};

module.exports = authController;
