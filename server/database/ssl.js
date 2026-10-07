// Opções de TLS da conexão com o Postgres.
// Por padrão a conexão é criptografada, mas o certificado do servidor NÃO é verificado
// (funciona com qualquer provedor, sem configuração, mas não protege contra man-in-the-middle).
// DATABASE_SSL_VERIFY=true liga a verificação; para provedores com CA própria (ex.: Supabase),
// informe o certificado da CA em DATABASE_SSL_CA (PEM; "\n" literal vira quebra de linha).

function opcoesSsl(connectionString, env = process.env) {
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  if (env.DATABASE_SSL_VERIFY !== 'true') return { rejectUnauthorized: false };

  const ssl = { rejectUnauthorized: true };
  if (env.DATABASE_SSL_CA) ssl.ca = env.DATABASE_SSL_CA.replace(/\\n/g, '\n');
  return ssl;
}

module.exports = { opcoesSsl };
