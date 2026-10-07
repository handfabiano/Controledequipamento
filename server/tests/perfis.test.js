const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor } = require('./helpers');

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

const GESTORES = ['coordenador', 'entrega', 'recebimento'];

const novoEquipamento = (token) =>
  srv.req('POST', '/api/equipamentos', { token, body: { nome: 'Equipamento de perfil', categoria_id: 1, prefixo: 'PRF' } });
const novoEvento = (token) =>
  srv.req('POST', '/api/eventos', {
    token,
    body: { nome: 'Evento de perfil', local: 'Ginásio', data_inicio: '2032-05-10T10:00', data_fim: '2032-05-10T22:00' }
  });

test('técnico não cadastra nem edita equipamentos; coordenador e responsáveis sim', async () => {
  const negado = await srv.req('POST', '/api/equipamentos', { token: t.tecnico, body: {} });
  assert.strictEqual(negado.status, 403, 'a recusa por perfil vem antes da validação do corpo');

  for (const papel of GESTORES) {
    const r = await novoEquipamento(t[papel]);
    assert.strictEqual(r.status, 201, `${papel}: ${r.text}`);
    const edicao = await srv.req('PUT', `/api/equipamentos/${r.body.id}`, { token: t[papel], body: { nome: 'Editado' } });
    assert.strictEqual(edicao.status, 200, `${papel} edita`);
  }

  const alvo = (await novoEquipamento(t.coordenador)).body.id;
  const edicaoNegada = await srv.req('PUT', `/api/equipamentos/${alvo}`, { token: t.tecnico, body: { status: 'manutencao' } });
  assert.strictEqual(edicaoNegada.status, 403, 'técnico não muda o estado do equipamento');
  const depois = await srv.req('GET', `/api/equipamentos/${alvo}`, { token: t.coordenador });
  assert.notStrictEqual(depois.body.status, 'manutencao');
});

test('qualquer perfil reporta problema, mas só coordenador e responsáveis o resolvem', async () => {
  const id = (await novoEquipamento(t.coordenador)).body.id;
  const reportar = (token) =>
    srv.req('POST', `/api/equipamentos/${id}/problemas`, { token, body: { descricao: 'Sem som no canal 3', gravidade: 'critica' } });

  const doTecnico = await reportar(t.tecnico);
  assert.strictEqual(doTecnico.status, 201, 'técnico reporta');

  const resolver = (token, problemaId) =>
    srv.req('PUT', `/api/equipamentos/${id}/problemas/${problemaId}/resolver`, { token });

  assert.strictEqual((await resolver(t.tecnico, doTecnico.body.id)).status, 403);
  assert.strictEqual((await srv.req('GET', `/api/equipamentos/${id}`, { token: t.coordenador })).body.status, 'com_problema',
    'o técnico não pode liberar o equipamento');

  for (const papel of GESTORES) {
    const p = await reportar(t.tecnico);
    assert.strictEqual((await resolver(t[papel], p.body.id)).status, 200, `${papel} resolve`);
  }
});

test('técnico não cria eventos; coordenador e responsáveis sim', async () => {
  assert.strictEqual((await novoEvento(t.tecnico)).status, 403);
  for (const papel of GESTORES) {
    const r = await novoEvento(t[papel]);
    assert.strictEqual(r.status, 201, `${papel}: ${r.text}`);
  }
});
