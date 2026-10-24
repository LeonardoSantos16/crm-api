# Regras de negócio

Especificação do comportamento da API: o funil, as transições de etapa, o alerta de retorno e as ações sobre uma oportunidade. É a referência dos testes de domínio. O porquê das escolhas de arquitetura está nos [ADRs](adr/).

## 1. Etapas

```
Primeiro Contato → Apresentação de Orçamento → Follow-up → Forecast → Fechamento
```

| Etapa                     | Enum                  |
| ------------------------- | --------------------- |
| Primeiro Contato          | `FIRST_CONTACT`       |
| Apresentação de Orçamento | `BUDGET_PRESENTATION` |
| Follow-up                 | `FOLLOW_UP`           |
| Forecast                  | `FORECAST`            |
| Fechamento                | `CLOSING`             |
| Perdida                   | `LOST`                |

- **Perdida** pode ser aplicada a partir de qualquer etapa não final.
- **Estados finais:** Fechamento e Perdida.
- **Premissa:** o enunciado não define o que acontece em cada etapa. Primeiro Contato é o momento em que o lead já aguarda contato, por isso tem o prazo mais curto.

## 2. Transições

### 2.1 Regras

| #   | Regra                                                                                                                                                                                          | Por quê                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| R1  | Para frente, **só uma etapa por vez**.                                                                                                                                                         | Impede pular Orçamento e, com isso, a regra do valor e dos itens.                                       |
| R2  | **Toda entrada** em Orçamento (avanço ou retorno) exige **valor estimado** e **pelo menos um item**. Da etapa Orçamento em diante, a edição também não pode remover o valor nem o último item. | Regra do enunciado. Validar também no retorno e na edição mantém a regra verdadeira depois de cumprida. |
| R3  | **Fechamento** só a partir de **Forecast**.                                                                                                                                                    | Regra do enunciado.                                                                                     |
| R4  | **Perdida** a partir de qualquer etapa não final, com **motivo obrigatório**, somente pela ação "Marcar como perdida".                                                                         | Regra do enunciado. Um caminho só garante que o motivo sempre exista.                                   |
| R5  | **Estados finais não mudam mais.**                                                                                                                                                             | Regra do enunciado.                                                                                     |
| R6  | Retornos permitidos: **Follow-up → Orçamento** e **Forecast → Follow-up**. Nenhum outro.                                                                                                       | Ver [ADR 0005](adr/0005-regras-de-transicao.md).                                                        |
| R7  | **Proibido voltar a Primeiro Contato.**                                                                                                                                                        | Uma vez atendido, o lead não volta a esperar o primeiro contato.                                        |

### 2.2 Matriz

`↩` = retorno (R6). `lose` = só pela ação "Marcar como perdida".

| De \ Para        | Primeiro Contato | Orçamento | Follow-up | Forecast | Fechamento | Perdida |
| ---------------- | :--------------: | :-------: | :-------: | :------: | :--------: | :-----: |
| Primeiro Contato |        —         |  ✅ (R2)  |    ❌     |    ❌    |     ❌     |  lose   |
| Orçamento        |        ❌        |     —     |    ✅     |    ❌    |     ❌     |  lose   |
| Follow-up        |        ❌        |  ↩ (R2)   |     —     |    ✅    |     ❌     |  lose   |
| Forecast         |        ❌        |    ❌     |     ↩     |    —     |     ✅     |  lose   |
| Fechamento       |        ❌        |    ❌     |    ❌     |    ❌    |     —      |   ❌    |
| Perdida          |        ❌        |    ❌     |    ❌     |    ❌    |     ❌     |    —    |

### 2.3 Motivos de bloqueio

Para cada destino bloqueado, a API informa o código da regra. Quando mais de uma regra se aplica, vale a primeira da lista:

| Código                       | Regra | Exemplo                                            |
| ---------------------------- | ----- | -------------------------------------------------- |
| `FINAL_STAGE`                | R5    | qualquer destino a partir de Fechamento ou Perdida |
| `NO_RETURN_TO_FIRST_CONTACT` | R7    | Orçamento → Primeiro Contato                       |
| `ONLY_FROM_FORECAST`         | R3    | Follow-up → Fechamento                             |
| `RETURN_NOT_ALLOWED`         | R6    | Forecast → Orçamento                               |
| `ONE_STEP_AT_A_TIME`         | R1    | Primeiro Contato → Follow-up                       |

A falta de valor ou de itens (R2) **não é bloqueio**: o destino aparece como permitido, com a lista do que falta (`estimatedValue`, `items`). O front usa essa lista para pedir os dados antes de mover.

## 3. Alerta de retorno

A automação escolhida é o problema 4 do case: com muitos atendimentos, o vendedor esquece de dar retorno. O sistema **mostra** ao vendedor o que está parado e o que é mais urgente. Ele **não** contata o cliente pelo vendedor.

### 3.1 Gatilho e prazos

O alerta é disparado pela **inatividade na etapa atual**, não pela mudança de etapa: uma oportunidade esquecida não gera nenhum evento, então o critério precisa ser o tempo. Cada etapa tem seu prazo, porque elas não esfriam no mesmo ritmo:

| Etapa                     |  Prazo |
| ------------------------- | -----: |
| Primeiro Contato          |  1 dia |
| Apresentação de Orçamento | 5 dias |
| Follow-up                 | 6 dias |
| Forecast                  | 7 dias |

Etapas finais não têm prazo nem alerta.

### 3.2 Contagem do tempo

- **Dias corridos por data de calendário**, no fuso `America/Sao_Paulo`. O horário não conta: entrar numa etapa às 23h de ontem vale 1 dia hoje.
- **"Hoje"** é a data local do momento da consulta. Na demonstração, `REFERENCE_DATE` fixa esse dia (ver [ADR 0004](adr/0004-tempo-e-datas.md)).

### 3.3 Vencimento

Toda oportunidade aberta tem uma data de vencimento (`dueDate`), definida pelo evento mais recente:

| Situação                                  | Vencimento                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Adiada até X                              | X                                                                                              |
| Último retorno com próxima data escolhida | a data escolhida                                                                               |
| Nenhum dos dois                           | data do evento mais recente entre a entrada na etapa e o último retorno, mais o prazo da etapa |

Só um desses estados existe por vez, porque cada ação limpa os demais (seção 4).

Editar dados da oportunidade (telefone, datas, itens) **não** reinicia o relógio. Se reiniciasse, alertas sumiriam sem que o cliente tivesse recebido retorno.

### 3.4 Estados

Avaliados nesta ordem:

| Estado                   | Condição                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------- |
| sem alerta               | Etapa final                                                                                           |
| `ESCALATED` (Escalonada) | 2 adiamentos seguidos sem retorno no meio, **ou** hoje posterior ao vencimento mais um prazo da etapa |
| `SNOOZED` (Adiada)       | Adiada, e hoje anterior à data do adiamento                                                           |
| `ATTENTION` (Atenção)    | Hoje posterior ao vencimento                                                                          |
| `ON_TIME` (Em dia)       | Caso contrário                                                                                        |

- **No dia do vencimento a oportunidade está em dia** ("Vence hoje"). Ela fica atrasada a partir do dia seguinte.
- O escalonamento mede o atraso **depois do aviso**: o vendedor é avisado e ganha mais um prazo inteiro antes de o gestor ser envolvido.
- O **2º adiamento seguido** escala na hora, mesmo com a oportunidade adiada. Isso fecha a brecha de adiar repetidamente para fugir do alerta.
- **Precisam de atenção** = Atenção + Escalonada. Adiadas não contam: o vendedor já decidiu quando voltar a elas.
- **Proposta vencida e evento próximo não são alerta.** São informações mostradas ao lado das datas.

### 3.5 Prioridade

1. **Percentual do prazo consumido**, do maior para o menor: `(hoje − (vencimento − prazo)) / prazo`. Dias brutos não são comparáveis entre etapas com prazos diferentes; normalizar pelo prazo torna a comparação justa.
2. **Desempate pelo valor estimado**, do maior para o menor. Oportunidades sem valor ficam por último.

A ordenação alternativa usa só o valor. Fechamento e perdidas, que não têm alerta, aparecem das mais recentes para as mais antigas na ordenação por prioridade.

### 3.6 Exemplo com os dados do case

Data de referência: 15/10/2026.

| Oportunidade | Etapa            | Última atividade | Vencimento | Estado                     |
| ------------ | ---------------- | ---------------- | ---------- | -------------------------- |
| OPP-2001     | Primeiro Contato | 14/10            | 15/10      | Em dia ("Vence hoje")      |
| OPP-2002     | Orçamento        | 06/10            | 11/10      | Atenção (parada há 9 dias) |
| OPP-2003     | Follow-up        | 13/10            | 19/10      | Em dia                     |
| OPP-2004     | Follow-up        | 02/10            | 08/10      | Escalonada (desde 15/10)   |
| OPP-2005     | Forecast         | 15/10            | 22/10      | Em dia                     |
| OPP-2006     | Fechamento       | —                | —          | sem alerta                 |
| OPP-2007     | Perdida          | —                | —          | sem alerta                 |

## 4. Ações

Toda ação grava um registro no histórico da oportunidade, com data e autor.

| Ação                      | Entrada                                                   | Efeito                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mover**                 | etapa de destino; opcionalmente, valor e itens que faltam | Valida a transição (seção 2). Reinicia o relógio (nova entrada na etapa), cancela adiamento e próxima data. **Não** zera a contagem de adiamentos. Se vierem dados junto, eles só são salvos se a transição for aceita. |
| **Marcar como perdida**   | motivo; detalhe                                           | Só em etapa não final. O detalhe é obrigatório quando o motivo é "Outro".                                                                                                                                               |
| **Marcar como retornado** | canal, resumo e próxima data, todos opcionais             | Registra o retorno com a data de hoje, reinicia o relógio, cancela o adiamento e **zera** a contagem de adiamentos. Sem próxima data, vale o prazo da etapa.                                                            |
| **Adiar**                 | data obrigatória; motivo opcional                         | Pausa o alerta até a data. **Soma 1** na contagem de adiamentos.                                                                                                                                                        |
| **Comentar**              | texto                                                     | Não afeta o alerta. Comentários não podem ser editados nem excluídos.                                                                                                                                                   |

- **"Dar retorno" é o vendedor marcar como retornado.** O contato acontece fora do sistema (telefone, WhatsApp), então o sistema só sabe que houve retorno se o vendedor registrar.
- **Retornar e adiar são ações diferentes.** As duas escolhem uma data; o que as separa é ter havido contato. Se fizessem a mesma coisa, o vendedor sempre escolheria a que não conta para o escalonamento.
- **Datas de próxima ação e de adiamento:** depois de hoje e até 30 dias à frente. O teto impede adiamentos enormes.
- **Retornar e adiar** não são aceitos em etapas finais. Comentar é aceito em qualquer etapa.
- **Limitação assumida:** um retorno pode ser marcado sem ter acontecido. A data no histórico torna o padrão visível.

### 4.1 Motivos de perda

| Motivo                      | Enum            |
| --------------------------- | --------------- |
| Preço                       | `PRICE`         |
| Prazo de entrega            | `DELIVERY_TIME` |
| Escolheu concorrente        | `COMPETITOR`    |
| Sem orçamento               | `NO_BUDGET`     |
| Sem resposta do cliente     | `NO_RESPONSE`   |
| Outro (detalhe obrigatório) | `OTHER`         |

## 5. Criação e edição

- **Criar:** empresa, contato e responsável são obrigatórios; brinde, quantidade e valor são opcionais. A empresa é reaproveitada pelo nome. A oportunidade nasce em Primeiro Contato.
- **Responsável:** o vendedor só cria oportunidades para si mesmo; o gestor escolhe alguém do time.
- **Editar:** contato, datas, valor e itens. A lista de itens enviada substitui a anterior. Oportunidades em estado final não podem ser editadas.

## 6. Visibilidade

- O **vendedor** vê e altera só as próprias oportunidades.
- O **gestor** vê e altera as oportunidades do time.
- Uma oportunidade fora da visibilidade do usuário responde como inexistente.

## 7. Listagem

- **Busca** por código ou empresa, ignorando caixa e acento.
- **Filtros:**
  - situação (Atenção, Adiada, Escalonada, Em dia);
  - responsável, só para o gestor.
- **Fechamento** mostra os últimos 30 dias por padrão, com opção de ver todos.
- **Perdidas** ficam fora por padrão. Quando incluídas, vêm as dos últimos 30 dias, com a etapa de onde saíram.

## 8. Dados iniciais (seed)

- Oportunidades OPP-2001 a OPP-2007 do case; vendedores Ana, Bruno e Carla; gestor Marcos.
- O case não informa a data de entrada na etapa. O seed usa a data do último contato. Como o relógio conta a partir do evento mais recente entre os dois, o resultado é o mesmo.
- Contatos ficam vazios, porque o case não os informa.
- OPP-2007 (Perdida) recebe o motivo "Outro", com o detalhe "Motivo não informado nos dados do case". Inventar um motivo seria fabricar dado.
