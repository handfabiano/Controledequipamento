const { allAsync, getAsync, runAsync } = require('../database/init');
const { registrar } = require('../services/seguranca');
const { inteiro } = require('../services/validacao');
const { COLUNAS_PUBLICAS, usuarioPublico } = require('../services/usuarios');

const usuariosController = {
  async listar(req, res) {
    try {
      const usuarios = await allAsync(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios ORDER BY nome`);
      res.json(usuarios.map(usuarioPublico));
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  },

  // Para escolher pessoas pelo nome (destino e responsáveis de transferência): qualquer
  // usuário logado, por isso sem e-mail nem situação
  async listarAtivos(req, res) {
    try {
      res.json(await allAsync('SELECT id, nome, tipo FROM usuarios WHERE ativo = 1 ORDER BY nome'));
    } catch (error) {
      console.error('Erro ao listar usuários ativos:', error);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  },

  async definirAtivo(req, res) {
    try {
      const id = inteiro(req.params.id);
      const { ativo } = req.body;

      if (!id || id < 1) {
        return res.status(400).json({ error: 'ID de usuário inválido' });
      }
      if (typeof ativo !== 'boolean') {
        return res.status(400).json({ error: 'Informe ativo como verdadeiro ou falso' });
      }
      // Sem isso o último coordenador poderia se trancar fora do sistema (os demais, desativados,
      // perdem a sessão na hora: o authMiddleware confere o usuário no banco)
      if (id === req.user.id) {
        return res.status(400).json({ error: 'Você não pode desativar ou reativar a própria conta' });
      }

      const resultado = await runAsync('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, id]);
      if (resultado.changes === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      registrar(ativo ? 'usuario_reativado' : 'usuario_desativado', { usuario_id: id, por: req.user.id, ip: req.ip });

      const usuario = await getAsync(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = ?`, [id]);
      res.json(usuarioPublico(usuario));
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(500).json({ error: 'Erro ao atualizar usuário' });
    }
  }
};

module.exports = usuariosController;
