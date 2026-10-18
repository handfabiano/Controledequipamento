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

// Erro de dado do formulário: quem captura responde 400 com a mensagem (ver tratarErros)
class ErroDeEntrada extends Error {}

// Id de registro: inteiro positivo dentro do INTEGER do Postgres (acima disso o driver dá erro 500)
const ID_MAXIMO = 2147483647;
const idValido = (valor) => {
  const id = inteiro(valor);
  return id !== null && id >= 1 && id <= ID_MAXIMO ? id : null;
};

// Texto opcional sem espaços nas pontas; vazio ou null viram null
function textoOuNulo(valor, rotulo, max) {
  if (!informado(valor)) return null;
  if (typeof valor !== 'string') throw new ErroDeEntrada(`${rotulo} deve ser texto`);
  const texto = valor.trim();
  if (texto.length > max) throw new ErroDeEntrada(`${rotulo} deve ter no máximo ${max} caracteres`);
  return texto || null;
}

function textoObrigatorio(valor, rotulo, max) {
  const texto = textoOuNulo(valor, rotulo, max);
  if (!texto) throw new ErroDeEntrada(`${rotulo} é obrigatório`);
  return texto;
}

// Envolve um handler: ErroDeEntrada vira 400 com a mensagem; o resto, 500 com a mensagem da ação
const tratarErros = (mensagem, handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error instanceof ErroDeEntrada) return res.status(400).json({ error: error.message });
    console.error(`${mensagem}:`, error);
    res.status(500).json({ error: mensagem });
  }
};

module.exports = { informado, inteiro, idValido, normalizarEmail, ErroDeEntrada, textoOuNulo, textoObrigatorio, tratarErros };
