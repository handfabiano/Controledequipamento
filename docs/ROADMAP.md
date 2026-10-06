# Roadmap técnico (priorizado)

Consolida `MELHORIAS_SUGERIDAS.md` e `GUIA_IMPLEMENTACAO_RAPIDA.md` com o estado atual do código.

## P0 — Fundamentos (fazer antes de novas features)
1. **Testes automatizados** (Jest + Supertest no backend; SQLite em memória via `SQLITE_PATH=:memory:`/arquivo temporário). Cobrir auth, autorização de transferências, checklist de eventos. Adicionar job ao CI.
2. **Transações** em `db.js` (`withTransaction`) para: concluir transferência, criar transferência, adicionar equipamentos ao evento.
3. **Autorização**: aprovações exigem responsável designado (rejeitar quando nulo ou exigir coordenador); `checkRole` em escrita de equipamentos/eventos; revisar IDOR.
4. **Corrigir** `transferencias.origem_id NOT NULL` vs `origem_id || null`.
5. `helmet`, `trust proxy`, CORS restrito por padrão em produção.

## P1 — Qualidade e performance
- Eliminar N+1 em `equipamentosController.listar` (problemas ativos em 1 query com `IN` parametrizado).
- Validators para transferências, eventos, notificações e auth.
- Paginação em transferências/eventos/notificações; `PaginationControls` no front.
- Máquina de estados de evento e checagem de conflito de agenda/disponibilidade ao alocar equipamento.
- Migrações versionadas (tabela `schema_migrations`) em vez de apenas `IF NOT EXISTS`.
- Tratamento global de erros e `ErrorBoundary`/toasts no front; remover `window.location` no interceptor.

## P2 — Funcionalidades (do README)
Relatórios/dashboards, exportação PDF/Excel, reservas antecipadas, manutenção preventiva, fotos de equipamentos, custos, integração com calendário, app mobile/PWA.

## P3 — Operação
Logs estruturados, métricas, backups do Postgres, ambientes de preview, rotação de `JWT_SECRET`, refresh tokens.

## Débito de documentação
README ainda cita `cd Esporte` e lista estrutura antiga; `docs/` é a fonte atual — alinhar README.
