const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS } = require('./helpers');

let srv;
let t;
let tecnico2; // token de um segundo técnico, sem relação com as transferências

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
  const reg = await srv.req('POST', '/api/auth/register', {
    token: t.coordenador,
    body: { nome: 'Técnico Dois', email: 'tecnico2@sistema.com', senha: 'senha-segura-9', tipo: 'tecnico' }
  });
  assert.strictEqual(reg.status, 201);
  tecnico2 = await srv.login('tecnico2@sistema.com', 'senha-segura-9');
});
test.after(() => srv.fechar());

async function novoEquipamento(extra = {}) {
  const r = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { nome: 'Equipamento de transferência', categoria_id: 1, prefixo: 'TRF', ...extra }
  });
  assert.strictEqual(r.status, 201, r.text);
  return r.body.id;
}

const equip = async (id) => (await srv.req('GET', `/api/equipamentos/${id}`, { token: t.coordenador })).body;
const transf = async (id, token = t.coordenador) =>
  (await srv.req('GET', `/api/transferencias/${id}`, { token })).body;

// Payload exatamente como a tela de Transferências envia (sem responsáveis nem origem_id)
async function solicitar(equipamento_id, extra = {}, token = t.tecnico) {
  return srv.req('POST', '/api/transferencias', {
    token,
    body: { equipamento_id, origem_tipo: 'deposito', destino_tipo: 'deposito', destino_id: 2, ...extra }
  });
}

const aprovar = (id, tipo, token) =>
  srv.req('POST', `/api/transferencias/${id}/aprovar`, { token, body: { tipo_aprovacao: tipo } });

test('solicitação como a UI faz (sem origem_id/responsáveis) é aceita e trava o equipamento', async () => {
  const eqId = await novoEquipamento({ deposito_id: 1 });
  const r = await solicitar(eqId);
  assert.strictEqual(r.status, 201, r.text);

  assert.strictEqual((await equip(eqId)).status, 'transferencia');
  const tr = await transf(r.body.id);
  assert.strictEqual(tr.origem_id, 1, 'origem deve assumir o depósito atual do equipamento');
  assert.strictEqual(tr.status, 'pendente');
});

test('fluxo triplo com três pessoas conclui e move o equipamento', async () => {
  const eqId = await novoEquipamento({ deposito_id: 1 });
  const { body } = await solicitar(eqId, { destino_id: 3 });
  const id = body.id;

  let r = await aprovar(id, 'coordenador', t.coordenador);
  assert.strictEqual(r.status, 200, r.text);
  assert.strictEqual(r.body.status, 'aprovada_coordenador');

  r = await aprovar(id, 'entrega', t.entrega);
  assert.strictEqual(r.body.status, 'em_transito');

  r = await aprovar(id, 'recebimento', t.recebimento);
  assert.strictEqual(r.body.status, 'concluida');

  const eq = await equip(eqId);
  assert.strictEqual(eq.deposito_id, 3);
  assert.strictEqual(eq.status, 'disponivel');
  assert.ok(eq.historico.some((h) => h.tipo_movimentacao === 'transferencia'));

  // O solicitante foi avisado do andamento
  const notif = await srv.req('GET', '/api/notificacoes', { token: t.tecnico });
  assert.ok(notif.body.some((n) => n.tipo === 'transferencia_atualizada'));
});

test('aprovações fora de ordem nunca deixam a transferência travada', async () => {
  const eqId = await novoEquipamento({ deposito_id: 1 });
  const { body } = await solicitar(eqId);
  const id = body.id;

  // Recebimento antes da entrega não faz sentido
  const cedo = await aprovar(id, 'recebimento', t.recebimento);
  assert.strictEqual(cedo.status, 400);

  assert.strictEqual((await aprovar(id, 'entrega', t.entrega)).body.status, 'pendente');
  assert.strictEqual((await aprovar(id, 'recebimento', t.recebimento)).body.status, 'pendente');

  // Coordenador por último fecha o ciclo (antes ficava em aprovada_coordenador para sempre)
  const ultimo = await aprovar(id, 'coordenador', t.coordenador);
  assert.strictEqual(ultimo.body.status, 'concluida');
  assert.strictEqual((await equip(eqId)).status, 'disponivel');
});

test('coordenador aprovando depois da entrega vai direto para em_transito', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  await aprovar(body.id, 'entrega', t.entrega);
  const r = await aprovar(body.id, 'coordenador', t.coordenador);
  assert.strictEqual(r.body.status, 'em_transito');
});

test('autorização por etapa quando não há responsável designado', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  const id = body.id;

  assert.strictEqual((await aprovar(id, 'coordenador', t.entrega)).status, 403);
  assert.strictEqual((await aprovar(id, 'entrega', t.tecnico)).status, 403, 'técnico não confirma entrega');
  assert.strictEqual((await aprovar(id, 'entrega', t.recebimento)).status, 403);
  assert.strictEqual((await aprovar(id, 'entrega', tecnico2)).status, 403);
  assert.strictEqual((await aprovar(id, 'inexistente', t.coordenador)).status, 400);

  assert.strictEqual((await aprovar(id, 'entrega', t.entrega)).status, 200);
  assert.strictEqual((await aprovar(id, 'recebimento', t.tecnico)).status, 403);
});

test('responsável designado: só ele aprova a própria etapa', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId, {
    responsavel_entrega_id: USUARIOS.entrega.id,
    responsavel_recebimento_id: USUARIOS.recebimento.id,
    coordenador_id: USUARIOS.coordenador.id
  });
  assert.strictEqual((await aprovar(body.id, 'entrega', t.coordenador)).status, 403);
  assert.strictEqual((await aprovar(body.id, 'entrega', t.entrega)).status, 200);
});

test('a mesma etapa não pode ser aprovada duas vezes', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  assert.strictEqual((await aprovar(body.id, 'coordenador', t.coordenador)).status, 200);
  assert.strictEqual((await aprovar(body.id, 'coordenador', t.coordenador)).status, 400);
});

test('visibilidade: coordenador vê tudo, responsáveis veem as suas etapas, estranhos não veem', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  const id = body.id;

  const ids = async (token) =>
    (await srv.req('GET', '/api/transferencias', { token })).body.map((x) => x.id);

  assert.ok((await ids(t.tecnico)).includes(id), 'solicitante vê');
  assert.ok((await ids(t.coordenador)).includes(id), 'coordenador vê (antes só via as que ele criou)');
  assert.ok((await ids(t.entrega)).includes(id), 'responsável de entrega vê as sem designado');
  assert.ok((await ids(t.recebimento)).includes(id), 'responsável de recebimento vê as sem designado');
  assert.ok(!(await ids(tecnico2)).includes(id), 'técnico estranho não vê');

  assert.strictEqual((await srv.req('GET', `/api/transferencias/${id}`, { token: tecnico2 })).status, 403);
  assert.strictEqual((await srv.req('GET', `/api/transferencias/${id}`, { token: t.entrega })).status, 200);

  // Com responsáveis designados, os outros do mesmo papel deixam de ver
  const eq2 = await novoEquipamento();
  const designada = await solicitar(eq2, {
    responsavel_entrega_id: USUARIOS.coordenador.id,
    responsavel_recebimento_id: USUARIOS.coordenador.id
  });
  assert.ok(!(await ids(t.entrega)).includes(designada.body.id));
  assert.ok(!(await ids(t.recebimento)).includes(designada.body.id));
});

test('filtro por status na listagem', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  await aprovar(body.id, 'coordenador', t.coordenador);
  const r = await srv.req('GET', '/api/transferencias?status=aprovada_coordenador', { token: t.coordenador });
  assert.ok(r.body.length >= 1);
  assert.ok(r.body.every((x) => x.status === 'aprovada_coordenador'));
});

test('cancelar: libera o equipamento, é idempotente e exige permissão', async () => {
  const eqId = await novoEquipamento();
  const { body } = await solicitar(eqId);
  const id = body.id;

  const semPermissao = await srv.req('POST', `/api/transferencias/${id}/cancelar`, {
    token: t.entrega,
    body: { motivo: 'não é meu' }
  });
  assert.strictEqual(semPermissao.status, 403);

  const ok = await srv.req('POST', `/api/transferencias/${id}/cancelar`, {
    token: t.tecnico,
    body: { motivo: 'mudança de planos' }
  });
  assert.strictEqual(ok.status, 200);
  assert.strictEqual((await equip(eqId)).status, 'disponivel');
  assert.match((await transf(id)).observacoes, /mudança de planos/);

  // Nova transferência do mesmo equipamento, depois cancelar a antiga de novo não pode
  // soltar o equipamento que já está em outra transferência
  const nova = await solicitar(eqId);
  assert.strictEqual(nova.status, 201);
  const repetido = await srv.req('POST', `/api/transferencias/${id}/cancelar`, {
    token: t.coordenador,
    body: { motivo: 'de novo' }
  });
  assert.strictEqual(repetido.status, 400);
  assert.strictEqual((await equip(eqId)).status, 'transferencia');
});

test('não permite duas transferências ativas do mesmo equipamento', async () => {
  const eqId = await novoEquipamento();
  assert.strictEqual((await solicitar(eqId)).status, 201);
  const segunda = await solicitar(eqId);
  assert.strictEqual(segunda.status, 400);
  assert.match(segunda.body.error, /transfer/i);
});

test('validação de entrada na criação', async () => {
  const eqId = await novoEquipamento();
  assert.strictEqual((await solicitar(eqId, { origem_tipo: 'lua' })).status, 400);
  assert.strictEqual((await solicitar(eqId, { destino_tipo: 'marte' })).status, 400);
  assert.strictEqual((await solicitar(eqId, { destino_id: 9999 })).status, 400, 'depósito inexistente');
  assert.strictEqual((await solicitar(eqId, { destino_tipo: 'usuario', destino_id: 9999 })).status, 400);
  assert.strictEqual((await solicitar(eqId, { responsavel_entrega_id: 9999 })).status, 400);
  assert.strictEqual(
    (await solicitar(eqId, { coordenador_id: USUARIOS.tecnico.id })).status,
    400,
    'coordenador_id precisa ser de um coordenador'
  );
  assert.strictEqual((await solicitar(999999)).status, 404);
  // Nada disso pode ter travado o equipamento
  assert.strictEqual((await equip(eqId)).status, 'disponivel');
});

test('equipamento em manutenção não é transferido', async () => {
  const eqId = await novoEquipamento();
  await srv.req('PUT', `/api/equipamentos/${eqId}`, { token: t.coordenador, body: { status: 'manutencao' } });
  assert.strictEqual((await solicitar(eqId)).status, 400);
});

test('concluir transferência de equipamento com problema grave não o "cura"', async () => {
  const eqId = await novoEquipamento({ deposito_id: 1 });
  await srv.req('POST', `/api/equipamentos/${eqId}/problemas`, {
    token: t.tecnico,
    body: { descricao: 'Não liga de jeito nenhum', gravidade: 'critica' }
  });
  const { body } = await solicitar(eqId);
  await aprovar(body.id, 'coordenador', t.coordenador);
  await aprovar(body.id, 'entrega', t.entrega);
  const fim = await aprovar(body.id, 'recebimento', t.recebimento);
  assert.strictEqual(fim.body.status, 'concluida');
  assert.strictEqual((await equip(eqId)).status, 'com_problema');
});

// ---------- Transferência rápida e entre eventos (dependem de eventos) ----------

async function eventoAprovado(nome, inicio = '2030-01-10T10:00', fim = '2030-01-10T22:00') {
  const c = await srv.req('POST', '/api/eventos', {
    token: t.coordenador,
    body: { nome, local: 'Local de teste', data_inicio: inicio, data_fim: fim }
  });
  assert.strictEqual(c.status, 201, c.text);
  const s = await srv.req('PUT', `/api/eventos/${c.body.id}/status`, {
    token: t.coordenador,
    body: { status: 'aprovado' }
  });
  assert.strictEqual(s.status, 200, s.text);
  return c.body.id;
}

async function alocar(eventoId, equipamentoId, responsavelId) {
  const r = await srv.req('POST', `/api/eventos/${eventoId}/equipamentos`, {
    token: t.coordenador,
    body: { equipamentos: [{ equipamento_id: equipamentoId, responsavel_id: responsavelId, area: 'som' }] }
  });
  assert.strictEqual(r.status, 200, r.text);
}

test('transferência rápida: só responsável atual, equipe do evento ou coordenador', async () => {
  const evento = await eventoAprovado('Evento rápida');
  const eqId = await novoEquipamento();
  await alocar(evento, eqId, USUARIOS.entrega.id);

  const rapida = (token, body) =>
    srv.req('POST', '/api/transferencias/rapida', {
      token,
      body: { equipamento_id: eqId, evento_id: evento, ...body }
    });

  const intruso = await rapida(tecnico2, { responsavel_destino_id: USUARIOS.recebimento.id });
  assert.strictEqual(intruso.status, 403);

  const mesmo = await rapida(t.entrega, { responsavel_destino_id: USUARIOS.entrega.id });
  assert.strictEqual(mesmo.status, 400, 'não faz sentido transferir para si mesmo');

  const inexistente = await rapida(t.entrega, { responsavel_destino_id: 9999 });
  assert.strictEqual(inexistente.status, 400);

  // A origem registrada é a real, mesmo que o cliente tente forjar outra
  const ok = await rapida(t.entrega, {
    responsavel_destino_id: USUARIOS.recebimento.id,
    responsavel_origem_id: USUARIOS.tecnico.id
  });
  assert.strictEqual(ok.status, 200, ok.text);
  const tr = await transf(ok.body.transferencia_id);
  assert.strictEqual(tr.origem_id, USUARIOS.entrega.id);
  assert.strictEqual(tr.destino_id, USUARIOS.recebimento.id);

  const det = await srv.req('GET', `/api/eventos/${evento}`, { token: t.coordenador });
  assert.strictEqual(det.body.equipamentos[0].responsavel_id, USUARIOS.recebimento.id);

  // Quem era responsável perdeu o direito; o coordenador sempre pode
  const perdeu = await rapida(t.entrega, { responsavel_destino_id: USUARIOS.tecnico.id });
  assert.strictEqual(perdeu.status, 403);
  const coord = await rapida(t.coordenador, { responsavel_destino_id: USUARIOS.tecnico.id });
  assert.strictEqual(coord.status, 200);

  // Equipamento fora do evento
  const outro = await novoEquipamento();
  const fora = await srv.req('POST', '/api/transferencias/rapida', {
    token: t.coordenador,
    body: { equipamento_id: outro, evento_id: evento, responsavel_destino_id: USUARIOS.tecnico.id }
  });
  assert.strictEqual(fora.status, 404);
});

test('transferência entre eventos: exige eventos simultâneos, distintos e equipamento livre', async () => {
  const e1 = await eventoAprovado('Evento A', '2030-03-01T10:00', '2030-03-01T20:00');
  const e2 = await eventoAprovado('Evento B', '2030-03-01T14:00', '2030-03-01T23:00');
  const e3 = await eventoAprovado('Evento C', '2030-06-01T10:00', '2030-06-01T20:00');
  const eqId = await novoEquipamento();
  await alocar(e1, eqId, USUARIOS.entrega.id);

  const pedir = (origem, destino, extra = {}) =>
    srv.req('POST', '/api/transferencias/entre-eventos', {
      token: t.entrega,
      body: { equipamento_id: eqId, evento_origem_id: origem, evento_destino_id: destino, ...extra }
    });

  assert.strictEqual((await pedir(e1, e1)).status, 400, 'origem = destino');
  assert.strictEqual((await pedir(e1, e3)).status, 400, 'não simultâneos');
  assert.strictEqual((await pedir(e1, e2, { responsavel_entrega_id: 9999 })).status, 400);

  const ok = await pedir(e1, e2);
  assert.strictEqual(ok.status, 201, ok.text);
  assert.strictEqual((await equip(eqId)).status, 'transferencia');

  const duplicada = await pedir(e1, e2);
  assert.strictEqual(duplicada.status, 400, 'já existe transferência ativa');
});

test('entre eventos: quem não é responsável nem da equipe do evento de origem não pede', async () => {
  const e1 = await eventoAprovado('Evento D', '2030-09-01T10:00', '2030-09-01T20:00');
  const e2 = await eventoAprovado('Evento E', '2030-09-01T12:00', '2030-09-01T23:00');
  const eqId = await novoEquipamento();
  await alocar(e1, eqId, USUARIOS.entrega.id);

  const pedir = (token) =>
    srv.req('POST', '/api/transferencias/entre-eventos', {
      token,
      body: { equipamento_id: eqId, evento_origem_id: e1, evento_destino_id: e2 }
    });

  assert.strictEqual((await pedir(tecnico2)).status, 403);
  assert.strictEqual((await equip(eqId)).status, 'em_uso', 'o pedido negado não pode travar o equipamento');
  assert.strictEqual((await pedir(t.coordenador)).status, 201);
});

test('origem em evento exige o equipamento alocado; destino em evento exige evento ativo', async () => {
  const ativo = await eventoAprovado('Evento F', '2030-10-01T10:00', '2030-10-01T20:00');
  const encerrado = await eventoAprovado('Evento G', '2030-10-02T10:00', '2030-10-02T20:00');
  await srv.req('PUT', `/api/eventos/${encerrado}/status`, { token: t.coordenador, body: { status: 'cancelado' } });
  const eqId = await novoEquipamento();

  const origemErrada = await solicitar(eqId, { origem_tipo: 'evento', origem_id: ativo, destino_id: 1 });
  assert.strictEqual(origemErrada.status, 400, 'equipamento não está nesse evento');

  const destinoEncerrado = await solicitar(eqId, { destino_tipo: 'evento', destino_id: encerrado });
  assert.strictEqual(destinoEncerrado.status, 400);

  const ok = await solicitar(eqId, { destino_tipo: 'evento', destino_id: ativo });
  assert.strictEqual(ok.status, 201, ok.text);
});

test('concluir com destino fora de depósito preserva o depósito de origem', async () => {
  const evento = await eventoAprovado('Evento H', '2030-11-01T10:00', '2030-11-01T20:00');
  const eqId = await novoEquipamento({ deposito_id: 2 });
  const { body } = await solicitar(eqId, { destino_tipo: 'evento', destino_id: evento });
  await aprovar(body.id, 'coordenador', t.coordenador);
  await aprovar(body.id, 'entrega', t.entrega);
  assert.strictEqual((await aprovar(body.id, 'recebimento', t.recebimento)).body.status, 'concluida');

  const eq = await equip(eqId);
  assert.strictEqual(eq.deposito_id, 2, 'depósito de origem preservado');
  assert.strictEqual(eq.status, 'em_uso', 'passou a fazer parte do evento de destino');
});

test('falha ao aplicar a conclusão desfaz a etapa e permite repetir (sem travar a transferência)', async () => {
  const sqlite3 = require('sqlite3');
  const eqId = await novoEquipamento({ deposito_id: 1 });
  const { body } = await solicitar(eqId, { destino_id: 3 });
  await aprovar(body.id, 'coordenador', t.coordenador);
  await aprovar(body.id, 'entrega', t.entrega);

  // Um trigger faz o registro do histórico falhar, simulando uma queda no meio da conclusão
  const db = new sqlite3.Database(process.env.SQLITE_PATH);
  const exec = (sql) => new Promise((res, rej) => db.exec(sql, (e) => (e ? rej(e) : res())));
  await exec(`CREATE TRIGGER falha_historico BEFORE INSERT ON historico_movimentacoes
              WHEN NEW.tipo_movimentacao = 'transferencia'
              BEGIN SELECT RAISE(ABORT, 'falha simulada'); END;`);

  const falhou = await aprovar(body.id, 'recebimento', t.recebimento);
  assert.strictEqual(falhou.status, 500);

  const meio = await transf(body.id);
  assert.strictEqual(meio.status, 'em_transito', 'voltou ao estado anterior');
  assert.strictEqual(meio.aprovacao_recebimento, 0, 'etapa pode ser aprovada de novo');

  await exec('DROP TRIGGER falha_historico');
  db.close();

  const de_novo = await aprovar(body.id, 'recebimento', t.recebimento);
  assert.strictEqual(de_novo.status, 200, de_novo.text);
  assert.strictEqual(de_novo.body.status, 'concluida');
  const eq = await equip(eqId);
  assert.strictEqual(eq.deposito_id, 3);
  assert.strictEqual(eq.historico.filter((h) => h.tipo_movimentacao === 'transferencia').length, 1);
});
