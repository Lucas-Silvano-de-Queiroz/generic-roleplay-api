# Spec — GET /rpg-templates/:templateId/records

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Listar registros dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `RecordsController.list` em [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
**Plan correspondente:** [2026-10-05-23-get-rpg-templates-templateId-records.md](../plans/2026-10-05-23-get-rpg-templates-templateId-records.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path templateId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Query | `listRecordsQuerySchema` estrito; parâmetros desconhecidos rejeitados. |
| limit | String decimal ASCII ^[0-9]+$, convertida em inteiro 1–100; omitir produz número 50. Zeros à esquerda aceitos; expoente, sinal, decimal, vazio e repetição como array rejeitados. |
| cursor | Opcional; z.uuid(); não precisa identificar registro existente/próprio. |

## Resposta de sucesso

`200` JSON `RecordPage`: `{items:[RpgRecord...],nextCursor?}`; template vazio devolve `{items:[]}`.

## Fluxo implementado

1. `RecordsController.list` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.list(user.id, templateId, query)`.
2. Verificar templateScope(owner,templateId); template ausente/alheio retorna null e serviço gera 404.
3. Buscar somente records do template e de ownedTemplates(owner), aplicando id > cursor se fornecido; orderBy(id), limit(query.limit+1).
4. items=rows.slice(0,limit); se existir item extra, nextCursor=ID do último item entregue; caso contrário omitir nextCursor. Cursor é limite inferior, não lookup de recurso.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleRecordsRepository.list(owner: string, templateId: string, query: ListRecordsQuery): Promise<RecordPage | null>`
- `RecordsService.list` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `implements CRUD with literal Unicode, replacement and no-op timestamps`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `authenticates all routes and returns identical missing and foreign 404s`: Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `rejects strict payloads, query parameters, invalid UUIDs and over-sized bodies`: Query limit inválido/repetido, cursor inválido ou parâmetro extra → 400; GET com UUID inválido → 400.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `paginates normally and accepts foreign, deleted and absent cursors without revealing content`: Páginas de 50+50+1; sem nextCursor na última; cursor arbitrário apenas filtra IDs.
- [src/modules/rpg-content/domain/records.schemas.spec.ts](../../../src/modules/rpg-content/domain/records.schemas.spec.ts) — `parses only HTTP decimal integer limits and UUID cursors`: Limit 1–100/default 50, regex decimal; query estrita.

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
