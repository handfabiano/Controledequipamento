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
