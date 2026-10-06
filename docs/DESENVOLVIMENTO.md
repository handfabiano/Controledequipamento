# Guia de Desenvolvimento

## Setup
```bash
git clone <repo> && cd Controledequipamento
npm run install:all
cp .env.example .env     # ajuste JWT_SECRET
npm run dev:full         # API :3001 + React :3000
```
Banco local: SQLite em `server/database/equipamentos.db` (ignorado pelo git; apague para recriar + reseed).
Para testar Postgres: `DATABASE_URL=postgresql://... npm run dev` (use um banco descartável).

Usuários seed (dev): `coordenador@sistema.com`, `joao@sistema.com` (entrega), `maria@sistema.com` (recebimento), `pedro@sistema.com` (técnico) — senha `123456`.

## Fluxo de trabalho
1. Entender a regra em `REGRAS_DE_NEGOCIO.md`.
2. Backend: schema (2 arquivos) → validator → controller → rota → `docs/API.md`.
3. Frontend: `services/api.js` → página/componente → rota/menu.
4. Verificar (abaixo) → commit pequeno em português → push na branch da tarefa.

## Verificação local (espelha o CI)
```bash
for f in $(find server -name '*.js'); do node --check "$f"; done
PORT=3101 node server/index.js &   # depois:
curl -sf localhost:3101/health
curl -sf -X POST localhost:3101/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"coordenador@sistema.com","senha":"123456"}' | grep token
kill %1
(cd client && npm run build)
```
Para mudanças de comportamento, exercite o fluxo com `curl` usando o token (veja skill `escrever-testes` para automatizar).

## Estilo
- CommonJS no backend, ESM/JSX no frontend; 2 espaços; aspas simples; ponto e vírgula.
- Nomes de domínio em português (`equipamento`, `transferencia`), comentários curtos em português explicando o *porquê*.
- Sem novas dependências sem necessidade clara.

## Variáveis de ambiente
Ver `.env.example` e `DEPLOY.md`: `PORT, JWT_SECRET, NODE_ENV, DATABASE_URL, CORS_ORIGIN, SEED_DEMO_DATA, PG_POOL_MAX, SQLITE_PATH`; frontend: `REACT_APP_API_URL`.
