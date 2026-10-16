# Changelog

Registro **vivo** e datado do que mudou e por quê. Entradas mais recentes no topo. Cada entrada
cita os IDs do [ROADMAP](./ROADMAP.md) e a evidência da verificação.

---

## 2026-10-16 — R-006 (em andamento): suíte do backend também em Postgres

**O quê**
- `server/tests/helpers.js`: com `TEST_DATABASE_URL` (Postgres com permissão de criar bancos),
  cada arquivo de teste cria um banco próprio e o apaga no fim (`DROP ... WITH (FORCE)`, também
  quando a subida do app ou o fechamento falham). Sem a variável, segue o SQLite temporário.
- Os testes em SQLite não podem mais ir parar num banco de verdade: antes, um `DATABASE_URL` no
  `.env` de quem rodava `npm test` voltava pelo `dotenv` e os testes gravavam nele (reproduzido:
  12 falhas tentando conectar no host do `.env`; agora usa SQLite).
- `db.js`: `encerrar()` fecha as conexões; o pool do Postgres ganhou ouvinte de `error`, sem o qual
  uma conexão ociosa derrubada pelo servidor (reinício, failover) derrubava o processo.
- O teste que simula falha no meio da conclusão de transferência usava um trigger só de SQLite;
  agora cria o trigger nos dois bancos e o remove mesmo se uma asserção falhar.
- CI: o job do backend sobe um Postgres 16 e roda `npm test` nele depois do SQLite (D-013).

**Por quê**
- Produção usa Postgres e nenhum teste rodava nele (R-006); R-008 e R-020 dependem disso.

**Verificado**
- Postgres 16 local: 131/131 (antes da correção do trigger, 130/131), várias rodadas sem
  sobrar banco `teste_*`. SQLite: 131/131.
- Workflow validado como YAML. **Falta**: o CI só roda em PR ou no `main`, então o passo novo
  ainda não rodou no GitHub; R-006 fica Em andamento até isso.
- Revisões: simplify (passo no job existente em vez de job duplicado; TLS do helper igual ao do
  app), code-review high (limpeza garantida do banco e do trigger, `.env` local isolado, FORCE no
  DROP), security-review sem achados.

**Riscos que ficam**
- Os testes de config/seed que rodam em processo filho continuam só em SQLite.

---

## 2026-10-15 — R-004 e R-023: gestão de usuários e sessão só para usuário ativo

**O quê**
- API: `GET /api/usuarios` e `PUT /api/usuarios/:id/ativo` (coordenador; não altera a própria
  conta) e `PUT /api/auth/senha` (o próprio usuário, exige a senha atual e aplica a política de
  senhas). Senha atual errada responde 400, porque a sessão é válida e o client desloga em 401.
- Limite de tentativas na troca de senha por usuário, contando só senha atual errada, com
  contador separado do login (`limiteDeFalhas` em `rateLimiter.js`).
- R-023: o `authMiddleware` (e o cadastro feito por coordenador) confere no banco que o usuário
  do token existe e está ativo, e usa o perfil do banco. Desativar encerra as sessões abertas.
- Login, `me` e as rotas de usuários devolvem o mesmo formato (`usuarioPublico`, `ativo`
  booleano, nunca a senha); perfis aceitos em `TIPOS_USUARIO` (`services/usuarios.js`).
- Telas: **Usuários** (coordenador: lista, cadastra com perfil, desativa/reativa, com aviso na
  tela em vez de `alert()`) e **Minha conta** (troca de senha), ligada pelo nome no topo.
- Testes novos: `usuarios.test.js` (12) e `limite-senha.test.js` (2). Roadmap: R-004 e R-023
  Pronto; novo R-038. Conclusão: 56% → 60% (F-03 Pronto).

**Por quê**
- Não havia como cadastrar, listar ou desativar usuários nem trocar senha sem mexer no banco.
- A revisão mostrou que, sem R-023, desativar não tirava o acesso: um coordenador desativado
  ainda podia, com o token antigo, desativar os outros coordenadores e trancar todos fora.

**Verificado**
- Testes novos falharam antes da implementação (9 de 9, depois 3 de 3 para R-023) e passam;
  `npm test`: 131/131. `cd client && npm run build`: OK, sem avisos de lint.
- No navegador (Chromium headless, build de produção, banco novo): coordenador cadastra um
  técnico (senha fraca recusada com a mensagem do servidor), desativa (login do técnico → 401),
  reativa (→ 200); a própria linha não tem botão; técnico não vê o menu e `/usuarios` volta ao
  início; troca de senha com senha atual errada mostra o erro sem deslogar; depois da troca a
  senha antiga dá 401 e a nova 200. Nenhum erro de JavaScript.
- Postgres 16 local: as mesmas rotas, `ativo` booleano, token do usuário desativado → 401 no
  dashboard.
- Revisões: simplify (constantes e helpers compartilhados, `inteiro`, fábrica de limitadores,
  limite por usuário), code-review high (levou a fazer R-023 junto, limite só para senha atual
  errada, formato único de usuário, sem SQL montado com colunas vindas de parâmetro),
  security-review sem achados.

**Riscos que ficam**
- Trocar a senha não derruba outras sessões já abertas (até 24h) → R-038.
- Uma consulta ao banco a mais por requisição autenticada (busca por chave primária).

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
