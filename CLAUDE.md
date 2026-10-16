# CLAUDE.md — Sistema de Controle de Equipamentos

Instruções para o Claude Code (e qualquer agente) que trabalhe neste repositório.
Este arquivo é lido automaticamente no início de cada sessão.

## Regra nº 1 — Sempre usar todos os plugins e skills disponíveis

**No início de TODA tarefa, antes de escrever código, inventarie o que está disponível e
invoque tudo o que se aplica ao trabalho. Não pule uma skill/plugin porque a tarefa
"parece simples".**

Passo a passo:

1. **Inventário** (a cada sessão — a lista muda):
   - Skills da sessão: as listadas no sistema (ferramenta `Skill`).
   - Skills da conta do usuário: ferramenta `ListSkills`.
   - Plugins habilitados: ferramenta `ListPlugins`. Se estiver vazio ou faltar algo útil,
     procure com `SearchPlugins` / `SearchSkills` e sugira a instalação
     (`SuggestPluginInstall` / `SuggestSkills`) em vez de ignorar.
   - Conectores/MCPs (GitHub, Supabase, Google Drive…): `ListConnectors` — use quando a
     tarefa tocar o serviço correspondente.
2. **Invocar** toda skill/plugin cujo gatilho case com a tarefa, via `Skill`
   (ex.: `/code-review`). "Todos" significa: **nenhum que se aplique pode ficar de fora**.
   Skills de outros formatos (`docx`, `pptx`, `xlsx`, `pdf`, `google-workspace`,
   `computer-use`, navegadores…) são invocadas assim que a tarefa envolver aquele
   formato/ferramenta — por exemplo, exportar relatório de equipamentos para Excel
   aciona `xlsx`.
3. **Registrar**: no resumo final da tarefa, liste quais skills/plugins foram
   invocados e, se alguma disponível ficou de fora, diga por quê.

### Checklist obrigatório para mudanças de código neste projeto

| Momento | Skill | Para quê |
|---|---|---|
| Início de sessão em ambiente novo (cloud) | `session-start-hook` | Garantir que dependências (`npm ci`) estejam instaladas para rodar testes/lint |
| Ao implementar/validar | `run` | Subir o app (servidor + client) e ver a mudança funcionando de verdade |
| Antes de commitar | `simplify` | Reuso, simplificação e eficiência do diff |
| Antes de commitar | `code-review` (nível `high`) | Bugs de correção no diff |
| Antes de commitar (auth, SQL, HTML, uploads, deploy) | `security-review` | Revisão de segurança do branch |
| Ao mexer em hooks/permissões/env do Claude Code | `update-config` | Alterar `settings.json` do jeito suportado |
| Ao criar página/relatório para compartilhar | `artifact-design` / `dataviz` | Dashboards e gráficos |
| Ao usar a API/SDK da Anthropic | `claude-api` | Modelos, parâmetros, caching |

## Regra nº 2 — Documentação viva em `/docs`

O estado do sistema e o plano de finalização vivem em quatro arquivos:
[`docs/AUDITORIA.md`](docs/AUDITORIA.md) (estado atual, com data por seção),
[`docs/ROADMAP.md`](docs/ROADMAP.md) (tarefas com ID, status, prioridade e dependências),
[`docs/CHANGELOG.md`](docs/CHANGELOG.md) (registro datado) e
[`docs/DECISOES.md`](docs/DECISOES.md) (decisões técnicas e motivos).

1. **Antes de começar qualquer tarefa**, leia o `ROADMAP.md` e proponha o próximo item da fila
   (o primeiro `Pendente` da fase mais baixa com dependências prontas).
2. **Ao concluir qualquer tarefa**, na mesma entrega: atualize o status no `ROADMAP.md`, adicione
   uma entrada datada no `CHANGELOG.md` (o quê, por quê, como foi verificado) e atualize a seção
   afetada do `AUDITORIA.md` (com a nova data de verificação e o percentual de conclusão).
3. **Nunca marque algo como pronto sem verificar** (rodar, testar, consultar). A evidência vai no
   `CHANGELOG.md`.
4. **Descobriu algo novo durante o trabalho?** Registre como nova tarefa no `ROADMAP.md` (próximo
   ID livre), em vez de corrigir em silêncio ou ignorar.
5. Escolha técnica relevante (biblioteca, padrão, regra de negócio) vira entrada em `DECISOES.md`.

## Comandos

```bash
npm ci && (cd client && npm ci)   # instalar tudo
npm test                           # testes do backend (node:test, SQLite temporário)
TEST_DATABASE_URL=postgresql://... npm test   # os mesmos testes em Postgres (um banco por arquivo)
npm run dev                        # backend com nodemon (porta 3001)
npm run client                     # frontend (porta 3000)
cd client && npm run build         # build de produção do frontend (CI roda isso)
```

Antes de dar uma tarefa como pronta: `npm test` verde **e** `cd client && npm run build` ok.

## Arquitetura (resumo)

- `server/` — Express. `controllers/` (req/res), `services/` (efeitos colaterais, ex.:
  notificações), `validators/` (express-validator), `middleware/`, `database/`.
- `server/database/db.js` — camada única de acesso com **dois drivers**: Postgres quando
  `DATABASE_URL` existe (produção/Vercel) e SQLite caso contrário. As queries usam
  placeholders `?` (convertidos para `$1…` no Postgres) e `runAsync/getAsync/allAsync`.
- **Todo schema novo deve ser escrito em `schema.sql` (SQLite) E `schema.pg.sql`
  (Postgres).** Escreva SQL que rode nos dois (sem funções exclusivas de um driver).
- `client/` — React (CRA). Chamadas HTTP em `client/src/services/api.js`.
- Deploy na Vercel (`vercel.json`); ver `DEPLOY.md`. SQLite não persiste lá.

## Convenções

- Mensagens de erro e textos de UI em **português**. Respostas de erro: `{ error: '...' }`.
- Autorização é feita **no servidor** (o `canApprove` do client é só UX). Nunca confie em
  ids de usuário vindos do body — use `req.user`.
- Estados de equipamento (`disponivel`, `em_uso`, `transferencia`, `com_problema`,
  `manutencao`) devem permanecer consistentes entre equipamentos, transferências e eventos.
- Sem dependências novas sem necessidade; testes usam apenas `node:test` + `fetch`.
- Não commitar `.env`, `*.db`, `node_modules`, `client/build`.

## Git

- Desenvolva na branch designada para a sessão; **não abra PR a menos que o usuário peça**.
- Commits pequenos, mensagem em português descrevendo o porquê.
