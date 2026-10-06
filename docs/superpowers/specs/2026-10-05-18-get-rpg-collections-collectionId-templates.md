# Spec — GET /rpg-collections/:collectionId/templates

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Listar templates dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `TemplatesController.list` em [src/modules/rpg-content/presentation/http/templates.controller.ts](../../../src/modules/rpg-content/presentation/http/templates.controller.ts).
**Plan correspondente:** [2026-10-05-18-get-rpg-collections-collectionId-templates.md](../plans/2026-10-05-18-get-rpg-collections-collectionId-templates.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path collectionId | String validada por new ParseUUIDPipe(), sem opção de versão v7. |
| Body/query | Nenhum body schema; query não é validada nesta rota. |

## Resposta de sucesso

`200` JSON array `RpgTemplate[]`, inclusive `[]`, em ID crescente; sem paginação. Cada item: `{id,collectionId,name,identifier,description?,category?,fields,createdAt,updatedAt}`; SQL NULL omitido nos opcionais; fields em ordem com defaults.

## Fluxo implementado

1. `TemplatesController.list` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `TemplatesService.list(user.id, collectionId)`.
2. `listTemplates` verifica existência/ownership do pai via findCollection; null é convertido em 404.
3. Selecionar templates por ID do pai e ownership transitivo; orderBy(id); converter com templateView. Pai próprio sem filhos retorna [].

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 404 | Resource not found | Recurso ou pai inexistente/alheio; resposta indistinguível. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.listTemplates(owner: string, collectionId: string): Promise<RpgTemplate[] | null>`
- `TemplatesService.list` delega ao repositório; null → ContentNotFoundError via requireContent.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `returns indistinguishable 404s for foreign and missing resources in every operation`: Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.

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
