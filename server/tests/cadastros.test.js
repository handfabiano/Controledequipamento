const test = require('node:test');
const assert = require('node:assert');
const { iniciarServidor, USUARIOS } = require('./helpers');

let srv;
let t;

test.before(async () => {
  srv = await iniciarServidor();
  t = await srv.tokens();
});
test.after(() => srv.fechar());

const NAO_COORDENADORES = ['entrega', 'recebimento', 'tecnico'];

test('qualquer usuário logado lista os depósitos, com o nome do responsável', async () => {
  const r = await srv.req('GET', '/api/depositos', { token: t.tecnico });
  assert.strictEqual(r.status, 200, r.text);
  const norte = r.body.find((d) => d.nome === 'Depósito Zona Norte');
  assert.ok(norte, 'depósito do seed na lista');
  assert.strictEqual(norte.responsavel_id, USUARIOS.entrega.id);
  assert.ok(norte.responsavel_nome, 'traz o nome do responsável');
  assert.strictEqual((await srv.req('GET', '/api/depositos')).status, 401);
});

test('coordenador cria e edita depósito', async () => {
  const criar = await srv.req('POST', '/api/depositos', {
    token: t.coordenador,
    body: { nome: '  Galpão Leste  ', endereco: 'Rua Leste, 5', responsavel_id: USUARIOS.tecnico.id }
  });
  assert.strictEqual(criar.status, 201, criar.text);
  assert.strictEqual(criar.body.nome, 'Galpão Leste', 'nome sem espaços nas pontas');
  assert.strictEqual(criar.body.responsavel_id, USUARIOS.tecnico.id);

  const editar = await srv.req('PUT', `/api/depositos/${criar.body.id}`, {
    token: t.coordenador,
    body: { nome: 'Galpão Leste 2', endereco: '', responsavel_id: null }
  });
  assert.strictEqual(editar.status, 200, editar.text);
  assert.strictEqual(editar.body.nome, 'Galpão Leste 2');
  assert.strictEqual(editar.body.endereco, null, 'endereço vazio é limpo');
  assert.strictEqual(editar.body.responsavel_id, null);

  const { body: lista } = await srv.req('GET', '/api/depositos', { token: t.entrega });
  assert.ok(lista.some((d) => d.id === criar.body.id && d.nome === 'Galpão Leste 2'));
});

test('depósito criado pode receber equipamento', async () => {
  const { body: deposito } = await srv.req('POST', '/api/depositos', { token: t.coordenador, body: { nome: 'Depósito Novo' } });
  const { body: categorias } = await srv.req('GET', '/api/equipamentos/categorias', { token: t.coordenador });
  const r = await srv.req('POST', '/api/equipamentos', {
    token: t.coordenador,
    body: { codigo: 'DEP9001', nome: 'Caixa', categoria_id: categorias[0].id, deposito_id: deposito.id }
  });
  assert.strictEqual(r.status, 201, r.text);
  const filtrados = await srv.req('GET', `/api/equipamentos?deposito_id=${deposito.id}`, { token: t.coordenador });
  assert.deepStrictEqual(filtrados.body.data.map((e) => e.deposito_nome), ['Depósito Novo']);
});

test('depósito: valida nome, responsável e id', async () => {
  const criar = (body) => srv.req('POST', '/api/depositos', { token: t.coordenador, body });
  assert.strictEqual((await criar({})).status, 400, 'nome obrigatório');
  assert.strictEqual((await criar({ nome: '   ' })).status, 400, 'nome em branco');
  assert.strictEqual((await criar({ nome: 7 })).status, 400, 'nome texto');
  assert.strictEqual((await criar({ nome: 'x'.repeat(101) })).status, 400, 'nome longo');
  assert.strictEqual((await criar({ nome: 'A', endereco: 5 })).status, 400, 'endereço texto');
  assert.strictEqual((await criar({ nome: 'A', responsavel_id: 99999 })).status, 400, 'responsável inexistente');
  assert.strictEqual((await criar({ nome: 'A', responsavel_id: 'abc' })).status, 400, 'responsável inválido');

  const { id } = await srv.criarUsuario({ nome: 'Inativo', email: 'inativo.dep@x.com' }, t.coordenador);
  await srv.req('PUT', `/api/usuarios/${id}/ativo`, { token: t.coordenador, body: { ativo: false } });
  assert.strictEqual((await criar({ nome: 'A', responsavel_id: id })).status, 400, 'responsável inativo');

  const editar = (alvo, body) => srv.req('PUT', `/api/depositos/${alvo}`, { token: t.coordenador, body });
  assert.strictEqual((await editar(99999, { nome: 'B' })).status, 404);
  assert.strictEqual((await editar('abc', { nome: 'B' })).status, 400);
  assert.strictEqual((await editar(1, { nome: '' })).status, 400);
});

test('depósito mantém o responsável atual mesmo desativado, mas não aceita trocar por inativo', async () => {
  const { id: usuario } = await srv.criarUsuario({ nome: 'Resp Saiu', email: 'resp.saiu@x.com' }, t.coordenador);
  const { body: dep } = await srv.req('POST', '/api/depositos', { token: t.coordenador, body: { nome: 'Dep Resp', responsavel_id: usuario } });
  await srv.req('PUT', `/api/usuarios/${usuario}/ativo`, { token: t.coordenador, body: { ativo: false } });

  const renomear = await srv.req('PUT', `/api/depositos/${dep.id}`, {
    token: t.coordenador, body: { nome: 'Dep Resp 2', responsavel_id: usuario }
  });
  assert.strictEqual(renomear.status, 200, renomear.text);

  const outro = await srv.req('POST', '/api/depositos', { token: t.coordenador, body: { nome: 'Dep Outro' } });
  const trocar = await srv.req('PUT', `/api/depositos/${outro.body.id}`, {
    token: t.coordenador, body: { nome: 'Dep Outro', responsavel_id: usuario }
  });
  assert.strictEqual(trocar.status, 400, 'inativo não vira responsável de outro depósito');
});

test('nomes repetidos são recusados, sem diferenciar maiúsculas', async () => {
  const dep = await srv.req('POST', '/api/depositos', { token: t.coordenador, body: { nome: 'depósito zona norte' } });
  assert.strictEqual(dep.status, 400);
  assert.match(dep.body.error, /Já existe/);
  const cat = await srv.req('POST', '/api/equipamentos/categorias', { token: t.coordenador, body: { nome: 'MESA DE SOM', tipo: 'som' } });
  assert.strictEqual(cat.status, 400);

  const { body: lista } = await srv.req('GET', '/api/depositos', { token: t.coordenador });
  const norte = lista.find((d) => d.nome === 'Depósito Zona Norte');
  const sul = lista.find((d) => d.nome === 'Depósito Zona Sul');
  const mesmo = await srv.req('PUT', `/api/depositos/${norte.id}`, { token: t.coordenador, body: { nome: 'Depósito Zona Norte', endereco: norte.endereco, responsavel_id: norte.responsavel_id } });
  assert.strictEqual(mesmo.status, 200, 'salvar sem mudar o nome não conflita consigo mesmo');
  const conflito = await srv.req('PUT', `/api/depositos/${sul.id}`, { token: t.coordenador, body: { nome: 'Depósito Zona Norte' } });
  assert.strictEqual(conflito.status, 400);
});

test('ids fora do intervalo do banco dão 400, não 500', async () => {
  const grande = 99999999999;
  assert.strictEqual((await srv.req('PUT', `/api/depositos/${grande}`, { token: t.coordenador, body: { nome: 'Z' } })).status, 400);
  assert.strictEqual((await srv.req('POST', '/api/depositos', { token: t.coordenador, body: { nome: 'Z', responsavel_id: grande } })).status, 400);
});

test('só coordenador cria ou edita depósito', async () => {
  for (const papel of NAO_COORDENADORES) {
    assert.strictEqual((await srv.req('POST', '/api/depositos', { token: t[papel], body: { nome: 'X' } })).status, 403, papel);
    assert.strictEqual((await srv.req('PUT', '/api/depositos/1', { token: t[papel], body: { nome: 'X' } })).status, 403, papel);
  }
  const { body } = await srv.req('GET', '/api/depositos', { token: t.coordenador });
  assert.ok(!body.some((d) => d.nome === 'X'));
});

test('coordenador cria e edita categoria, que aparece na lista do cadastro de equipamento', async () => {
  // Carrega a lista antes para garantir que o cache não esconde a categoria nova
  await srv.req('GET', '/api/equipamentos/categorias', { token: t.tecnico });

  const criar = await srv.req('POST', '/api/equipamentos/categorias', {
    token: t.coordenador, body: { nome: 'Projetor', tipo: 'iluminacao', descricao: 'Projetores de vídeo' }
  });
  assert.strictEqual(criar.status, 201, criar.text);
  assert.strictEqual(criar.body.tipo, 'iluminacao');

  let lista = (await srv.req('GET', '/api/equipamentos/categorias', { token: t.tecnico })).body;
  assert.ok(lista.some((c) => c.id === criar.body.id && c.nome === 'Projetor'));

  const editar = await srv.req('PUT', `/api/equipamentos/categorias/${criar.body.id}`, {
    token: t.coordenador, body: { nome: 'Projetor de vídeo', tipo: 'outro', descricao: '' }
  });
  assert.strictEqual(editar.status, 200, editar.text);
  assert.strictEqual(editar.body.descricao, null, 'descrição vazia é limpa');

  lista = (await srv.req('GET', '/api/equipamentos/categorias', { token: t.tecnico })).body;
  const editada = lista.find((c) => c.id === criar.body.id);
  assert.strictEqual(editada.nome, 'Projetor de vídeo');
  assert.strictEqual(editada.tipo, 'outro');
});

test('categoria: valida nome, tipo e id', async () => {
  const criar = (body) => srv.req('POST', '/api/equipamentos/categorias', { token: t.coordenador, body });
  assert.strictEqual((await criar({ tipo: 'som' })).status, 400, 'nome obrigatório');
  assert.strictEqual((await criar({ nome: 'Cabo' })).status, 400, 'tipo obrigatório');
  assert.strictEqual((await criar({ nome: 'Cabo', tipo: 'video' })).status, 400, 'tipo fora da lista');
  assert.strictEqual((await criar({ nome: 'Cabo', tipo: 'som', descricao: [] })).status, 400, 'descrição texto');

  const editar = (alvo, body) => srv.req('PUT', `/api/equipamentos/categorias/${alvo}`, { token: t.coordenador, body });
  assert.strictEqual((await editar(99999, { nome: 'B' })).status, 404);
  assert.strictEqual((await editar('abc', { nome: 'B' })).status, 400);
  assert.strictEqual((await editar(1, { nome: 'B', tipo: 'video' })).status, 400);
  assert.strictEqual((await editar(1, { tipo: 'som' })).status, 400, 'edição exige o nome');
});

test('só coordenador cria ou edita categoria', async () => {
  for (const papel of NAO_COORDENADORES) {
    const criar = await srv.req('POST', '/api/equipamentos/categorias', { token: t[papel], body: { nome: 'Y', tipo: 'som' } });
    assert.strictEqual(criar.status, 403, papel);
    const editar = await srv.req('PUT', '/api/equipamentos/categorias/1', { token: t[papel], body: { nome: 'Y' } });
    assert.strictEqual(editar.status, 403, papel);
  }
  const { body } = await srv.req('GET', '/api/equipamentos/categorias', { token: t.coordenador });
  assert.ok(!body.some((c) => c.nome === 'Y'));
});
