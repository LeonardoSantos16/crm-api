# 0002 — Histórico de auditoria em tabelas tipadas

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O case exige o histórico das mudanças de etapa (quando, de onde, para onde). A tela de detalhe também mostra, numa única timeline, os retornos, os adiamentos e os comentários. Cada tipo de entrada guarda campos diferentes:

| Tipo             | Campos                                  |
| ---------------- | --------------------------------------- |
| Mudança de etapa | etapa de origem e de destino            |
| Retorno          | canal, resumo, próxima data (opcionais) |
| Adiamento        | data até, motivo                        |
| Comentário       | texto                                   |

## Decisão

- **A fonte da verdade é a linha da `Opportunity`**: etapa atual, entrada na etapa, adiamento ativo, próxima data escolhida e contagem de adiamentos. A listagem lê o estado direto dela.
- **O histórico fica numa tabela por tipo:** `StageChange` (que já existia), `FollowUp`, `Snooze` e `Comment`. Todas pertencem à oportunidade e guardam data e autor.
- **Toda ação grava as duas coisas na mesma transação:** atualiza a oportunidade e insere o registro de histórico.
- **A timeline é montada na leitura:** a API junta as quatro tabelas e ordena pela data. A entrada "Criada" é o primeiro `StageChange` (sem etapa de origem). A entrada "Escalonada" é calculada ([ADR 0003](0003-alerta-calculado-na-leitura.md)).

## Alternativas consideradas

- **Event sourcing:** os eventos como única fonte da verdade, com o estado reconstruído a partir deles. Rejeitado: a listagem com filtro e prioridade precisaria de uma projeção, que na prática é a própria tabela `Opportunity`. Versionamento de eventos, projeções e replay são infraestrutura que o case não pede, e o histórico de auditoria já responde "o que aconteceu".
- **Tabela `Activity` única**, com tipo e payload em JSON. Rejeitado: o banco não valida os campos do payload (datas, enum de canal), e consultas como "quantos adiamentos" exigem ler dentro do JSON.

## Consequências

- Cada tipo tem colunas e enums validados pelo schema.
- Montar a timeline exige quatro consultas e uma junção em memória, o que é aceitável para o histórico de uma oportunidade.
- O risco de a oportunidade e o histórico divergirem é coberto pela transação, e os testes de integração verificam que as duas escritas acontecem juntas.
