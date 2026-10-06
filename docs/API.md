# Referência da API

Base: `/api` · Auth: `Authorization: Bearer <jwt>` (24h) · Erros: `{ "error": "msg" }` (+ `details` na validação).
Limites: 100 req/15 min/IP em `/api`; login 5 falhas/15 min.

## Auth
| Método | Rota | Acesso | Notas |
|---|---|---|---|
| POST | `/auth/login` | público | `{email, senha}` → `{token, usuario}` |
| POST | `/auth/register` | 1º usuário livre; depois só coordenador | `{nome,email,senha(≥6),tipo}` |
| GET | `/auth/me` | autenticado | |

## Equipamentos
| Método | Rota | Notas |
|---|---|---|
| GET | `/equipamentos` | filtros `status, categoria_id, deposito_id, search, page, limit(≤100)` |
| GET | `/equipamentos/categorias` | |
| GET | `/equipamentos/tombamento/:tombamento` | formato `TOMB-AAAA-NNNNNN` |
| GET | `/equipamentos/:id` | inclui problemas |
| GET | `/equipamentos/:id/qrcode` | JSON com data URL |
| GET | `/equipamentos/:id/etiqueta` | HTML imprimível (10x5 cm) |
| POST | `/equipamentos` | `nome, categoria_id` + (`codigo` XXX0000 **ou** `prefixo` XXX) |
| PUT | `/equipamentos/:id` | |
| POST | `/equipamentos/:id/problemas` | `descricao(10–500), gravidade` → equipamento vai a `com_problema` |
| PUT | `/equipamentos/:id/problemas/:problemaId/resolver` | |

## Transferências
| Método | Rota | Notas |
|---|---|---|
| GET | `/transferencias?status=` | só as em que o usuário está envolvido |
| POST | `/transferencias` | `equipamento_id, origem_tipo, destino_tipo, destino_id,…`; equipamento → `transferencia` |
| POST | `/transferencias/rapida` | troca de responsável no mesmo evento (sem aprovação) |
| POST | `/transferencias/entre-eventos` | exige eventos aprovados/em andamento **simultâneos** |
| GET | `/transferencias/:id` | envolvidos ou coordenador |
| POST | `/transferencias/:id/aprovar` | `{tipo_aprovacao: coordenador|entrega|recebimento}` |
| POST | `/transferencias/:id/cancelar` | `{motivo}`; coordenador ou solicitante |

## Eventos
| Método | Rota | Notas |
|---|---|---|
| GET | `/eventos` | filtros `status, data_inicio, data_fim` |
| GET | `/eventos/templates` | templates + checklist |
| GET | `/eventos/:id` | com responsáveis e equipamentos |
| POST | `/eventos` | `nome, local, data_inicio, data_fim, template_id?, responsaveis?[]` |
| POST | `/eventos/:id/equipamentos` | `{equipamentos:[{equipamento_id,responsavel_id,area,quantidade}]}` → equipamentos em uso |
| GET | `/eventos/:id/validar-checklist` | |
| PUT | `/eventos/:id/status` | `aprovado` só coordenador e com checklist obrigatório completo |

## Notificações
`GET /notificacoes` · `GET /notificacoes/nao-lidas/count` · `PUT /notificacoes/ler-todas` · `PUT /notificacoes/:id/ler`

## Convenções para novos endpoints
Rota em `routes/index.js` (específicas antes das `/:id`), `authMiddleware`, validator quando houver entrada, checagem de papel/vínculo no controller, resposta de sucesso `{ message, id? }` ou o recurso, erros em pt-BR. Atualize esta doc e `client/src/services/api.js`.
