# Spec — GET /rpg-collections/:collectionId

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Consultar coleções dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `CollectionsController.get` em [src/modules/rpg-content/presentation/http/collections.controller.ts](../../../src/modules/rpg-content/presentation/http/collections.controller.ts).
**Plan correspondente:** [2026-10-05-14-get-rpg-collections-collectionId.md](../plans/2026-10-05-14-get-rpg-collections-collectionId.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path collectionId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body/query | Nenhum body schema; query não é validada nesta rota. |

## Resposta de sucesso

`200` JSON `RpgCollection`: `{id,systemId,name,identifier,description?,createdAt,updatedAt}`; description SQL NULL omitida.

## Fluxo implementado

1. `CollectionsController.get` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `CollectionsService.get(user.id, collectionId)`.
2. `findCollection(owner,id)` seleciona pela scope de collection (ID + owner transitivo).
3. Retornar collectionView(row) ou null; SQL NULL dos opcionais não aparece no JSON.
4. O serviço aplica requireContent: null → ContentNotFoundError("Resource not found").

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.findCollection(owner: string, id: string): Promise<RpgCollection | null>`
- `CollectionsService.get` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `returns indistinguishable 404s for foreign and missing resources in every operation`: Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.

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
