const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS } = require('./helpers');

let srv;
let t;
let tecnico2; // sem relação com os eventos criados

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
  const reg = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Técnico Dois', email: 'tecnico2@sistema.com', senha: '123456', tipo: 'tecnico' }
  });
  assert.strictEqual(reg.status, 201);
  tecnico2 = await srv.login('tecnico2@sistema.com');
});
test.after(() => srv.fechar());

let contador = 0;

async function novoEquipamento(extra = {}) {
  const r = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Equipamento de evento', categoria_id: 1, prefixo: 'EVT', ...extra }
  });
  assert.strictEqual(r.status, 201, r.text);
  return r.body.id;
}

const equip = async (id) => (await srv.req('GET', `/api/equipamentos/${id}`, { token: t.coordenador })).body;
const evento = async (id) => (await srv.req('GET', `/api/eventos/${id}`, { token: t.coordenador })).body;
const status = (id, novo, token = t.coordenador) =>
  srv.req('PUT', `/api/eventos/${id}/status`, { token, body: { status: novo } });

async function criarEvento(extra = {}, token = t.coordenador) {
  contador += 1;
  const r = await srv.req('POST', '/api/eventos', {
    token,
    body: {
      nome: `Evento ${contador}`,
      local: 'Ginásio',
      data_inicio: '2031-05-10T10:00',
      data_fim: '2031-05-10T22:00',
      ...extra
    }
  });
  assert.strictEqual(r.status, 201, r.text);
  return r.body.id;
}

const alocar = (eventoId, itens, token = t.coordenador) =>
  srv.req('POST', `/api/eventos/${eventoId}/equipamentos`, {
    token,
    body: { equipamentos: itens.map((i) => (typeof i === 'number' ? { equipamento_id: i } : i)) }
  });

test('criar evento: validações de datas, template e responsáveis (sem criar nada pela metade)', async () => {
  const post = (body) => srv.req('POST', '/api/eventos', { token: t.coordenador, body });
  const base = { nome: 'X', local: 'Y', data_inicio: '2031-05-10T10:00', data_fim: '2031-05-10T22:00' };

  assert.strictEqual((await post({ ...base, data_fim: '2031-05-09T10:00' })).status, 400, 'fim antes do início');
  assert.strictEqual((await post({ ...base, data_inicio: 'ontem' })).status, 400, 'data inválida');
  assert.strictEqual((await post({ ...base, nome: '   ' })).status, 400);
  assert.strictEqual((await post({ ...base, template_id: 9999 })).status, 400);
  assert.strictEqual((await post({ ...base, responsaveis: [{ usuario_id: 9999, area: 'som', tipo: 'entrega' }] })).status, 400);
  assert.strictEqual((await post({ ...base, responsaveis: [{ usuario_id: 2, area: 'lua', tipo: 'entrega' }] })).status, 400);
  assert.strictEqual((await post({ ...base, responsaveis: [{ usuario_id: 2, area: 'som', tipo: 'rei' }] })).status, 400);

  const lista = await srv.req('GET', '/api/eventos', { token: t.coordenador });
  assert.strictEqual(lista.body.length, 0, 'nenhuma das tentativas inválidas pode ter gravado o evento');

  const ok = await post({ ...base, responsaveis: [{ usuario_id: 2, area: 'som', tipo: 'entrega' }] });
  assert.strictEqual(ok.status, 201);
});

test('evento inexistente devolve 404 em todas as rotas', async () => {
  assert.strictEqual((await srv.req('GET', '/api/eventos/999999', { token: t.coordenador })).status, 404);
  assert.strictEqual((await status(999999, 'aprovado')).status, 404);
  assert.strictEqual((await status(999999, 'cancelado')).status, 404, 'antes devolvia 200 sem fazer nada');
  assert.strictEqual((await alocar(999999, [1])).status, 404);
  assert.strictEqual((await srv.req('GET', '/api/eventos/999999/validar-checklist', { token: t.coordenador })).status, 404);
});

test('status: transições válidas, permissões e estados finais', async () => {
  const id = await criarEvento();

  assert.strictEqual((await status(id, 'inexistente')).status, 400);
  assert.strictEqual((await status(id, 'planejamento')).status, 400, 'já está nesse status');
  assert.strictEqual((await status(id, 'em_andamento')).status, 400, 'não pode pular a aprovação');
  assert.strictEqual((await status(id, 'concluido')).status, 400);

  assert.strictEqual((await status(id, 'aprovado', t.tecnico)).status, 403);
  assert.strictEqual((await status(id, 'aprovado')).status, 200);
  assert.strictEqual((await status(id, 'em_andamento', tecnico2)).status, 403, 'só coordenador inicia');
  assert.strictEqual((await status(id, 'em_andamento')).status, 200);
  assert.strictEqual((await status(id, 'concluido', t.entrega)).status, 403, 'só coordenador conclui');
  assert.strictEqual((await status(id, 'concluido')).status, 200);

  // Estados finais não voltam
  for (const destino of ['planejamento', 'aprovado', 'em_andamento', 'cancelado']) {
    assert.strictEqual((await status(id, destino)).status, 400, `concluido -> ${destino}`);
  }
});

test('o criador do evento pode cancelá-lo; outros técnicos não', async () => {
  const meu = await criarEvento({}, t.tecnico);
  assert.strictEqual((await status(meu, 'cancelado', tecnico2)).status, 403);
  assert.strictEqual((await status(meu, 'aprovado', t.tecnico)).status, 403, 'criador não aprova');
  assert.strictEqual((await status(meu, 'cancelado', t.tecnico)).status, 200);
  assert.strictEqual((await evento(meu)).status, 'cancelado');
});

test('aprovação exige checklist obrigatório completo do template', async () => {
  const id = await criarEvento({ template_id: 2 });
  const falha = await status(id, 'aprovado');
  assert.strictEqual(falha.status, 400);
  assert.match(falha.body.error, /checklist/i);

  const validacao = await srv.req('GET', `/api/eventos/${id}/validar-checklist`, { token: t.coordenador });
  assert.strictEqual(validacao.body.valido, false);

  // Seed: 2+ microfones com fio, 1+ sem fio, 4+ caixas, 1+ mesa (categorias 1, 2, 3 e 4)
  const codigos = ['MIC0001', 'MIC0002', 'MIW0001', 'CAI0001', 'CAI0002', 'CAI0003', 'CAI0004', 'MES0001'];
  const todos = (await srv.req('GET', '/api/equipamentos?limit=100', { token: t.coordenador })).body.data;
  const itens = codigos.map((c) => todos.find((e) => e.codigo === c).id);
  assert.strictEqual((await alocar(id, itens)).status, 200);

  assert.strictEqual((await status(id, 'aprovado')).status, 200);
});

test('alocar equipamentos: marca em_uso e exige permissão', async () => {
  const id = await criarEvento();
  const eq = await novoEquipamento();

  assert.strictEqual((await alocar(id, [eq], tecnico2)).status, 403, 'estranho ao evento');
  assert.strictEqual((await equip(eq)).status, 'disponivel');

  assert.strictEqual((await alocar(id, [eq])).status, 200);
  assert.strictEqual((await equip(eq)).status, 'em_uso');
  assert.strictEqual((await evento(id)).equipamentos.length, 1);
});

test('alocar: responsáveis cadastrados e o criador do evento podem alocar', async () => {
  const doTecnico = await criarEvento({}, t.tecnico);
  const eq1 = await novoEquipamento();
  assert.strictEqual((await alocar(doTecnico, [eq1], t.tecnico)).status, 200, 'criador');

  const comResponsavel = await criarEvento({
    responsaveis: [{ usuario_id: USUARIOS.entrega.id, area: 'som', tipo: 'entrega' }]
  });
  const eq2 = await novoEquipamento();
  assert.strictEqual((await alocar(comResponsavel, [eq2], t.entrega)).status, 200, 'responsável do evento');
});

test('alocar: equipamento indisponível, duplicado ou inexistente recusa o lote inteiro', async () => {
  const id = await criarEvento();
  const livre = await novoEquipamento();
  const emManutencao = await novoEquipamento();
  await srv.req('PUT', `/api/equipamentos/${emManutencao}`, { token: t.coordenador, body: { status: 'manutencao' } });
  const comProblema = await novoEquipamento();
  await srv.req('POST', `/api/equipamentos/${comProblema}/problemas`, {
    token: t.tecnico,
    body: { descricao: 'Canal esquerdo mudo', gravidade: 'alta' }
  });
  const ocupado = await novoEquipamento();
  const outro = await criarEvento();
  await alocar(outro, [ocupado]);

  for (const ruim of [emManutencao, comProblema, ocupado]) {
    const r = await alocar(id, [livre, ruim]);
    assert.strictEqual(r.status, 400, `equipamento ${ruim} deveria ser recusado`);
  }
  assert.strictEqual((await alocar(id, [livre, livre])).status, 400, 'duplicado no pedido');
  assert.strictEqual((await alocar(id, [999999])).status, 400, 'inexistente');
  assert.strictEqual((await alocar(id, [{ equipamento_id: livre, area: 'lua' }])).status, 400);
  assert.strictEqual((await alocar(id, [{ equipamento_id: livre, quantidade: 0 }])).status, 400);
  assert.strictEqual((await alocar(id, [{ equipamento_id: livre, responsavel_id: 9999 }])).status, 400);

  // Nada foi gravado pela metade
  assert.strictEqual((await evento(id)).equipamentos.length, 0);
  assert.strictEqual((await equip(livre)).status, 'disponivel');
  assert.strictEqual((await equip(emManutencao)).status, 'manutencao');
});

test('não aloca em evento concluído ou cancelado', async () => {
  const id = await criarEvento();
  await status(id, 'cancelado');
  const eq = await novoEquipamento();
  assert.strictEqual((await alocar(id, [eq])).status, 400);
});

test('concluir ou cancelar o evento libera os equipamentos (antes ficavam em_uso para sempre)', async () => {
  for (const final of ['concluido', 'cancelado']) {
    const id = await criarEvento();
    const eq = await novoEquipamento();
    const comProblema = await novoEquipamento();
    const emManutencao = await novoEquipamento();
    await alocar(id, [eq, comProblema]);
    await srv.req('POST', `/api/equipamentos/${comProblema}/problemas`, {
      token: t.tecnico,
      body: { descricao: 'Queimou durante a montagem', gravidade: 'critica' }
    });
    await srv.req('PUT', `/api/equipamentos/${emManutencao}`, { token: t.coordenador, body: { status: 'manutencao' } });

    if (final === 'concluido') {
      await status(id, 'aprovado');
      await status(id, 'em_andamento');
    }
    assert.strictEqual((await status(id, final)).status, 200);

    assert.strictEqual((await equip(eq)).status, 'disponivel', `${final}: equipamento liberado`);
    assert.strictEqual((await equip(comProblema)).status, 'com_problema', `${final}: problema continua visível`);
    assert.strictEqual((await equip(emManutencao)).status, 'manutencao');

    const det = await evento(id);
    assert.ok(det.equipamentos.every((e) => e.status === 'devolvido'), `${final}: alocações devolvidas`);

    // Liberado, pode ser usado em outro evento
    const proximo = await criarEvento();
    assert.strictEqual((await alocar(proximo, [eq])).status, 200);
  }
});

test('problema grave num equipamento de evento e a resolução não o devolvem a "disponível"', async () => {
  const id = await criarEvento();
  const eq = await novoEquipamento();
  await alocar(id, [eq]);

  const problema = await srv.req('POST', `/api/equipamentos/${eq}/problemas`, {
    token: t.tecnico,
    body: { descricao: 'Distorção no canal 3', gravidade: 'alta' }
  });
  assert.strictEqual((await equip(eq)).status, 'com_problema');

  await srv.req('PUT', `/api/equipamentos/${eq}/problemas/${problema.body.id}/resolver`, { token: t.coordenador });
  assert.strictEqual((await equip(eq)).status, 'em_uso', 'continua alocado ao evento');
});

test('cancelar o evento não libera equipamento que está em transferência', async () => {
  const id = await criarEvento();
  const eq = await novoEquipamento({ deposito_id: 1 });
  await alocar(id, [eq]);

  const tr = await srv.req('POST', '/api/transferencias', {
    token: t.tecnico,
    body: { equipamento_id: eq, origem_tipo: 'evento', origem_id: id, destino_tipo: 'deposito', destino_id: 1 }
  });
  assert.strictEqual(tr.status, 201, tr.text);
  assert.strictEqual((await equip(eq)).status, 'transferencia');

  await status(id, 'cancelado');
  assert.strictEqual((await equip(eq)).status, 'transferencia');

  // Cancelando a transferência, sem evento ativo, ele finalmente fica disponível
  await srv.req('POST', `/api/transferencias/${tr.body.id}/cancelar`, { token: t.coordenador, body: { motivo: 'teste' } });
  assert.strictEqual((await equip(eq)).status, 'disponivel');
});

test('transferência entre eventos concluída move a alocação junto com o equipamento', async () => {
  const a = await criarEvento({ data_inicio: '2031-08-01T10:00', data_fim: '2031-08-01T20:00' });
  const b = await criarEvento({ data_inicio: '2031-08-01T14:00', data_fim: '2031-08-01T23:00' });
  await status(a, 'aprovado');
  await status(b, 'aprovado');
  const eq = await novoEquipamento();
  await alocar(a, [{ equipamento_id: eq, responsavel_id: USUARIOS.entrega.id, area: 'som' }]);

  const tr = await srv.req('POST', '/api/transferencias/entre-eventos', {
    token: t.entrega,
    body: { equipamento_id: eq, evento_origem_id: a, evento_destino_id: b }
  });
  assert.strictEqual(tr.status, 201, tr.text);
  for (const [tipo, token] of [['coordenador', t.coordenador], ['entrega', t.entrega], ['recebimento', t.recebimento]]) {
    const r = await srv.req('POST', `/api/transferencias/${tr.body.id}/aprovar`, { token, body: { tipo_aprovacao: tipo } });
    assert.strictEqual(r.status, 200, r.text);
  }

  const detA = await evento(a);
  const detB = await evento(b);
  assert.strictEqual(detA.equipamentos[0].status, 'devolvido');
  assert.strictEqual(detB.equipamentos.length, 1);
  assert.strictEqual(detB.equipamentos[0].responsavel_id, USUARIOS.entrega.id, 'responsável acompanha');
  assert.strictEqual(detB.equipamentos[0].area, 'som');
  assert.strictEqual((await equip(eq)).status, 'em_uso');

  // Encerrar o evento de origem não pode soltar um equipamento que está no outro
  await status(a, 'em_andamento');
  await status(a, 'concluido');
  assert.strictEqual((await equip(eq)).status, 'em_uso');

  await status(b, 'cancelado');
  assert.strictEqual((await equip(eq)).status, 'disponivel');
});

test('templates: lista com checklist (cache)', async () => {
  const r1 = await srv.req('GET', '/api/eventos/templates', { token: t.coordenador });
  assert.strictEqual(r1.status, 200);
  assert.strictEqual(r1.body.length, 4);
  assert.ok(r1.body.find((x) => x.tamanho === 'medio').checklist.length >= 4);
  const r2 = await srv.req('GET', '/api/eventos/templates', { token: t.tecnico });
  assert.deepStrictEqual(r2.body, r1.body);
});
