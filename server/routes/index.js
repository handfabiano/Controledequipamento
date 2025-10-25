const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');

// Controllers
const authController = require('../controllers/authController');
const equipamentosController = require('../controllers/equipamentosController');
const transferenciasController = require('../controllers/transferenciasController');
const eventosController = require('../controllers/eventosController');

// Rotas de autenticação (públicas)
router.post('/auth/login', authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/me', authMiddleware, authController.me);

// Rotas de equipamentos
router.get('/equipamentos', authMiddleware, equipamentosController.listar);
router.get('/equipamentos/categorias', authMiddleware, equipamentosController.listarCategorias);
router.get('/equipamentos/:id', authMiddleware, equipamentosController.buscarPorId);
router.post('/equipamentos', authMiddleware, equipamentosController.criar);
router.put('/equipamentos/:id', authMiddleware, equipamentosController.atualizar);
router.post('/equipamentos/:id/problemas', authMiddleware, equipamentosController.reportarProblema);
router.put('/equipamentos/:id/problemas/:problemaId/resolver', authMiddleware, equipamentosController.resolverProblema);

// Rotas de transferências
router.get('/transferencias', authMiddleware, transferenciasController.listar);
router.get('/transferencias/:id', authMiddleware, transferenciasController.buscarPorId);
router.post('/transferencias', authMiddleware, transferenciasController.criar);
router.post('/transferencias/:id/aprovar', authMiddleware, transferenciasController.aprovar);
router.post('/transferencias/:id/cancelar', authMiddleware, transferenciasController.cancelar);
router.post('/transferencias/rapida', authMiddleware, transferenciasController.transferirEntreResponsaveis);

// Rotas de eventos
router.get('/eventos', authMiddleware, eventosController.listar);
router.get('/eventos/templates', authMiddleware, eventosController.listarTemplates);
router.get('/eventos/:id', authMiddleware, eventosController.buscarPorId);
router.post('/eventos', authMiddleware, eventosController.criar);
router.post('/eventos/:id/equipamentos', authMiddleware, eventosController.adicionarEquipamentos);
router.get('/eventos/:id/validar-checklist', authMiddleware, eventosController.validarChecklist);
router.put('/eventos/:id/status', authMiddleware, eventosController.atualizarStatus);

module.exports = router;
