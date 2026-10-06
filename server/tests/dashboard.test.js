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

const resumo = async (token = t.coordenador) =>
  srv.req('GET', '/api/dashboard/resumo', { token });

test('exige autenticação', async () => {
  assert.strictEqual((await srv.req('GET', '/api/dashboard/resumo')).status, 401);
});

test('resumo do seed: contagens por status vêm do banco inteiro', async () => {
  const r = await resumo();
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(r.body.equipamentos, {
    total: 15,
    disponivel: 15,
    em_uso: 0,
    com_problema: 0,
    transferencia: 0,
    manutencao: 0
  });
  assert.strictEqual(r.body.transferencias_pendentes, 0);
  assert.strictEqual(r.body.eventos_ativos, 0);
});

test('com mais de 100 equipamentos o total continua correto (antes parava em 50)', async () => {
  for (let i = 0; i < 90; i += 1) {
    const r = await srv.req('POST', '/api/equipamentos', {
      token: t.coordenador,
      body: { nome: `Equipamento em massa ${i}`, categoria_id: 1, prefixo: 'MAS' }
    });
    assert.strictEqual(r.status, 201);
  }
  const r = await resumo();
  assert.strictEqual(r.body.equipamentos.total, 105);
  assert.strictEqual(r.body.equipamentos.disponivel, 105);
});

test('contagens refletem eventos, problemas, transferências e manutenção', async () => {
  const lista = (await srv.req('GET', '/api/equipamentos?limit=100&search=Equipamento em massa', { token: t.coordenador })).body.data;
  const [emEvento, comProblema, emTransf, emManut] = lista;

  const ev = await srv.req('POST', '/api/eventos', {
    token: t.coordenador,
    body: { nome: 'Show', local: 'Praça', data_inicio: '2031-01-01T10:00', data_fim: '2031-01-01T20:00' }
  });
  await srv.req('POST', `/api/eventos/${ev.body.id}/equipamentos`, {
    token: t.coordenador,
    body: { equipamentos: [{ equipamento_id: emEvento.id }] }
  });
  await srv.req('PUT', `/api/eventos/${ev.body.id}/status`, { token: t.coordenador, body: { status: 'aprovado' } });
  await srv.req('PUT', `/api/eventos/${ev.body.id}/status`, { token: t.coordenador, body: { status: 'em_andamento' } });

  await srv.req('POST', `/api/equipamentos/${comProblema.id}/problemas`, {
    token: t.tecnico,
    body: { descricao: 'Sem som nenhum no canal', gravidade: 'critica' }
  });
  await srv.req('PUT', `/api/equipamentos/${emManut.id}`, { token: t.coordenador, body: { status: 'manutencao' } });
  const tr = await srv.req('POST', '/api/transferencias', {
    token: t.tecnico,
    body: { equipamento_id: emTransf.id, origem_tipo: 'deposito', destino_tipo: 'deposito', destino_id: 2 }
  });
  assert.strictEqual(tr.status, 201);

  const r = await resumo();
  assert.deepStrictEqual(r.body.equipamentos, {
    total: 105,
    disponivel: 101,
    em_uso: 1,
    com_problema: 1,
    transferencia: 1,
    manutencao: 1
  });
  assert.strictEqual(r.body.eventos_ativos, 1);
  assert.strictEqual(r.body.transferencias_pendentes, 1);

  // Quem não enxerga a transferência não a conta
  const reg = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Outro', email: 'outro@sistema.com', senha: 'senha-segura-9', tipo: 'tecnico' }
  });
  assert.strictEqual(reg.status, 201);
  const outro = await srv.login('outro@sistema.com', 'senha-segura-9');
  assert.strictEqual((await resumo(outro)).body.transferencias_pendentes, 0);
  assert.strictEqual((await resumo(t.entrega)).body.transferencias_pendentes, 1, 'responsável de entrega sem designado vê');

  // Atividades recentes: transferência pendente e problemas não resolvidos (seed tem 1)
  const atividades = r.body.atividades;
  assert.ok(atividades.some((a) => a.tipo === 'transferencia' && /pendente/.test(a.descricao)));
  assert.ok(atividades.some((a) => a.tipo === 'problema' && a.descricao.includes('MOV0001')));
  assert.ok(atividades.some((a) => a.tipo === 'problema' && a.descricao.includes(comProblema.codigo)));
  assert.ok(atividades.length <= 10);
  assert.ok(atividades.every((a) => a.data));
  assert.ok(!(await resumo(outro)).body.atividades.some((a) => a.tipo === 'transferencia'));
});
