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
- SQLite (banco de dados)
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

O sistema já vem com usuários de teste pré-cadastrados:

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

### Transferências
- `GET /api/transferencias` - Listar transferências
- `GET /api/transferencias/:id` - Buscar transferência por ID
- `POST /api/transferencias` - Criar transferência
- `POST /api/transferencias/:id/aprovar` - Aprovar transferência
- `POST /api/transferencias/:id/cancelar` - Cancelar transferência
- `POST /api/transferencias/rapida` - Transferência rápida entre responsáveis

### Eventos
- `GET /api/eventos` - Listar eventos
- `GET /api/eventos/:id` - Buscar evento por ID
- `POST /api/eventos` - Criar evento
- `POST /api/eventos/:id/equipamentos` - Adicionar equipamentos ao evento
- `GET /api/eventos/:id/validar-checklist` - Validar checklist do evento
- `PUT /api/eventos/:id/status` - Atualizar status do evento
- `GET /api/eventos/templates` - Listar templates de eventos

## Fluxos de Trabalho

### Fluxo de Transferência

1. **Solicitação:**
   - Usuário cria uma nova transferência
   - Equipamento muda status para "transferência"

2. **Aprovação do Coordenador:**
   - Coordenador revisa e aprova
   - Status muda para "aprovada_coordenador"

3. **Confirmação de Entrega:**
   - Responsável pela entrega confirma a retirada
   - Status muda para "em_transito"

4. **Confirmação de Recebimento:**
   - Responsável pelo recebimento confirma
   - Status muda para "concluida"
   - Equipamento atualiza localização

### Fluxo de Evento com Checklist

1. **Criação do Evento:**
   - Selecionar template (opcional)
   - Definir datas e local
   - Adicionar responsáveis

2. **Adição de Equipamentos:**
   - Selecionar equipamentos disponíveis
   - Alocar por área (som, iluminação, etc.)
   - Definir responsável por cada equipamento

3. **Validação do Checklist:**
   - Sistema verifica se todos os itens obrigatórios estão presentes
   - Mostra avisos sobre itens faltantes
   - Previne aprovação se faltar itens obrigatórios

4. **Aprovação:**
   - Coordenador aprova o evento
   - Equipamentos mudam status para "em_uso"

5. **Execução e Conclusão:**
   - Status muda conforme andamento
   - Ao concluir, equipamentos retornam ao depósito

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

- Autenticação via JWT
- Senhas criptografadas com bcrypt
- Middleware de autenticação em todas as rotas protegidas
- Controle de permissões por tipo de usuário

## Próximos Passos / Melhorias Futuras

- [ ] Notificações em tempo real
- [ ] Relatórios e dashboards avançados
- [ ] Exportação de dados (PDF, Excel)
- [ ] Sistema de reservas antecipadas
- [ ] App mobile
- [ ] Integração com calendário
- [ ] QR Code para rastreamento rápido
- [ ] Sistema de manutenção preventiva
- [ ] Fotos dos equipamentos
- [ ] Controle de custos e orçamentos

## Suporte

Para dúvidas ou problemas, entre em contato ou abra uma issue no repositório.

## Licença

Este projeto está sob a licença ISC.