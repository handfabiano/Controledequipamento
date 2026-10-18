# Roadmap de Finalização

Documento **vivo**. Fonte dos itens: [AUDITORIA.md](./AUDITORIA.md). Antes de começar qualquer
tarefa, leia este arquivo e proponha o próximo item da fila (o primeiro `Pendente` da fase mais
baixa cujas dependências estejam `Pronto`).

- **Status**: Pendente · Em andamento · Pronto · Bloqueado
- **Prioridade**: Crítico · Alto · Médio · Baixo
- **Esforço**: P (horas) · M (1–2 dias) · G (3+ dias)
- Um item só vira `Pronto` depois que o critério de pronto foi **verificado** (teste, build ou
  execução), com a data e a evidência registradas no CHANGELOG.
- Achados novos durante o trabalho viram itens novos (próximo ID livre), nunca correções
  silenciosas.

**Conclusão do sistema: 65%** (fórmula em [DECISOES.md](./DECISOES.md#d-002)). Atualizada em 2026-10-18, após R-008 (F-24 Pronto) e R-002 (F-04 e F-06 seguem parciais por templates e prefixo).

---

## Fase 0 — Bloqueadores de lançamento

Sem estes itens o sistema não funciona em produção.

| ID | Tarefa | Status | Prioridade | Esforço | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|
| R-001 | Dados de referência em produção: catálogo inicial (categorias, templates + checklists, um depósito padrão) separado do seed demo, idempotente | Pronto (2026-10-14) | Crítico | P | — | Servidor com `NODE_ENV=production` em banco vazio: `GET /api/equipamentos/categorias` devolve ≥1 item e `POST /api/equipamentos` cria; teste automatizado cobre; rodar duas vezes não duplica |
| R-002 | API e telas de coordenador para depósitos e categorias (listar, criar, editar) | Pronto (2026-10-17) | Alto | M | R-001 | Coordenador cria depósito e categoria pela tela e os vê no cadastro de equipamento; não-coordenador recebe 403; testes de API |
| R-003 | URL da API em produção: padrão relativo `/api` no build, documentar `REACT_APP_API_URL` | Pronto (2026-10-14) | Crítico | P | — | `npm run build` sem a variável não contém `localhost:3001`; DEPLOY.md atualizado |
| R-004 | Gestão de usuários: listar, cadastrar pela tela, desativar, trocar a própria senha | Pronto (2026-10-15) | Alto | M | — | Coordenador cadastra e desativa usuário pela tela; usuário desativado não loga; testes de API para cada rota |
| R-005 | Cadastro de equipamento com opção de código automático por prefixo (a lista de depósitos entrou com R-002) | Pendente | Alto | P | R-002 | Criar com prefixo pela tela gera `XXX0001` |
| R-006 | Suíte de testes também contra Postgres no CI (service container) | Pronto (2026-10-16) | Alto | M | — | Job do CI com Postgres verde rodando `npm test` |
| R-007 | Verificar o deploy real (variáveis na Vercel, banco, `/health`, logs, RLS se for Supabase) | Bloqueado | Crítico | P | acesso do usuário | Checklist de deploy preenchido com evidência; app responde login em produção. **Bloqueio**: falta acesso à Vercel e ao banco de produção |
| R-008 | Migrations versionadas (tabela de controle) no lugar do DDL a cada cold start; inclui rodar o catálogo inicial uma única vez (hoje dois cold starts simultâneos em banco vazio podem duplicá-lo) | Pronto (2026-10-17) | Alto | M | R-006 | Script de migração idempotente nos dois drivers; adicionar coluna nova aplica em banco existente; catálogo semeado uma vez; testado no CI |

## Fase 1 — Fluxos principais completos na tela

| ID | Tarefa | Status | Prioridade | Esforço | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|
| R-010 | Transferência: escolher origem/destino por nome (depósitos, eventos, usuários) e designar responsáveis | Pendente | Alto | M | R-002, R-004 | Nenhum campo de ID numérico na tela; fluxo completo (solicitar → 3 aprovações → concluída) executado no app |
| R-011 | Notificar perfis elegíveis quando a transferência não tem responsável designado | Pendente | Médio | P | — | Teste: criar sem designados notifica coordenadores |
| R-012 | Detalhe do equipamento: histórico, problemas, resolver problema, editar, manutenção | Pendente | Alto | M | — | Cada ação da API F-07/F-08/F-10 acessível pela tela e exercitada no app |
| R-013 | QR Code e etiqueta pela tela, com autenticação (buscar HTML com token) | Pendente | Médio | P | R-012 | Botão imprime etiqueta sem 401 |
| R-014 | Detalhe do evento: equipamentos, responsáveis, transferência rápida e entre eventos | Pendente | Alto | M | R-004 | F-13, F-14, F-19 acessíveis pela tela e exercitadas no app |
| R-015 | Evento: definir responsáveis na criação, editar evento, remover equipamento alocado | Pendente | Médio | M | R-004 | Rotas novas com teste; tela usa |
| R-016 | Feedback de erro: mostrar mensagem do servidor (ex.: reportar problema) e trocar `alert()` por aviso na tela | Pendente | Baixo | P | — | Nenhum `alert()` em `client/src/pages`; erros de validação aparecem com o texto da API |

## Fase 2 — Robustez e segurança

| ID | Tarefa | Status | Prioridade | Esforço | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|
| R-020 | Transações na camada `db.js` e uso nas operações de várias etapas | Pendente | Alto | M | R-006 | Teste que força falha no meio da alocação/encerramento não deixa estado parcial, nos dois drivers |
| R-021 | Garantir no banco uma única transferência ativa por equipamento | Pendente | Médio | P | R-008 | Duas solicitações simultâneas: uma 201, outra 400/409 (teste) |
| R-022 | Ligar `PRAGMA foreign_keys = ON` no SQLite | Pendente | Médio | P | — | Teste: inserir com FK inexistente falha no SQLite |
| R-023 | Token só vale para usuário ativo e com o perfil atual (feito junto com R-004: sem isso, desativar não tirava o acesso) | Pronto (2026-10-15) | Médio | P | R-004 | Teste: desativar usuário invalida o token na próxima requisição |
| R-024 | Rate limit efetivo em serverless (store compartilhado ou limite na borda) | Pendente | Médio | M | R-007 | Limite de login respeitado entre instâncias (ou decisão registrada em DECISOES) |
| R-025 | Fuso horário das datas de evento consistente entre SQLite e Postgres | Pendente | Médio | P | R-006 | Teste de simultaneidade com horários passa nos dois drivers |
| R-026 | `validarChecklist` ignorar alocações devolvidas, igual à aprovação | Pendente | Baixo | P | — | Teste: após devolução, checklist e aprovação concordam |
| R-027 | Dependências: `sqlite3` 6 (tar crítico) e sair do CRA (Vite) | Pendente | Médio | G | — | `npm audit --omit=dev` sem críticas/altas no backend; build do client sem `react-scripts` |
| R-028 | Alocação ciente de datas (reserva por período) | Pendente | Médio | M | R-020 | Equipamento alocado em evento futuro pode ir a outro evento sem sobreposição; teste |
| R-042 | Banco de produção criado antes das migrações: conferir se as tabelas têm todas as colunas da `001_schema_inicial` (o `CREATE TABLE IF NOT EXISTS` antigo nunca acrescentava coluna a tabela já existente) e, se faltar, escrever a migração que completa | Pendente | Médio | P | R-007 | Comparação coluna a coluna registrada no CHANGELOG; banco de produção igual ao de um banco novo |
| R-038 | Trocar a senha encerra as outras sessões (versão de senha no token ou data da troca) | Pendente | Baixo | P | R-008 | Teste: token emitido antes da troca recebe 401; o da sessão atual segue válido ou é reemitido |
| R-039 | API e tela de coordenador para templates de evento e seus checklists (criar, editar) | Pendente | Médio | M | R-002 | Coordenador cria um template com checklist pela tela e o usa ao criar evento; não-coordenador recebe 403; testes de API |
| R-040 | Nome único de depósito e de categoria garantido no banco (índice em `LOWER(nome)`), não só na checagem da API. Atenção: o `LOWER` do SQLite só converte letras ASCII (`LOWER('DEPÓSITO')` dá `depÓsito`), então a chave normalizada deve ser calculada em JS | Pendente | Baixo | P | R-008 | Dois cadastros simultâneos com o mesmo nome: um 201, outro 400 (teste) |
| R-041 | Ids acima do `INTEGER` do Postgres dão 500 nas rotas antigas (ex.: `PUT /api/usuarios/99999999999/ativo`); usar `idValido` de `services/validacao.js` | Pendente | Baixo | P | — | Mesmas rotas respondem 400/404 em SQLite e Postgres (teste) |
| R-029 | Regra de quem pode solicitar transferência (hoje qualquer autenticado) | Pendente | Baixo | P | decisão do usuário | Regra registrada em DECISOES e testada |

## Fase 3 — Qualidade e pós-lançamento

| ID | Tarefa | Status | Prioridade | Esforço | Depende de | Critério de pronto |
|---|---|---|---|---|---|---|
| R-030 | Testes de ponta a ponta do frontend (Playwright: login, cadastro, transferência) | Pendente | Médio | M | Fase 1 | Job no CI verde |
| R-031 | Arquivar documentação obsoleta (`MELHORIAS_SUGERIDAS.md`, `GUIA_IMPLEMENTACAO_RAPIDA.md`) e alinhar README com /docs | Pendente | Baixo | P | — | README aponta para /docs; arquivos obsoletos removidos ou movidos |
| R-032 | Ordenar templates por tamanho real | Pendente | Baixo | P | — | Lista sai pequeno → extra grande |
| R-033 | Relatórios e exportação (Excel/PDF) | Pendente | Médio | G | Fase 1 | Exportar inventário e histórico de um equipamento |
| R-034 | Limpezas: import não usado em `server/index.js`, busca com atraso (debounce), `/health` consulta o banco | Pendente | Baixo | P | — | Lint limpo; `/health` devolve 503 sem banco |
| R-035 | Decidir PRs abertos #8 e #16 | Pendente | Baixo | P | decisão do usuário | PRs fechados ou mesclados |
| R-036 | `npm run client` (dev server do CRA) não sobe: `options.allowedHosts[0] should be a non-empty string` por causa do campo `proxy`. Corrigir sem remover o encaminhamento de `/api` para :3001 (desde R-003 o client depende dele em dev) | Pendente | Médio | P | — | `npm run client` serve a tela em :3000 sem variáveis extras e o login funciona |
| R-037 | Barrar no build um `REACT_APP_API_URL` que aponte para localhost (o CI só vê o build sem a variável; o da Vercel usa as variáveis do painel) | Pendente | Baixo | P | — | `npm run build` com `REACT_APP_API_URL=http://localhost:3001/api` e `NODE_ENV=production` falha com mensagem clara; build local de teste continua possível |

---

## Fila atual

1. **R-005** — código automático por prefixo no cadastro de equipamento (Alto, P, depende de R-002, pronto).
2. **R-007** — aguardando acesso (Vercel e banco de produção).
