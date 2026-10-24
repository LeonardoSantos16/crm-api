# 0007 — Consistência nas mudanças de etapa

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

Mudar de etapa altera a oportunidade e grava o histórico. Três situações podem deixar os dados inconsistentes:

1. **Escrita parcial:** a etapa muda, mas o registro de histórico não é gravado (ou o contrário).
2. **Corrida:** duas requisições simultâneas leem a mesma etapa de origem, as duas validam a transição e as duas gravam. Por exemplo, uma move para Fechamento e a outra marca como Perdida.
3. **"Salvar e mover":** o diálogo de dados faltantes salva valor e itens e depois move. Se o move falhar, os dados ficariam salvos com a oportunidade parada, o contrário do que o botão promete.

## Decisão

- **Transação única** em toda ação: a atualização da oportunidade e o registro de histórico são gravados juntos ou não são gravados.
- **Update condicional** no `/move` e no `/lose`: a atualização filtra pela etapa lida (`where: { id, stage: fromStage }`). Se nenhuma linha mudar, outra requisição alterou a etapa antes, e a resposta é **409 `STAGE_CONFLICT`**.
- **`complete` no `/move`:** o corpo aceita, opcionalmente, valor e itens. Dentro da mesma transação, a API grava esses dados, valida a transição com eles e muda a etapa. Se a transição for recusada, nada é salvo.

## Alternativas consideradas

- **Lock pessimista** (`SELECT … FOR UPDATE`). Rejeitado: o update condicional resolve com uma consulta a menos e sem segurar a linha.
- **Sem controle de corrida.** Rejeitado: o case avalia dados consistentes, e o risco é justamente uma oportunidade terminar em dois estados finais no histórico.
- **"Salvar e mover" em duas chamadas** (`PATCH` e depois `/move`). Rejeitado: não é atômico.

## Consequências

- O histórico sempre corresponde ao estado atual da oportunidade.
- O front trata o `STAGE_CONFLICT` como uma recusa comum: devolve o card à coluna e mostra a mensagem.
- Os testes de integração cobrem a transação (estado e histórico juntos), o `complete` recusado e o conflito.
