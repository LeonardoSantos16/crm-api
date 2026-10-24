# 0005 — Retornos de etapa e Perdida por ação própria

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O enunciado define algumas regras e deixa outras em aberto:

- **Definidas:** valor e item para entrar em Orçamento; Fechamento só a partir de Forecast; Perdida a partir de qualquer etapa não final, com motivo; estados finais.
- **Em aberto:** quais retornos de etapa fazem sentido num processo comercial real, e como avançar (uma etapa por vez ou com saltos).

## Decisão

- **Avanço de uma etapa por vez.** Assim ninguém pula Orçamento e, com isso, a regra do valor e dos itens.
- **Dois retornos permitidos:**
  - **Follow-up → Orçamento:** o cliente pediu revisão do orçamento (exemplo do próprio enunciado). A volta passa de novo pela regra do valor e dos itens.
  - **Forecast → Follow-up:** o cliente esfriou depois de sinalizar o fechamento, e a negociação volta a precisar de acompanhamento.
- **Nenhum outro retorno.** Em especial, ninguém volta a Primeiro Contato: um lead já atendido não volta a esperar o primeiro contato, e voltar para lá zeraria o prazo mais curto do funil.
- **Perdida só pela ação "Marcar como perdida"** (`POST /lose`). O `/move` rejeita esse destino.

A matriz completa e os códigos de bloqueio estão em [regras-de-negocio.md](../regras-de-negocio.md), seção 2.

## Alternativas consideradas

- **Retornos livres para qualquer etapa anterior.** Rejeitado: permitiria, por exemplo, voltar de Forecast a Orçamento e esconder um orçamento recusado, ou reiniciar prazos.
- **Nenhum retorno.** Rejeitado: o próprio enunciado cita a revisão de orçamento como caso real, e sem retorno a única saída seria marcar como Perdida.
- **Forecast → Orçamento** (nova proposta no fim da negociação). Rejeitado: o caminho Forecast → Follow-up → Orçamento cobre o caso e deixa o esfriamento registrado no histórico.
- **Perdida também pelo `/move`, com motivo no corpo.** Rejeitado: dois caminhos para o mesmo estado exigiriam validar o motivo nos dois, e o `/move` ficaria com um corpo que só vale para um destino.

## Consequências

- A matriz de transições é a base dos testes unitários de domínio.
- Toda volta a Orçamento revalida valor e itens.
- O front mostra o motivo de cada coluna proibida a partir dos códigos publicados pela API ([ADR 0006](0006-movimentos-publicados-pela-api.md)).
