# Guia de Deploy na Vercel

Este projeto está configurado para deploy automático na Vercel.

## Estrutura do Projeto

- **Backend**: Node.js/Express em `/server` - deployado como serverless function
- **Frontend**: React em `/client` - deployado como site estático
- **Banco de Dados**: SQLite (desenvolvimento) / Recomendado usar DB externo em produção

## Deploy Automático

Pushes para o branch `main` fazem deploy automático para produção.

## Configuração de Variáveis de Ambiente

### No Painel da Vercel

1. Acesse seu projeto no dashboard da Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:

```
NODE_ENV=production
JWT_SECRET=seu_secret_jwt_super_seguro_aqui
PORT=3001
```

### Opcional - Banco de Dados Externo

Para produção, é **altamente recomendado** usar um banco de dados externo ao invés de SQLite:

#### Opção 1: Vercel Postgres
```
POSTGRES_URL=sua_connection_string_aqui
```

#### Opção 2: PlanetScale (MySQL)
```
DATABASE_URL=sua_connection_string_aqui
```

#### Opção 3: MongoDB Atlas
```
MONGODB_URI=sua_connection_string_aqui
```

## Arquivos de Configuração

### `vercel.json`
Define como a Vercel deve fazer build e rotear as requisições:
- Backend em `/api/*` → serverless function
- Frontend em `/*` → arquivos estáticos

### `.vercelignore`
Define quais arquivos não devem ser enviados no deploy (node_modules, .env, etc)

## Limitações do SQLite em Serverless

⚠️ **IMPORTANTE**: SQLite em ambiente serverless (Vercel) tem limitações:

1. **Filesystem efêmero**: Os dados do SQLite não persistem entre invocações
2. **Cold starts**: Cada invocação pode inicializar um novo container
3. **Sem estado compartilhado**: Múltiplas instâncias não compartilham o mesmo arquivo

### Solução Recomendada para Produção

Migre para um banco de dados externo:

1. **Vercel Postgres** (recomendado para Vercel)
   - Integração nativa
   - Configuração automática
   - https://vercel.com/docs/storage/vercel-postgres

2. **PlanetScale** (MySQL serverless)
   - Gratuito até 5GB
   - Branching de banco de dados
   - https://planetscale.com/

3. **Supabase** (PostgreSQL)
   - Gratuito até 500MB
   - API REST automática
   - https://supabase.com/

4. **MongoDB Atlas**
   - Gratuito até 512MB
   - Bom para dados não estruturados
   - https://www.mongodb.com/atlas

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

### Erro de banco de dados em produção
- SQLite não funciona bem em serverless
- Migre para um banco de dados externo (veja acima)

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

## Rollback

Se algo der errado:
1. Dashboard da Vercel → **Deployments**
2. Encontre o deployment anterior que funcionava
3. Clique nos 3 pontos → **Promote to Production**

## Recursos Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Vercel Build Configuration](https://vercel.com/docs/build-step)
