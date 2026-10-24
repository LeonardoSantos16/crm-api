# 0006 — A API publica os movimentos permitidos

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

No Kanban, enquanto um card é arrastado, o front escurece as colunas proibidas e mostra o motivo ("Só a partir de Forecast"). O menu "Mover para…" desabilita as mesmas etapas. Quando falta valor ou item para entrar em Orçamento, o front abre um diálogo para completar os dados em vez de falhar.

O case exige que as regras sejam validadas no backend, nunca apenas na tela.

## Decisão

Cada oportunidade, na listagem e no detalhe, traz a lista `moves`: uma entrada por etapa do funil, exceto a atual.

```ts
{ stage: Stage; allowed: boolean; reason?: MoveBlockReason; missing?: ("estimatedValue" | "items")[] }
```

- `reason` é o código da regra que bloqueia o destino (ex.: `ONLY_FROM_FORECAST`), e o front o traduz para pt-BR.
- `missing` indica a falta de valor ou itens para Orçamento. Não é bloqueio: é o gatilho do diálogo "Completar dados".
- `moves` é gerado pela **mesma função pura** que o `/move` usa para validar. Não existe uma segunda implementação das regras.
- Perdida fica fora de `moves`, porque tem ação própria ([ADR 0005](0005-regras-de-transicao.md)).

## Alternativas consideradas

- **Regras duplicadas no front.** Rejeitado: duas implementações divergem com o tempo, e o front poderia oferecer um movimento que a API recusa.
- **Endpoint estático com a matriz de transições.** Rejeitado: a matriz não basta, porque a regra do valor e dos itens depende dos dados de cada oportunidade.
- **Sem publicação:** o front tenta mover e trata a recusa. Rejeitado: o vendedor só descobriria a regra depois de soltar o card.

## Consequências

- O front não conhece as regras, só os códigos e seus textos.
- Uma mudança de regra no domínio aparece no front sem alteração de código.
- O `/move` continua validando: `moves` orienta a interface, mas não substitui a validação.
