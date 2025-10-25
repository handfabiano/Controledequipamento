const { body, query, param, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

const listarEquipamentos = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Página deve ser um número inteiro maior que 0'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limite deve ser entre 1 e 100'),

  query('status')
    .optional()
    .isIn(['disponivel', 'em_uso', 'manutencao', 'com_problema', 'transferencia'])
    .withMessage('Status inválido'),

  query('categoria_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID da categoria deve ser um número inteiro positivo'),

  query('deposito_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID do depósito deve ser um número inteiro positivo'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 }).withMessage('Busca deve ter entre 1 e 100 caracteres'),

  validate
];

const criarEquipamento = [
  body('nome')
    .trim()
    .notEmpty().withMessage('Nome é obrigatório')
    .isLength({ min: 3, max: 100 }).withMessage('Nome deve ter entre 3 e 100 caracteres'),

  body('categoria_id')
    .isInt({ min: 1 }).withMessage('Categoria inválida'),

  body('codigo')
    .optional()
    .matches(/^[A-Z]{3}\d{4}$/).withMessage('Código deve estar no formato XXX0000 (ex: MIC0001)'),

  body('prefixo')
    .optional()
    .matches(/^[A-Z]{3}$/).withMessage('Prefixo deve ter 3 letras maiúsculas (ex: MIC)'),

  body('marca')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Marca muito longa (máximo 50 caracteres)'),

  body('modelo')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Modelo muito longo (máximo 50 caracteres)'),

  body('numero_serie')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Número de série muito longo (máximo 100 caracteres)'),

  body('deposito_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID do depósito inválido'),

  body('condicao')
    .optional()
    .isIn(['excelente', 'bom', 'regular', 'ruim', 'quebrado'])
    .withMessage('Condição inválida (opções: excelente, bom, regular, ruim, quebrado)'),

  body('observacoes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Observações muito longas (máximo 500 caracteres)'),

  validate
];

const atualizarEquipamento = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID do equipamento inválido'),

  body('nome')
    .optional()
    .trim()
    .notEmpty().withMessage('Nome não pode ser vazio')
    .isLength({ min: 3, max: 100 }).withMessage('Nome deve ter entre 3 e 100 caracteres'),

  body('categoria_id')
    .optional()
    .isInt({ min: 1 }).withMessage('Categoria inválida'),

  body('marca')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Marca muito longa (máximo 50 caracteres)'),

  body('modelo')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Modelo muito longo (máximo 50 caracteres)'),

  body('numero_serie')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Número de série muito longo (máximo 100 caracteres)'),

  body('deposito_id')
    .optional()
    .isInt({ min: 1 }).withMessage('ID do depósito inválido'),

  body('status')
    .optional()
    .isIn(['disponivel', 'em_uso', 'manutencao', 'com_problema', 'transferencia'])
    .withMessage('Status inválido'),

  body('condicao')
    .optional()
    .isIn(['excelente', 'bom', 'regular', 'ruim', 'quebrado'])
    .withMessage('Condição inválida'),

  body('observacoes')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Observações muito longas (máximo 500 caracteres)'),

  validate
];

const reportarProblema = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID do equipamento inválido'),

  body('descricao')
    .trim()
    .notEmpty().withMessage('Descrição é obrigatória')
    .isLength({ min: 10, max: 500 }).withMessage('Descrição deve ter entre 10 e 500 caracteres'),

  body('gravidade')
    .isIn(['baixa', 'media', 'alta', 'critica'])
    .withMessage('Gravidade inválida (opções: baixa, media, alta, critica)'),

  validate
];

const buscarPorId = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID do equipamento inválido'),

  validate
];

const buscarPorTombamento = [
  param('tombamento')
    .matches(/^TOMB-\d{4}-\d{6}$/)
    .withMessage('Formato de tombamento inválido (esperado: TOMB-YYYY-XXXXXX)'),

  validate
];

module.exports = {
  listarEquipamentos,
  criarEquipamento,
  atualizarEquipamento,
  reportarProblema,
  buscarPorId,
  buscarPorTombamento
};
