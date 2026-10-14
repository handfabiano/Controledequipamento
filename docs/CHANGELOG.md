# Changelog

Registro **vivo** e datado do que mudou e por quê. Entradas mais recentes no topo. Cada entrada
cita os IDs do [ROADMAP](./ROADMAP.md) e a evidência da verificação.

---

## 2026-10-14 — R-003: client de produção chama a API na mesma origem

**O quê**
- `client/src/services/api.js`: sem `REACT_APP_API_URL`, o padrão passa de
  `http://localhost:3001/api` para `/api` (a Vercel encaminha `/api/*` ao servidor; em
  desenvolvimento o `proxy` do CRA encaminha para :3001) (D-010).
- CI: novo passo "Build não aponta para localhost" falha se o JavaScript publicado contiver
  `localhost`, `127.0.0.1` ou `0.0.0.0` com porta, ou se não houver build para checar.
- `DEPLOY.md`: `REACT_APP_API_URL` documentada (opcional, do client, lida no build), como testar o
  build localmente com a API em outra porta e diagnóstico de "toda chamada à API falha".
- Roadmap: R-003 Pronto; R-036 avisa que o `proxy` não pode simplesmente ser removido; novo
  R-037 (barrar no build da Vercel um `REACT_APP_API_URL` com localhost). Conclusão segue 56%.

**Por quê**
- Sem a variável, o site publicado chamava `localhost:3001` na máquina de quem o abria: nenhuma
  tela funcionava em produção.

**Verificado**
- Passo do CI rodado localmente: falha no build anterior (aponta `main.2835cd46.js`), passa no
  novo e falha sem pasta de build.
- `npm test`: 117/117. `cd client && npm run build`: OK.
- No navegador (Chromium headless), build servido com roteamento igual ao da Vercel (`/api` →
  servidor na :3001, o resto → build), banco novo com `NODE_ENV=production`: login, 10
  categorias na tela, cadastro de equipamento; 8 chamadas à API, todas em `/api` da mesma
  origem, nenhuma para fora; nenhum erro de JavaScript.
- Revisões: simplify (passo do CI mais simples e com padrão mais amplo; sugestão de checar a
  variável no build da Vercel virou R-037), code-review high (passo do CI só no `.js` e sem
  passar quando falta o build; DEPLOY.md com teste local e onde definir a variável; etiqueta sem
  token já coberta por R-013), security-review sem achados.

---

## 2026-10-14 — R-001: catálogo básico em todo banco

**O quê**
- Novo `server/database/catalogo.js`: 10 categorias, 4 templates (checklist de 6 itens no
  "Evento Médio") e o "Depósito Central", criados em todo banco, inclusive produção. Cada tabela
  só é preenchida enquanto está vazia, com um INSERT de várias linhas por tabela (D-009).
- O seed de demonstração (`init.js`) deixou de criar esse catálogo e passou a referenciar
  categorias e depósitos pelo nome.
- Novo teste `server/tests/catalogo.test.js` (5 casos, banco sem dados de demonstração).
- Roadmap: R-001 Pronto; R-008 ganhou o caso de dois cold starts simultâneos em banco vazio;
  novo R-036 (dev server do client não sobe). Conclusão: 54% → 56%.

**Por quê**
- Um banco de produção novo não tinha categorias nem depósitos e não havia como criá-los:
  cadastrar o primeiro equipamento falhava com `Categoria não encontrada`.

**Verificado**
- Teste novo falhou antes da mudança (3 de 5) e passa depois; `npm test`: 117/117.
- `cd client && npm run build`: OK.
- Postgres 16 local com `NODE_ENV=production`: 10 categorias, 4 templates, 6 itens de checklist,
  1 depósito; `POST /api/equipamentos` com prefixo criou `MIC0001`; reiniciar não duplicou
  (mesmas contagens). Seed de demonstração no Postgres: 15 equipamentos, depósitos 1–3 corretos.
- No navegador (Chromium headless, build de produção servido localmente, banco novo): login,
  tela de Equipamentos com 10 categorias, cadastro do primeiro equipamento no "Depósito Central",
  sem erros de JavaScript.
- Revisões: simplify (4 ajustes aplicados), code-review high (lote único por tabela, nomes no
  seed demo, endereço do depósito demo restaurado), security-review sem achados.

**Riscos que ficam**
- Dois cold starts simultâneos em banco vazio podem duplicar o catálogo (sem restrição de
  unicidade) → R-008.
- A tela ainda assume o depósito de id 1 → R-005.

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
