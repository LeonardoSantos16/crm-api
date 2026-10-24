# 0003 — Alerta e escalonamento calculados na leitura

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O alerta de retorno depende do tempo: uma oportunidade passa de Em dia para Atenção, e depois para Escalonada, sem que ninguém faça nada. Algum componente precisa perceber essa passagem.

## Decisão

- O estado do alerta (Em dia, Atenção, Escalonada, Adiada), o vencimento e a prioridade são **calculados a cada consulta**, por funções puras do domínio, a partir da linha da oportunidade e da data de hoje.
- **Nada disso é gravado.** O banco guarda só os fatos: entrada na etapa, último retorno, próxima data escolhida, adiamento ativo e contagem de adiamentos.
- Na timeline, a entrada "Escalonada" é **sintetizada** com a data em que o escalonamento ocorreu:
  - por prazo, o dia seguinte ao vencimento mais um prazo da etapa;
  - por adiamentos, a data do 2º adiamento seguido.
- As regras estão em [regras-de-negocio.md](../regras-de-negocio.md), seção 3.

## Alternativas consideradas

- **Worker periódico que grava o estado do alerta.** Rejeitado: se o worker parar, a tela mostra um estado desatualizado. Calculando na leitura, a tela mostra sempre a verdade. Um worker só faz sentido para **avisar** (notificações), o que está fora do escopo atual.
- **Gravar o escalonamento como evento.** Rejeitado por ora: exigiria o worker acima ou um gatilho na leitura com efeito colateral. Vira necessário quando houver notificações.

## Consequências

- Não há estado de alerta para ficar dessincronizado.
- As fronteiras de data são testadas como funções puras, com `now` fixo ([ADR 0004](0004-tempo-e-datas.md)).
- O filtro por situação e a ordenação por prioridade acontecem em memória ([ADR 0010](0010-listagem-filtrada-no-servidor.md)).
- Notificar o gestor de um escalonamento vai exigir, no futuro, um processo que perceba a passagem. A change `add-follow-up-alerts` do front prevê esse worker.
