# crm-api

API de CRM construída com Node.js, Express 5, Prisma 7 e PostgreSQL.

A interface (Kanban, busca, filtros e detalhe) fica no repositório [`crm-dashboard`](https://github.com/LeonardoSantos16/crm-dashboard). Para ver o CRM completo, suba esta API com o seed e depois o front, seguindo o README dele.

## Pré-requisitos

- [Node.js 24](https://nodejs.org/) (versão definida em `.nvmrc`)
- [Docker](https://www.docker.com/) com Docker Compose

## Como rodar

1. Crie o arquivo de variáveis de ambiente e preencha os valores:

   ```bash
   cp .env.example .env
   ```

   Exemplo para desenvolvimento local:

   ```dotenv
   POSTGRES_USER=crm
   POSTGRES_PASSWORD=crm
   DATABASE_URL=postgresql://crm:crm@localhost:5432/crm
   DATABASE_URL_TEST=postgresql://crm:crm@localhost:5432/crm_test
   NODE_ENV=development
   PORT=3333
   CORS_ORIGIN=http://localhost:3000
   REFERENCE_DATE=2026-10-15
   ```

   > `REFERENCE_DATE` fixa o "hoje" da API na data de referência do case (15/10/2026), para que os alertas do seed batam com os da [seção 3.6 das regras](docs/regras-de-negocio.md#36-exemplo-com-os-dados-do-case). Sem ela, vale o relógio real e os estados mudam ([ADR 0004](docs/adr/0004-tempo-e-datas.md)).

   > O `docker-compose.yml` exige `POSTGRES_USER` e `POSTGRES_PASSWORD`, por isso o `.env` precisa existir antes de subir o banco.

2. Suba o PostgreSQL (cria os bancos `crm` e `crm_test`):

   ```bash
   docker compose up -d
   ```

3. Instale as dependências:

   ```bash
   npm ci
   ```

4. Aplique as migrations, gere o Prisma Client e popule o banco:

   ```bash
   npm run db:deploy
   npm run db:generate
   npm run db:seed
   ```

5. Inicie a API em modo de desenvolvimento:

   ```bash
   npm run dev
   ```

   A API sobe em `http://localhost:3333`. Para verificar: `GET /health`.

## Como testar

Os testes de integração usam o banco definido em `DATABASE_URL_TEST`, separado do banco de desenvolvimento. As migrations são aplicadas automaticamente antes da suíte.

Com o banco rodando (`docker compose up -d`) e o Prisma Client gerado:

```bash
npm test            # executa a suíte uma vez
npm run test:watch  # modo watch
```

Checagens de qualidade (as mesmas rodadas no CI):

```bash
npm run format:check
npm run lint
npm run typecheck
```

## Decisões

Resumo das decisões. As regras completas estão em [docs/regras-de-negocio.md](docs/regras-de-negocio.md), e o raciocínio de cada escolha de arquitetura, nos [ADRs](docs/adr/).

### Funil e transições

- **Avanço de uma etapa por vez**, para que ninguém pule a exigência de valor e itens em Apresentação de Orçamento.
- **Retornos permitidos:**
  - Follow-up → Orçamento, quando o cliente pede revisão;
  - Forecast → Follow-up, quando o cliente esfria.
- **Nenhuma etapa volta a Primeiro Contato.**
- **Valor e itens** são exigidos em toda entrada em Orçamento, inclusive no retorno, e não podem ser removidos depois.
- **Perdida** só pela ação própria, com motivo obrigatório de uma lista fechada.
- **A API publica os movimentos permitidos** de cada oportunidade, com o motivo de cada bloqueio, e o front não replica as regras.

Detalhes: [ADR 0005](docs/adr/0005-regras-de-transicao.md) e [ADR 0006](docs/adr/0006-movimentos-publicados-pela-api.md).

### Automação: alerta de retorno (problema 4)

O sistema **mostra** ao vendedor o que está parado e o que é mais urgente. Ele **não** contata o cliente no lugar do vendedor.

- **Gatilho:** inatividade na etapa atual, com prazo por etapa: Primeiro Contato 1 dia, Orçamento 5, Follow-up 6 e Forecast 7.
- **Relógio:** conta a partir do evento mais recente entre a entrada na etapa e o último retorno, ou até a data escolhida pelo vendedor. Editar dados não reinicia o relógio.
- **Ações do vendedor:**
  - **Marcar como retornado:** registra o contato e zera a contagem de adiamentos.
  - **Adiar:** até 30 dias, sem contato, e soma na contagem.
- **Escalonamento:** a oportunidade escala depois de mais um prazo inteiro sem resposta, ou no 2º adiamento seguido.
- **Prioridade:** percentual do prazo consumido, com o valor como desempate.
- **Cálculo:** o alerta é calculado na consulta, sem worker, então a tela sempre mostra o estado real.

Detalhes: [ADR 0003](docs/adr/0003-alerta-calculado-na-leitura.md) e [ADR 0004](docs/adr/0004-tempo-e-datas.md).

### Consistência dos dados

- **Mudança de etapa e histórico** são gravados na mesma transação.
- **Corridas:** um update condicional detecta duas mudanças simultâneas (409).
- **"Salvar e mover"** é atômico: se a transição for recusada, os dados não são salvos.
- **Histórico de auditoria, não event sourcing:** a oportunidade guarda o estado atual, e as tabelas de histórico registram o que aconteceu.

Detalhes: [ADR 0002](docs/adr/0002-historico-em-tabelas-tipadas.md) e [ADR 0007](docs/adr/0007-consistencia-nas-mudancas-de-etapa.md).

### Arquitetura

- **Camadas:** `routes` → `controllers` (HTTP e zod) → `use-cases` (casos de uso) → `domain`.
- **Persistência atrás de interfaces:** os use cases dependem de `repositories` e de uma unit of work que abre a transação. A implementação com Prisma fica em `repositories/prisma`, e o `container.ts` monta as dependências. Assim os use cases são testados com repositórios mockados, sem banco.
- **Domínio em funções puras**, com o "agora" recebido por parâmetro e testado sem banco. Sem DDD completo, por não trazer ganho neste escopo ([ADR 0001](docs/adr/0001-camadas-com-dominio-puro.md)).
- **Erros** num formato único com `code`: 409 para conflito de estado, 422 para pré-requisito faltando ([ADR 0009](docs/adr/0009-contrato-de-erros.md)).
- **Listagem** filtrada e ordenada no servidor ([ADR 0010](docs/adr/0010-listagem-filtrada-no-servidor.md)).

### Segurança

- A identidade vem do header `X-User-Id`, e a visibilidade é aplicada na API:
  - o vendedor vê as próprias oportunidades;
  - o gestor vê as do time.
- Credenciais ficam só no `.env`, que não é versionado.
- **Em produção:** o case não exige autenticação completa, por isso a demonstração usa o header. Em produção, eu aplicaria autenticação com JWT: o usuário faz login num provedor de identidade, o front envia o token no header `Authorization: Bearer`, e a API valida a assinatura e a expiração em cada requisição, tirando do token o usuário e o papel que hoje vêm do `X-User-Id`. Junto disso, HTTPS, CORS restrito ao domínio do front, rate limiting e segredos num cofre, fora do `.env` ([ADR 0008](docs/adr/0008-identidade-sem-autenticacao.md)).

### Limitações conhecidas

- **Prazos** em dias corridos, sem calendário de feriados.
- **Listagem** sem paginação, com a prioridade calculada em memória.
- **Identidade** por header, sem autenticação.
- **Escalonamento** sem notificação nem worker. É a próxima etapa, prevista no front.
- **Retorno sem contato:** um retorno pode ser marcado sem ter acontecido. A data no histórico torna o padrão visível.
- **Dados do seed:** o case não informa a data de entrada na etapa (o seed usa a do último contato) nem o motivo da perda da OPP-2007 (registrado como "Outro").

## Os outros três problemas

O problema 4 foi implementado (seção [Automação](#automação-alerta-de-retorno-problema-4)). Para os outros três, esta é a solução que eu seguiria.

### 1. Lead esperando o primeiro contato

**Ideia:** responder o lead na hora, automaticamente, e manter o vendedor cobrado pelo contato real.

- **E-mail automático no cadastro:** ao criar a oportunidade, a API grava na mesma transação um envio pendente numa tabela de saída (outbox). Um worker envia em segundos um e-mail de boas-vindas, com uma apresentação da Nobre Brindes e o aviso de que um vendedor vai entrar em contato. Se o envio falhar, ele é tentado de novo.
- **Job de hora em hora:** reprocessa os envios que falharam e encontra leads em Primeiro Contato que ficaram sem e-mail.
- **O e-mail não substitui o contato:** a oportunidade continua em Primeiro Contato, e o prazo de 1 dia do alerta de retorno segue valendo. Se ninguém ligar, ela aparece como atrasada e depois escala para o gestor.

### 2. Conhecer a empresa do lead

**Ideia:** preencher automaticamente os dados da empresa a partir do CNPJ, para que o vendedor chegue à ligação sabendo com quem fala.

- **Consulta pelo CNPJ:** a empresa ganha um campo `cnpj`, opcional e único. Ao informá-lo, um worker consulta uma API pública da Receita Federal (como a BrasilAPI) e salva razão social, nome fantasia, atividade principal (CNAE), porte, data de abertura, endereço e situação cadastral.
- **Uso no atendimento:** o detalhe da oportunidade ganha um bloco "Sobre a empresa". A atividade ajuda a sugerir o tipo de brinde, e o porte indica o volume provável do pedido.
- **Sem travar o cadastro:** a consulta roda em segundo plano, com nova tentativa se a API externa falhar. Os dados ficam salvos na empresa e só são consultados de novo quando estiverem antigos.
- **Menos duplicatas:** com o CNPJ, a empresa passa a ser identificada por ele, e não pelo nome.
- **LGPD:** só os dados da empresa são guardados. O quadro de sócios, que traz pessoas físicas, fica de fora.

### 3. Informações do roteiro da ligação

**Ideia:** transcrever a ligação com IA e extrair dela as respostas do roteiro, para que fiquem registradas na oportunidade sem o vendedor digitar.

- **Gravação e transcrição:** a ligação feita pela telefonia VoIP é gravada, com aviso ao cliente no início. Ao terminar, um worker envia o áudio a um serviço de transcrição (speech-to-text) e salva o texto na oportunidade.
- **Extração do roteiro:** um LLM lê a transcrição e preenche os campos do roteiro de forma estruturada: brinde de interesse, quantidade, data do evento, orçamento, quem decide e próximos passos. A saída é validada com zod, como qualquer entrada da API.
- **O vendedor confirma:** os campos extraídos aparecem como sugestão no registro do retorno (o `FollowUp`, que já tem canal e resumo). Só depois de o vendedor revisar é que eles atualizam a oportunidade. A IA pode errar, e um valor ou quantidade errados afetariam as regras do funil.
- **Consulta depois da ligação:** o resumo entra na linha do tempo, e a transcrição completa fica disponível no detalhe, com busca por texto.
- **LGPD:** a gravação exige o aviso ao cliente, e o áudio é apagado depois de um prazo definido. Fica guardado só o texto.

## Uso de IA

A API foi desenvolvida com o Claude Code:

- **Definição das regras:** as regras de transição e do alerta foram fechadas em rodadas de perguntas e respostas (skill `grilling`), antes do código. O resultado está em [docs/regras-de-negocio.md](docs/regras-de-negocio.md) e nos ADRs.
- **TDD:** a implementação seguiu um plano de etapas, com a skill `tdd`. Em cada etapa, os casos de teste foram listados e aprovados por mim antes do ciclo red → green → refactor. Os commits seguem o par `test:` / `feat:`.
- **Prisma 7:** as skills oficiais do Prisma (`.claude/skills/prisma-*`) serviram de referência para a configuração do client, do adapter `pg` e das migrations.
- **Commits e PRs:** mensagens de commit e textos de PR escritos com auxílio do Claude Code.
- **Implementação:** as decisões de regras de negócio e de arquitetura são minhas. Em um fluxo padrão, eu seguiria TDD: os testes seriam gerados pela IA, com os stubs revisados por mim, e a implementação da etapa Green seria feita manualmente. Por falta de tempo, devido a motivos pessoais, acabei usando a IA também em grande parte da implementação, com a revisão do código concentrada principalmente nos PRs. Como esse código inicial não seguia um padrão estrutural, é possível notar verbosidade e alto acoplamento no PR https://github.com/LeonardoSantos16/crm-api/pull/10, no qual, após finalizar o back-end e o front-end, refatorei todo o código, separando-o em camadas e aplicando os princípios SOLID para deixá-lo no meu padrão.
