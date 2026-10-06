# Regras de Negócio

## Papéis
| Ação | coordenador | resp. entrega | resp. recebimento | técnico |
|---|:-:|:-:|:-:|:-:|
| Registrar usuário | ✅ | ❌ | ❌ | ❌ |
| Aprovar evento | ✅ | ❌ | ❌ | ❌ |
| Aprovação de coordenador em transferência | ✅ (o designado, se houver) | ❌ | ❌ | ❌ |
| Confirmar entrega | — | ✅ (o designado) | — | — |
| Confirmar recebimento | — | — | ✅ (o designado) | — |
| Cancelar transferência | ✅ | solicitante | solicitante | solicitante |
| Ver transferência | ✅ | envolvido | envolvido | envolvido |
| CRUD equipamentos/eventos | todos autenticados (**hoje sem restrição por papel**) |

> Se `responsavel_*_id` for nulo na transferência, qualquer usuário autenticado consegue dar a respectiva aprovação — ponto a endurecer.

## Equipamento
- Código `XXX0000` único (gerado por prefixo: próximo número do prefixo) + tombamento interno `TOMB-AAAA-NNNNNN` único.
- Status: `disponivel → em_uso` (alocado a evento) · `→ transferencia` (transferência aberta) · `→ com_problema` (problema reportado) · `manutencao` (bloqueia transferência).
- Todo evento relevante grava em `historico_movimentacoes`.

## Transferência com aprovação tripla
```
pendente ──coordenador──► aprovada_coordenador ──entrega (após coord.)──► em_transito ──recebimento (após coord.+entrega)──► concluida
    └──────────────────────────── cancelada (coordenador ou solicitante, exceto se concluida) ◄───────────────┘
```
- Criar: equipamento deve existir e não estar em `manutencao`; equipamento → `transferencia`; notifica coordenador/entrega/recebimento.
- Concluir (recebimento): `equipamentos.deposito_id` = destino (se destino é depósito, senão `NULL`), status `disponivel`, grava `data_conclusao` e histórico.
- Cancelar: equipamento volta a `disponivel` (atenção: ignora status anterior).
- **Rápida** (`/rapida`): troca `equipamentos_evento.responsavel_id`; registra transferência já `concluida`; notifica novo responsável.
- **Entre eventos** (`/entre-eventos`): equipamento precisa estar no evento de origem; ambos eventos `aprovado|em_andamento`; datas devem se sobrepor; segue aprovação tripla; histórico `transferencia_urgente`.
- Notificações: `transferencia_pendente`, `transferencia_atualizada`, `transferencia_cancelada`, `equipamento_recebido`.

## Evento
- Status: `planejamento → aprovado → em_andamento → concluido` (ou `cancelado`). Hoje qualquer valor válido é aceito de qualquer estado (sem máquina de estados rígida).
- Aprovar: só coordenador; se há `template_id`, todo item `obrigatorio` do checklist deve ter `quantidade_minima` atingida (somando `quantidade` por categoria).
- Adicionar equipamentos: cria `equipamentos_evento` e põe equipamento em `em_uso` (sem checar disponibilidade/conflito de agenda — melhoria pendente).
- **Não implementado:** ao concluir/cancelar o evento os equipamentos NÃO voltam a `disponivel` nem ao depósito (o README promete isso). Item de backlog.

## Problemas
`gravidade` baixa|media|alta|critica; reportar → equipamento `com_problema`; resolver marca `resolvido`, `resolvido_por`, `data_resolucao`.

## Auth
bcrypt (10 rounds), JWT 24h com `{id,email,tipo}`, usuário `ativo=1` para logar. Primeiro usuário em banco vazio pode se registrar; seed de demo só fora de produção.
