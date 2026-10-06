// Conversões de entrada usadas pelos controllers.

// Campo preenchido: nem ausente, nem null, nem string vazia (o que a tela envia em branco)
const informado = (valor) => valor !== undefined && valor !== null && valor !== '';

// Converte "12" / 12 em 12; qualquer outra coisa (vazio, texto, decimal, null) vira null
const inteiro = (valor) => {
  if (!informado(valor)) return null;
  const n = Number(valor);
  return Number.isInteger(n) ? n : null;
};

// E-mails são comparados sem diferenciar maiúsculas/minúsculas e sem espaços nas pontas
const normalizarEmail = (email) => email.trim().toLowerCase();

module.exports = { informado, inteiro, normalizarEmail };
