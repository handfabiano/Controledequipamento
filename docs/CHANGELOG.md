# Changelog

Registro **vivo** e datado do que mudou e por quê. Entradas mais recentes no topo. Cada entrada
cita os IDs do [ROADMAP](./ROADMAP.md) e a evidência da verificação.

---

## 2026-10-14 — Auditoria inicial e documentação viva

**O quê**
- Criados `docs/AUDITORIA.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` e `docs/DECISOES.md`.
- `CLAUDE.md` ganhou a seção "Documentação viva" com as regras de manutenção.

**Por quê**
- Base para o planejamento de finalização; o levantamento precisa evoluir junto com a
  implementação (D-001).

**Verificado**
- `npm test`: 112/112 passando.
- `cd client && npm run build`: OK (avisos de source map do `html5-qrcode`).
- Servidor com `NODE_ENV=production` em SQLite vazio: primeiro cadastro OK; categorias e
  templates vazios; `POST /api/equipamentos` → `Categoria não encontrada`; `/api/depositos` e
  `/api/usuarios` → 404 (origem de R-001, R-002, R-004).
- Build do client sem `REACT_APP_API_URL` contém `localhost:3001/api` (origem de R-003).
- `npm audit --omit=dev`: backend 8 vulnerabilidades (1 crítica em `tar` via `sqlite3`);
  client 101 (cadeia do `react-scripts`).
- CI do `main` verde (run 21). Supabase: nenhum projeto acessível contém este sistema.

**Código alterado**: nenhum.
