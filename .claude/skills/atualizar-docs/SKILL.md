---
name: atualizar-docs
description: Sincroniza a documentação (CLAUDE.md, README, docs/) com o código atual e registra divergências. Use após mudar rotas, schema, regras, env vars ou ao auditar a doc.
---
# Atualizar documentação

1. Descubra o que mudou: `git diff --stat origin/main...HEAD` ou a área indicada.
2. Mapa fonte → doc:
   - `server/routes/index.js` → `docs/API.md` (+ `client/src/services/api.js` coerente)
   - `server/database/schema*.sql`, `init.js` → `docs/BANCO_DE_DADOS.md`
   - controllers (status, papéis, transições) → `docs/REGRAS_DE_NEGOCIO.md`
   - middleware/config/CORS/limites → `docs/SEGURANCA.md`
   - scripts, env, estrutura de pastas → `docs/DESENVOLVIMENTO.md`, `docs/ARQUITETURA.md`, `.env.example`, `DEPLOY.md`
   - comandos/regras/convenções → `CLAUDE.md`
   - itens concluídos/novos débitos → `docs/ROADMAP.md`
3. Documente o que o **código faz**, lendo-o; não copie promessas do README. Divergência doc×código: corrija a doc se o código é o desejado; senão registre no ROADMAP.
4. Conferência: todo endpoint em `routes/index.js` aparece em `API.md`; toda tabela/coluna do schema em `BANCO_DE_DADOS.md`; toda env var em `.env.example`.
5. Mantenha `CLAUDE.md` curto (regras e ponteiros); detalhes ficam em `docs/`.
