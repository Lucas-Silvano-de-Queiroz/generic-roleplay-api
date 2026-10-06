# Spec — POST /rpg-templates/:templateId/records

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Criar registros dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `RecordsController.create` em [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
**Plan correspondente:** [2026-10-05-22-post-rpg-templates-templateId-records.md](../plans/2026-10-05-22-post-rpg-templates-templateId-records.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path templateId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body | `createRecordSchema`; objeto estrito; extras e null rejeitados. |
| values | Obrigatório. Objeto de strings; keys identifier 1–64; valores até 100000 unidades UTF-16; depois validado contra fields do template atual. |

## Resposta de sucesso

`201` JSON `RpgRecord`: `{id,templateId,values,createdAt,updatedAt}`; mapa literal, sem name fixo ou userId.

## Fluxo implementado

1. `RecordsController.create` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.create(user.id, templateId, input)`.
2. `create` abre transação; localiza pai em rpg_templates com ownership e bloqueia `FOR UPDATE`; pai ausente/alheio retorna null, convertido pelo serviço em 404.
3. Validar values com fields atuais: apenas keys conhecidas; required próprio e não-whitespace; maxLength efetivo min(template,100000). Sem transformação do texto.
4. Depois da validação, contar rpg_records por templateId; count>=1000 gera RecordLimitError.
5. INSERT SELECT revalida templateScope(owner,templateId), grava UUIDv7, values JSONB literal e now() para as duas datas; returning retorna row ou null.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |
| 409 | Record limit reached | Template já possui 1000 records. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleRecordsRepository.create(owner: string, templateId: string, input: CreateRecord): Promise<RpgRecord | null>`
- `RecordsService.create` delega ao repositório; null → ContentNotFoundError via requireContent.
- `validateRecordValues(values: RecordValues, fields: readonly FieldDefinition[]): RecordValidationIssue[]`

## Evidências e critérios de conferência

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `implements CRUD with literal Unicode, replacement and no-op timestamps`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `authenticates all routes and returns identical missing and foreign 404s`: Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `rejects strict payloads, query parameters, invalid UUIDs and over-sized bodies`: Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [test/integration/rpg-records.repository.integration-spec.ts](../../../test/integration/rpg-records.repository.integration-spec.ts) — `serializes two creates at 999 to exactly 1000 records`: Só uma criação vence; outra RecordLimitError; total=1000.
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
