# Spec — GET /rpg-records/:recordId

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Consultar registros dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `RecordsController.get` em [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
**Plan correspondente:** [2026-10-05-24-get-rpg-records-recordId.md](../plans/2026-10-05-24-get-rpg-records-recordId.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path recordId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body/query | Nenhum body schema; query não é validada nesta rota. |

## Resposta de sucesso

`200` JSON `RpgRecord`: `{id,templateId,values,createdAt,updatedAt}`; mapa literal, sem name fixo ou userId.

## Fluxo implementado

1. `RecordsController.get` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.get(user.id, recordId)`.
2. `find(owner,id)` seleciona pela scope de record (ID + owner transitivo).
3. Retornar row de rpg_records ou null.
4. O serviço aplica requireContent: null → ContentNotFoundError("Resource not found").

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleRecordsRepository.find(owner: string, id: string): Promise<RpgRecord | null>`
- `RecordsService.get` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `implements CRUD with literal Unicode, replacement and no-op timestamps`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `authenticates all routes and returns identical missing and foreign 404s`: Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.

Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.

## Fontes da implementação

- [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts)
- [src/modules/rpg-content/application/records.service.ts](../../../src/modules/rpg-content/application/records.service.ts)
- [src/modules/rpg-content/domain/records.schemas.ts](../../../src/modules/rpg-content/domain/records.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-records.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-records.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/records.repository.ts](../../../src/modules/rpg-content/domain/records.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/records.openapi.ts](../../../src/modules/rpg-content/presentation/http/records.openapi.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts)
- [src/modules/rpg-content/domain/record-values.ts](../../../src/modules/rpg-content/domain/record-values.ts)
- [src/modules/rpg-content/application/records.errors.ts](../../../src/modules/rpg-content/application/records.errors.ts)
