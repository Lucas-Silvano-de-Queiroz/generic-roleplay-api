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

`SERVER_PORT` aceita valores de 1 a 65535 e usa `3000` por padrão. `NODE_ENV` é obrigatório e aceita `development` ou `production`. `PEPPER` precisa ter pelo menos 32 caracteres. As chaves JWT precisam ser um par RSA correspondente de 2048 a 4096 bits codificado em Base64. O access token expira em 15 minutos (`JWT_EXPIRES_IN=15m`) e o refresh token em 15 dias (`JWT_REFRESH_EXPIRES_IN=15d`).

> `drizzle-kit push` sincroniza diretamente o banco e é indicado aqui para desenvolvimento local. Para atualizar uma instalação existente, há um SQL aditivo de rollout em `drizzle/20261001_security_state.sql`; veja abaixo. Ele é independente de um journal de migrations Drizzle.

## Documentação OpenAPI

Com `NODE_ENV=development`, a interface Swagger fica em [`http://localhost:3000/docs`](http://localhost:3000/docs), e o documento OpenAPI em [`http://localhost:3000/docs-json`](http://localhost:3000/docs-json). A documentação descreve corpos, respostas, erros e quais operações exigem Bearer token. As rotas públicas são cadastro, login, refresh e readiness; exclusão e logout exigem autenticação.

## Endpoints

### `POST /users`

Cria uma conta. O nome é normalizado e deve ter de 1 a 255 caracteres Unicode, o e-mail deve ser válido e a senha precisa ter de 8 a 1024 unidades UTF-16; ela nunca é truncada. E-mails são removidos de espaços nas extremidades e convertidos para minúsculas antes de salvar.

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

Troca um refresh token válido por um novo par de tokens. O cliente deve substituir o refresh token anterior pelo novo. A reutilização de um token anterior revoga a sessão inteira, incluindo os access tokens. Não envie renovações concorrentes; após perder uma resposta de renovação, autentique novamente. O prazo absoluto da sessão continua sendo 15 dias desde o login.

```sh
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<jwt-15-dias>"}'
```

Resposta `200 OK`:

```json
{"accessToken":"<novo-jwt-15-min>","refreshToken":"<novo-refresh-jwt>","tokenType":"Bearer"}
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

Os limites são compartilhados entre instâncias pelo PostgreSQL. Uma falha no armazenamento impede autenticação com resposta controlada. Consulte a tabela de limites abaixo.


## Logout e readiness

`POST /auth/logout`, com `Authorization: Bearer <accessToken>`, retorna `204` e revoga a sessão atual. Depois disso, tanto o access quanto o refresh recebem `401`. A exclusão da conta revoga todas as sessões por cascata no banco; tokens antigos passam a receber `401`, em vez de `404`.

`GET /health/ready` retorna `200 {"status":"ready"}` quando o banco e as tabelas de segurança estão disponíveis, ou `503` genérico. Use para readiness em uma rede de monitoramento; não há detalhes de infraestrutura na resposta. Restrinja sondagens na borda para evitar consultas abusivas.

## Limites e custo operacional

| Rota | Limite por IP | Limite adicional |
| --- | --- | --- |
| POST /auth/login | 5 / 15 minutos | 5 / 15 minutos por e-mail normalizado |
| POST /users | 10 / 15 minutos | Orçamento global compartilhado |
| POST /auth/refresh | 30 / minuto | Orçamento global compartilhado |
| POST /auth/logout | 30 / minuto | Orçamento global compartilhado |
| DELETE /users/me | 5 / 15 minutos | Orçamento global compartilhado |

Todos esses endpoints consomem primeiro o orçamento compartilhado de `AUTH_GLOBAL_LIMIT` chamadas por minuto (padrão e máximo: 1200). Chamadas malformadas ou bem-sucedidas também contam. Respostas `429` incluem `Retry-After`; `503` pode indicar fila de hashing saturada ou indisponibilidade do armazenamento. NATs compartilham o limite por IP. O limite temporário por conta também pode ser usado para incomodar um usuário; monitore bloqueios e adapte a política ao tráfego real.

As chaves dos contadores são HMACs, sem armazenar e-mail/IP em claro. Incrementos são atômicos; limpar janelas expiradas não altera o limite compartilhado. A limpeza periódica usa índices e lotes de até 4096 contadores e 1000 sessões, com `SKIP LOCKED`. Sessões revogadas ficam até a expiração para preservar a detecção de replay. Se nenhuma instância estiver ativa, a limpeza retoma ao iniciar o serviço.

`HASH_CONCURRENCY=2` e `HASH_QUEUE_LIMIT=16` limitam hashes efetivamente concorrentes e pendentes por instância. Argon2id usa 64 MiB, três passagens e paralelismo quatro, mantendo o perfil dos hashes existentes. Reduzir o custo do hash não é uma otimização de complexidade desejável. Não há limite assintótico linear de varredura de todos os IPs no event loop; a regex ambígua do domínio foi substituída por validação O(L).

As consultas continuam indexadas por ID/e-mail/sessão. O limitador PostgreSQL adiciona até três operações indexadas por login e duas nas outras rotas, além da consulta de sessão em endpoints protegidos. O custo é aproximadamente O(log K) no armazenamento dos contadores e O(log S) nas sessões. Meça carga, locks e latência antes de ajustar conexões ou substituir o backend por um serviço de rate limit. JWT usa APIs assíncronas, mas a biblioteca ainda executa partes de RSA no processo; não há promessa de ausência de bloqueio do event loop.

## Configuração adicional e produção

| Variável | Padrão | Efeito |
| --- | --- | --- |
| JWT_ISSUER | generic-roleplay-api | Emissor esperado dos JWTs |
| JWT_AUDIENCE | generic-roleplay-client | Destinatário esperado dos JWTs |
| HASH_CONCURRENCY | 2 | 1–8 hashes ativos por instância |
| HASH_QUEUE_LIMIT | 16 | 0–128 hashes em espera por instância |
| DATABASE_QUERY_TIMEOUT_MS | 5000 | Prazo de statement; cliente tem 1 segundo adicional; locks no máximo 2 segundos |
| AUTH_GLOBAL_LIMIT | 1200 | 10–1200 chamadas de identidade por minuto entre instâncias |
| TRUSTED_PROXY_CIDRS | vazio | IPs/CIDRs dos proxies confiáveis, separados por vírgula |

Todas as instâncias precisam dos mesmos valores de pepper, emissor e destinatário. Alterar esses valores pode invalidar senhas/tokens ou reiniciar orçamentos; planeje rotação de segredos. `TRUSTED_PROXY_CIDRS` aceita IPs/CIDRs explícitos; não aceita confiar em todos os proxies ou em `/0`. Por exemplo, indique o IP exato do balanceador. Não configure pelo número de saltos: caminhos alternativos poderiam permitir falsificação de `X-Forwarded-For`.

Produção requer HTTPS na borda, redirecionamento de HTTP e TLS verificado na conexão PostgreSQL quando atravessar rede não confiável. Use `sslmode=verify-full` e certificados confiáveis conforme o ambiente; nunca desative a validação do certificado. O código não provisiona certificado, cofre de segredos ou alertas externos. Swagger só é registrado com desenvolvimento explícito. As respostas têm request ID gerado pelo servidor, `Cache-Control: no-store`, `nosniff`, proteção contra frames e HSTS em produção. Na borda, estabeleça limites de corpo/conexões/tempo também: rate limit na aplicação não substitui proteção contra flood de rede.

Eventos estruturados incluem `session_created`, `session_refreshed`, `session_revoked`, `refresh_replay`, `account_deleted`, `security_request_rejected`, `database_idle_connection_error`, `rate_limit_store_unavailable`, `security_state_cleanup_failed` e `unexpected_error`. Encaminhe-os ao monitoramento com controle de acesso/retenção; alerte sobre replay, erros do pool, falha de limpeza e crescimento de 401/429/503. O filtro não registra SQL, mensagens arbitrárias de erro, senhas, tokens ou chaves. Isso reduz exposição, mas o diagnóstico deve usar request IDs e instrumentação controlada. Há uma resposta 409 explícita para cadastro duplicado: ela revela existência de conta; escondê-la exige outro fluxo de produto (como confirmação de e-mail).

## Rollout do schema e compatibilidade

1. Faça backup e revise `drizzle/20261001_security_state.sql` para a instalação existente, que já deve ter `users` no schema padrão. O SQL cria `sessions`, `rate_limits` e índices em uma transação; executa uma única vez e falha se as tabelas já existirem. Não o reaplique após `drizzle-kit push` já ter criado o mesmo schema.
2. Aplique antes de implantar a versão nova, por exemplo: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/20261001_security_state.sql`. Use credenciais/permissões de migração apropriadas; a aplicação não aplica DDL automaticamente. Para um banco novo de desenvolvimento, `drizzle-kit push` cria todo o schema.
3. Atualize o cliente para guardar o `refreshToken` devolvido a cada renovação e serializar chamadas de refresh. Os tokens stateless antigos não possuem sessão e deixam de funcionar: os usuários precisam autenticar novamente. Não misture versões antigas e novas atendendo as mesmas sessões durante o rollout.
4. Confira `/health/ready`, teste login/refresh/logout/exclusão e configure HTTPS, TLS do banco e coleta de eventos na implantação.

Os containers e GitHub Actions estão fixados por digest/SHA. Atualize essas referências com revisão periódica; fixação não significa ausência de vulnerabilidades na imagem. Nodemailer sem uso foi removido. Overrides restritos em `pnpm-workspace.yaml` corrigem resoluções que upstream ainda fixa; reavalie/remova quando essas dependências adotarem as correções. CI usa Node 24, pnpm 11.25.0, instalação congelada, build/lint, testes e auditoria de todas as dependências; os testes geram chaves descartáveis sem usar segredos locais.
