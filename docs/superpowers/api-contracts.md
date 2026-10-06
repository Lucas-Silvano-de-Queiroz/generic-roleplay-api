# Contratos compartilhados da API implementada

Referência: código do working tree em 2026-10-05, incluindo alterações locais já presentes. O HEAD de referência é `55a833dbc3eb6e215beaaa75b6c151302dad08a2`; ele sozinho não representa este retrato. Estes documentos descrevem a implementação existente. Os plans são roteiros de reprodução e conferência dessa implementação, sem proposta de mudança de comportamento.

Todos os caminhos de código e comandos são relativos à raiz de `generic-roleplay-api`. O trabalho documental se limita a esta API. As specs são documentos Markdown; os arquivos `*.spec.ts`, `*.integration-spec.ts` e `*.e2e-spec.ts` continuam sendo os testes existentes.

## Registro HTTP e ordem de processamento

[AppModule](../../src/app.module.ts) importa `IdentityModule` e `RpgContentModule` e registra `HealthController`. São 26 operações declaradas nos sete controllers. Não há prefixo global em [main.ts](../../src/main.ts). Além delas, o bootstrap registra Swagger somente quando `env.isDevelopment` é verdadeiro: `/docs`, `/docs-json` e `/docs-yaml`, com aliases e assets fornecidos pela biblioteca.

[configureHttpApplication](../../src/modules/shared/presentation/configure-http-application.ts) instala o middleware de cabeçalhos antes da inicialização; `AppModule` também o associa às rotas. O request ID é preservado entre essas duas passagens. Parsing do corpo precede guards e pipes. As políticas globais incluem `CookieOriginGuard`, `IdentityRateLimitGuard` e `JwtAuthGuard`, este último registrado em `IdentityModule`. A origem é rejeitada antes dos efeitos dos handlers; `@Public()` dispensa apenas o guard JWT. Os endpoints de Swagger são registrados diretamente no adapter pela biblioteca, fora dos controllers e de seus guards.

O parser padrão do Nest/Express limita o corpo a 100 KiB; o bootstrap não redefine esse limite. Há evidência HTTP de `413` nos testes de conteúdo, registros e segurança. Limites por campo não substituem o limite do corpo completo. Queries só passam por um schema nesta implementação em `GET /rpg-templates/:templateId/records`; as outras rotas não declaram `@Query` nem validação de parâmetros adicionais.

## Cookies e autenticação

Fontes: [JwtAuthGuard](../../src/modules/identity/infrastructure/auth/jwt-auth.guard.ts), [JwtStrategy](../../src/modules/identity/infrastructure/passport/jwt.strategy.ts), [auth-cookies](../../src/modules/shared/infrastructure/auth/auth-cookies.ts), [IdentityModule](../../src/modules/identity/identity.module.ts).

| Configuração | Desenvolvimento | Produção |
| --- | --- | --- |
| Access | `grp-access` | `__Host-grp-access` |
| Refresh | `grp-refresh` | `__Host-grp-refresh` |
| `Secure` | `false` | `true` |

Ambos usam `HttpOnly`, `SameSite=Lax`, `Path=/`, sem `Domain`. `Expires` vem do `exp` do JWT. Limpar cookies usa os mesmos nomes e opções. O leitor procura exatamente uma ocorrência do cookie solicitado, decodifica com `decodeURIComponent` e aceita apenas valores com 1–4096 unidades de string; ausência, duplicação, vazio, excesso de tamanho ou escape inválido retornam `null`.

Access é extraído exclusivamente do cookie. A estratégia valida assinatura RS256, expiração, issuer e audience e exige payload com `sub` UUID, `exp` inteiro positivo e `tokenUse: "access"`. Produz `{ id: sub }` para `@CurrentUser`. Não consulta conta, sessão ou banco. O cabeçalho `Authorization: Bearer` não é uma fonte de autenticação.

Access dura 15 minutos. Refresh tem `sub`, `jti` UUID aleatório e `tokenUse: "refresh"`, além das claims padrão. O login fixa a expiração de refresh em 15 dias, arredondada para segundos. A rotação conserva o `exp` recebido, sem estender essa janela. O schema de refresh permite claims extras de tokens legados, mas os tokens novos não incluem `sid`. `tokenType: "Bearer"` pertence ao retorno interno do serviço; login e refresh HTTP retornam `204` com cookies e nenhum JSON.

## Origem, CORS e proxy

Fonte: [CookieOriginGuard](../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts).

- `GET`, `HEAD` e `OPTIONS` passam pelo guard de origem.
- Outras requisições com `Origin` precisam de igualdade exata com `${request.protocol}://${request.get("host")}` ou uma entrada de `AUTH_ALLOWED_ORIGINS`.
- Sem `Origin`, são aceitas, exceto quando `Sec-Fetch-Site` é exatamente `cross-site`.
- A rejeição é `403 {"statusCode":403,"message":"Untrusted request origin"}`. Nenhum handler é executado.

CORS com `credentials: true` só é habilitado se a allowlist não estiver vazia. Origens são HTTP(S) explícitas, sem paths ou wildcards. `trust proxy` é `false` por padrão; quando configurado, usa a lista de IPs/CIDRs explícitos. A validação de ambiente rejeita `/0`.

## Rate limit de identidade

Fontes: [IdentityRateLimitGuard](../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts), [PostgreSqlRateLimitStore](../../src/modules/shared/infrastructure/auth/postgresql-rate-limit.store.ts).

| Operação | Por IP | Adicional |
| --- | --- | --- |
| `POST /users` | 10 / 900 s | Global |
| `POST /auth/login` | 5 / 900 s | 5 / 900 s por e-mail + global |
| `POST /auth/refresh` | 30 / 60 s | Global |
| `POST /auth/logout` | 30 / 60 s | Global |
| `DELETE /users/me` | 5 / 900 s | Global |

A sequência de consumo é global, IP e, no login, e-mail quando o corpo possui string com até 512 unidades, normalizada com `trim().toLowerCase()`. O orçamento global por 60 segundos usa `AUTH_GLOBAL_LIMIT`, padrão 1200, intervalo permitido 10–1200. As demais rotas não têm política nesse guard. Requisições que chegam ao guard contam mesmo se falharem depois na validação/credenciais. Falhas de parsing anteriores ao guard e rejeições de origem anteriores ao consumo não seguem essa contagem.

Os contadores persistidos usam HMAC-SHA256 com `PEPPER`. O SQL faz upsert atômico; janela começa na primeira chamada e reinicia quando expira. Contagem satura em `limit + 1`. Negação gera `429`, mensagem `Too many requests. Try again later.` e `Retry-After` em segundos, arredondado para cima, mínimo 1. Falha no store gera `503`, mensagem `Authentication service unavailable`. Não se deve atribuir automaticamente `503` a todo erro do banco: erros fora do store, sem exceção HTTP própria, caem em `500`.

## Entrada de identidade

Fonte: [identity-input.schemas](../../src/modules/identity/presentation/http/dto/identity-input.schemas.ts) e DTOs adjacentes.

| Campo | Comportamento real |
| --- | --- |
| `name` | String bruta até 1024 unidades UTF-16; `trim`; resultado com 1–255 pontos de código (`Array.from`) |
| `email` | String bruta até 512 unidades; `trim`, minúsculas, até 255 unidades; `z.email("Invalid email address")` |
| `password` cadastro/exclusão | String com 8–1024 unidades UTF-16; sem trim ou truncamento |
| `password` login | String com 1–1024 unidades UTF-16; sem trim ou truncamento |

Os schemas de identidade usam `z.object`: propriedades extras são removidas do resultado validado, não rejeitadas. Campos obrigatórios ausentes ou `null` falham. `Email.create` normaliza novamente e valida no domínio: até 255 unidades, sem whitespace, um único `@`, parte local não vazia e ponto no domínio com texto antes/depois.

Hash: [Argon2HashServiceAdapter](../../src/modules/identity/infrastructure/crypto/argon2-hash.adapter.ts) concatena senha e `PEPPER`, usa Argon2id com `memoryCost=65536`, `timeCost=3`, `parallelism=4`. Inicializa um hash dummy; login compara contra ele quando a conta não existe. A fila FIFO admite padrão 2 trabalhos ativos e 16 pendentes. Saturação retorna `503`, mensagem `Authentication capacity exceeded. Try again later.`. A conta é identificada por UUIDv7; o e-mail tem unicidade no banco.

## Entrada de conteúdo

Fonte: [content.schemas](../../src/modules/rpg-content/domain/content.schemas.ts).

Os objetos são `z.strictObject`: extras são rejeitados, inclusive IDs, owner e troca de pai. `null` não é aceito nos campos declarados. Nomes/labels têm limite de 100 unidades UTF-16 **antes** do trim e precisam ficar não vazios **depois** do trim. Descrições são preservadas literalmente, até 5000 unidades; `""` é permitido. `identifier` e `key` têm 1–64 unidades e padrão `^[a-z][a-z0-9_-]*$`, sem normalização.

Templates acrescentam `category` opcional, string até 64 unidades, inclusive vazia, sem enum ou trim; ela não escolhe um schema. `fields` é array ordenado com até 100 entradas, inclusive vazio. No cadastro, omissão resulta em `[]`; no PATCH, omissão preserva o array atual. Cada definição é estrita:

| Campo | Regra |
| --- | --- |
| `key` | Obrigatório, regra de identifier; único dentro do array |
| `label` | Obrigatório, regra de nome |
| `description` | Opcional, string literal até 1000 unidades |
| `required` | Booleano, padrão `false` |
| `maxLength` | Opcional, número inteiro 1–100000; sem coerção |
| `format` | `text` ou `textarea`, padrão `text` |

O formato `markdown` é rejeitado no contrato atual. A migration `drizzle/20261005_remove_markdown_format.sql` converte definições antigas para `textarea`; não roda automaticamente no bootstrap. Nenhum formato transforma valores textuais em HTML.

## Respostas, ownership e persistência de conteúdo

Fontes: [content](../../src/modules/rpg-content/domain/content.ts), [records](../../src/modules/rpg-content/domain/records.ts), [ownership](../../src/modules/rpg-content/infrastructure/database/content-ownership.ts), [schema de conteúdo](../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts), [schema de registros](../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts).

| Tipo HTTP | Propriedades |
| --- | --- |
| `RpgSystem` | `id`, `name`, `description?`, `createdAt`, `updatedAt` |
| `RpgCollection` | Propriedades de sistema + `systemId`, `identifier` |
| `RpgTemplate` | Propriedades de sistema + `collectionId`, `identifier`, `category?`, `fields` |
| `RpgRecord` | `id`, `templateId`, `values`, `createdAt`, `updatedAt` |
| `RecordPage` | `items: RpgRecord[]`, `nextCursor?` |

Datas são `Date` internamente, serializadas como strings ISO no JSON. Descrição/category SQL `NULL` são omitidas da resposta; strings vazias são mantidas. `userId` não aparece nas views de conteúdo. Os novos IDs são UUIDv7, mas parâmetros de rota usam `new ParseUUIDPipe()` sem restringir a versão a v7. Os corpos não podem fornecer IDs ou timestamps. Responses não passam por um pipe Zod: os schemas de saída são usados na documentação OpenAPI.

Ownership acompanha `users → rpg_systems → rpg_collections → rpg_templates → rpg_records`, por subqueries nos predicados SQL. Recurso de outro usuário e recurso ausente geram o mesmo `404 Resource not found`. Listar um pai próprio vazio produz lista vazia; listar filhos de um pai ausente/alheio produz 404. A listagem raiz de sistemas apenas filtra pelo `userId` do JWT e pode retornar `[]`, inclusive se a conta já foi removida.

Não existe limite de sistemas implementado. São permitidas até 100 coleções por sistema, 100 templates por coleção e 1000 registros por template. As criações de filhos bloqueiam o pai com `FOR UPDATE`, em transação, para conferir ownership e quota. Identifiers são únicos por pai; nomes podem repetir. Sistemas/coleções/templates são listados integralmente, em ID crescente, sem paginação.

PATCH de conteúdo aceita `{}`. Campos omitidos são preservados. Uma diferença semântica (`isDeepStrictEqual`) atualiza `updatedAt`; no-op devolve o estado atual e preserva ambas as datas. Renomear não deriva identifier. Campos opcionais não podem ser limpos com `null`; descrições/category podem ser alteradas para `""`. Reordenação de fields é alteração do array.

As FKs usam `ON DELETE CASCADE`: remover conta, sistema, coleção ou template remove todos os descendentes pertinentes. Remover conta também remove todos os refresh tokens. Repetir DELETE de conteúdo após a remoção retorna 404, não 204.

## Valores de registros

Fontes: [records.schemas](../../src/modules/rpg-content/domain/records.schemas.ts), [validateRecordValues](../../src/modules/rpg-content/domain/record-values.ts), [DrizzleRecordsRepository](../../src/modules/rpg-content/infrastructure/database/drizzle-records.repository.ts).

POST exige `{values: Record<string,string>}`; PATCH permite `{}` ou `{values: ...}`. Corpo estrito. `values` é objeto, não array, com keys válidas pela regra de identifier e strings de até 100000 unidades UTF-16. A validação estrutural ocorre no pipe, antes da consulta. Depois de localizar o template autorizado, a validação de domínio rejeita keys que não pertençam aos fields e exige propriedade própria com texto não-whitespace para cada field `required`. Campos opcionais aceitam vazio/whitespace e podem faltar. O limite efetivo é `min(field.maxLength ?? 100000, 100000)`. Strings, Unicode, espaços, quebras de linha e texto com aparência de HTML são persistidos literalmente. Registro não possui campo fixo `name`; nomes podem existir como key dinâmica definida pelo template.

PATCH com `values` substitui o mapa inteiro; opcionais omitidos são removidos. Omitir `values` ou reenviar mapa semanticamente igual preserva `updatedAt`. Não há merge, preenchimento automático ou truncamento. Template sem fields aceita somente `{values:{}}`. Atualizações inválidas mantêm valores e timestamps anteriores.

Criar, atualizar e excluir registros bloqueia o template na transação. PATCH do template também bloqueia esse template; se fields realmente mudarem, valida todos os registros existentes em lotes de 50, por ID. Incompatibilidade retorna `409 Template change would invalidate existing records` e rollback de toda a alteração, inclusive metadados. Labels/format/descrições, reordenação, inclusão de opcionais e remoção de keys não usadas podem ser compatíveis; o resultado depende de validar todos os valores existentes.

## Erros e cabeçalhos compartilhados

Fontes: [ZodValidationPipe](../../src/modules/shared/presentation/pipes/zod-validation.pipe.ts), [GlobalExceptionFilter](../../src/modules/shared/presentation/filters/global-exception.filter.ts), [SecurityHeadersMiddleware](../../src/modules/shared/presentation/middleware/security-headers.middleware.ts).

Formato: `{statusCode:number,message:string,details?:{field:string,message:string}[]}`. Todo 400 do filtro HTTP usa `message: "Validation failed"`. Erros Zod incluem caminhos unidos por ponto; erro de UUID pelo `ParseUUIDPipe` não fornece a mesma lista de detalhes. Validação de values usa paths `values.<key>` e mensagens `Unknown template field`, `Required field must contain non-whitespace text`, `Must contain at most <limite> UTF-16 units`. Erros inesperados viram `500 Internal Server Error`. Corpo excessivo vira `413 Request body too large`.

O OpenAPI aplica grupos de erros aos controllers; isso pode documentar 409 em operações que não têm ramo de conflito próprio. Os erros específicos efetivamente produzidos estão em cada spec. Guards de origem e exceções genéricas também podem produzir respostas que não aparecem nos decorators de Swagger atuais; esta documentação descreve o runtime sem alterar decorators.

Cabeçalhos: `X-Request-Id` gerado pelo servidor, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, remoção de `X-Powered-By`; produção acrescenta `Strict-Transport-Security: max-age=31536000`. Falhas 401/403/429/503 geram `security_request_rejected`; falhas inesperadas geram `unexpected_error`, com request ID e sem imprimir o erro arbitrário. Eventos próprios de emissão, rotação, revogação e exclusão estão nas specs correspondentes.

## Conferência e testes existentes

Comandos sempre executados na raiz da API:

```sh
pnpm test
pnpm exec vitest run --config ./vitest.config.e2e.ts <arquivos-existentes>
```

O segundo comando inclui integração e E2E e requer Docker disponível ao Testcontainers. O global setup cria PostgreSQL 17 temporário, aplica o schema com `pushSchema` e fornece chaves RSA/pepper temporários; não usa o banco de desenvolvimento como alvo dos testes. Alguns testes limpam `rate_limits` desse banco de teste. O primeiro comando exclui arquivos de integração/E2E.

Cada plan liga os testes existentes às regras da spec. Comandos nos plans são roteiros de verificação, não declaração de execução nesta entrega. Lacunas de cobertura automatizada são identificadas como conferência estática, sem inventar testes presentes ou prometer comportamento não implementado. As alterações desta entrega são apenas documentos; não requerem reimplementar handlers ou executar migrations.
