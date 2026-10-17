const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { iniciarServidor } = require('./helpers');

// Banco de produção vazio (sem demonstração), como no primeiro deploy
process.env.SEED_DEMO_DATA = 'false';

const ORIGEM = path.join(__dirname, '..', 'database', 'migracoes');

let srv;
let dirs = [];

// Diretório com as migrações reais mais as do teste: { 'NNN_nome': [sqlite, postgres] }
function diretorioCom(extras) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migracoes-test-'));
  dirs.push(dir);
  for (const arquivo of fs.readdirSync(ORIGEM)) fs.copyFileSync(path.join(ORIGEM, arquivo), path.join(dir, arquivo));
  for (const [nome, [sqlite, pg]] of Object.entries(extras)) {
    if (sqlite !== undefined) fs.writeFileSync(path.join(dir, `${nome}.sql`), sqlite);
    if (pg !== undefined) fs.writeFileSync(path.join(dir, `${nome}.pg.sql`), pg);
  }
  return dir;
}

const migrar = (dir) => {
  const { comExclusividade } = require('../database/db');
  const { aplicarMigracoes } = require('../database/migracoes');
  return comExclusividade((conexao) => aplicarMigracoes(conexao, dir));
};

const colunas = async (tabela) => {
  const { getAsync } = require('../database/db');
  return Object.keys(await getAsync(`SELECT * FROM ${tabela} LIMIT 1`) || {});
};

test.before(async () => {
  srv = await iniciarServidor();
});
test.after(async () => {
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  await srv.fechar();
});

// Primeiro teste: o banco ainda está vazio (o app só inicializa na primeira requisição)
test('cold starts simultâneos em banco vazio inicializam uma vez só', async () => {
  const { initializeDatabase } = require('../database/init');
  const { getAsync } = require('../database/db');

  const respostas = await Promise.all([
    initializeDatabase(),
    initializeDatabase(),
    srv.req('GET', '/api/equipamentos/categorias'),
    srv.req('GET', '/api/equipamentos/categorias')
  ]);
  for (const r of respostas.slice(2)) assert.strictEqual(r.status, 401, r.text);

  const contar = async (tabela) => (await getAsync(`SELECT COUNT(*) AS n FROM ${tabela}`)).n;
  assert.strictEqual(await contar('categorias_equipamentos'), 10);
  assert.strictEqual(await contar('templates_eventos'), 4);
  assert.strictEqual(await contar('checklist_template'), 6);
  assert.strictEqual(await contar('depositos'), 1);
  assert.strictEqual(await contar('migracoes'), 1);
});

test('reiniciar não reaplica migrações', async () => {
  const { initializeDatabase } = require('../database/init');
  const { allAsync } = require('../database/db');
  await initializeDatabase();
  assert.deepStrictEqual(
    (await allAsync('SELECT versao, nome FROM migracoes ORDER BY versao')).map((l) => [l.versao, l.nome]),
    [[1, '001_schema_inicial']]
  );
  assert.deepStrictEqual(await migrar(ORIGEM), []);
});

test('migração nova adiciona coluna em banco existente, uma vez só', async () => {
  // O '?' do texto não pode virar placeholder no Postgres
  const sql = "ALTER TABLE depositos ADD COLUMN observacao TEXT DEFAULT 'conferido?';";
  const dir = diretorioCom({ '002_teste_coluna': [sql, sql] });

  assert.deepStrictEqual(await migrar(dir), ['002_teste_coluna']);
  const { getAsync } = require('../database/db');
  assert.strictEqual((await getAsync('SELECT observacao FROM depositos LIMIT 1')).observacao, 'conferido?');
  assert.deepStrictEqual(await migrar(dir), []);
});

test('migração que falha no meio não deixa nada aplicado nem registrado', async () => {
  const sql = 'ALTER TABLE categorias_equipamentos ADD COLUMN parcial TEXT; ALTER TABLE tabela_inexistente ADD COLUMN x TEXT;';
  const dir = diretorioCom({ '003_teste_falha': [sql, sql] });

  await assert.rejects(migrar(dir), /Migração 003_teste_falha falhou/);
  assert.ok(!(await colunas('categorias_equipamentos')).includes('parcial'), 'primeiro comando não foi desfeito');

  const { getAsync } = require('../database/db');
  assert.strictEqual((await getAsync('SELECT COUNT(*) AS n FROM migracoes WHERE versao = 3')).n, 0);

  // A conexão continua utilizável depois da falha
  const r = await srv.req('GET', '/health');
  assert.strictEqual(r.status, 200);
});

test('migração só num driver é recusada', async () => {
  const { listarMigracoes } = require('../database/migracoes');
  const soSqlite = diretorioCom({ '004_so_sqlite': ['SELECT 1;', undefined] });
  assert.throws(() => listarMigracoes(soSqlite), /precisa dos dois arquivos/);

  const soPg = diretorioCom({ '004_so_pg': [undefined, 'SELECT 1;'] });
  assert.throws(() => listarMigracoes(soPg), /precisa dos dois arquivos/);
});

test('as migrações do repositório têm os dois drivers', () => {
  const { listarMigracoes } = require('../database/migracoes');
  assert.ok(listarMigracoes().length >= 1);
});
