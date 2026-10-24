# crm-api

API de CRM construída com Node.js, Express 5, Prisma 7 e PostgreSQL.

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
   ```

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
- **Em produção:** o header seria substituído por um token validado pela API, como um JWT de um provedor de identidade ([ADR 0008](docs/adr/0008-identidade-sem-autenticacao.md)).
- Credenciais ficam só no `.env`, que não é versionado.

### Limitações conhecidas

- **Prazos** em dias corridos, sem calendário de feriados.
- **Listagem** sem paginação, com a prioridade calculada em memória.
- **Identidade** por header, sem autenticação.
- **Escalonamento** sem notificação nem worker. É a próxima etapa, prevista no front.
- **Retorno sem contato:** um retorno pode ser marcado sem ter acontecido. A data no histórico torna o padrão visível.
- **Dados do seed:** o case não informa a data de entrada na etapa (o seed usa a do último contato) nem o motivo da perda da OPP-2007 (registrado como "Outro").
