#!/bin/bash
# Instala as dependências do backend e do frontend em sessões do Claude Code na web,
# para que testes (`npm test`) e o build do client (`cd client && npm run build`)
# funcionem logo no início da sessão. Idempotente e não interativo.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# npm install (e não npm ci) aproveita o cache do container entre sessões
npm install --no-audit --no-fund --loglevel=error
(cd client && npm install --no-audit --no-fund --loglevel=error)
