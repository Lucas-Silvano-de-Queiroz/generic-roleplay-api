# Spec — POST /rpg-systems/:systemId/collections

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Criar coleções dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `CollectionsController.create` em [src/modules/rpg-content/presentation/http/collections.controller.ts](../../../src/modules/rpg-content/presentation/http/collections.controller.ts).
**Plan correspondente:** [2026-10-05-12-post-rpg-systems-systemId-collections.md](../plans/2026-10-05-12-post-rpg-systems-systemId-collections.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path systemId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body | `createCollectionSchema`; objeto estrito; extras e null rejeitados. |
| name | Obrigatório. String até 100 unidades UTF-16 antes de trim, não vazia após trim. |
| description | Opcional, string literal até 5000 unidades; vazio permitido. |
| identifier | Obrigatório. String 1–64, ^[a-z][a-z0-9_-]*$, sem trim ou coerção. |

## Resposta de sucesso

`201` JSON `RpgCollection`: `{id,systemId,name,identifier,description?,createdAt,updatedAt}`; description SQL NULL omitida.

## Fluxo implementado

1. `CollectionsController.create` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `CollectionsService.create(user.id, systemId, input)`.
2. `createCollection` abre transação; localiza pai em rpg_systems com ownership e bloqueia `FOR UPDATE`; pai ausente/alheio retorna null, convertido pelo serviço em 404.
3. Contar collections do pai; count>=100 gera ContentLimitError("Collection"). Inserir UUIDv7, input e ID do pai, com timestamps defaultNow; retornar view.
4. Unicidade do identifier é garantida pela constraint do pai; erro PostgreSQL 23505 na constraint nomeada é traduzido em ContentIdentifierConflictError; outros erros são propagados.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |
| 409 | Collection identifier already exists | Identifier duplicado no mesmo pai. |
| 409 | Collection limit reached | Pai já possui 100 filhos. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.createCollection(owner: string, systemId: string, input: CreateCollection): Promise<RpgCollection | null>`
- `CollectionsService.create` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `returns indistinguishable 404s for foreign and missing resources in every operation`: Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `rejects unknown properties, moves, null, invalid fields and excessive sizes`: Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `enforces scoped identifier uniqueness in create and PATCH`: Identifier repetido no mesmo pai gera 409; outro pai permite repetir.
- [test/integration/rpg-content.repository.integration-spec.ts](../../../test/integration/rpg-content.repository.integration-spec.ts) — `serializes concurrent collections at 99 to a maximum of 100`: Duas criações a partir de 99 filhos: uma vence, uma rejeita; total=100.

Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.

## Fontes da implementação

- [src/modules/rpg-content/presentation/http/collections.controller.ts](../../../src/modules/rpg-content/presentation/http/collections.controller.ts)
- [src/modules/rpg-content/application/collections.service.ts](../../../src/modules/rpg-content/application/collections.service.ts)
- [src/modules/rpg-content/domain/content.schemas.ts](../../../src/modules/rpg-content/domain/content.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/content.repository.ts](../../../src/modules/rpg-content/domain/content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)
