# Guia de Deploy na Vercel

Este projeto está configurado para deploy automático na Vercel.

## Estrutura do Projeto

- **Backend**: Node.js/Express em `/server` - deployado como serverless function
- **Frontend**: React em `/client` - deployado como site estático
- **Banco de Dados**: Postgres via `DATABASE_URL` (produção) / SQLite local (desenvolvimento)

## Deploy Automático

Pushes para o branch `main` fazem deploy automático para produção.

## Configuração de Variáveis de Ambiente

### No Painel da Vercel

1. Acesse seu projeto no dashboard da Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:

```
NODE_ENV=production
JWT_SECRET=seu_secret_jwt_super_seguro_aqui        # OBRIGATÓRIO — o servidor não sobe sem ele em produção
DATABASE_URL=postgresql://usuario:senha@host:5432/banco   # OBRIGATÓRIO para persistir dados
CORS_ORIGIN=https://seu-app.vercel.app             # Recomendado
```

Variáveis opcionais:

```
SEED_DEMO_DATA=true    # Insere usuários/equipamentos de demonstração no primeiro boot (NÃO use em produção real)
PG_POOL_MAX=3          # Tamanho do pool de conexões Postgres
```

## Banco de Dados

O backend escolhe o driver automaticamente:

- **`DATABASE_URL` definido** → Postgres (`pg`), com schema em `server/database/schema.pg.sql`
- **Sem `DATABASE_URL`** → SQLite local em `server/database/equipamentos.db` (apenas desenvolvimento)

⚠️ **SQLite NÃO persiste na Vercel** — o filesystem das functions é efêmero e os dados
são perdidos a cada cold start. Em produção, configure `DATABASE_URL` apontando para
um Postgres gerenciado.

### Onde hospedar o Postgres

1. **Supabase** (PostgreSQL) — gratuito até 500MB — https://supabase.com/
   - Use a connection string do **pooler** (porta 6543), ideal para serverless:
     `postgresql://postgres.<ref>:<senha>@aws-0-<região>.pooler.supabase.com:6543/postgres`
2. **Neon** (PostgreSQL serverless) — https://neon.tech/
3. **Vercel Postgres** — integração nativa — https://vercel.com/docs/storage/vercel-postgres

O schema é criado automaticamente no primeiro boot (`CREATE TABLE IF NOT EXISTS`).

### Primeiro acesso (banco vazio)

Com o banco vazio e `SEED_DEMO_DATA` desativado, o **primeiro usuário** pode se registrar
livremente via `POST /api/auth/register` (bootstrap). A partir do segundo usuário, apenas
coordenadores autenticados podem registrar novos usuários.

## Arquivos de Configuração

### `vercel.json`
Define como a Vercel deve fazer build e rotear as requisições:
- Backend em `/api/*` → serverless function
- Frontend em `/*` → arquivos estáticos

### `.vercelignore`
Define quais arquivos não devem ser enviados no deploy (node_modules, .env, etc)

## Build Local para Testar

```bash
# Instalar dependências
npm install
cd client && npm install && cd ..

# Build do frontend
cd client && npm run build

# Testar localmente
npm start
```

## Troubleshooting

### Build falha com "command not found"
- Verifique se todos os scripts estão definidos no `package.json`
- `vercel-build` deve estar presente em `client/package.json`

### 404 em rotas da API
- Verifique se o `vercel.json` está configurado corretamente
- As rotas `/api/*` devem apontar para `server/index.js`

### "JWT_SECRET não definido" nos logs
- Configure a variável `JWT_SECRET` no painel da Vercel — em produção ela é obrigatória

### Dados somem entre acessos
- Você está sem `DATABASE_URL` (rodando em SQLite efêmero) — configure um Postgres externo

### Frontend não carrega
- Verifique se o build do React foi bem sucedido
- Confirme que `client/build` foi gerado
- Verifique o console do browser para erros

## Monitoramento

Acesse os logs em tempo real:
1. Dashboard da Vercel → seu projeto
2. Aba **Deployments** → clique no deployment
3. Aba **Functions** para logs do backend
4. Aba **Build Logs** para logs de build
