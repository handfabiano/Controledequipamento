# Sistema de Gestão de Equipamentos de Som e Iluminação

Sistema completo para controle e gestão de equipamentos de som e iluminação para eventos, com recursos de rastreamento, transferências com aprovação tripla e checklists automáticos.

## Funcionalidades Principais

### 1. Gestão de Equipamentos
- **Sistema de Código Único:** Formato XXX0000 (3 letras + 4 números)
  - Exemplos: MIC0001, CAI0025, MES0003, PAR0012
  - Geração automática por prefixo ou manual
  - Validação de formato e unicidade
- **QR Code e Etiquetas:**
  - Geração automática de QR Code por equipamento
  - Etiquetas prontas para impressão (10cm x 5cm)
  - Scanner via app mobile para identificação rápida
  - Tombamento interno para rastreamento administrativo
- Cadastro completo com categoria, marca e modelo
- Controle de status (disponível, em uso, manutenção, com problema, transferência)
- Controle de condição (excelente, bom, regular, ruim, quebrado)
- Sistema de reporte de problemas com níveis de gravidade
- Histórico completo de movimentações
- Múltiplos depósitos

### 2. Sistema de Transferências com Aprovação Tripla
- Transferência de equipamentos entre depósitos, eventos ou responsáveis
- **Transferências entre Eventos Simultâneos:**
  - Validação automática de eventos acontecendo ao mesmo tempo
  - Transferência urgente de equipamentos entre locais diferentes
  - Sistema de aprovação tripla aplicado
- **Aprovação em 3 etapas:**
  1. **Coordenador:** Aprova a transferência
  2. **Responsável pela Entrega:** Confirma a retirada/entrega
  3. **Responsável pelo Recebimento:** Confirma o recebimento
- Transferências rápidas entre responsáveis no mesmo evento
- Rastreamento completo do status de cada transferência
- Cancelamento com justificativa

### 3. Gestão de Eventos
- Criação de eventos com templates predefinidos
- Templates por tamanho (pequeno, médio, grande, extra grande)
- **Sistema de Checklist Automático:**
  - Valida se todos os equipamentos obrigatórios foram incluídos
  - Alerta sobre itens faltantes antes de aprovar o evento
  - Previne esquecimentos e garante qualidade
- Múltiplos responsáveis por área (som, iluminação, palco, etc.)
- Alocação de equipamentos por evento
- Controle de status do evento

### 4. Controle de Problemas
- Reporte detalhado de problemas em equipamentos
- Níveis de gravidade (baixa, média, alta, crítica)
- Atualização automática do status do equipamento
- Histórico de todos os problemas
- Marcação de resolução de problemas

## Tecnologias Utilizadas

### Backend
- Node.js
- Express.js
- PostgreSQL em produção (via `DATABASE_URL`) / SQLite em desenvolvimento
- JWT (autenticação)
- Bcrypt (hash de senhas)

### Frontend
- React 18
- React Router DOM
- Axios
- CSS Modules

## Instalação

### Pré-requisitos
- Node.js 14+ e npm instalados

### Passo a Passo

1. **Clone o repositório:**
```bash
git clone <url-do-repositorio>
cd Esporte
```

2. **Instale as dependências do backend:**
```bash
npm install
```

3. **Instale as dependências do frontend:**
```bash
cd client
npm install
cd ..
```

4. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```
Edite o arquivo `.env` e configure:
- `PORT`: Porta do servidor (padrão: 3001)
- `JWT_SECRET`: Chave secreta para JWT (mude em produção!)

5. **Inicie o servidor:**
```bash
npm run dev
```

6. **Em outro terminal, inicie o cliente:**
```bash
cd client
npm start
```

7. **Acesse o sistema:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

## Credenciais de Teste

Com `NODE_ENV=development` (já definido por `npm run dev`) ou com `SEED_DEMO_DATA=true`, o
sistema insere usuários de teste no primeiro boot em banco vazio. **Sem `NODE_ENV` e em produção
o seed fica desativado** — o primeiro usuário se registra via API e, a partir daí, apenas
coordenadores podem registrar novos usuários (ver `DEPLOY.md`).

| Email | Senha | Tipo |
|-------|-------|------|
| coordenador@sistema.com | 123456 | Coordenador |
| joao@sistema.com | 123456 | Responsável pela Entrega |
| maria@sistema.com | 123456 | Responsável pelo Recebimento |
| pedro@sistema.com | 123456 | Técnico |

## Estrutura do Projeto

```
Esporte/
├── server/                     # Backend
│   ├── controllers/           # Controladores da API
│   │   ├── authController.js
│   │   ├── equipamentosController.js
│   │   ├── transferenciasController.js
│   │   └── eventosController.js
│   ├── database/              # Banco de dados
│   │   ├── schema.sql         # Schema do banco
│   │   └── init.js            # Inicialização e dados de exemplo
│   ├── middleware/            # Middlewares
│   │   └── auth.js            # Autenticação
│   ├── routes/                # Rotas da API
│   │   └── index.js
│   └── index.js               # Servidor principal
├── client/                    # Frontend React
│   ├── public/
│   └── src/
│       ├── components/        # Componentes React
│       │   └── Layout.js
│       ├── context/           # Context API
│       │   └── AuthContext.js
│       ├── pages/             # Páginas
│       │   ├── Login.js
│       │   ├── Dashboard.js
│       │   ├── Equipamentos.js
│       │   ├── Transferencias.js
│       │   └── Eventos.js
│       ├── services/          # Serviços
│       │   └── api.js         # Cliente da API
│       ├── App.js
│       └── index.js
├── package.json
└── README.md
```

## API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro de novo usuário
- `GET /api/auth/me` - Dados do usuário logado

### Equipamentos
- `GET /api/equipamentos` - Listar equipamentos (com filtros)
- `GET /api/equipamentos/:id` - Buscar equipamento por ID
- `POST /api/equipamentos` - Criar equipamento
- `PUT /api/equipamentos/:id` - Atualizar equipamento
- `POST /api/equipamentos/:id/problemas` - Reportar problema
- `PUT /api/equipamentos/:id/problemas/:problemaId/resolver` - Resolver problema
- `GET /api/equipamentos/categorias` - Listar categorias
- `GET /api/equipamentos/:id/qrcode` - QR Code do equipamento (tombamento)
- `GET /api/equipamentos/:id/etiqueta` - Etiqueta HTML para impressão

### Transferências
- `GET /api/transferencias` - Listar transferências
- `GET /api/transferencias/:id` - Buscar transferência por ID
- `POST /api/transferencias` - Criar transferência
- `POST /api/transferencias/:id/aprovar` - Aprovar transferência
- `POST /api/transferencias/:id/cancelar` - Cancelar transferência
- `POST /api/transferencias/rapida` - Transferência rápida entre responsáveis (mesmo evento)
- `POST /api/transferencias/entre-eventos` - Transferência entre eventos simultâneos

### Eventos
- `GET /api/eventos` - Listar eventos
- `GET /api/eventos/:id` - Buscar evento por ID
- `POST /api/eventos` - Criar evento
- `POST /api/eventos/:id/equipamentos` - Adicionar equipamentos ao evento
- `GET /api/eventos/:id/validar-checklist` - Validar checklist do evento
- `PUT /api/eventos/:id/status` - Atualizar status do evento
- `GET /api/eventos/templates` - Listar templates de eventos

### Dashboard
- `GET /api/dashboard/resumo` - Contagens de equipamentos por status, transferências pendentes, eventos ativos e atividades recentes (calculado no banco)

### Notificações
- `GET /api/notificacoes` - Listar minhas notificações
- `GET /api/notificacoes/nao-lidas/count` - Contador de não lidas
- `PUT /api/notificacoes/:id/ler` - Marcar como lida
- `PUT /api/notificacoes/ler-todas` - Marcar todas como lidas

## Fluxos de Trabalho

### Status do equipamento

O status é **derivado** pelo sistema (ver `server/services/equipamentoStatus.js`), nunca
sobrescrito "na mão" pelos fluxos. Prioridade:

1. problema grave (alta/crítica) não resolvido → `com_problema`
2. transferência em andamento → `transferencia`
3. alocado em evento planejado/aprovado/em andamento → `em_uso`
4. caso contrário → `disponivel`

`manutencao` é a única definição manual (via `PUT /api/equipamentos/:id`) e nunca é
sobrescrita automaticamente; voltar para `disponivel` recalcula o status real.

### Fluxo de Transferência

1. **Solicitação:** qualquer usuário solicita; o equipamento passa a `transferencia`.
   Um equipamento só pode ter uma transferência ativa por vez.
2. **Três aprovações, em qualquer ordem** (exceto: o recebimento exige a entrega antes):
   - **Coordenador** (`aprovada_coordenador`)
   - **Responsável pela entrega** (com o coordenador também aprovado → `em_transito`)
   - **Responsável pelo recebimento**
3. **Conclusão:** quando as três estão dadas, em qualquer ordem, a transferência vai para
   `concluida`, o equipamento muda de depósito e o histórico é registrado.
4. **Quem aprova:** com responsável designado, só ele; sem designado (o caso da tela de
   solicitação), o perfil correspondente (`responsavel_entrega`/`responsavel_recebimento`)
   ou um coordenador. Cada etapa só pode ser aprovada uma vez.
5. **Quem vê:** coordenadores veem todas; os demais veem as em que estão envolvidos, e os
   responsáveis de entrega/recebimento também as que ainda não têm responsável designado.
6. **Cancelar:** coordenador ou solicitante; devolve ao equipamento o status real.

### Fluxo de Evento com Checklist

1. **Criação:** template (opcional), datas (fim ≥ início), local e responsáveis.
2. **Alocação de equipamentos:** só a equipe do evento (coordenadores, criador e
   responsáveis cadastrados). O lote inteiro é validado antes de gravar: precisam estar
   `disponivel` (não aceita manutenção, com problema, em transferência ou em outro evento).
3. **Checklist:** `GET /api/eventos/:id/validar-checklist` mostra o que falta; a aprovação
   é recusada enquanto faltarem itens obrigatórios do template.
4. **Status** (`PUT /api/eventos/:id/status`): `planejamento → aprovado → em_andamento →
   concluido`, com `cancelado` possível antes do fim. Só coordenadores aprovam, iniciam e
   concluem; coordenador **ou o criador** pode cancelar. `concluido` e `cancelado` são finais.
5. **Encerramento:** ao concluir ou cancelar, as alocações são devolvidas e cada equipamento
   volta ao status real (disponível, com problema, em transferência ou manutenção).

## Banco de Dados

### Principais Tabelas

- **usuarios**: Usuários do sistema
- **depositos**: Depósitos de armazenamento
- **categorias_equipamentos**: Categorias (som, iluminação, palco)
- **equipamentos**: Cadastro de equipamentos
- **problemas_equipamentos**: Problemas reportados
- **templates_eventos**: Templates de eventos
- **checklist_template**: Itens do checklist por template
- **eventos**: Eventos cadastrados
- **responsaveis_evento**: Responsáveis por área do evento
- **equipamentos_evento**: Equipamentos alocados no evento
- **transferencias**: Transferências de equipamentos
- **historico_movimentacoes**: Histórico completo de movimentações

## Segurança

- Autenticação via JWT; e-mails comparados sem diferenciar maiúsculas/minúsculas
- Senhas criptografadas com bcrypt; novas senhas: mínimo de 8 caracteres (máx. 72 bytes) e sem senhas
  comuns/previsíveis (`server/services/senhas.js`)
- Conexão com o Postgres via TLS; `DATABASE_SSL_VERIFY=true` passa a verificar o certificado do servidor
- Primeiro cadastro (banco vazio) protegido por `BOOTSTRAP_TOKEN` opcional (cabeçalho `X-Bootstrap-Token`)
- Middleware de autenticação em todas as rotas protegidas
- Autorização no servidor por perfil e por envolvimento (transferências, eventos). Cadastrar/editar
  equipamentos, resolver problemas e criar eventos: só coordenador e responsáveis (entrega e
  recebimento); o técnico vê tudo, reporta problemas e atua nas transferências/eventos em que está envolvido
- Rate limit por IP (`RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX`); atrás de proxy/Vercel o IP
  real exige `TRUST_PROXY` (padrão: 1 hop na Vercel)
- HTML gerado (etiquetas) com escape dos dados e Content-Security-Policy
- Cabeçalhos de segurança na API (`server/middleware/cabecalhos.js`) e no SPA (rota catch-all do
  `vercel.json`); `X-Powered-By` desligado
- Log de segurança em JSON, uma linha por evento (`server/services/seguranca.js`): `login_sucesso`,
  `login_falha`, `usuario_criado` e `acesso_negado` (401/403/429). Sem senhas, tokens nem query string;
  na Vercel aparece nos logs da função

## Testes

```bash
npm test    # testes de integração do backend (node:test, SQLite temporário, sem dependências extras)
```

Cobrem autenticação, equipamentos, transferências, eventos, dashboard e configuração.
O CI roda `npm test` e o build do frontend a cada push/PR.

## Próximos Passos / Melhorias Futuras

- [x] Notificações (sino no topo, com polling)
- [x] QR Code para rastreamento rápido (scanner via câmera na página de Equipamentos)
- [x] Banco de dados persistente em produção (Postgres via `DATABASE_URL`)
- [ ] Relatórios e dashboards avançados
- [ ] Exportação de dados (PDF, Excel)
- [ ] Sistema de reservas antecipadas
- [ ] App mobile
- [ ] Integração com calendário
- [ ] Sistema de manutenção preventiva
- [ ] Fotos dos equipamentos
- [ ] Controle de custos e orçamentos

## Desenvolvimento com Claude Code

O arquivo [`CLAUDE.md`](./CLAUDE.md) define como agentes de IA devem trabalhar neste
repositório. A regra principal: **a cada tarefa, inventariar e invocar todos os plugins
e skills disponíveis que se aplicam** (`code-review`, `simplify`, `security-review`,
`run`, `session-start-hook`, etc.), além dos comandos, convenções e do checklist de
validação do projeto (`npm test` + build do client).

### Plugin `sempre-skills`

Para não depender só do `CLAUDE.md`, o repositório traz o plugin
[`plugins/sempre-skills`](./plugins/sempre-skills), que acrescenta essa regra ao prompt de
sistema de toda sessão (hook `prompt.compose`). Instalação, num terminal do Claude Code
(depois que esta branch for para a branch padrão do repositório):

```
/plugin install sempre-skills --marketplace handfabiano/Controledequipamento
```

Testes do plugin: `claude plugin test plugins/sempre-skills`.

## Suporte

Para dúvidas ou problemas, entre em contato ou abra uma issue no repositório.

## Licença

Este projeto está sob a licença ISC.