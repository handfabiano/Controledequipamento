// Registro de eventos de segurança: uma linha JSON por evento, na saída padrão
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

// Troca o destino das linhas (usado nos testes, que rodam um processo por arquivo).
function definirDestino(novoDestino) {
  destino = novoDestino;
}

function limitar(valor) {
  return typeof valor === 'string' ? valor.slice(0, TAMANHO_MAXIMO_CAMPO) : valor;
}

// Campos undefined somem sozinhos no JSON.stringify.
function registrar(evento, campos) {
  const linha = { ts: new Date().toISOString(), categoria: 'seguranca', evento };
  for (const [chave, valor] of Object.entries(campos)) {
    linha[chave] = limitar(valor);
  }
  destino(JSON.stringify(linha));
}

// Registra uma negação específica (ex.: login_falha) e avisa registrarAcessosNegados para não
// repetir a mesma resposta 401 como acesso_negado.
function registrarNegacao(res, evento, campos) {
  registrar(evento, campos);
  res.locals.negacaoRegistrada = true;
}

// Registra toda resposta 401/403/429 (token ausente/inválido, perfil sem permissão, rate limit).
// Deve ficar antes dos demais middlewares para pegar também o que o rate limiter barrar.
// Respostas já registradas por registrarNegacao ficam de fora.
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

module.exports = { registrar, registrarNegacao, registrarAcessosNegados, definirDestino };
