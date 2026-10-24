# 0009 — Contrato de erros

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O front precisa distinguir os erros para reagir a cada um:

- mostrar a mensagem de uma transição recusada;
- abrir o diálogo de dados faltantes;
- apontar um campo inválido.

Os status HTTP sozinhos não bastam: duas recusas de transição diferentes podem ter o mesmo status.

## Decisão

Todo erro usa o mesmo formato:

```json
{ "error": { "code": "INVALID_TRANSITION", "message": "...", "details": {} } }
```

| Status | Código                   | Quando                                                             |
| ------ | ------------------------ | ------------------------------------------------------------------ |
| 400    | `VALIDATION_ERROR`       | Entrada inválida (zod). `details` traz os campos.                  |
| 400    | `INVALID_JSON`           | Corpo malformado                                                   |
| 401    | `UNAUTHENTICATED`        | `X-User-Id` ausente ou usuário inexistente                         |
| 403    | `FORBIDDEN`              | Vendedor agindo em nome de outro                                   |
| 404    | `NOT_FOUND`              | Recurso inexistente ou fora da visibilidade                        |
| 409    | `INVALID_TRANSITION`     | Transição fora da matriz. `details.reason` traz o código da regra. |
| 409    | `FINAL_STAGE`            | Ação sobre uma oportunidade em estado final                        |
| 409    | `STAGE_CONFLICT`         | A etapa mudou durante a requisição                                 |
| 422    | `MISSING_VALUE_OR_ITEMS` | Entrada em Orçamento sem valor ou itens, ou edição que os remove   |

Regra geral: **409** quando o problema é o **estado atual** da oportunidade; **422** quando falta um **pré-requisito nos dados**.

## Alternativas consideradas

- **Um status único (422) para toda violação de regra**, diferenciada só pelo `code`. Rejeitado: separar o estado (409) do dado faltante (422) deixa o tipo de erro legível pelo próprio status.
- **Problem Details (RFC 9457).** Rejeitado por ora: o formato atual já existe no `error-handler` e cobre o necessário.

## Consequências

- O front decide a reação pelo `code`, e a mensagem pt-BR fica com ele.
- Cada código tem ao menos um teste de integração.
