# Auditoria do Sistema de Controle de Equipamentos

Documento **vivo**: descreve o estado atual do sistema. Cada seção tem a data da última
verificação. Ao concluir uma tarefa do [ROADMAP](./ROADMAP.md), atualize a seção afetada
(e a data), registre no [CHANGELOG](./CHANGELOG.md) e, se houve escolha técnica, em
[DECISOES](./DECISOES.md).

Legenda de status: **Pronto** · **Parcial** · **Pendente** · **Bloqueado**.
Severidade: **Crítico** · **Alto** · **Médio** · **Baixo**. Esforço: **P** (horas) · **M** (1–2 dias) · **G** (3+ dias).

---

## 0. Resumo executivo

_Última verificação: 2026-10-14 (após R-003)_

| Indicador | Valor | Como foi medido |
|---|---|---|
| Conclusão funcional | **56%** | Inventário da seção 2: (7 Pronto + 0,5 × 13 Parcial) / 24 itens (R-003 não muda o inventário: o deploy, F-23, segue Bloqueado) |
| Testes do backend | 117/117 passando | `npm test` (node:test, SQLite temporário) |
| Build do frontend | OK (só avisos de source map do `html5-qrcode`) | `cd client && npm run build` |
| CI no `main` | Verde | GitHub Actions, run 21 (`ci.yml`) |
| Vulnerabilidades (produção, backend) | 8 (1 crítica, 5 altas, 2 baixas) | `npm audit --omit=dev` |
| Vulnerabilidades (frontend) | 101 (63 altas) | `cd client && npm audit --omit=dev`, todas na cadeia do `react-scripts` |
| Infra de produção | **Não verificada** | Sem acesso à Vercel; nenhum projeto Supabase da conta contém este sistema |

**Atualização 2026-10-14 (R-001):** um banco de produção novo já nasce com 10 categorias, 4
templates (checklist no "Evento Médio") e o "Depósito Central", e o primeiro equipamento é
cadastrado pela tela (verificado em SQLite, em Postgres 16 e no navegador).

**Atualização 2026-10-14 (R-003):** o build de produção chama a API em `/api` na mesma origem
e não contém mais `localhost`; o CI falha se voltar a conter.

**Estado geral.** O núcleo de regras do backend (status derivado dos equipamentos,
transferência com aprovação tripla, ciclo de vida de eventos, checklist) está bem feito e
coberto por testes. O que impede o lançamento é o entorno: um banco de produção novo nasce
**sem categorias, depósitos nem templates e não há tela nem API para criá-los** (verificado),
o build de produção do frontend aponta para `localhost` se uma variável não for definida
(verificado), e metade das funções do backend não tem tela.

**Top 5 riscos**

1. ~~**Produção inutilizável em banco novo**~~ (resolvido em R-001, 2026-10-14): o catálogo
   básico agora nasce em todo banco. Continua faltando editar depósitos e categorias pela
   tela. → R-002.
2. ~~**Frontend de produção chama `http://localhost:3001/api`**~~ (resolvido em R-003,
   2026-10-14): o padrão é `/api` na mesma origem e `REACT_APP_API_URL` está no `DEPLOY.md`.
   Um valor errado definido no painel da Vercel ainda passaria sem aviso. → R-037.
3. **Postgres nunca é testado** (Alto): CI e testes só usam SQLite; não há migrations; o
   deploy real não pôde ser verificado. → R-006, R-007, R-008.
4. **Sem gestão de usuários** (Alto): não há tela de cadastro, listagem ou desativação;
   usuário desativado continua com token válido por até 24h. → R-004, R-023.
5. **Sem transações** (Alto): operações de várias etapas (concluir transferência, alocar
   lote, encerrar evento) podem deixar estado parcial em falha; duas solicitações simultâneas
   podem abrir duas transferências do mesmo equipamento. → R-020, R-021.

---

## 1. Arquitetura e stack

_Última verificação: 2026-10-14_

- **Backend**: Node 20 + Express 4 (`server/index.js`), exportado como função serverless da
  Vercel. Camadas: `routes/index.js` → `controllers/` → `services/` (regras compartilhadas,
  efeitos colaterais) → `database/db.js`.
- **Banco**: camada única com dois drivers (`server/database/db.js:9`): Postgres (`pg`) quando
  `DATABASE_URL` existe, SQLite caso contrário. Placeholders `?` convertidos para `$n`
  (`db.js:38`). Não há suporte a transação na camada.
- **Frontend**: React 18 + CRA (`react-scripts 5.0.1`), React Router 6, axios
  (`client/src/services/api.js`), leitor de QR com `html5-qrcode`.
- **Autenticação**: JWT HS256 de 24h (`server/services/token.js:9`), guardado em
  `localStorage` no cliente (`client/src/context/AuthContext.js:26`).
- **Deploy**: `vercel.json` com builds legados (`@vercel/node` + `@vercel/static-build`).
- **Integrações externas**: nenhuma (sem e-mail, storage ou filas). Notificações são linhas na
  tabela `notificacoes` lidas por polling de 60s (`client/src/components/NotificationBell.js:6`).
- **Plugin do Claude Code**: `plugins/sempre-skills` + `.claude-plugin/marketplace.json`
  (injeta a regra de usar skills); hook de início de sessão em `.claude/hooks/session-start.sh`.

Fluxo principal: Login → Dashboard → Equipamentos (listar, cadastrar, reportar problema,
escanear QR) → Eventos (criar, alocar, checklist, status) → Transferências (solicitar,
aprovar em 3 etapas, cancelar).

---

## 2. Funcionalidades

_Última verificação: 2026-10-14 (após R-001)_

| ID | Funcionalidade | Status | Evidência |
|---|---|---|---|
| F-01 | Login e sessão | Pronto | `authController.login`; testes em `server/tests/auth.test.js` |
| F-02 | Primeiro cadastro (bootstrap) | Parcial | Só via API `POST /api/auth/register` (`authController.js:62`); sem tela |
| F-03 | Gestão de usuários (listar, criar, desativar, trocar senha) | Pendente | Não existe rota `/api/usuarios` (verificado: 404); cliente não usa `auth.register` |
| F-04 | Cadastros base (categorias, depósitos, templates, checklists) | Parcial | Catálogo inicial em todo banco (`server/database/catalogo.js`, R-001); sem rotas para editar; `GET /api/depositos` → 404 |
| F-05 | Listar/buscar equipamentos com filtros e paginação | Pronto | `equipamentosController.listar`; `Equipamentos.js` |
| F-06 | Cadastrar equipamento | Parcial | Funciona em banco novo desde R-001 (verificado no navegador); tela fixa `deposito_id: 1` (`Equipamentos.js:38`); exige código completo (prefixo automático só via API) |
| F-07 | Editar equipamento / colocar em manutenção | Parcial | API `PUT /equipamentos/:id` pronta; sem tela (`equipamentos.atualizar` não é usado) |
| F-08 | Detalhe do equipamento (histórico, problemas) | Parcial | API `GET /equipamentos/:id` pronta; sem tela |
| F-09 | Reportar problema | Pronto | `reportarProblema` + modal em `Equipamentos.js` |
| F-10 | Resolver problema | Parcial | API pronta; `equipamentos.resolverProblema` não é usado no cliente |
| F-11 | QR Code: leitura, geração e etiqueta | Parcial | Leitura pronta (`QRScanner.js`); geração/etiqueta só na API; `gerarEtiqueta` devolve URL que, aberta direto, não leva o token Bearer (inferido: 401) |
| F-12 | Transferência com aprovação tripla | Parcial | API completa e testada; tela pede **IDs numéricos** de origem/destino (`Transferencias.js:285,310`) e não designa responsáveis |
| F-13 | Transferência rápida entre responsáveis (mesmo evento) | Parcial | API `POST /transferencias/rapida`; sem tela |
| F-14 | Transferência entre eventos simultâneos | Parcial | API `POST /transferencias/entre-eventos`; sem tela |
| F-15 | Criar/listar eventos | Parcial | Tela não envia responsáveis; não há edição de evento nem remoção de equipamento alocado |
| F-16 | Alocar equipamentos em evento | Pronto | `adicionarEquipamentos` (lote validado); modal em `Eventos.js` |
| F-17 | Checklist por template | Pronto | `validarChecklist` + bloqueio na aprovação (`eventosController.js:455`) |
| F-18 | Ciclo de status do evento | Pronto | Máquina de estados em `services/eventos.js:15`; guarda de concorrência |
| F-19 | Detalhe do evento (equipamentos, responsáveis) | Parcial | API `GET /eventos/:id`; sem tela |
| F-20 | Notificações | Parcial | Sino funciona; transferência sem responsável designado (o caso da tela) não notifica ninguém (`transferenciasController.js:364`) |
| F-21 | Dashboard | Pronto | `dashboardController.resumo`; testes em `dashboard.test.js` |
| F-22 | Relatórios e exportação | Pendente | Listado como futuro no README |
| F-23 | Deploy de produção funcionando | Bloqueado | Sem acesso à Vercel/banco de produção para verificar |
| F-24 | Migrations de schema | Pendente | Schema aplicado com `CREATE TABLE IF NOT EXISTS` a cada cold start (`init.js:11-19`) |

Funcionalidades "de fachada" (API pronta, sem uso na tela): F-07, F-08, F-10, F-11
(geração), F-13, F-14, F-19, além de `transferencias.buscarPorId`.

---

## 3. Banco de dados

_Última verificação: 2026-10-14 (após R-001)_

- **Tabelas (13)**: `usuarios`, `depositos`, `categorias_equipamentos`, `equipamentos`,
  `problemas_equipamentos`, `templates_eventos`, `checklist_template`, `eventos`,
  `responsaveis_evento`, `equipamentos_evento`, `transferencias`, `historico_movimentacoes`,
  `notificacoes`. Definidas em `schema.sql` e `schema.pg.sql`; os dois divergem só em tipos
  (`AUTOINCREMENT`/`IDENTITY`, `DATETIME`/`TIMESTAMPTZ`) — conferido com `diff`.
- **Relacionamentos**: FKs declaradas em todas as tabelas filhas. No SQLite **não são
  aplicadas** (não há `PRAGMA foreign_keys = ON` em `db.js`). Nenhuma FK tem `ON DELETE`.
- **Índices**: 12 índices (status, depósito, tombamento, transferências por equipamento,
  notificações por usuário etc.). Falta índice/restrição de unicidade para "uma transferência
  ativa por equipamento" (a regra é só verificada no código).
- **Migrations**: não existem. Qualquer coluna nova em tabela existente não é aplicada em
  produção. O DDL roda a cada cold start (latência e corrida entre instâncias simultâneas no
  Postgres — inferido).
- **RLS/permissões**: não se aplica ao app (acesso só pelo backend com uma credencial). Se o
  Postgres for Supabase, as tabelas ficam no schema `public` sem RLS e expostas à API REST do
  Supabase para quem tiver a chave anon — **verificar quando o banco de produção for
  identificado** (R-007).
- **Catálogo básico** (R-001, verificado 2026-10-14): `server/database/catalogo.js` preenche
  categorias, templates + checklist e o "Depósito Central" em todo banco, cada tabela só
  enquanto está vazia (D-009). Dois cold starts simultâneos em banco vazio podem duplicar o
  catálogo (sem restrição de unicidade); fica para R-008.
- **Dados fictícios**: seed de demonstração (usuários com senha `123456`, equipamentos
  exemplo, depósitos Zona Norte/Sul) só com `NODE_ENV=development|test` ou
  `SEED_DEMO_DATA=true` (`config.js:64`).
- **Banco de produção**: nenhum dos dois projetos Supabase acessíveis (Conectapol, JER
  Gestão) contém as tabelas deste sistema (verificado com `list_tables`). O banco real não
  foi localizado.

---

## 4. Backend / API

_Última verificação: 2026-10-14_

25 rotas em `server/routes/index.js`, todas sob `/api`, mais `GET /health`.

| Grupo | Rotas | Autorização | Validação |
|---|---|---|---|
| Auth | login, register, me | login público com rate limit; register aberto só no banco vazio (com `BOOTSTRAP_TOKEN` opcional) | manual |
| Equipamentos | 10 | escrita: coordenador e responsáveis (`gestor`); reportar: qualquer autenticado | express-validator (`validators/equipamentoValidator.js`) |
| Transferências | 7 | criar: qualquer autenticado; aprovar por etapa/designado; ver por envolvimento | manual (`inteiro`, `informado`) |
| Eventos | 7 | criar: gestor; alocar: equipe do evento; status: coordenador (cancelar: criador também) | manual |
| Notificações | 4 | só as do próprio usuário | — |
| Dashboard | 1 | autenticado | — |

- **Tratamento de erros**: todos os handlers têm `try/catch` com `{ error }` em português;
  handler global trata JSON inválido (400) e corpo grande (413) (`index.js:90`).
- **Achados**:
  - Sem transações; a conclusão de transferência tem compensação manual
    (`transferenciasController.js:186`). Alocação em lote e encerramento de evento não.
  - `validarChecklist` conta alocações devolvidas (`eventosController.js:367`), enquanto a
    aprovação não (`:53`) — o checklist pode mostrar "válido" e a aprovação recusar.
  - Alocação não considera datas: equipamento em evento planejado para o futuro fica
    `em_uso` e não pode ir a outro evento antes.
  - Qualquer usuário (inclusive técnico) pode solicitar transferência de qualquer equipamento.
  - Templates ordenados alfabeticamente por `tamanho` (`eventosController.js:512`).
  - `authLimiter` importado e não usado em `server/index.js:7`.
- **Edge Functions**: não há.

---

## 5. Frontend

_Última verificação: 2026-10-14_

Telas: Login, Dashboard, Equipamentos, Transferências, Eventos (`client/src/App.js`).

- **Faltam telas**: usuários, depósitos/categorias/templates, detalhe de equipamento,
  detalhe de evento, transferência rápida e entre eventos, perfil/troca de senha.
- **UX quebrada**: transferência por ID numérico digitado; depósito fixo 1 no cadastro;
  erro do servidor descartado ao reportar problema (`Equipamentos.js:138` mostra mensagem
  genérica, mas a API exige 10+ caracteres); busca dispara requisição a cada tecla; feedback
  só por `alert()`; não há estado de erro na tela (dashboard falha em silêncio).
- **Estado de sessão**: usuário restaurado do `localStorage` sem revalidar (`AuthContext.js:22`);
  401 leva ao login.
- **Configuração** (verificado 2026-10-14, R-003): `API_URL` padrão `/api` na mesma origem
  (`client/src/services/api.js:4`); `REACT_APP_API_URL` só para API em outro domínio. Em
  desenvolvimento, `/api` depende do campo `proxy` do `client/package.json`.
- **Testes**: nenhum teste de frontend.
- **Etiqueta**: `gerarEtiqueta` devolve uma URL; abri-la direto não envia o token (401). → R-013.
- **Dev server**: `npm run client` falha ao subir (`options.allowedHosts[0] should be a
  non-empty string`, efeito do campo `proxy` no CRA); o build de produção funciona. → R-036.

---

## 6. Infraestrutura

_Última verificação: 2026-10-14 (após R-003)_

- **Deploy**: Vercel (`vercel.json`), `NODE_ENV=production` fixo. Sem acesso ao painel: não
  foi possível verificar variáveis de ambiente, saúde, logs nem o banco. **Bloqueado.**
- **Variáveis**: documentadas em `.env.example` e `DEPLOY.md`, incluindo `REACT_APP_API_URL`
  (opcional, lida no build do client).
- **Containers**: não há (sem Dockerfile).
- **CI**: `.github/workflows/ci.yml` — sintaxe, `npm test`, smoke test SQLite, build do
  cliente e verificação de que o build não contém `localhost:<porta>` (R-003). Último run no `main` verde. Não testa Postgres.
- **Dependabot**: configurado (`.github/dependabot.yml`), ignora majors. PR #16 (patches de
  cors, express-validator, jsonwebtoken, pg) aberto desde 2026-10-06.
- **Logs**: `console.log` por requisição + log JSON de segurança (`services/seguranca.js`).
  Sem agregação/alerta.
- **Rate limit**: memória do processo; na Vercel cada instância conta separado (inferido),
  então o limite real é maior que o configurado.
- **Health**: `GET /health` não consulta o banco.

---

## 7. Segurança

_Última verificação: 2026-10-14_

**Pontos fortes (verificados no código e testes):** JWT com algoritmo fixo e segredo
obrigatório em produção; bcrypt com comparação em tempo constante e hash fictício contra
enumeração; política de senha; cadastro fechado após o primeiro usuário; queries
parametrizadas (nenhuma concatenação de entrada em SQL); escape + CSP na etiqueta HTML;
cabeçalhos de segurança; log de acessos negados; seed demo desligado em produção.

**Achados:**

| Achado | Severidade | Evidência |
|---|---|---|
| Token continua válido após desativar usuário ou mudar perfil (até 24h) | Médio | `middleware/auth.js:11` não consulta o banco |
| Token em `localStorage` (exposto a XSS, se houver) | Baixo | `AuthContext.js:34` |
| Rate limit em memória ineficaz em serverless | Médio | `middleware/rateLimiter.js` |
| CORS aberto se `CORS_ORIGIN` não definido | Baixo | `config.js:28` (há aviso no log) |
| `tar` crítico via `sqlite3` (afeta instalação, não o runtime) | Médio | `npm audit` |
| 101 vulnerabilidades na cadeia do `react-scripts` (build) | Médio | `npm audit` no client; CRA está descontinuado |
| Tabelas sem RLS se o Postgres for Supabase | A verificar | ver seção 3 |
| Segredos no repositório/histórico | Nenhum encontrado | busca no `git log -p` por URLs com senha, JWT e chaves |

---

## 8. Qualidade

_Última verificação: 2026-10-14_

- **Testes**: 112 testes de integração do backend, todos passando; cobrem auth, perfis,
  equipamentos, eventos, transferências, dashboard, config, cabeçalhos, segurança, TLS.
  Sem testes de frontend, sem testes contra Postgres.
- **Dívida técnica**: sem transações; schema sem migrations; CRA descontinuado; `alert()`
  como feedback; controllers longos (`transferenciasController.js` 758 linhas).
- **Código morto**: funções do `api.js` sem uso na tela (ver seção 2); `authLimiter`
  importado sem uso em `index.js`; `transferencias.buscarPorId`.
- **Documentação obsoleta**: `MELHORIAS_SUGERIDAS.md` e `GUIA_IMPLEMENTACAO_RAPIDA.md`
  descrevem problemas já corrigidos (ex.: N+1 em `listar`, hoje resolvido em
  `equipamentosController.js:111`).
- **PRs abertos**: #8 ("Add comprehensive documentation and agent/skill framework", de
  2026-10-06) e #16 (Dependabot).

---

## 9. Pendências explícitas

_Última verificação: 2026-10-14_

- `TODO`/`FIXME`/`HACK` no código: nenhum.
- Mocks: só nos testes (`auth.test.js:198`).
- Dados fictícios: seed demo (ver seção 3) e credenciais de teste exibidas no login apenas no
  build de desenvolvimento (`Login.js` linha do `process.env.NODE_ENV === 'development'`).
- Itens "futuros" do README: relatórios, exportação, reservas, app mobile, calendário,
  manutenção preventiva, fotos, custos.
