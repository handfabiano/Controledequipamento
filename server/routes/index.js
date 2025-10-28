const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Controllers
const authController = require('../controllers/authController');
const equipamentosController = require('../controllers/equipamentosController');
const transferenciasController = require('../controllers/transferenciasController');
const eventosController = require('../controllers/eventosController');

// Validators
const equipamentoValidator = require('../validators/equipamentoValidator');

// Rotas de autenticação (públicas)
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/me', authMiddleware, authController.me);

// Rotas de equipamentos
router.get('/equipamentos', authMiddleware, equipamentoValidator.listarEquipamentos, equipamentosController.listar);
router.get('/equipamentos/categorias', authMiddleware, equipamentosController.listarCategorias);
router.get('/equipamentos/tombamento/:tombamento', authMiddleware, equipamentoValidator.buscarPorTombamento, equipamentosController.buscarPorTombamento);
router.get('/equipamentos/:id', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.buscarPorId);
router.get('/equipamentos/:id/qrcode', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.gerarQRCode);
router.get('/equipamentos/:id/etiqueta', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.gerarEtiqueta);
router.post('/equipamentos', authMiddleware, equipamentoValidator.criarEquipamento, equipamentosController.criar);
router.put('/equipamentos/:id', authMiddleware, equipamentoValidator.atualizarEquipamento, equipamentosController.atualizar);
router.post('/equipamentos/:id/problemas', authMiddleware, equipamentoValidator.reportarProblema, equipamentosController.reportarProblema);
router.put('/equipamentos/:id/problemas/:problemaId/resolver', authMiddleware, equipamentosController.resolverProblema);

// Rotas de transferências
router.get('/transferencias', authMiddleware, transferenciasController.listar);
router.post('/transferencias', authMiddleware, transferenciasController.criar);
// Rotas específicas devem vir ANTES das rotas parametrizadas
router.post('/transferencias/rapida', authMiddleware, transferenciasController.transferirEntreResponsaveis);
router.post('/transferencias/entre-eventos', authMiddleware, transferenciasController.transferirEntreEventos);
// Rotas parametrizadas por último
router.get('/transferencias/:id', authMiddleware, transferenciasController.buscarPorId);
router.post('/transferencias/:id/aprovar', authMiddleware, transferenciasController.aprovar);
router.post('/transferencias/:id/cancelar', authMiddleware, transferenciasController.cancelar);

// Rotas de eventos
router.get('/eventos', authMiddleware, eventosController.listar);
router.get('/eventos/templates', authMiddleware, eventosController.listarTemplates);
router.get('/eventos/:id', authMiddleware, eventosController.buscarPorId);
router.post('/eventos', authMiddleware, eventosController.criar);
router.post('/eventos/:id/equipamentos', authMiddleware, eventosController.adicionarEquipamentos);
router.get('/eventos/:id/validar-checklist', authMiddleware, eventosController.validarChecklist);
router.put('/eventos/:id/status', authMiddleware, eventosController.atualizarStatus);

module.exports = router;
