---
name: fluxo-transferencia
description: Regras e armadilhas do fluxo de transferência com aprovação tripla (criar, aprovar, cancelar, rápida, entre eventos). Use ao tocar em transferenciasController, rotas de transferência ou na tela Transferencias.
---
# Fluxo de transferência

Código: `server/controllers/transferenciasController.js`; UI: `client/src/pages/Transferencias.js`.

## Máquina de estados
`pendente → aprovada_coordenador → em_transito → concluida`; `cancelada` a partir de qualquer não-concluída.
- `coordenador`: só `tipo=coordenador` (e o designado, se `coordenador_id` setado) → `aprovada_coordenador` (+`data_aprovacao`).
- `entrega`: designado → flag; vira `em_transito` só se coordenador já aprovou.
- `recebimento`: designado → se coordenador e entrega já aprovaram: `concluida`, atualiza `equipamentos` (depósito destino, `disponivel`), grava `data_conclusao` e `historico_movimentacoes`.

## Armadilhas (verifique ao alterar)
- `responsavel_*_id`/`coordenador_id` nulos deixam a aprovação **aberta a qualquer usuário** — não piore; prefira corrigir.
- Recebimento sem entrega prévia não conclui, mas o flag é gravado e o status fica inalterado: considere rejeitar fora de ordem.
- Aprovar duas vezes a mesma etapa não é bloqueado.
- `cancelar` devolve o equipamento para `disponivel` ignorando o estado anterior.
- `transferencias.origem_id` é NOT NULL, mas `criar` envia `origem_id || null`.
- Nada é transacional: equipamento/histórico/transferência podem divergir em falha parcial.
- Não há bloqueio de duas transferências ativas para o mesmo equipamento.
- `/rapida` não valida que o solicitante é o responsável atual nem papel; `/entre-eventos` valida simultaneidade por datas.
- Rotas literais (`/rapida`, `/entre-eventos`) devem permanecer antes de `/:id`.

## Ao mudar o fluxo
1. Atualize `docs/REGRAS_DE_NEGOCIO.md` (diagrama e matriz de papéis).
2. Notificações: `transferencia_pendente`, `transferencia_atualizada`, `transferencia_cancelada`, `equipamento_recebido`.
3. Teste cada papel × cada ação (ver `escrever-testes`) incluindo os casos negativos 403/400.
4. Acione `revisor-seguranca` — a maior parte dos bugs passados foi autorização aqui.
