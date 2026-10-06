# CLAUDE.md — Sistema de Controle de Equipamentos (Som e Iluminação)

Guia para agentes e desenvolvedores. Documentação detalhada em `docs/`.

## O que é
API REST + SPA para controlar equipamentos de som/iluminação de eventos: cadastro com código `XXX0000`,
QR Code/etiquetas, problemas, transferências com **aprovação tripla**, eventos com **checklist** por template,
notificações. Idioma do domínio, código, mensagens e commits: **português (pt-BR)**.

## Stack
- **Backend** (`server/`): Node 20, Express 4, JWT, bcryptjs, express-validator, express-rate-limit, node-cache, qrcode. CommonJS.
- **Banco**: Postgres (`pg`) se `DATABASE_URL` definido; senão SQLite (`sqlite3`). Mesma interface em `server/database/db.js`.
- **Frontend** (`client/`): React 18 (CRA/react-scripts 5), react-router 6, axios, html5-qrcode. CSS por arquivo (sem framework).
- **Deploy**: Vercel (`vercel.json`) — backend serverless + build estático. CI: `.github/workflows/ci.yml`.

## Comandos
```bash
npm run install:all      # instala raiz + client
npm run dev              # API em :3001 (nodemon, SQLite + seed)
npm run client           # React em :3000 (proxy para :3001)
npm run dev:full         # ambos
npm start                # API sem nodemon
cd client && npm run build
```
Não há suíte de testes automatizada ainda (ver `docs/ROADMAP.md`). Verificação mínima = o que o CI faz:
`node --check` em todo `server/**/*.js`, subir o servidor, `GET /health`, login seed
(`coordenador@sistema.com` / `123456`), e `npm run build` no client.

## Arquitetura (resumo)
`routes/index.js` → middleware (`authMiddleware`, `checkRole`, validators) → `controllers/*` → `database/init` (re-exporta `runAsync/getAsync/allAsync`).
Efeitos colaterais (notificações) em `services/notificacoes.js`. Config sensível em `server/config.js`.
Frontend: `pages/*` consomem `services/api.js` (um objeto por domínio); auth em `context/AuthContext.js`.

## Regras invioláveis
1. **SQL com placeholders `?`** sempre (o driver converte para `$n` no Postgres). Nunca interpolar entrada do usuário.
   Interpolação só de identificadores fixos/whitelisted.
2. **Todo SQL deve funcionar em SQLite E Postgres.** Evitar funções específicas de um dos dois; se inevitável, ramificar por `usePostgres`.
3. **Mudou o schema? Atualize os DOIS arquivos**: `schema.sql` (SQLite) e `schema.pg.sql` (Postgres). Só `CREATE ... IF NOT EXISTS`
   e sem `;` dentro de strings/funções (o `init.js` faz `split(';')`). Mudanças em tabelas existentes exigem migração explícita (ver skill `migracao-banco`).
4. **Autorização no servidor, sempre.** Toda rota de escrita checa papel (`tipo`) e/ou vínculo do usuário com o recurso.
   O histórico de bugs deste repo é majoritariamente de autorização faltando (ver `docs/SEGURANCA.md`).
5. **Rotas específicas antes das parametrizadas** em `routes/index.js` (`/transferencias/rapida` antes de `/transferencias/:id`).
6. **Segredos**: nunca commitar `.env`; `JWT_SECRET` obrigatório em produção; seed de demo desligado em produção.
7. Respostas de erro: `{ error: 'mensagem em pt-BR' }` com status HTTP correto (400/401/403/404/500); `details` em erros de validação.
8. Operações multi-passo (ex.: concluir transferência = atualizar equipamento + histórico + status) hoje **não são transacionais** —
   ao tocar nelas, preserve a ordem existente e documente o risco; não presuma atomicidade.

## Papéis (`usuarios.tipo`)
`coordenador`, `responsavel_entrega`, `responsavel_recebimento`, `tecnico`. Ver matriz em `docs/REGRAS_DE_NEGOCIO.md`.

## Convenções
- Controllers: objeto com métodos `async (req, res)` com `try/catch` e `console.error` + 500 genérico.
- Novos validators em `server/validators/<dominio>Validator.js` no padrão de `equipamentoValidator.js` (array de regras + `validate`).
- Frontend: nova chamada de API vai em `services/api.js`; página nova = `pages/X.js` + `X.css` + rota em `App.js` + link em `Layout.js`.
- Commits em português, no imperativo curto ("Corrigir…", "Adicionar…"). Branch de trabalho conforme instrução da sessão; PR só quando pedido.

## Agentes e skills do projeto (`.claude/`)
Agentes: `arquiteto`, `dev-backend`, `dev-frontend`, `dba`, `revisor-seguranca`, `qa-testes`, `devops`, `documentador`.
Skills: `novo-endpoint`, `nova-pagina-react`, `migracao-banco`, `fluxo-transferencia`, `revisao-seguranca`,
`escrever-testes`, `checklist-deploy`, `atualizar-docs`.
Quando a tarefa casar com um agente/skill, use-o.

## Dívidas conhecidas (não "corrija por tabela" sem pedido)
Sem testes; sem transações; paginação só em `GET /equipamentos`; validators só para equipamentos; `checkRole` existe mas quase não é usado;
CORS aberto se `CORS_ORIGIN` ausente; rate limit em memória (não compartilhado entre instâncias serverless); README cita pasta `Esporte/` (antigo).
