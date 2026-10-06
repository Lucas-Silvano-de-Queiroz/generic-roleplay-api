# Spec — POST /rpg-systems

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Criar sistemas dentro do escopo do usuário autenticado, com o contrato atual.
**Entrada no código:** `SystemsController.create` em [src/modules/rpg-content/presentation/http/systems.controller.ts](../../../src/modules/rpg-content/presentation/http/systems.controller.ts).
**Plan correspondente:** [2026-10-05-07-post-rpg-systems.md](../plans/2026-10-05-07-post-rpg-systems.md).

## Escopo e acesso

Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Body | `createSystemSchema`; objeto estrito; extras e null rejeitados. |
| name | Obrigatório. String até 100 unidades UTF-16 antes de trim, não vazia após trim. |
| description | Opcional, string literal até 5000 unidades; vazio permitido. |

## Resposta de sucesso

`201` JSON `RpgSystem`: `{id,name,description?,createdAt,updatedAt}`; description SQL NULL omitida; sem userId.

## Fluxo implementado

1. `SystemsController.create` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `SystemsService.create(user.id, input)`.
2. `DrizzleContentRepository.createSystem(owner,input)` insere em rpg_systems com userId=owner e UUIDv7; timestamps defaultNow; retorna systemView. Não há quota ou unicidade de nome.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | UUID/body/query inválido conforme os parâmetros declarados; details quando fornecidos pelo validador. |
| 401 | Unauthorized | Access cookie ausente/inválido/expirado/tipo errado. |
| 403 | Untrusted request origin | Guard rejeita origem antes da mutation. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `DrizzleContentRepository.createSystem(owner: string, input: CreateSystem): Promise<RpgSystem>`
- `SystemsService.create` delega ao repositório; retorno encaminhado diretamente.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `creates, lists, reads, patches and deletes the full hierarchy`: Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `requires authentication on all 15 routes and rejects malformed UUIDs`: Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.
- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `rejects unknown properties, moves, null, invalid fields and excessive sizes`: Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.

Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.

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
