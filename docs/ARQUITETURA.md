# Arquitetura

## Visão geral
```
 React SPA (client/)  ──axios──►  Express API (server/)  ──►  db.js ──► Postgres (DATABASE_URL)
 Vercel static build              Vercel serverless / node        └──► SQLite (dev local)
```
- Monorepo simples: `package.json` na raiz (backend) e em `client/` (frontend). Sem workspaces.
- Em produção (Vercel), `server/index.js` exporta o `app` Express (função serverless); localmente roda `app.listen` quando `require.main === module`.

## Backend (`server/`)
| Arquivo/pasta | Responsabilidade |
|---|---|
| `index.js` | Monta Express: CORS, body parsers, log, **garante o banco inicializado** (`ensureDatabase`) antes de cada request, rate limit em `/api`, rotas, `/health`, 404, error handler |
| `config.js` | `JWT_SECRET` (obrigatório em produção), `CORS_ORIGIN` → `corsOrigins` |
| `routes/index.js` | Único roteador; aplica `authMiddleware` e validators |
| `middleware/auth.js` | `authMiddleware` (Bearer JWT → `req.user = {id,email,tipo}`), `checkRole(...tipos)` |
| `middleware/rateLimiter.js` | `apiLimiter` 100 req/15min/IP; `authLimiter` 5 tentativas/15min (login) |
| `controllers/*` | Regra de negócio + SQL direto (sem camada de repositório) |
| `validators/` | express-validator (hoje só `equipamentoValidator.js`) |
| `services/notificacoes.js` | `criarNotificacao`, `notificarUsuarios` — falhas são logadas e engolidas |
| `database/db.js` | Driver duplo; expõe `usePostgres, runAsync, getAsync, allAsync` |
| `database/init.js` | Executa schema (split por `;`), seed de demo, `gerarTombamento`, `gerarCodigo`; re-exporta helpers do `db.js` |
| `database/schema.sql` / `schema.pg.sql` | DDL SQLite / Postgres — **manter em paridade** |
| `cache.js` | node-cache (TTL 1h) — utilitário disponível, uso mínimo |

### Camada de dados (`db.js`)
- Placeholders `?` em todo SQL; no Postgres são reescritos para `$1..$n`.
- `runAsync` em `INSERT` no Postgres acrescenta `RETURNING id` e devolve `lastID` (emula SQLite). Toda tabela deve ter coluna `id`.
- `COUNT(*)` (BIGINT) é convertido para número via `types.setTypeParser(20, parseInt)`.
- Pool Postgres pequeno (`PG_POOL_MAX`, padrão 3) por causa de serverless; SSL ligado exceto localhost.
- Booleanos são `INTEGER 0/1` em ambos os bancos. Datas: `TIMESTAMPTZ` (PG) vs `DATETIME` (SQLite) — comparar com cuidado.
- **Sem transações expostas.** Fluxos multi-passo não são atômicos.

### Ciclo de uma requisição
`cors → json → log → ensureDatabase → apiLimiter(/api) → router → authMiddleware → [validator] → controller → res.json`

## Frontend (`client/src/`)
- `index.js` / `App.js`: `AuthProvider` + `react-router` (`/login`, e rotas privadas dentro de `Layout`: `/`, `/equipamentos`, `/transferencias`, `/eventos`).
- `context/AuthContext.js`: token e usuário em `localStorage` (`token`, `user`).
- `services/api.js`: instância axios com `REACT_APP_API_URL` (padrão `http://localhost:3001/api`); injeta Bearer; em 401 limpa storage e vai para `/login`. Exporta `auth, equipamentos, transferencias, eventos, notificacoes`.
- `components/`: `Layout` (menu), `NotificationBell` (polling), `QRScanner` (html5-qrcode), `LoadingSpinner`.
- `pages/`: `Login, Dashboard, Equipamentos, Transferencias, Eventos` (cada um com `.css` próprio).

## Deploy e CI
- `vercel.json`: `/api/*` e `/health` → `server/index.js`; demais → build do React. Detalhes em `DEPLOY.md`.
- CI (`.github/workflows/ci.yml`): job backend (`node --check`, smoke test SQLite com login seed) e job frontend (`npm run build`).

## Decisões e trade-offs
- SQL cru + dois dialetos: simples, mas exige disciplina (ver `CLAUDE.md` regras 1–3).
- Seed automático só fora de produção; bootstrap do primeiro usuário via `/auth/register` com banco vazio.
- Rate limit em memória: eficaz em instância única, fraco em serverless multi-instância.
