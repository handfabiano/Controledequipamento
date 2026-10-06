// Registro de eventos de segurança (A09-001): uma linha JSON por evento, na saída padrão
// (na Vercel vira log da função), para dar para investigar e alertar sobre tentativas de
// invasão: força bruta, uso de contas, acessos negados e criação de usuários.
//
// Regras: nunca registrar senha, token ou query string; todo valor passa por JSON.stringify
// (quebras de linha viram \n escapado, então uma entrada não forja outra linha de log) e
// textos longos são truncados.

const TAMANHO_MAXIMO_CAMPO = 200;
const STATUS_NEGADOS = new Set([401, 403, 429]);

// Nos testes fica em silêncio, a menos que o teste troque o destino.
let destino = (linha) => {
  if (process.env.NODE_ENV !== 'test') console.log(linha);
};

// Troca o destino das linhas (usado nos testes). Devolve a função que restaura o anterior.
function definirDestino(novoDestino) {
  const anterior = destino;
  destino = novoDestino;
  return () => { destino = anterior; };
}

function limitar(valor) {
  return typeof valor === 'string' ? valor.slice(0, TAMANHO_MAXIMO_CAMPO) : valor;
}

function registrar(evento, campos = {}) {
  const linha = { ts: new Date().toISOString(), categoria: 'seguranca', evento };
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor !== undefined) linha[chave] = limitar(valor);
  }
  destino(JSON.stringify(linha));
}

// Registra toda resposta 401/403/429 (token ausente/inválido, perfil sem permissão, rate limit).
// Deve ficar antes dos demais middlewares para pegar também o que o rate limiter barrar.
// Quem já registrou um evento mais específico marca res.locals.negacaoRegistrada.
function registrarAcessosNegados(req, res, next) {
  res.on('finish', () => {
    if (!STATUS_NEGADOS.has(res.statusCode) || res.locals.negacaoRegistrada) return;
    registrar('acesso_negado', {
      status: res.statusCode,
      metodo: req.method,
      rota: req.originalUrl.split('?')[0],
      ip: req.ip,
      usuario_id: req.user?.id
    });
  });
  next();
}

module.exports = { registrar, registrarAcessosNegados, definirDestino };
