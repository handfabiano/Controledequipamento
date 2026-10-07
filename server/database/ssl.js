// Opções de TLS do Postgres (variáveis DATABASE_SSL_VERIFY e DATABASE_SSL_CA: ver .env.example).
// O padrão criptografa sem verificar o certificado, para funcionar com qualquer provedor.

function opcoesSsl(connectionString, env = process.env) {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  if (env.DATABASE_SSL_VERIFY !== 'true') return { rejectUnauthorized: false };

  const ssl = { rejectUnauthorized: true };
  if (env.DATABASE_SSL_CA) ssl.ca = env.DATABASE_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

module.exports = { opcoesSsl };
