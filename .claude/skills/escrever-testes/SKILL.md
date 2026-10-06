---
name: escrever-testes
description: Introduz e escreve testes automatizados de API (Jest + Supertest) com SQLite temporário, e roteiros de verificação por curl. Use ao criar testes, reproduzir bug ou validar uma mudança de comportamento.
---
# Escrever testes

O repositório ainda não tem framework de testes. Na primeira vez:
1. `npm i -D jest supertest`; em `package.json`: `"test": "jest --runInBand"` e `"jest": {"testEnvironment":"node"}`.
2. Crie `server/__tests__/helpers.js`:
   - Antes de importar o app: `process.env.SQLITE_PATH = <arquivo em os.tmpdir() único>`, `NODE_ENV='test'`, `JWT_SECRET='teste'`, `SEED_DEMO_DATA='true'`.
   - `app = require('../index')` (exporta o Express sem `listen`); `login(email)` retorna token via `POST /api/auth/login` (senha `123456`).
   - Limpeza do arquivo temporário em `afterAll`.
   - Atenção ao `authLimiter` (5 logins falhos/15 min): cacheie tokens, não faça logins inválidos em excesso.
3. Um arquivo por domínio: `auth.test.js`, `transferencias.test.js`, `eventos.test.js`, `equipamentos.test.js`.
4. Adicione ao CI um passo `npm test` no job backend.

## O que cobrir primeiro
- Transferência: criar → aprovar na ordem → concluir; cada papel errado recebe 403; etapa fora de ordem; cancelar concluída = 400; envolvido vs. não envolvido em `GET /:id`.
- Evento: aprovar sem checklist completo = 400; não-coordenador = 403; checklist completo = 200.
- Equipamento: criação por prefixo gera `XXX0001`, duplicado = 400, filtros/paginação.
- Auth: login inválido 401; register sem token com banco populado 401; só coordenador registra.

## Boas práticas
Nomes descritivos em português ("deve impedir que técnico aprove como coordenador"); cada teste monta seus dados via API; asserte status **e** corpo/efeito colateral no banco (`/equipamentos/:id`). Para bug: teste vermelho primeiro, mostre a falha, depois a correção. Se não houver tempo para Jest, entregue um script `curl` reproduzível.
