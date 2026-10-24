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
