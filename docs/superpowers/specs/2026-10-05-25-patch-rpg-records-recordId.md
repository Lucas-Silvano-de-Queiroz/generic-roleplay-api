# Spec — PATCH /rpg-records/:recordId

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Atualizar parcialmente registros dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `RecordsController.update` em [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
**Plan correspondente:** [2026-10-05-25-patch-rpg-records-recordId.md](../plans/2026-10-05-25-patch-rpg-records-recordId.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path recordId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body | `updateRecordSchema`; objeto estrito; extras e null rejeitados. Todos os campos opcionais; {} aceito. |
| values | Opcional; omissão preserva mapa. Objeto de strings; keys identifier 1–64; valores até 100000 unidades UTF-16; depois validado contra fields do template atual. |

## Resposta de sucesso

`200` JSON `RpgRecord`: `{id,templateId,values,createdAt,updatedAt}`; mapa literal, sem name fixo ou userId.

## Fluxo implementado

1. `RecordsController.update` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.update(user.id, recordId, input)`.
2. Transação: localizar record com recordScope; localizar/bloquear template autorizado FOR UPDATE; reler record com ownership. Qualquer ausência retorna null → 404.
3. values omitido ou isDeepStrictEqual(current.values,input.values) retorna current sem mudar timestamps.
4. Para mapa diferente, validar contra fields atuais; erro gera 400 e rollback.
5. UPDATE substitui integralmente values e define updatedAt=new Date(), com recordScope no predicado; createdAt preservado. Opcionais não enviados no novo mapa são removidos.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleRecordsRepository.update(owner: string, id: string, input: UpdateRecord): Promise<RpgRecord | null>`
- `RecordsService.update` delega ao repositório; null → ContentNotFoundError via requireContent.
- `validateRecordValues(values: RecordValues, fields: readonly FieldDefinition[]): RecordValidationIssue[]`

## Evidências e critérios de conferência

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `implements CRUD with literal Unicode, replacement and no-op timestamps`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `authenticates all routes and returns identical missing and foreign 404s`: Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `rejects strict payloads, query parameters, invalid UUIDs and over-sized bodies`: Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [test/integration/rpg-records.repository.integration-spec.ts](../../../test/integration/rpg-records.repository.integration-spec.ts) — `CRUD preserves literal text, replaces values, and keeps timestamps on semantic no-ops`: No-op e mapa igual com ordem de keys diferente preservam timestamps; mapa diferente substitui values.
- [src/modules/rpg-content/domain/record-values.spec.ts](../../../src/modules/rpg-content/domain/record-values.spec.ts) — `counts UTF-16 and enforces template and global lengths`: Comprimento efetivo conta UTF-16 e respeita maxLength/global.

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
