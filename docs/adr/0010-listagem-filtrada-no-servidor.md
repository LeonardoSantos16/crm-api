# 0010 — Listagem filtrada no servidor, com prioridade em memória

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O Kanban oferece busca, filtros (situação, responsável, perdidas, Fechamento completo) e duas ordenações (prioridade e valor). A situação e a prioridade dependem do alerta, que é calculado e não gravado ([ADR 0003](0003-alerta-calculado-na-leitura.md)).

## Decisão

- `GET /opportunities` aceita os parâmetros `q`, `situation[]`, `ownerId`, `sort`, `includeLost` e `allClosed`, e devolve a lista **já filtrada e ordenada**, com o alerta e os movimentos de cada oportunidade e a contagem "Precisam de atenção".
- O banco aplica o que é coluna: visibilidade, responsável, etapa, cortes de 30 dias e busca. O domínio, em JavaScript, calcula o alerta, filtra por situação e ordena.
- **Sem paginação.**

## Alternativas consideradas

- **Filtrar e ordenar no front.** Rejeitado: o front repetiria o cálculo de prioridade, e a regra deve morar no backend.
- **Prioridade calculada em SQL.** Rejeitado por ora: duplicaria a regra do alerta numa consulta, e os testes de fronteira passariam a exigir banco. Vira necessário com um volume maior.
- **Paginação.** Rejeitado por ora: o Kanban mostra todas as colunas de uma vez, e o volume de oportunidades abertas por vendedor é pequeno.

## Consequências

- Uma única implementação do alerta, testada sem banco.
- O custo cresce com o número de oportunidades abertas visíveis ao usuário. É uma limitação documentada no README: com volume alto, a prioridade passaria para SQL (ou uma coluna materializada) com paginação por coluna.
