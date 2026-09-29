# Generic Roleplay API

API HTTP construída com NestJS, PostgreSQL e Drizzle ORM para cadastro, autenticação e exclusão de contas.

## Requisitos

- Node.js 24 ou superior
- pnpm 11.25.0
- Docker e Docker Compose, para executar o PostgreSQL localmente

## Configuração local

1. Instale as dependências e crie o arquivo de ambiente:

   ```sh
   pnpm install --frozen-lockfile
   cp .env.example .env
   ```

2. Gere uma chave RSA para assinatura dos tokens. Os comandos abaixo são para Linux com GNU `base64`:

   ```sh
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt-private.pem
   openssl pkey -in jwt-private.pem -pubout -out jwt-public.pem
   base64 -w 0 jwt-private.pem
   base64 -w 0 jwt-public.pem
   ```

   Coloque as duas saídas nas variáveis `JWT_PRIVATE_KEY_BASE64` e `JWT_PUBLIC_KEY_BASE64` do `.env`. Gere também um pepper aleatório com `openssl rand -base64 32` e configure `PEPPER`. Não compartilhe nem versione o `.env` ou a chave privada.

3. Para executar API e banco pelo Compose, configure `DATABASE_URL` no `.env` com o hostname do serviço:

   ```env
   DATABASE_URL=postgresql://myuser:mypassword@postgres:5432/mydb
   ```

   Inicie os serviços e crie/atualize o schema de desenvolvimento:

   ```sh
   docker compose up -d --build
   docker compose exec api pnpm exec drizzle-kit push
   ```

   A aplicação fica disponível em `http://localhost:3000`. Para executar a API diretamente com `pnpm start:dev`, use `localhost` como host do banco em `DATABASE_URL` e inicie apenas o PostgreSQL com `docker compose up -d postgres`.

`SERVER_PORT` aceita valores de 1 a 65535 e usa `3000` por padrão. `NODE_ENV` aceita `development` ou `production`. `PEPPER` precisa ter pelo menos 32 caracteres. As chaves JWT precisam ser um par RSA correspondente codificado em Base64. O access token expira em 15 minutos (`JWT_EXPIRES_IN=15m`) e o refresh token em 15 dias (`JWT_REFRESH_EXPIRES_IN=15d`).

> `drizzle-kit push` sincroniza diretamente o banco e é indicado aqui para desenvolvimento local. O repositório ainda não contém um fluxo de migrations versionadas para implantação de produção.

## Documentação OpenAPI

Com `NODE_ENV=development`, a interface Swagger fica em [`http://localhost:3000/docs`](http://localhost:3000/docs), e o documento OpenAPI em [`http://localhost:3000/docs-json`](http://localhost:3000/docs-json). A documentação descreve corpos, respostas, erros e quais operações exigem Bearer token. As rotas públicas são cadastro e login; a exclusão exige autenticação.

## Endpoints

### `POST /users`

Cria uma conta. O nome deve ter ao menos 1 caractere, o e-mail deve ser válido e a senha precisa ter no mínimo 8 caracteres. E-mails são removidos de espaços nas extremidades e convertidos para minúsculas antes de salvar.

```sh
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"name":"Ana Silva","email":"ana@example.com","password":"senha-segura-123"}'
```

Resposta `201 Created`:

```json
{"id":"0194f3a2-7b8c-7def-8abc-123456789012"}
```

### `POST /auth/login`

Autentica com e-mail e senha. E-mail recebe a mesma normalização do cadastro. São permitidas 5 tentativas por endereço IP em cada janela de 15 minutos; ao exceder o limite, a resposta é `429 Too Many Requests` e inclui o cabeçalho `Retry-After`.

```sh
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"senha-segura-123"}'
```

Resposta `200 OK`:

```json
{"accessToken":"<jwt-15-min>","refreshToken":"<jwt-15-dias>","tokenType":"Bearer"}
```

### `POST /auth/refresh`

Troca um refresh token válido por um novo access token. O refresh token original continua válido até expirar.

```sh
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<jwt-15-dias>"}'
```

Resposta `200 OK`:

```json
{"accessToken":"<novo-jwt-15-min>","tokenType":"Bearer"}
```

### `DELETE /users/me`

Exclui a conta associada ao token depois de confirmar a senha atual. A resposta de sucesso é `204 No Content`.

```sh
curl -X DELETE http://localhost:3000/users/me \
  -H 'Authorization: Bearer <jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"password":"senha-segura-123"}'
```

## Erros

As respostas de erro usam `statusCode` e `message`. Erros de validação também incluem `details`:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "details": [
    {"field":"email","message":"Invalid email address"}
  ]
}
```

Os códigos principais são `400` para entrada inválida, `401` para autenticação ou credenciais inválidas, `404` quando o usuário autenticado não existe, `409` quando o e-mail já está em uso, `429` quando o limite de tentativas de login é excedido e `500` para falhas inesperadas.

O limite de login é mantido em memória pelo processo da API. Em uma implantação com múltiplas instâncias, use um armazenamento compartilhado para que o limite valha entre todas elas.
