# 0001 — Camadas com domínio em funções puras, sem DDD completo

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

As regras que o case avalia são as transições de etapa e o alerta de retorno. Elas precisam de testes unitários rápidos, incluindo casos de fronteira de data, sem depender de banco. O sistema tem poucas entidades (usuário, empresa, oportunidade e seu histórico), e quase toda a regra se concentra na oportunidade.

## Decisão

Organizar a API em quatro camadas:

| Camada         | Responsabilidade                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `routes/`      | Definição das rotas                                                                                                                                          |
| `controllers/` | HTTP e validação de entrada com zod. Sem regra de negócio.                                                                                                   |
| `services/`    | Casos de uso: carregam dados, aplicam visibilidade por papel, chamam o domínio e abrem transações                                                            |
| `domain/`      | Regras de transição, movimentos permitidos, prazos e alerta, como **funções puras**: sem acesso a banco, sem ler o relógio, com `now` recebido por parâmetro |

## Alternativas consideradas

- **DDD completo** (agregados, repositórios, eventos de domínio, value objects). Rejeitado: para este escopo, as camadas extras trariam cerimônia sem ganho de clareza. As regras já ficam isoladas e testáveis nas funções puras.
- **Regras dentro dos services, junto do Prisma.** Rejeitado: os testes de transição e de alerta passariam a exigir banco, e os testes de fronteira de data ficariam lentos e frágeis.

## Consequências

- Os testes de domínio rodam sem banco e cobrem a matriz de transições e as fronteiras do alerta.
- A mesma função de transição valida o `/move` e gera os movimentos publicados ao front ([ADR 0006](0006-movimentos-publicados-pela-api.md)).
- Se o domínio crescer (vários agregados com invariantes entre si), a estrutura pode evoluir para DDD sem reescrever as regras, que já estão isoladas.
