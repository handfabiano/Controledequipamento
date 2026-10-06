---
name: checklist-deploy
description: Checklist pré-deploy e pós-deploy para Vercel + Postgres (Supabase/Neon). Use antes de publicar uma release ou ao diagnosticar falha em produção.
---
# Checklist de deploy

## Antes
- [ ] CI verde no commit (backend sintaxe+smoke, frontend build); testes (`npm test`) quando existirem.
- [ ] Schema alterado? Migração idempotente pronta e testada em banco com schema antigo (`migracao-banco`).
- [ ] Variáveis na Vercel: `NODE_ENV=production`, `JWT_SECRET` (forte, único), `DATABASE_URL` (pooler porta 6543 no Supabase), `CORS_ORIGIN=https://<app>.vercel.app`. **`SEED_DEMO_DATA` ausente/false.**
- [ ] `REACT_APP_API_URL` coerente com o domínio (rotas `/api` na mesma origem ⇒ `/api`).
- [ ] Nada de segredo no diff (`git diff` + `.env` ignorado).
- [ ] `revisao-seguranca` rodada se mexeu em auth/rotas.

## Depois
- [ ] `GET /health` → `{status:"ok"}`.
- [ ] Banco vazio: primeiro usuário via `POST /api/auth/register` (coordenador); depois registro só autenticado.
- [ ] Login pela UI, criar equipamento, gerar QR, abrir etiqueta.
- [ ] Logs da função na Vercel sem `JWT_SECRET não definido`, erros de conexão ou `CORS`.

## Diagnóstico rápido
- Dados somem ⇒ sem `DATABASE_URL` (SQLite efêmero).
- 404 em `/api/*` ⇒ `vercel.json` / build do `server/index.js`.
- Timeout/conexões esgotadas ⇒ usar pooler e `PG_POOL_MAX` baixo.
- Bloqueio de CORS ⇒ `CORS_ORIGIN` sem a origem exata (com `https://`, sem barra final).
Referência: `DEPLOY.md`.
