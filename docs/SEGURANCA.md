# Segurança

## Controles existentes
JWT + bcrypt; rate limit global e de login; `JWT_SECRET` obrigatório em produção (`config.js`); CORS configurável (`CORS_ORIGIN`); validação de entrada em equipamentos; SQL parametrizado; seed de demo desligado em produção; registro restrito a coordenadores após o 1º usuário.

## Histórico
Os dois últimos PRs corrigiram falhas de **autorização** (transferências/eventos): ações executadas por quem não era o responsável designado. Padrão recorrente: o endpoint autentica mas não verifica *quem* é o usuário em relação ao recurso.

## Checklist para toda rota nova/alterada
- [ ] Exige `authMiddleware` (exceto login/health)?
- [ ] Verifica papel (`checkRole`) ou vínculo com o recurso (solicitante/responsável/coordenador)?
- [ ] IDs vindos de body/params são validados (inteiro, existe, pertence ao contexto)? Evitar IDOR.
- [ ] SQL 100% parametrizado? (`IN (...)` com lista: gerar `?` por item, nunca `join(',')` de entrada.)
- [ ] Transição de estado válida a partir do estado atual (ex.: não aprovar `cancelada`)?
- [ ] Resposta não vaza `senha`/hash nem dados de terceiros?
- [ ] Mensagens de erro não expõem stack/SQL.
- [ ] Efeitos colaterais (equipamento.status, histórico, notificação) consistentes se algum passo falhar?

## Riscos conhecidos / backlog
1. Aprovações abertas quando `responsavel_*_id` é nulo (qualquer usuário aprova).
2. `checkRole` praticamente sem uso; criar/editar equipamento e evento sem restrição de papel.
3. CORS `*` quando `CORS_ORIGIN` ausente; `ssl.rejectUnauthorized:false` no Postgres.
4. Rate limit em memória (burlável em serverless); `trust proxy` não configurado atrás da Vercel (IP pode ser o do proxy).
5. Token só em `localStorage` (XSS); sem refresh/revogação; sem política de senha além de ≥ 6.
6. Fluxos multi-passo sem transação → estados inconsistentes em falha parcial.
7. Sem headers de segurança (`helmet`) e sem log de auditoria de login.
8. Credenciais de demo `123456` — nunca habilitar `SEED_DEMO_DATA` em produção real.
