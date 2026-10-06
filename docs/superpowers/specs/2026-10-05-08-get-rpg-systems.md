# Spec — GET /rpg-systems

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Listar sistemas dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `SystemsController.list` em [src/modules/rpg-content/presentation/http/systems.controller.ts](../../../src/modules/rpg-content/presentation/http/systems.controller.ts).
**Plan correspondente:** [2026-10-05-08-get-rpg-systems.md](../plans/2026-10-05-08-get-rpg-systems.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Body/query | Nenhum body schema; query não é validada nesta rota. |

## Resposta de sucesso

`200` JSON array `RpgSystem[]`, inclusive `[]`, em ID crescente; sem paginação. Cada item: `{id,name,description?,createdAt,updatedAt}`; description SQL NULL omitida; sem userId.

## Fluxo implementado

1. `SystemsController.list` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `SystemsService.list(user.id)`.
2. `listSystems(owner)` seleciona rpg_systems com userId=owner e orderBy(id); converte com systemView. Não consulta users nem gera 404 por ausência de conta.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.listSystems(owner: string): Promise<RpgSystem[]>`
- `SystemsService.list` delega ao repositório; retorno encaminhado diretamente.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `returns indistinguishable 404s for foreign and missing resources in every operation`: Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.

Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados. Não há lookup de conta nessa rota; 404 para conta removida não deve ser inferido.

## Fontes da implementação

- [src/modules/rpg-content/presentation/http/systems.controller.ts](../../../src/modules/rpg-content/presentation/http/systems.controller.ts)
- [src/modules/rpg-content/application/systems.service.ts](../../../src/modules/rpg-content/application/systems.service.ts)
- [src/modules/rpg-content/domain/content.schemas.ts](../../../src/modules/rpg-content/domain/content.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/content.repository.ts](../../../src/modules/rpg-content/domain/content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)
