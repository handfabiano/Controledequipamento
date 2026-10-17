// Migrações versionadas: cada mudança de schema é um par de arquivos em migracoes/, NNN_nome.sql
// (SQLite) e NNN_nome.pg.sql (Postgres), aplicado uma única vez e registrado na tabela migracoes.
// Rodam dentro de comExclusividade (db.js), numa transação só e com uma instância por vez: dois cold
// starts não aplicam a mesma migração, e uma que falha não deixa nada pela metade.

const fs = require('fs');
const path = require('path');
const { usePostgres } = require('./db');

const DIRETORIO = path.join(__dirname, 'migracoes');
const PADRAO = /^(\d+)_([a-z0-9_]+)(\.pg)?\.sql$/;

// Migrações do driver atual, em ordem. Falha se uma versão não tiver os dois arquivos ou se
// repetir: uma migração só num driver deixaria os bancos de teste e de produção diferentes
function listarMigracoes(diretorio = DIRETORIO) {
  const porDriver = { sqlite: new Map(), pg: new Map() };
  for (const arquivo of fs.readdirSync(diretorio)) {
    const partes = PADRAO.exec(arquivo);
    if (!partes) continue;
    const [, versao, nome, pg] = partes;
    const lista = porDriver[pg ? 'pg' : 'sqlite'];
    if (lista.has(Number(versao))) {
      throw new Error(`Migração ${versao} repetida em ${diretorio}`);
    }
    lista.set(Number(versao), { versao: Number(versao), nome: `${versao}_${nome}`, arquivo: path.join(diretorio, arquivo) });
  }

  for (const versao of new Set([...porDriver.sqlite.keys(), ...porDriver.pg.keys()])) {
    if (!porDriver.sqlite.has(versao) || !porDriver.pg.has(versao)) {
      throw new Error(`Migração ${versao} precisa dos dois arquivos (.sql e .pg.sql) em ${diretorio}`);
    }
  }

  return [...porDriver[usePostgres ? 'pg' : 'sqlite'].values()].sort((a, b) => a.versao - b.versao);
}

// Aplica as pendentes; devolve os nomes das que aplicou
async function aplicarMigracoes(conexao, diretorio = DIRETORIO) {
  await conexao.run(`CREATE TABLE IF NOT EXISTS migracoes (
    versao INTEGER PRIMARY KEY,
    nome TEXT NOT NULL,
    aplicada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  const aplicadas = new Set((await conexao.all('SELECT versao FROM migracoes')).map((linha) => linha.versao));
  const novas = [];

  for (const migracao of listarMigracoes(diretorio)) {
    if (aplicadas.has(migracao.versao)) continue;

    const comandos = fs.readFileSync(migracao.arquivo, 'utf8').split(';').filter((comando) => comando.trim());
    try {
      for (const comando of comandos) {
        await conexao.run(comando);
      }
      // all, e não run: o run do Postgres acrescenta RETURNING id, e esta tabela não tem id
      await conexao.all('INSERT INTO migracoes (versao, nome) VALUES (?, ?)', [migracao.versao, migracao.nome]);
    } catch (erro) {
      throw new Error(`Migração ${migracao.nome} falhou: ${erro.message}`, { cause: erro });
    }
    novas.push(migracao.nome);
  }

  return novas;
}

module.exports = { aplicarMigracoes, listarMigracoes };
