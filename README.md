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

> `drizzle-kit push` sincroniza diretamente o banco e é indicado aqui para desenvolvimento local. Para instalações existentes com sessões, aplique `drizzle/20261005_refresh_tokens.sql` para preservar os refresh tokens ativos e remover a tabela `sessions`; veja abaixo. Os SQLs de rollout são independentes de um journal de migrations Drizzle.

## Documentação OpenAPI

Com `NODE_ENV=development`, a interface Swagger fica em [`http://localhost:3000/docs`](http://localhost:3000/docs), e o documento OpenAPI em [`http://localhost:3000/docs-json`](http://localhost:3000/docs-json). A documentação descreve corpos, respostas, erros e autenticação por cookie. Cadastro, login e readiness dispensam tokens; refresh e logout leem o cookie de refresh. As rotas protegidas leem o cookie de access.

O access token é validado localmente por assinatura RS256, expiração, issuer, audience e tipo de token, sem consultar o banco. Não há `sid` nem modelo de sessões na API. Apenas os hashes SHA-256 dos refresh tokens ativos são persistidos, para rotação e revogação; nenhum token em claro é armazenado.

Login e refresh retornam `204 No Content` e enviam os JWTs somente nos cabeçalhos `Set-Cookie`, sem JSON de tokens. Em desenvolvimento, os nomes são `grp-access` e `grp-refresh`; em produção são `__Host-grp-access` e `__Host-grp-refresh`. Ambos usam `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`, e `Secure` em produção. Cada cookie expira junto com seu JWT. A API autentica exclusivamente por cookies; Bearer no cabeçalho e refresh token no corpo não são aceitos.

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
  -c /tmp/grp-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"senha-segura-123"}'
```

Resposta `204 No Content`, sem corpo. O cookie jar recebe os dois JWTs:

```http
Set-Cookie: grp-access=<jwt>; Path=/; Expires=<15 minutos>; HttpOnly; SameSite=Lax
Set-Cookie: grp-refresh=<jwt>; Path=/; Expires=<15 dias>; HttpOnly; SameSite=Lax
```

### `POST /auth/refresh`

Lê o cookie de refresh e envia um novo par de cookies em `Set-Cookie`. O navegador substitui os valores automaticamente; clientes servidor-servidor devem atualizar seu cookie jar. O token anterior é consumido em uma transação e sua reutilização retorna `401`, sem invalidar o token novo ou access tokens já emitidos. Somente uma renovação concorrente pode vencer; serialize chamadas de refresh e, após perder uma resposta de renovação, autentique novamente. A expiração absoluta do refresh permanece em 15 dias desde o login.

```sh
curl -X POST http://localhost:3000/auth/refresh \
  -b /tmp/grp-cookies.txt \
  -c /tmp/grp-cookies.txt
```

Resposta `204 No Content`, sem corpo, com os novos cookies de access e refresh.

### `DELETE /users/me`

Exclui a conta associada ao token depois de confirmar a senha atual. A resposta de sucesso é `204 No Content`.

```sh
curl -X DELETE http://localhost:3000/users/me \
  -b /tmp/grp-cookies.txt \
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

Os códigos principais são `400` para entrada inválida, `401` para autenticação ou credenciais inválidas, `403` para origem não confiável em uma mutation, `404` quando o usuário autenticado não existe, `409` quando o e-mail já está em uso, `429` quando o limite de tentativas de login é excedido e `500` para falhas inesperadas.

Os limites das rotas de identidade são compartilhados entre instâncias pelo PostgreSQL. Uma falha no armazenamento bloqueia essas operações com resposta controlada. A validação de access tokens nas demais rotas não consulta esse armazenamento. Consulte a tabela de limites abaixo.


## Logout e readiness

`POST /auth/logout` lê o cookie de refresh, revoga seu hash e limpa os dois cookies com `Set-Cookie`. Retorna `204` sem corpo e não exige access token, portanto funciona mesmo quando ele já expirou. Sem cookie de refresh, somente limpa os cookies e retorna `204`; repetir o logout com o mesmo refresh assinado e ainda não expirado também retorna `204`. Cookies de refresh presentes mas inválidos/expirados retornam `401`, com os cabeçalhos de limpeza. Outros logins do mesmo usuário continuam funcionando.

O access token já emitido permanece válido até expirar (até 15 minutos), inclusive depois do logout. A exclusão da conta remove todos os refresh tokens por cascata. Access tokens de uma conta excluída continuam passando pela validação JWT até expirar; operações que exigem a existência da conta retornam `404`.

```sh
curl -X POST http://localhost:3000/auth/logout \
  -b /tmp/grp-cookies.txt \
  -c /tmp/grp-cookies.txt
```

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

As chaves dos contadores são HMACs, sem armazenar e-mail/IP em claro. Incrementos são atômicos; limpar janelas expiradas não altera o limite compartilhado. A limpeza periódica usa índices e lotes de até 4096 contadores e 1000 refresh tokens expirados, com `SKIP LOCKED`. Tokens consumidos ou revogados são removidos imediatamente. Se nenhuma instância estiver ativa, a limpeza retoma ao iniciar o serviço.

`HASH_CONCURRENCY=2` e `HASH_QUEUE_LIMIT=16` limitam hashes efetivamente concorrentes e pendentes por instância. Argon2id usa 64 MiB, três passagens e paralelismo quatro, mantendo o perfil dos hashes existentes. Reduzir o custo do hash não é uma otimização de complexidade desejável. Não há limite assintótico linear de varredura de todos os IPs no event loop; a regex ambígua do domínio foi substituída por validação O(L).

As consultas continuam indexadas por ID/e-mail/hash do refresh token. O limitador PostgreSQL adiciona até três operações indexadas por login e duas nas outras rotas de identidade. A autenticação por access token não adiciona consulta ao banco; consultas de conteúdo e ownership pertencem à operação da rota. Meça carga, locks e latência antes de ajustar conexões ou substituir o backend por um serviço de rate limit. JWT usa APIs assíncronas, mas a biblioteca ainda executa partes de RSA no processo; não há promessa de ausência de bloqueio do event loop.

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
| AUTH_ALLOWED_ORIGINS | vazio | Origens HTTP(S) explícitas autorizadas para requests de browser com cookies; sem paths ou wildcards |

Requests de browser que alteram dados precisam de `Origin` igual ao da API ou presente em `AUTH_ALLOWED_ORIGINS`. Origem não confiável recebe `403` antes de autenticar, consumir refresh ou limpar cookies. Requests com `Sec-Fetch-Site: cross-site` e sem `Origin` também são rejeitados. Chamadas servidor-servidor sem `Origin` são aceitas. Essa validação cobre login, refresh, logout e mutations de conteúdo, junto com `SameSite=Lax`.

Quando o browser chama a API de outra origem, use `credentials: "include"` e cadastre a origem exata, por exemplo `AUTH_ALLOWED_ORIGINS=http://localhost:3000` para Next em 3000 e API em 3001. CORS usa credenciais somente para essa allowlist; nunca usa `*`. `SameSite=Lax` continua limitando envio de cookies entre sites diferentes. Na arquitetura BFF, o Next recebe/atualiza os cookies da API no servidor e envia `Cookie` ao chamar rotas protegidas; o browser não precisa acessar os JWTs por JavaScript.

Todas as instâncias precisam dos mesmos valores de pepper, emissor e destinatário. Alterar esses valores pode invalidar senhas/tokens ou reiniciar orçamentos; planeje rotação de segredos. `TRUSTED_PROXY_CIDRS` aceita IPs/CIDRs explícitos; não aceita confiar em todos os proxies ou em `/0`. Por exemplo, indique o IP exato do balanceador. Não configure pelo número de saltos: caminhos alternativos poderiam permitir falsificação de `X-Forwarded-For`.

Produção requer HTTPS na borda, redirecionamento de HTTP e TLS verificado na conexão PostgreSQL quando atravessar rede não confiável. Use `sslmode=verify-full` e certificados confiáveis conforme o ambiente; nunca desative a validação do certificado. O código não provisiona certificado, cofre de segredos ou alertas externos. Swagger só é registrado com desenvolvimento explícito. As respostas têm request ID gerado pelo servidor, `Cache-Control: no-store`, `nosniff`, proteção contra frames e HSTS em produção. Na borda, estabeleça limites de corpo/conexões/tempo também: rate limit na aplicação não substitui proteção contra flood de rede.

Eventos estruturados incluem `tokens_issued`, `tokens_refreshed`, `refresh_token_revoked`, `refresh_rejected`, `account_deleted`, `security_request_rejected`, `database_idle_connection_error`, `rate_limit_store_unavailable`, `security_state_cleanup_failed` e `unexpected_error`. Encaminhe-os ao monitoramento com controle de acesso/retenção; alerte sobre refresh rejeitado, erros do pool, falha de limpeza e crescimento de 401/429/503. O filtro não registra SQL, mensagens arbitrárias de erro, senhas, tokens ou chaves. Isso reduz exposição, mas o diagnóstico deve usar request IDs e instrumentação controlada. Há uma resposta 409 explícita para cadastro duplicado: ela revela existência de conta; escondê-la exige outro fluxo de produto (como confirmação de e-mail).

## Rollout do schema e compatibilidade

Templates aceitam somente os formatos `text` e `textarea`. Em bancos existentes, pare as instâncias antigas e aplique `drizzle/20261005_remove_markdown_format.sql` antes de iniciar a versão nova: converte o antigo formato `markdown` para `textarea`, mantendo a ordem e as demais propriedades dos campos. Não modifica valores dos registros. A conversão é idempotente e não é aplicada automaticamente pela aplicação.

1. Para a instalação que já possui `users`, `sessions` e `rate_limits`, faça backup e revise `drizzle/20261005_refresh_tokens.sql`. O SQL cria `refresh_tokens`, copia somente os hashes de sessões ativas e não expiradas e remove `sessions` em uma transação. Execute uma única vez. O SQL histórico `20261001_security_state.sql` continua disponível para instalações anteriores ao schema de segurança.
2. Pare as instâncias antigas e aplique a migração antes de implantar a versão nova: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/20261005_refresh_tokens.sql`. Use credenciais/permissões de migração apropriadas; a aplicação não aplica DDL automaticamente. Para um banco novo de desenvolvimento, `drizzle-kit push` cria diretamente `refresh_tokens` e não cria `sessions`.
3. Atualize o cliente para login/refresh com resposta `204` e cookies em `Set-Cookie`; as requisições privadas, refresh e logout precisam enviar `Cookie`. Remova a dependência de tokens em JSON e Authorization Bearer e serialize chamadas de refresh. Tokens ativos da versão anterior continuam criptograficamente válidos e os hashes de refresh são migrados, mas o contrato HTTP mudou: usuários de clientes antigos podem precisar autenticar novamente. Novas emissões não incluem `sid`. Não misture instâncias antigas e novas durante o rollout.
4. Confira `/health/ready`, teste login/refresh/logout/exclusão e configure HTTPS, TLS do banco e coleta de eventos na implantação.

Os containers e GitHub Actions estão fixados por digest/SHA. Atualize essas referências com revisão periódica; fixação não significa ausência de vulnerabilidades na imagem. Nodemailer sem uso foi removido. Overrides restritos em `pnpm-workspace.yaml` corrigem resoluções que upstream ainda fixa; reavalie/remova quando essas dependências adotarem as correções. CI usa Node 24, pnpm 11.25.0, instalação congelada, build/lint, testes e auditoria de todas as dependências; os testes geram chaves descartáveis sem usar segredos locais.
