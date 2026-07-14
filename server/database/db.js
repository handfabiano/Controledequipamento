// Camada de acesso a dados com dois drivers:
// - Postgres (pg) quando DATABASE_URL está definido (produção/Vercel)
// - SQLite local quando não está (desenvolvimento)
// Ambos expõem a mesma interface: runAsync, getAsync, allAsync.
// As queries usam placeholders `?`; no Postgres eles são convertidos para $1, $2...

const usePostgres = Boolean(process.env.DATABASE_URL);

let runAsync;
let getAsync;
let allAsync;

if (usePostgres) {
  const { Pool, types } = require('pg');

  // COUNT(*) e afins retornam BIGINT como string no pg; converter para número
  types.setTypeParser(20, (value) => parseInt(value, 10));

  const connectionString = process.env.DATABASE_URL;
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    // Ambiente serverless: manter o pool pequeno
    max: parseInt(process.env.PG_POOL_MAX || '3', 10)
  });

  const toPgPlaceholders = (sql) => {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  };

  runAsync = async (sql, params = []) => {
    let text = toPgPlaceholders(sql);
    const isInsert = /^\s*insert\b/i.test(text);

    // Emular o lastID do SQLite: todas as tabelas do sistema têm coluna id
    if (isInsert && !/\breturning\b/i.test(text)) {
      text += ' RETURNING id';
    }

    const result = await pool.query(text, params);
    return {
      lastID: isInsert ? result.rows[0]?.id : undefined,
      changes: result.rowCount
    };
  };

  getAsync = async (sql, params = []) => {
    const result = await pool.query(toPgPlaceholders(sql), params);
    return result.rows[0];
  };

  allAsync = async (sql, params = []) => {
    const result = await pool.query(toPgPlaceholders(sql), params);
    return result.rows;
  };
} else {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');

  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'equipamentos.db');
  const db = new sqlite3.Database(dbPath);

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
}

module.exports = { usePostgres, runAsync, getAsync, allAsync };
