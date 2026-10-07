const { execFileSync } = require('node:child_process');
const path = require('node:path');

// config.js e init.js leem o ambiente ao carregar, então cada caso roda em um processo filho dentro
// de server/. Devolve o stdout. (Sem efeitos colaterais de carga, ao contrário de helpers.js.)
function rodarNoServidor(script, env = {}) {
  return execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { PATH: process.env.PATH, JWT_SECRET: 'x', ...env },
    encoding: 'utf8'
  });
}

module.exports = { rodarNoServidor };
