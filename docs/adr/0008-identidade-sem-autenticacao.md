# 0008 — Identidade por header, sem autenticação

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O case não exige autenticação completa, mas pede que a API não exponha credenciais e que o README descreva como ela seria protegida em produção. O front tem um seletor de usuário de demonstração ("Entrando como"), e a visibilidade depende do papel: o vendedor vê as próprias oportunidades, e o gestor vê as do time.

## Decisão

- O front envia o usuário selecionado no header **`X-User-Id`**. Ele é obrigatório em todas as rotas, exceto `GET /health` e `GET /users` (a lista do seletor).
- Header ausente ou usuário inexistente: **401 `UNAUTHENTICATED`**.
- **Visibilidade aplicada na API**, nunca só na tela:
  - o vendedor acessa só as próprias oportunidades;
  - o gestor acessa as do time.
- Uma oportunidade fora da visibilidade responde **404**, como se não existisse.
- O vendedor que tenta agir em nome de outro (filtrar ou criar com outro responsável) recebe **403 `FORBIDDEN`**.
- O usuário do header é gravado como autor de cada ação no histórico.

## Alternativas consideradas

- **JWT ou SSO.** Rejeitado para o case: fora do escopo pedido, e a troca vai descrita no README.
- **403 para a oportunidade de outro vendedor.** Rejeitado: confirmaria que a oportunidade existe. O 404 não revela nada.
- **Header opcional.** Rejeitado: sem identidade não há como aplicar a visibilidade.

## Consequências

- Qualquer cliente pode se passar por qualquer usuário. Isso é aceitável só em demonstração, e o README deixa explícito.
- **Em produção:** o header é substituído por um token validado pela API (por exemplo, um JWT emitido por um provedor de identidade), com o usuário extraído do token. As regras de visibilidade continuam iguais, porque já estão no backend.
