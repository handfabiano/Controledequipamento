# ⚠️ CONFIGURAÇÃO CRÍTICA: Variáveis de Ambiente

## 🚨 AÇÃO OBRIGATÓRIA ANTES DO PRIMEIRO USO

Você **DEVE** configurar estas variáveis de ambiente no dashboard da Vercel **ANTES** de usar a aplicação em produção.

---

## Como Configurar no Dashboard da Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione as variáveis abaixo

---

## Variáveis OBRIGATÓRIAS

### 1. `JWT_SECRET` (CRÍTICO - Segurança)

**Descrição:** Chave secreta para assinar tokens JWT de autenticação

**Valor sugerido:** Gere uma string aleatória segura de 64+ caracteres

**Como gerar:**
```bash
# No terminal:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Ou online:
# https://randomkeygen.com/ (use "CodeIgniter Encryption Keys")
```

**Exemplo:**
```
JWT_SECRET=a8f5f167f44f4964e6c998dee827110c03be6c9f871f0b29e2f0e8e7c3c5c8c8d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6
```

**⚠️ IMPORTANTE:**
- **NÃO use o exemplo acima** - gere seu próprio!
- **NÃO compartilhe** este valor
- Se vazar, gere um novo imediatamente e force re-login de todos os usuários

**Escopo:** Production, Preview, Development (use valores diferentes para cada)

---

### 2. ⚠️ PROBLEMA CRÍTICO: Banco de Dados SQLite

**Seu sistema atualmente usa SQLite, que NÃO FUNCIONA em ambiente serverless.**

#### Por que não funciona:
- ✗ Filesystem efêmero (dados são deletados entre invocações)
- ✗ Dados serão perdidos a cada deploy
- ✗ Dados desaparecem após 15 minutos de inatividade
- ✗ Múltiplas instâncias não compartilham o mesmo arquivo

#### Soluções Recomendadas:

##### Opção 1: **Vercel Postgres** (Recomendado)
1. No dashboard Vercel: **Storage** → **Create Database** → **Postgres**
2. Conecte ao seu projeto
3. Variáveis de ambiente são configuradas automaticamente
4. Migre o código para usar PostgreSQL

**Variáveis criadas automaticamente:**
```
POSTGRES_URL
POSTGRES_PRISMA_URL
POSTGRES_URL_NON_POOLING
POSTGRES_USER
POSTGRES_HOST
POSTGRES_PASSWORD
POSTGRES_DATABASE
```

##### Opção 2: **Supabase** (PostgreSQL - Gratuito até 500MB)
1. Crie conta em https://supabase.com
2. Crie um projeto
3. Copie a connection string

**Variável necessária:**
```
DATABASE_URL=postgresql://user:password@host:5432/database
```

##### Opção 3: **PlanetScale** (MySQL - Gratuito até 5GB)
1. Crie conta em https://planetscale.com
2. Crie banco de dados
3. Copie a connection string

**Variável necessária:**
```
DATABASE_URL=mysql://user:password@host/database?ssl={"rejectUnauthorized":true}
```

##### Opção 4: **MongoDB Atlas** (Gratuito até 512MB)
1. Crie conta em https://www.mongodb.com/atlas
2. Crie cluster gratuito
3. Copie a connection string

**Variável necessária:**
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database
```

---

## Variáveis Opcionais

### `PORT`
**Descrição:** Porta do servidor (gerenciada automaticamente pela Vercel)
**Valor padrão:** Gerenciado pela Vercel
**Necessário configurar?** NÃO

---

## Variáveis do Frontend (Build Time)

Estas já estão configuradas no arquivo `client/.env.production`:

### `REACT_APP_API_URL`
**Descrição:** URL da API backend
**Valor configurado:** `/api` (URL relativa - usa mesma origem)
**Necessário configurar?** NÃO (já configurado)

---

## Checklist de Deploy

Antes de fazer deploy em produção:

- [ ] ✅ `JWT_SECRET` configurado no dashboard da Vercel
- [ ] ⚠️ **CRÍTICO:** Banco de dados migrado de SQLite para solução persistente
- [ ] ⚠️ **CRÍTICO:** Código atualizado para usar o novo banco de dados
- [ ] ✅ Testado em Preview deployment
- [ ] ✅ Primeiro usuário admin criado no novo banco
- [ ] ✅ Dados migrados do SQLite (se houver)

---

## Como Verificar se Está Configurado

### 1. JWT_SECRET
```bash
# No dashboard Vercel, em Settings → Environment Variables
# Deve aparecer JWT_SECRET com valor oculto
```

### 2. Banco de Dados
```bash
# Teste fazendo login na aplicação
# Se conseguir fazer login e os dados persistirem após reload, está funcionando
```

---

## Troubleshooting

### "Invalid token" ou "Token expired"
- Verifique se `JWT_SECRET` está configurado
- Verifique se não mudou o JWT_SECRET (isso invalida todos os tokens)

### "Dados desaparecem após alguns minutos"
- Você ainda está usando SQLite
- DEVE migrar para banco de dados externo

### "Cannot read property of undefined" em auth
- JWT_SECRET não está configurado
- Adicione no dashboard da Vercel

---

## Segurança

### ✅ Boas Práticas:
- Use JWT_SECRET diferente para Production, Preview e Development
- Nunca commite `.env` com valores reais no git
- Gere JWT_SECRET com pelo menos 64 caracteres
- Troque o JWT_SECRET se suspeitar de comprometimento

### ⚠️ Nunca Faça:
- Usar o valor padrão "secret_key_change_in_production"
- Compartilhar JWT_SECRET em chats, emails, ou código
- Reusar JWT_SECRET entre projetos
- Usar valores curtos ou previsíveis

---

## Migrando de SQLite

Você precisará:

1. **Escolher um banco de dados** (veja opções acima)
2. **Atualizar dependências** no `package.json`
3. **Modificar** `server/database/init.js`
4. **Atualizar queries** SQL para o novo banco
5. **Testar localmente** antes do deploy
6. **Migrar dados** do SQLite antigo (se necessário)

**Precisa de ajuda?** Avise que posso ajudar a fazer a migração completa.

---

## Suporte

- [Documentação Vercel - Environment Variables](https://vercel.com/docs/environment-variables)
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Best Practices for JWT](https://tools.ietf.org/html/rfc8725)
