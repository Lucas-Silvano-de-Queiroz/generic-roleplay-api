# Spec — PATCH /rpg-templates/:templateId

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Atualizar parcialmente templates dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `TemplatesController.update` em [src/modules/rpg-content/presentation/http/templates.controller.ts](../../../src/modules/rpg-content/presentation/http/templates.controller.ts).
**Plan correspondente:** [2026-10-05-20-patch-rpg-templates-templateId.md](../plans/2026-10-05-20-patch-rpg-templates-templateId.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path templateId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body | `updateTemplateSchema`; objeto estrito; extras e null rejeitados. Todos os campos opcionais; {} aceito. |
| name | Opcional. String até 100 unidades UTF-16 antes de trim, não vazia após trim. |
| description | Opcional, string literal até 5000 unidades; vazio permitido. |
| identifier | Opcional. String 1–64, ^[a-z][a-z0-9_-]*$, sem trim ou coerção. |
| category | Opcional; string literal até 64, inclusive vazia; não fixa schema. |
| fields | Opcional; omitir preserva. Enviar substitui todo o array. Array ordenado, 0–100, keys únicas; definições estritas: key e label obrigatórios, description≤1000, required booleano default false, maxLength inteiro 1–100000 opcional, format text\|textarea default text. |

## Resposta de sucesso

`200` JSON `RpgTemplate`: `{id,collectionId,name,identifier,description?,category?,fields,createdAt,updatedAt}`; SQL NULL omitido nos opcionais; fields em ordem com defaults.

## Fluxo implementado

1. `TemplatesController.update` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `TemplatesService.update(user.id, templateId, input)`.
2. Transação: buscar templateScope e bloquear FOR UPDATE; ausência retorna null → 404.
3. changed(current,input) compara valores definidos com isDeepStrictEqual; se nada mudou, devolver view atual sem alterar datas.
4. Se fields definido e diferente do atual, percorrer todos os records em lotes de 50 por ID e aplicar validateRecordValues(record.values,input.fields).
5. Qualquer issue gera TemplateRecordsConflictError, rollback integral e 409; metadados, fields, timestamps e records preservados.
6. Se compatível, UPDATE dos campos fornecidos + updatedAt=new Date(), com templateScope; createdAt e values dos records preservados.
7. Identifier repetido na mesma coleção é traduzido em 409; renomear não muda identifier; omitir fields preserva, [] tenta retirar todos os fields.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |
| 409 | Template identifier already exists | Identifier duplicado no mesmo pai. |
| 409 | Template change would invalidate existing records | fields novos rejeitam ao menos um record; rollback integral. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.updateTemplate(owner: string, id: string, input: UpdateTemplate): Promise<RpgTemplate | null>`
- `TemplatesService.update` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `returns indistinguishable 404s for foreign and missing resources in every operation`: Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `rejects unknown properties, moves, null, invalid fields and excessive sizes`: Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `allows empty parents, empty templates and no-op PATCH without timestamps changing`: Teste HTTP de {} no template preserva timestamps; o mesmo helper changed rege sistemas/coleções, conferidos no repositório.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `enforces scoped identifier uniqueness in create and PATCH`: Identifier repetido no mesmo pai gera 409; outro pai permite repetir.
- [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts) — `rejects incompatible fields atomically without changing timestamps or values`: 409 de domínio; template inteiro, timestamps e records preservados.
- [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts) — `checks every batch, including an incompatible record after the first 100`: Incompatibilidade no 101º registro também impede atualização.
- [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts) — `allows metadata, reordering, optional additions, unused removal and already-filled required fields`: Alterações compatíveis passam; {} e fields idênticos preservam estado.

Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.

## Fontes da implementação

- [src/modules/rpg-content/presentation/http/templates.controller.ts](../../../src/modules/rpg-content/presentation/http/templates.controller.ts)
- [src/modules/rpg-content/application/templates.service.ts](../../../src/modules/rpg-content/application/templates.service.ts)
- [src/modules/rpg-content/domain/content.schemas.ts](../../../src/modules/rpg-content/domain/content.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/content.repository.ts](../../../src/modules/rpg-content/domain/content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts)
- [src/modules/rpg-content/domain/record-values.ts](../../../src/modules/rpg-content/domain/record-values.ts)
- [src/modules/rpg-content/application/records.errors.ts](../../../src/modules/rpg-content/application/records.errors.ts)
