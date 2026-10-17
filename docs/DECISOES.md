# Decisões Técnicas

Registro **vivo** das decisões técnicas e seus motivos. Formato: ID, data, decisão, motivo,
consequências. Decisões anteriores a este registro foram reconstruídas a partir do código e
dos commits (marcadas como "retroativa").

---

## D-001 — Documentação viva em /docs
- **Data**: 2026-10-14
- **Decisão**: o estado do sistema vive em `docs/AUDITORIA.md`, as tarefas em
  `docs/ROADMAP.md`, as mudanças em `docs/CHANGELOG.md` e as decisões aqui. Toda tarefa
  concluída atualiza ROADMAP, CHANGELOG e a seção afetada da AUDITORIA na mesma entrega.
- **Motivo**: o levantamento evolui com a implementação; um relatório estático fica obsoleto
  (como já aconteceu com `MELHORIAS_SUGERIDAS.md`).
- **Consequências**: regras gravadas no `CLAUDE.md` para valer em toda sessão.

## D-002 — Como medir o percentual de conclusão {#d-002}
- **Data**: 2026-10-14
- **Decisão**: percentual = (itens Pronto + 0,5 × itens Parcial) / total de itens do inventário
  de funcionalidades (AUDITORIA, seção 2). Pendente e Bloqueado contam zero.
- **Motivo**: simples de recalcular e verificável; evita "sensação" de progresso.
- **Consequências**: ao concluir uma tarefa, reclassificar os itens F-xx afetados e recalcular.

## D-003 — Identificadores
- **Data**: 2026-10-14
- **Decisão**: funcionalidades `F-xx`, tarefas do roadmap `R-xxx` (faixas por fase: 0xx, 01x,
  02x, 03x), decisões `D-xxx`. IDs nunca são reutilizados.
- **Motivo**: permitir referência estável entre os quatro documentos, commits e PRs.

## D-004 — Auditoria baseada em código enquanto a infra estiver inacessível
- **Data**: 2026-10-14
- **Decisão**: itens que dependem da produção (Vercel, banco) ficam `Bloqueado` até haver
  acesso; nada de produção é marcado como verificado por inferência.
- **Motivo**: nenhum dos projetos Supabase acessíveis contém este sistema e não há conector da
  Vercel nesta sessão.

## D-005 — Status do equipamento é derivado (retroativa)
- **Decisão**: `em_uso`, `transferencia` e `com_problema` são calculados a partir de eventos,
  transferências e problemas (`server/services/equipamentoStatus.js`); só `disponivel` e
  `manutencao` são manuais.
- **Motivo**: controllers sobrescrevendo o status deixavam equipamentos em estados errados.

## D-006 — Dois drivers de banco (retroativa)
- **Decisão**: Postgres com `DATABASE_URL`, SQLite sem; SQL escrito para rodar nos dois.
- **Motivo**: desenvolvimento sem infraestrutura e produção na Vercel (sem disco persistente).
- **Consequências**: todo schema novo em `schema.sql` e `schema.pg.sql`; Postgres precisa de
  teste próprio (R-006).

## D-007 — Cadastro fechado após o primeiro usuário (retroativa)
- **Decisão**: `POST /api/auth/register` só é aberto em banco vazio (com `BOOTSTRAP_TOKEN`
  opcional); depois, só coordenador autenticado cadastra.
- **Motivo**: impedir que qualquer pessoa crie conta de coordenador.

## D-008 — Seed de demonstração só em desenvolvimento (retroativa)
- **Decisão**: usuários e equipamentos de exemplo só com `NODE_ENV=development|test` ou
  `SEED_DEMO_DATA=true`.
- **Motivo**: senhas conhecidas não podem existir em produção.
- **Consequências**: o catálogo de categorias/templates/depósitos, que estava no mesmo seed,
  sumiu de produção — origem do item R-001.

## D-009 — Catálogo básico separado do seed de demonstração
- **Data**: 2026-10-14
- **Decisão**: categorias, templates com checklist e o "Depósito Central" são criados em todo
  banco por `server/database/catalogo.js`, independentemente de `SEED_DEMO_DATA`. Cada tabela só
  é preenchida enquanto está **vazia**, com um único INSERT de várias linhas.
- **Motivo**: sem esse catálogo o sistema não funciona em produção (R-001). Preencher só a tabela
  vazia evita recriar a cada reinício o que o coordenador editar ou apagar depois; o INSERT único
  não deixa a tabela pela metade se a conexão cair.
- **Consequências**: sem restrição de unicidade, dois cold starts simultâneos em banco vazio podem
  duplicar o catálogo; quando houver migrations (R-008), o catálogo vira uma migração de dados que
  roda uma vez. O seed de demonstração referencia categorias e depósitos pelo nome.
  _Atualizado em 2026-10-17 (R-008, D-015)_: o catálogo continua fora das migrações (só preenche
  tabela vazia), mas roda com exclusividade entre instâncias e numa transação, o que já impede a
  duplicação.

## D-010 — API na mesma origem por padrão no client
- **Data**: 2026-10-14
- **Decisão**: sem `REACT_APP_API_URL`, o client chama `/api` relativo. Na Vercel o
  `vercel.json` encaminha `/api/*` para o servidor; em desenvolvimento, o `proxy` do CRA.
  `REACT_APP_API_URL` fica só para uma API em outro domínio.
- **Motivo**: o padrão antigo (`http://localhost:3001/api`) fazia o site publicado chamar a
  máquina de quem o abria (R-003). Mesma origem também dispensa CORS no deploy padrão.
- **Consequências**: o dev server depende do campo `proxy` (cuidado em R-036); testar o build
  servido à parte exige gerar com `REACT_APP_API_URL` apontando para a API local; o CI falha se
  o build publicado contiver `localhost` com porta.

## D-011 — Sessão conferida no banco a cada requisição
- **Data**: 2026-10-15
- **Decisão**: o `authMiddleware` busca o usuário do token no banco (ativo) e usa os dados de lá
  (inclusive o perfil) em `req.user`; o JWT só prova a identidade.
- **Motivo**: sem isso, desativar um usuário ou mudar seu perfil só valia no próximo login (até
  24h); um coordenador desativado podia desativar os demais com o token antigo (R-023).
- **Consequências**: uma consulta por chave primária em cada requisição autenticada; erro de
  banco vira 500 (falha fechada). Troca de senha ainda não derruba outras sessões (R-038).

## D-012 — Erros de formulário em rotas autenticadas respondem 400, não 401
- **Data**: 2026-10-15
- **Decisão**: 401 significa sessão inválida (o client desloga). Um dado errado do formulário,
  como a senha atual na troca de senha, responde 400.
- **Motivo**: um erro de digitação não pode encerrar a sessão de quem está logado.

## D-013 — Testes em Postgres com um banco por arquivo
- **Data**: 2026-10-16
- **Decisão**: com `TEST_DATABASE_URL`, cada arquivo de teste (processo próprio no `node --test`)
  cria um banco `teste_<pid>_<hora>` e o apaga no fim. No CI, o mesmo job do backend roda a suíte
  em SQLite e depois em Postgres 16 (service container).
- **Motivo**: isolamento igual ao do SQLite temporário sem mudar os testes, que rodam em paralelo
  e contam com ids do seed; schema por arquivo exigiria mexer no `search_path` de toda conexão.
- **Consequências**: a URL precisa de permissão para criar bancos; os testes em processo filho
  (config/seed) seguem em SQLite.

## D-015 — Migrações em pares de arquivos SQL, serializadas por advisory lock
- **Data**: 2026-10-17
- **Decisão**: o schema vive em `server/database/migracoes/NNN_nome.sql` (SQLite) e
  `NNN_nome.pg.sql` (Postgres). `migracoes.js` aplica as pendentes em ordem e registra a versão
  na tabela `migracoes`; falta de um dos dois arquivos é erro na subida. Migrações, catálogo e seed
  rodam dentro de `comExclusividade` (`db.js`), numa transação só: no Postgres, com
  `pg_advisory_xact_lock` e `lock_timeout` de 20s; no SQLite, `BEGIN IMMEDIATE` e uma fila em
  memória. O antigo
  `schema.sql`/`schema.pg.sql` virou a `001_schema_inicial`, que mantém o `IF NOT EXISTS` para
  bancos criados antes das migrações. Sem biblioteca de migração.
- **Motivo**: o DDL a cada cold start não acrescentava coluna a tabela existente e corria entre
  instâncias (R-008). Dois arquivos por versão seguem a regra de SQL escrito para cada driver. O
  lock de **transação** (não o de sessão) funciona atrás do pooler do Supabase em modo transação
  (porta 6543, a que o DEPLOY.md recomenda) e é solto no COMMIT/ROLLBACK ou se a conexão cair; o
  `lock_timeout` impede que uma instância travada congele as outras (a espera falha com 500 e a
  próxima requisição tenta de novo). Tudo numa transação: uma falha no meio do seed ou de uma
  migração não deixa o banco pela metade. Uma lib (knex, node-pg-migrate) traria dependência para algo de ~60 linhas.
- **Consequências**: mudança de schema = nova migração com os dois arquivos, nunca editar uma já
  aplicada. Os comandos são separados por `;` (sem `;` dentro de strings ou funções); SQL sem
  parâmetros vai ao Postgres sem conversão de `?`. A
  `001` não é reaplicada, então um banco antigo com colunas faltando precisa de migração própria
  (R-042). O `index.js` memoriza a inicialização, e requisições simultâneas no cold start esperam
  a mesma.
