---
name: novo-endpoint
description: Cria ou altera um endpoint da API (rota, validator, controller, cliente do front e doc) seguindo as convenções do projeto. Use ao adicionar qualquer rota em server/.
---
# Novo endpoint

1. **Regra de negócio**: confirme em `docs/REGRAS_DE_NEGOCIO.md` quem pode fazer o quê e quais transições de estado são válidas.
2. **Schema**: se precisar de tabela/coluna, use a skill `migracao-banco` primeiro.
3. **Validator** (`server/validators/<dominio>Validator.js`), no padrão de `equipamentoValidator.js`: array de `body/param/query(...)` + `validate`.
4. **Controller** (`server/controllers/<dominio>Controller.js`), método `async (req, res)`:
   - `try/catch`; erro inesperado → `console.error` + `500 { error }`.
   - Buscar o recurso → `404` se não existe.
   - **Autorização**: papel (`req.user.tipo`) e/ou vínculo (`req.user.id` é solicitante/responsável/coordenador). Nunca confiar em IDs do body sem validar.
   - SQL com `?`; portável SQLite/Postgres; `IN` com um `?` por item.
   - Passos múltiplos: ordem segura (validar tudo antes de escrever) e registrar `historico_movimentacoes` quando muda localização/status de equipamento.
   - Notificações via `services/notificacoes.js`.
5. **Rota** em `server/routes/index.js` com `authMiddleware` (+ `checkRole` se for só de um papel). **Rotas literais antes de `/:id`.**
6. **Cliente**: função em `client/src/services/api.js` no objeto do domínio.
7. **Docs**: linha em `docs/API.md` (e regras novas em `REGRAS_DE_NEGOCIO.md`).
8. **Verificar**: `node --check` nos arquivos; subir servidor em porta livre; `curl` com token do login seed cobrindo: sucesso, 400 (validação), 401 (sem token), 403 (papel/vínculo errado), 404.

Resposta de sucesso: `201 { message, id }` para criação; `200 { message }` ou o recurso nos demais casos.
