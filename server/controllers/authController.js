const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAsync, runAsync } = require('../database/init');
const { jwtSecret } = require('../config');

const authController = {
  async login(req, res) {
    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }

      const usuario = await getAsync(
        'SELECT * FROM usuarios WHERE email = ? AND ativo = 1',
        [email]
      );

      if (!usuario) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const senhaValida = await bcrypt.compare(senha, usuario.senha);

      if (!senhaValida) {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
        jwtSecret,
        { expiresIn: '24h' }
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

      const tiposValidos = ['coordenador', 'responsavel_entrega', 'responsavel_recebimento', 'tecnico'];
      if (!tiposValidos.includes(tipo)) {
        return res.status(400).json({ error: 'Tipo de usuário inválido' });
      }

      if (senha.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
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
          decoded = jwt.verify(token, jwtSecret);
        } catch (err) {
          return res.status(401).json({ error: 'Token inválido' });
        }

        if (decoded.tipo !== 'coordenador') {
          return res.status(403).json({ error: 'Apenas coordenadores podem registrar novos usuários' });
        }
      }

      const usuarioExiste = await getAsync('SELECT id FROM usuarios WHERE email = ?', [email]);

      if (usuarioExiste) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }

      const senhaHash = await bcrypt.hash(senha, 10);

      const result = await runAsync(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
        [nome, email, senhaHash, tipo]
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
