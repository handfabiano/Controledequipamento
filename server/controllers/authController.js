const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAsync, runAsync } = require('../database/init');
const { jwtSecret, jwtAlgorithm } = require('../config');
const { validarSenha } = require('../services/senhas');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// E-mails são comparados sem diferenciar maiúsculas/minúsculas e sem espaços nas pontas
const normalizarEmail = (email) => email.trim().toLowerCase();

// Hash de uma senha aleatória, com o mesmo custo dos reais. Quando o e-mail não existe,
// comparamos contra ele para que a resposta demore o mesmo que a de uma senha errada
// (senão o tempo de resposta revela quais e-mails estão cadastrados).
const hashFicticio = bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);

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

      const usuario = await getAsync(
        'SELECT * FROM usuarios WHERE LOWER(email) = ? AND ativo = 1',
        [normalizarEmail(email)]
      );

      const senhaValida = await bcrypt.compare(senha, usuario ? usuario.senha : await hashFicticio);

      if (!usuario || !senhaValida) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
        jwtSecret,
        { algorithm: jwtAlgorithm, expiresIn: '24h' }
      );

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

      const erroSenha = validarSenha(senha, { email });
      if (erroSenha) {
        return res.status(400).json({ error: erroSenha });
      }

      // Cadastro aberto apenas para o primeiro usuário (bootstrap do sistema).
      // Depois disso, somente um coordenador autenticado pode registrar novos usuários.
      const userCount = await getAsync('SELECT COUNT(*) as count FROM usuarios');

      if (userCount.count > 0) {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
          return res.status(401).json({ error: 'Apenas coordenadores podem registrar novos usuários' });
        }

        let decoded;
        try {
          decoded = jwt.verify(token, jwtSecret, { algorithms: [jwtAlgorithm] });
        } catch (err) {
          return res.status(401).json({ error: 'Token inválido' });
        }

        if (decoded.tipo !== 'coordenador') {
          return res.status(403).json({ error: 'Apenas coordenadores podem registrar novos usuários' });
        }
      }

      const emailNormalizado = normalizarEmail(email);

      const usuarioExiste = await getAsync(
        'SELECT id FROM usuarios WHERE LOWER(email) = ?',
        [emailNormalizado]
      );

      if (usuarioExiste) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const result = await runAsync(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
        [nome.trim(), emailNormalizado, senhaHash, tipo]
      );

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
