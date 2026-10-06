# Spec — DELETE /rpg-records/:recordId

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Excluir registros dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `RecordsController.delete` em [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
**Plan correspondente:** [2026-10-05-26-delete-rpg-records-recordId.md](../plans/2026-10-05-26-delete-rpg-records-recordId.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path recordId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body/query | Nenhum body schema; query não é validada nesta rota. |

## Resposta de sucesso

`204`, corpo vazio; o serviço conclui sem retornar entidade.

## Fluxo implementado

1. `RecordsController.delete` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.delete(user.id, recordId)`.
2. Em transação, localizar record com recordScope; localizar/bloquear template autorizado FOR UPDATE; ausência retorna false.
3. DELETE rpg_records com recordScope e RETURNING id; presença retorna true; remover somente este record.
4. Serviço converte false em ContentNotFoundError; true conclui sem corpo.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleRecordsRepository.delete(owner: string, id: string): Promise<boolean>`
- `RecordsService.delete` delega ao repositório; false → ContentNotFoundError; true → void.

## Evidências e critérios de conferência

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `implements CRUD with literal Unicode, replacement and no-op timestamps`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `authenticates all routes and returns identical missing and foreign 404s`: Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.
- [test/integration/rpg-records.repository.integration-spec.ts](../../../test/integration/rpg-records.repository.integration-spec.ts) — `CRUD preserves literal text, replaces values, and keeps timestamps on semantic no-ops`: Excluir record retorna true, repetir false; sibling permanece intacto.

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
