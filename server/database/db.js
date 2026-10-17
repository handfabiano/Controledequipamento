// Camada de acesso a dados com dois drivers:
// - Postgres (pg) quando DATABASE_URL está definido (produção/Vercel)
// - SQLite local quando não está (desenvolvimento)
// Ambos expõem a mesma interface: runAsync, getAsync, allAsync.
// As queries usam placeholders `?`; no Postgres eles são convertidos para $1, $2...

const { opcoesSsl } = require('./ssl');

const usePostgres = Boolean(process.env.DATABASE_URL);

// Advisory lock que serializa migrações, catálogo e seed entre instâncias: chave (valor arbitrário
// fixo) e quanto uma instância espera a outra antes de desistir
const CHAVE_EXCLUSIVIDADE = 72616001;
const ESPERA_MAXIMA = '20s';

let runAsync;
let getAsync;
let allAsync;
let encerrar;
let comExclusividade;

if (usePostgres) {
  const { Pool, types } = require('pg');

  // COUNT(*) e afins retornam BIGINT como string no pg; converter para número
  types.setTypeParser(20, (value) => parseInt(value, 10));

  const connectionString = process.env.DATABASE_URL;
  const ssl = opcoesSsl(connectionString);

  if (ssl && !ssl.rejectUnauthorized) {
    console.warn(
      'AVISO: conexão com o Postgres criptografada, mas o certificado do servidor não é verificado. ' +
      'Defina DATABASE_SSL_VERIFY=true (e DATABASE_SSL_CA, se o provedor usar CA própria).'
    );
  }

  const pool = new Pool({
    connectionString,
    ssl,
    // Ambiente serverless: manter o pool pequeno
    max: parseInt(process.env.PG_POOL_MAX || '3', 10)
  });

  // Conexão ociosa derrubada pelo servidor (reinício, failover, limite do provedor): sem este
  // ouvinte o 'error' do pool derruba o processo; o pool descarta a conexão e abre outra
  pool.on('error', (err) => {
    console.error('Conexão ociosa com o Postgres perdida:', err.message);
  });

  encerrar = () => pool.end();

  const toPgPlaceholders = (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  };

  // Consultas num alvo (o pool ou um cliente dedicado). Sem parâmetros o SQL vai como está: um '?'
  // dentro de texto ou comentário de migração não é placeholder
  const consultar = (alvo, sql, params) => alvo.query(params.length > 0 ? toPgPlaceholders(sql) : sql, params);

  const conexaoPg = (alvo) => ({
    run: async (sql, params = []) => {
      const isInsert = /^\s*insert\b/i.test(sql);

      // Emular o lastID do SQLite: todas as tabelas do sistema têm coluna id
      const result = await consultar(alvo, isInsert && !/\breturning\b/i.test(sql) ? `${sql} RETURNING id` : sql, params);
      return {
        lastID: isInsert ? result.rows[0]?.id : undefined,
        changes: result.rowCount
      };
    },
    get: async (sql, params = []) => (await consultar(alvo, sql, params)).rows[0],
    all: async (sql, params = []) => (await consultar(alvo, sql, params)).rows
  });

  ({ run: runAsync, get: getAsync, all: allAsync } = conexaoPg(pool));

  // Cold starts simultâneos na Vercel: uma transação com advisory lock de transação faz as instâncias
  // esperarem a vez. O lock de transação (e não o de sessão) funciona também atrás do pooler em modo
  // transação (Supabase, porta 6543) e é liberado no COMMIT/ROLLBACK ou se a conexão cair
  comExclusividade = async (fn) => {
    const cliente = await pool.connect();
    let erroConexao;
    try {
      await cliente.query('BEGIN');
      try {
        // Uma instância travada segurando o lock não congela as outras para sempre: a espera falha e
        // a próxima requisição tenta de novo
        await cliente.query(`SET LOCAL lock_timeout = '${ESPERA_MAXIMA}'`);
        await cliente.query('SELECT pg_advisory_xact_lock($1)', [CHAVE_EXCLUSIVIDADE]);
        const resultado = await fn(conexaoPg(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (erro) {
        // ROLLBACK falhou (conexão caída): descartar a conexão em vez de devolvê-la ao pool
        await cliente.query('ROLLBACK').catch((erroRollback) => {
          erroConexao = erroRollback;
        });
        throw erro;
      }
    } finally {
      cliente.release(erroConexao);
    }
  };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');

  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'equipamentos.db');
  const db = new sqlite3.Database(dbPath);

  encerrar = () => new Promise((resolve, reject) => db.close((err) => (err ? reject(err) : resolve())));

  runAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  };

  getAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  };

  allAsync = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };

  // Um processo só, com uma conexão só: uma fila em memória serializa as chamadas (um BEGIN dentro
  // de outra transação da mesma conexão falharia); IMMEDIATE trava o arquivo contra outro processo
  const conexaoSqlite = { run: runAsync, get: getAsync, all: allAsync };
  let fila = Promise.resolve();
  comExclusividade = (fn) => {
    const vez = fila.then(async () => {
      await runAsync('BEGIN IMMEDIATE');
      try {
        const resultado = await fn(conexaoSqlite);
        await runAsync('COMMIT');
        return resultado;
      } catch (erro) {
        await runAsync('ROLLBACK').catch(() => {});
        throw erro;
      }
    });
    fila = vez.catch(() => {});
    return vez;
  };
}

// Lista de placeholders para cláusulas IN: placeholders(['a', 'b']) => '?, ?'
const placeholders = (valores) => valores.map(() => '?').join(', ');

module.exports = { usePostgres, runAsync, getAsync, allAsync, placeholders, encerrar, comExclusividade };
