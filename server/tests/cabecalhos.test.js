const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS } = require('./helpers');
const { cabecalhosDeSeguranca, CABECALHOS_BASE } = require('../middleware/cabecalhos');

let srv;
let token;

test.before(async () => {
  srv = await iniciarServidor();
  token = await srv.login(USUARIOS.coordenador.email);
});
test.after(() => srv.fechar());

test('respostas da API trazem os cabeçalhos de segurança e não revelam o Express', async () => {
  for (const r of [
    await srv.req('GET', '/health'),
    await srv.req('GET', '/api/equipamentos'), // 401
    await srv.req('GET', '/api/equipamentos', { token }),
    await srv.req('GET', '/rota-que-nao-existe') // 404
  ]) {
    assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(r.headers.get('x-frame-options'), 'DENY');
    assert.strictEqual(r.headers.get('referrer-policy'), 'no-referrer');
    assert.match(r.headers.get('permissions-policy'), /camera=\(self\)/);
    assert.strictEqual(r.headers.get('x-powered-by'), null);
  }
});

test('respostas autenticadas da API não são guardadas em cache', async () => {
  const r = await srv.req('GET', '/api/equipamentos', { token });
  assert.strictEqual(r.headers.get('cache-control'), 'no-store');
});

test('a etiqueta mantém a própria Content-Security-Policy restritiva', async () => {
  const r = await srv.req('GET', '/api/equipamentos/1/etiqueta', { token });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
  assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff');
});

test('HSTS só em produção', () => {
  const aplicar = (producao) => {
    const cabecalhos = {};
    cabecalhosDeSeguranca({ producao })({ path: '/api/x' }, { setHeader: (k, v) => { cabecalhos[k.toLowerCase()] = v; } }, () => {});
    return cabecalhos;
  };
  assert.strictEqual(aplicar(false)['strict-transport-security'], undefined);
  assert.match(aplicar(true)['strict-transport-security'], /^max-age=\d+$/);
});

test('o vercel.json manda ao SPA os mesmos cabeçalhos da API', () => {
  const { routes } = require('../../vercel.json');
  const catchAll = routes.find((r) => r.src === '/(.*)');
  assert.deepStrictEqual(catchAll.headers, CABECALHOS_BASE);
});
