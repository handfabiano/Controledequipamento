# Changelog

Registro **vivo** e datado do que mudou e por quê. Entradas mais recentes no topo. Cada entrada
cita os IDs do [ROADMAP](./ROADMAP.md) e a evidência da verificação.

---

## 2026-10-19 — R-005: código automático pelo prefixo na tela

**O quê**
- Formulário de novo equipamento: "Numerar automaticamente" vem marcado e o campo pede só o
  prefixo (MIC vira MIC0001, MIC0002...); desmarcado, pede o código completo. O aviso de sucesso
  mostra o código gerado. Fechar o formulário por qualquer caminho limpa o que foi digitado.
- A API aceita prefixo e código em minúsculas ou com espaços nas pontas (o validator normaliza);
  antes recusava `mic`.
- `gerarCodigo` (`server/database/init.js`): continua usando o número seguinte ao maior do
  prefixo, mas se o maior for 9999 (um código manual alto) usa o menor número livre; antes
  todo cadastro automático daquele prefixo passava a falhar. Sem número livre, 400 com mensagem.
- `mensagemDeErro` (client) mostra o motivo dos erros do express-validator (`details[0].msg`)
  em vez de só "Dados inválidos"; vale para todas as telas que a usam.

**Por quê**
- R-005: a tela exigia o código completo, e quem cadastra não sabe o próximo número livre.

**Verificado**
- `npm test`: 149/149 em SQLite e em Postgres 16 local. Testes novos em `equipamentos.test.js`:
  minúsculas e espaços normalizados, código manual sem prefixo, formatos inválidos dão 400,
  ZZZ9999 manual seguido de ZZZ0001 e ZZZ0002 automáticos. O teste de minúsculas falha sem a
  mudança no validator.
- `cd client && npm run build`: ok.
- Navegador (Playwright, build de produção, banco novo em `NODE_ENV=production`): `mic` gerou
  MIC0001 e depois MIC0002; `cai0042` manual gerou CAI0042 e o automático seguinte CAI0043;
  MES9999 manual seguido de MES0001 automático; prefixo com 2 letras barrado pelo navegador;
  formulário reaberto volta limpo e no modo automático. Sem erros de JavaScript.
- Revisões: simplify (formato do campo numa tabela só, normalização no validator), code-review
  high (código 9999 travando a numeração, texto da dica, cursor ao forçar maiúsculas, motivo do
  erro escondido, formulário não limpo ao fechar, estilo do checkbox) e security-review sem
  achados.

---

## 2026-10-17 — R-002: depósitos e categorias pela tela

**O quê**
- API nova (`server/controllers/cadastrosController.js`): `GET /api/depositos` para qualquer
  usuário logado (com o nome do responsável); `POST` e `PUT /api/depositos/:id`,
  `POST /api/equipamentos/categorias` e `PUT /api/equipamentos/categorias/:id` só para
  coordenador. A edição recebe o registro inteiro, como a tela envia.
- Regras: nome obrigatório (até 100 caracteres), sem repetir nome (sem diferenciar maiúsculas);
  tipo de categoria só entre os valores do `CHECK` do banco; responsável precisa ser usuário
  ativo, mas um depósito pode manter o responsável atual depois que ele for desativado; ids fora
  do `INTEGER` do Postgres dão 400.
- `GET /api/equipamentos/categorias` passou para o mesmo controller e perdeu o cache de 24h em
  memória (D-014).
- Tela **Cadastros** (só coordenador, link no menu): lista, cria e edita depósitos e categorias.
- Cadastro de equipamento: o depósito deixou de ser fixo em 1 e vem de uma lista obrigatória;
  categorias e depósitos carregam uma vez ao abrir a tela, não a cada filtro ou página.
- `services/validacao.js` ganhou `idValido`, `textoOuNulo`, `textoObrigatorio`, `ErroDeEntrada`
  e `tratarErros` (D-014).
- Novas tarefas: R-039 (templates e checklists pela tela), R-040 (nome único garantido no banco),
  R-041 (ids grandes dão 500 nas rotas antigas em Postgres: reproduzido com
  `PUT /api/usuarios/99999999999/ativo`). R-005 ficou só com o código automático por prefixo.

**Por quê**
- Sem isso o coordenador não conseguia criar depósitos nem categorias, e todo equipamento
  cadastrado pela tela ia para o depósito 1 (R-002).

**Verificado**
- `npm test`: 142/142 em SQLite e em Postgres 16 local (`server/tests/cadastros.test.js`, 11
  testes: listar, criar, editar, validações, 403 para os outros perfis, nome repetido,
  responsável inativo, ids grandes, categoria nova visível na lista do cadastro).
- `cd client && npm run build`: ok (só os avisos de source map do `html5-qrcode`).
- Navegador (Playwright, build de produção atrás de um proxy igual ao da Vercel, banco novo em
  `NODE_ENV=production`): coordenador criou o "Galpão Leste" com responsável, editou o nome,
  criou a categoria "Projetor"; ambos apareceram no formulário de equipamento e o equipamento
  `PRJ0001` foi criado no depósito novo. Sem erros de JavaScript.
- Revisões: simplify (categorias num só controller, PUT completo, carga única na tela de
  equipamentos), code-review high (cache entre instâncias, responsável desativado, nome
  repetido, erro silencioso ao carregar listas, ids grandes) e security-review sem achados.

---

## 2026-10-17 — R-008: migrações versionadas

**O quê**
- `server/database/migracoes/`: o schema virou a migração `001_schema_inicial` (`.sql` para SQLite,
  `.pg.sql` para Postgres; antes `schema.sql`/`schema.pg.sql`). `migracoes.js` aplica as pendentes
  em ordem e registra na tabela `migracoes`. Versão sem os dois arquivos ou repetida impede a
  subida.
- `db.js`: `comExclusividade` roda migrações, catálogo básico e seed de demonstração numa
  transação só, uma instância por vez (Postgres: `pg_advisory_xact_lock` com `lock_timeout` de
  20s, compatível com o pooler do Supabase na porta 6543; SQLite: `BEGIN IMMEDIATE` e fila em
  memória). SQL sem parâmetros vai ao Postgres sem trocar `?` por `$n`.
- `index.js`: requisições simultâneas no cold start esperam a mesma inicialização (antes cada uma
  podia disparar a sua); se falhar, a próxima tenta de novo.
- `vercel.json`: `includeFiles` leva `server/database/migracoes/**` para a função (o diretório é
  lido em tempo de execução, e o rastreio de dependências da Vercel não o enxerga).
- Docs: D-015, CLAUDE.md (convenção de schema), DEPLOY.md, README. Novo item R-042 (banco de
  produção antigo pode ter colunas faltando).

**Por quê**
- O DDL a cada cold start não acrescentava coluna a tabela existente, e dois cold starts
  simultâneos em banco vazio podiam duplicar o catálogo (R-008, pré-requisito de R-021 e R-038).

**Verificado**
- `server/tests/migracoes.test.js` (6 testes): dois `initializeDatabase` e duas requisições ao
  mesmo tempo em banco vazio deixam 10 categorias, 4 templates, 6 itens de checklist e 1 depósito;
  reiniciar não reaplica; uma migração `002` com `ALTER TABLE ... ADD COLUMN` aplica uma vez em
  banco existente; uma migração que falha no segundo comando desfaz o primeiro e não é
  registrada; migração só num driver é recusada.
- Sem a trava do Postgres, o teste de cold start simultâneo falha (2 de 2 rodadas): a trava é o
  que impede a duplicação. Com o lock segurado por outra sessão no `psql`, a inicialização desiste
  em 20s ("lock timeout") e a seguinte, já sem o lock, passa. Com `PG_POOL_MAX=1` e seed ligado, o
  banco vazio inicializa (15 equipamentos), sem esperar conexão do pool.
- Uma migração com `DEFAULT 'conferido?'` grava o texto igual nos dois bancos.
- Banco gerado pelo código do `main` (SQLite e Postgres 16, com seed): o código novo registra a
  `001` sem erro e sem duplicar usuários (4) nem categorias (10).
- `npm test`: 137/137 em SQLite e 137/137 em Postgres 16 local. O client não mudou.
- code-review high: a primeira versão usava lock de sessão, que vaza atrás do pooler em modo
  transação e não tinha tempo máximo de espera, e o seed rodava fora da transação pelo pool (com
  `PG_POOL_MAX=1`, esperava para sempre). As três coisas foram corrigidas.

**Riscos que ficam**
- Comandos separados por `;`: uma migração futura com função PL/pgSQL precisará de outro
  separador.
- Banco de produção existente não foi visto (R-007, R-042).

---

## 2026-10-16 — R-006: suíte do backend também em Postgres

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
- GitHub Actions no PR #22 (rascunho, aberto com o ok do Fabiano): job do backend verde (run
  38955169214), com o passo do Postgres 16; o log do Postgres mostra a `falha simulada` do teste
  do trigger, prova de que a suíte rodou nele. Frontend verde. O health check do service passou a
  usar `-U postgres` (sem isso o log enchia de `role "root" does not exist`).
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
