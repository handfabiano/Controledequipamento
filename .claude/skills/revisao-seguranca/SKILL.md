---
name: revisao-seguranca
description: Revisão de segurança do diff ou de um módulo (autorização/IDOR, SQL injection, JWT, CORS, rate limit, vazamento de dados). Use antes de merge/deploy ou após mexer em rotas e controllers.
---
# Revisão de segurança

1. Escopo: `git diff origin/main...HEAD` (ou o módulo indicado). Liste rotas tocadas em `server/routes/index.js`.
2. Para cada rota, responda com evidência (arquivo:linha):
   - Autenticada? Papel/vínculo checado? Quem consegue executar sem ser o responsável?
   - IDs do body/params validados e pertencentes ao contexto (IDOR)?
   - Transição de estado permitida a partir do estado atual?
   - SQL parametrizado (inclusive `IN`, `ORDER BY`, `LIKE`)? Nada de template string com entrada do usuário.
   - Resposta vaza `senha`, dados de outros usuários ou stack?
3. Infra: `config.js` (secret), CORS, rate limit, `trust proxy`, SSL do Postgres, `.env` fora do git, seed desligado em produção.
4. Frontend: token em localStorage, `dangerouslySetInnerHTML`, URLs montadas de entrada.
5. `npm audit --omit=dev` (backend) e `cd client && npm audit --omit=dev`; relate somente o relevante.
6. Relatório: tabela `severidade | arquivo:linha | cenário concreto | correção mínima`. Separe **confirmado** de **hipótese**. Se limpo, diga o que foi verificado. Não corrija sem pedido, exceto quando a tarefa for explicitamente "corrigir".
Base: `docs/SEGURANCA.md`.
