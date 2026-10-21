const express = require('express');
const router = express.Router();
const { authMiddleware, checkRole } = require('../middleware/auth');
const { authLimiter, senhaLimiter } = require('../middleware/rateLimiter');

// Controllers
const authController = require('../controllers/authController');
const equipamentosController = require('../controllers/equipamentosController');
const transferenciasController = require('../controllers/transferenciasController');
const eventosController = require('../controllers/eventosController');
const notificacoesController = require('../controllers/notificacoesController');
const dashboardController = require('../controllers/dashboardController');
const usuariosController = require('../controllers/usuariosController');
const cadastrosController = require('../controllers/cadastrosController');

// Validators
const equipamentoValidator = require('../validators/equipamentoValidator');

// Cadastro de equipamentos/eventos e baixa de problemas: coordenador e responsáveis (técnico só lê e reporta)
const gestor = checkRole('coordenador', 'responsavel_entrega', 'responsavel_recebimento');
const coordenador = checkRole('coordenador');

// Rotas de autenticação (públicas)
router.post('/auth/login', authLimiter, authController.login);
router.post('/auth/register', authController.register);
router.get('/auth/me', authMiddleware, authController.me);
router.put('/auth/senha', authMiddleware, senhaLimiter, authController.trocarSenha);

// Gestão de usuários (cadastro continua em /auth/register)
router.get('/usuarios', authMiddleware, coordenador, usuariosController.listar);
router.get('/usuarios/ativos', authMiddleware, usuariosController.listarAtivos);
router.put('/usuarios/:id/ativo', authMiddleware, coordenador, usuariosController.definirAtivo);

// Depósitos e categorias: todos consultam, só o coordenador cadastra e edita
router.get('/depositos', authMiddleware, cadastrosController.listarDepositos);
router.post('/depositos', authMiddleware, coordenador, cadastrosController.criarDeposito);
router.put('/depositos/:id', authMiddleware, coordenador, cadastrosController.atualizarDeposito);
router.get('/equipamentos/categorias', authMiddleware, cadastrosController.listarCategorias);
router.post('/equipamentos/categorias', authMiddleware, coordenador, cadastrosController.criarCategoria);
router.put('/equipamentos/categorias/:id', authMiddleware, coordenador, cadastrosController.atualizarCategoria);

// Rotas de equipamentos
router.get('/equipamentos', authMiddleware, equipamentoValidator.listarEquipamentos, equipamentosController.listar);
router.get('/equipamentos/tombamento/:tombamento', authMiddleware, equipamentoValidator.buscarPorTombamento, equipamentosController.buscarPorTombamento);
router.get('/equipamentos/:id', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.buscarPorId);
router.get('/equipamentos/:id/qrcode', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.gerarQRCode);
router.get('/equipamentos/:id/etiqueta', authMiddleware, equipamentoValidator.buscarPorId, equipamentosController.gerarEtiqueta);
router.post('/equipamentos', authMiddleware, gestor, equipamentoValidator.criarEquipamento, equipamentosController.criar);
router.put('/equipamentos/:id', authMiddleware, gestor, equipamentoValidator.atualizarEquipamento, equipamentosController.atualizar);
router.post('/equipamentos/:id/problemas', authMiddleware, equipamentoValidator.reportarProblema, equipamentosController.reportarProblema);
router.put('/equipamentos/:id/problemas/:problemaId/resolver', authMiddleware, gestor, equipamentosController.resolverProblema);

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
router.post('/eventos', authMiddleware, gestor, eventosController.criar);
router.post('/eventos/:id/equipamentos', authMiddleware, eventosController.adicionarEquipamentos);
router.get('/eventos/:id/validar-checklist', authMiddleware, eventosController.validarChecklist);
router.put('/eventos/:id/status', authMiddleware, eventosController.atualizarStatus);

// Rotas de notificações
router.get('/notificacoes', authMiddleware, notificacoesController.listar);
router.get('/notificacoes/nao-lidas/count', authMiddleware, notificacoesController.contarNaoLidas);
router.put('/notificacoes/ler-todas', authMiddleware, notificacoesController.marcarTodasLidas);
router.put('/notificacoes/:id/ler', authMiddleware, notificacoesController.marcarLida);

// Painel inicial
router.get('/dashboard/resumo', authMiddleware, dashboardController.resumo);

module.exports = router;
