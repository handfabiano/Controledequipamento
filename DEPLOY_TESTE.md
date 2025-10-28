# 🚀 DEPLOY DE TESTE - Guia Rápido

## ⚠️ IMPORTANTE: Este é um deploy de TESTE
- ✅ Funcional para testar a aplicação
- ❌ Dados NÃO persistem (SQLite temporário)
- ❌ Dados serão perdidos a cada deploy ou após 15min de inatividade
- 📝 Para produção real, migre para banco persistente depois

---

## PASSO 1: Configurar JWT_SECRET na Vercel

### 1.1 - Copie sua chave secreta:
```
ea55bec6989652f3560ba78bc25a20de6ff41b811c5ee5b53d731a90a47b4fff6b5f4e1ca8988200968ff003d7361d85bca76e90e079b0daed42d915589bb379
```

### 1.2 - Acesse o Dashboard da Vercel:
1. Vá para: https://vercel.com/dashboard
2. Clique no seu projeto **Controledequipamento**
3. Clique em **Settings** (aba superior)
4. No menu lateral esquerdo, clique em **Environment Variables**

### 1.3 - Adicione a variável:
```
Name:  JWT_SECRET
Value: ea55bec6989652f3560ba78bc25a20de6ff41b811c5ee5b53d731a90a47b4fff6b5f4e1ca8988200968ff003d7361d85bca76e90e079b0daed42d915589bb379
```

**Environments (marque):**
- ✅ Production
- ✅ Preview
- ✅ Development

**Clique em "Save"**

---

## PASSO 2: Fazer Merge do Pull Request

### 2.1 - Acesse o Pull Request:
https://github.com/handfabiano/Controledequipamento/pull/new/claude/vercel-config-011CUZXmnRXLdqrEbHvrKbB6

### 2.2 - Crie o Pull Request:
- **Título:** "Configuração completa de deploy Vercel + Correções críticas"
- **Descrição:** (opcional - pode deixar vazio ou copiar abaixo)

```markdown
## Mudanças

✅ Configuração completa para deploy na Vercel
✅ Correção de erros 404 de rotas
✅ Correção de warnings ESLint para build
✅ Configuração de API para produção
✅ Documentação completa

## ⚠️ Deploy de Teste
Este deploy usa SQLite temporário. Dados não persistem.
Para produção, migrar para banco persistente.

## Checklist
- [x] JWT_SECRET configurado na Vercel
- [ ] Banco de dados persistente (próximo passo)
```

### 2.3 - Clique em "Create Pull Request"

### 2.4 - Clique em "Merge Pull Request"

### 2.5 - Confirme com "Confirm Merge"

---

## PASSO 3: Acompanhar o Deploy

### 3.1 - A Vercel vai iniciar deploy automático
- Volte para o dashboard: https://vercel.com/dashboard
- Clique no seu projeto
- Na aba **Deployments**, você verá o build em andamento

### 3.2 - Aguarde o build (leva ~2-5 minutos)
Você vai ver:
```
⏳ Building...
✅ Build Completed
✅ Deployment Ready
```

### 3.3 - Acesse sua aplicação
Clique em "Visit" ou acesse a URL fornecida:
```
https://seu-projeto.vercel.app
```

---

## PASSO 4: Primeiro Acesso - Criar Usuário

A aplicação vai iniciar com banco de dados vazio.

### 4.1 - Crie sua primeira conta:
1. Acesse `/login` ou a raiz do site
2. Procure link "Cadastrar" ou "Registrar"
3. Crie uma conta de usuário

### 4.2 - Se precisar criar dados de teste:
Os usuários padrão do desenvolvimento não existirão em produção.
Você precisará criar manualmente ou ajustar o código de inicialização.

---

## ✅ Testando a Aplicação

### Funcionalidades que devem funcionar:
- ✅ Login/Logout
- ✅ Cadastro de usuários
- ✅ CRUD de equipamentos
- ✅ Transferências
- ✅ Eventos
- ✅ Navegação entre páginas

### Limitações conhecidas:
- ⚠️ Dados desaparecem após ~15min de inatividade
- ⚠️ Dados são perdidos a cada novo deploy
- ⚠️ Cada instância serverless tem seu próprio banco (não compartilhado)

---

## 🐛 Troubleshooting

### Erro: "Invalid token" ou "Unauthorized"
- Verifique se JWT_SECRET está configurado na Vercel
- Limpe localStorage do navegador (F12 → Application → Local Storage → Clear)

### Erro: "Cannot connect to API" ou 404
- Verifique se o build completou com sucesso
- Abra F12 → Console e veja erros
- Verifique se está acessando a URL correta

### Erro no build: "Failed to compile"
- Veja logs no dashboard Vercel
- Provavelmente warnings ESLint novos
- Me avise para corrigir

### Dados desaparecem
- ⚠️ Comportamento esperado com SQLite temporário
- Para persistir dados, migre para banco persistente

---

## 📊 Monitoramento

### Ver logs em tempo real:
1. Dashboard Vercel → seu projeto
2. Aba **Deployments** → clique no deployment ativo
3. Aba **Functions** → veja logs do backend

### Ver métricas:
1. Dashboard Vercel → seu projeto
2. Aba **Analytics** → uso, performance, erros

---

## 🎯 Próximos Passos (Após Testar)

Quando estiver satisfeito com o teste e quiser preparar para produção real:

1. **Escolher banco de dados persistente:**
   - Vercel Postgres (recomendado - integrado)
   - Supabase (PostgreSQL - gratuito)
   - PlanetScale (MySQL - gratuito)
   - MongoDB Atlas (NoSQL - gratuito)

2. **Me avisar** que eu ajudo a:
   - Migrar código do SQLite
   - Ajustar queries SQL
   - Testar localmente
   - Fazer deploy final

3. **Migrar dados** (se houver dados importantes do teste)

---

## 📞 Precisa de Ajuda?

Se algo der errado:
1. Copie a mensagem de erro completa
2. Me envie com contexto (o que estava fazendo)
3. Eu ajudo a resolver!

---

## 🔐 Segurança

**NUNCA compartilhe seu JWT_SECRET!**
- Não cole em chats públicos
- Não commite no git
- Se vazar, gere um novo

---

**Boa sorte com o deploy! 🚀**
