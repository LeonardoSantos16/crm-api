# 0004 — Tempo: dias corridos por data, "agora" injetável e data de referência

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O alerta compara datas: entrada na etapa, último retorno, vencimento. Três problemas surgem:

1. **Fronteiras.** O resultado precisa ser previsível no limite exato: "vence hoje" está atrasada ou não?
2. **Fuso.** O servidor roda em UTC, e os vendedores estão em São Paulo. Às 22h de São Paulo já é o dia seguinte em UTC.
3. **Demonstração.** Os dados do case são de 15/10/2026. Com o relógio real, quase tudo apareceria atrasado.

## Decisão

- **Unidade: dias corridos por data de calendário** no fuso `America/Sao_Paulo`. Os timestamps são guardados em UTC (`timestamptz`) e convertidos para a data local antes de comparar. O horário não conta.
- **Limite:** atrasada só quando hoje é **posterior** ao vencimento. No dia do vencimento a oportunidade está em dia ("Vence hoje").
- **"Agora" injetável:** as funções de domínio recebem `now` por parâmetro e nunca leem o relógio. Os testes passam datas fixas.
- **`REFERENCE_DATE`** (opcional, `YYYY-MM-DD`) fixa o "hoje" da API. Sem ele, vale o relógio real. O `.env.example` traz `2026-10-15`, o mesmo "hoje" fixo do mock do front.

## Alternativas consideradas

- **Horas exatas** (ex.: 24h por dia de prazo). Rejeitado: "parada há 2 dias" deixaria de bater com o calendário que o vendedor vê, e as fronteiras dependeriam do horário da ação.
- **Dias úteis.** Rejeitado por ora: exige um calendário de feriados. Fica como limitação documentada.
- **Fake timers do Vitest** no lugar do parâmetro. Rejeitado: o parâmetro deixa a dependência explícita e funciona igual em testes unitários e de integração.
- **"No limite já conta como atrasada".** Rejeitado: o front mostra "Vence hoje" como um aviso, não como atraso, e o vendedor ainda tem o dia para agir.

## Consequências

- Os testes de fronteira são determinísticos: véspera, dia do vencimento e dia seguinte.
- A demonstração reproduz os estados dos wireframes com os dados do case.
- Feriados não são considerados (limitação registrada no README).
