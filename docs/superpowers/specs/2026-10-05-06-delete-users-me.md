# Spec — DELETE /users/me

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Excluir a conta identificada pelo access cookie após confirmar a senha atual.
**Entrada no código:** `UserController.delete` em [src/modules/identity/presentation/http/controllers/user.controller.ts](../../../src/modules/identity/presentation/http/controllers/user.controller.ts).
**Plan correspondente:** [2026-10-05-06-delete-users-me.md](../plans/2026-10-05-06-delete-users-me.md).

## Escopo e acesso

Access cookie obrigatório; identidade vem de CurrentUser.id; origem validada; global + 5/IP/900 s.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Body | `deleteUserSchema = z.object({password})`; extras removidos. |
| password | String 8–1024 unidades UTF-16, sem trim. |
| userId | Obtido do JWT validado; nenhum ID recebido do cliente seleciona a conta. |

## Resposta de sucesso

`204`, corpo vazio. Este handler não limpa cookies. A exclusão por FK remove conteúdo e refresh tokens da conta.

## Fluxo implementado

1. `ZodValidationPipe(deleteUserSchema)` valida senha; `@CurrentUser` fornece user.id.
2. `DeleteUserUseCase.execute({userId:user.id,password:dto.password})` busca a conta por ID.
3. Conta ausente gera `UserNotFoundError`; se existir, comparar senha com passwordHash via adapter.
4. Senha incorreta gera `InvalidCredentialsError`; correta chama `deleteById(existingUser.id)`.
5. DELETE em users aciona cascatas de sistemas/coleções/templates/registros e refresh_tokens; registrar `account_deleted`.
6. Access já emitido continua passando na estratégia JWT até expirar; repetir esta operação encontra conta ausente e retorna 404.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | Senha fora do contrato. |
| 401 | Unauthorized | Access ausente/inválido/expirado. |
| 401 | Invalid credentials | Senha incorreta. |
| 404 | User not found | JWT válido de conta ausente. |
| 503 | Authentication capacity exceeded. Try again later. | Fila de verificação de hash saturada. |

Além dos ramos abaixo, valem parsing/cabeçalhos/erros inesperados do [contrato compartilhado](../api-contracts.md). Nas rotas de identidade, também valem 403 de origem, 429 com Retry-After e 503 do store; esses códigos não implicam consulta de banco na validação do access token.

## Interfaces e persistência

- `DeleteUserUseCase.execute(input: DeleteUserInput): Promise<void>`; input `{userId:string,password:string}`.
- `DrizzleUserRepositoryPostgreSQL.findById(userId: string): Promise<User | null>`
- `DrizzleUserRepositoryPostgreSQL.deleteById(userId: string): Promise<void>`

## Evidências e critérios de conferência

- [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts) — `should delete the authenticated user when the password is correct`: 204; login posterior 401.
- [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts) — `should return 401 when no access token is provided`: 401 Unauthorized.
- [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts) — `should return 404 when a valid access token refers to a deleted user`: Segunda exclusão 404 User not found.
- [src/modules/identity/application/usecases/delete-user.use-case.spec.ts](../../../src/modules/identity/application/usecases/delete-user.use-case.spec.ts) — `should throw InvalidCredentialsError when password does not match`: Não exclui conta com senha incorreta.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `removes refresh tokens from every login when the account is deleted`: Dois refresh anteriores falham com 401 após DELETE.
- [test/integration/rpg-records-schema.integration-spec.ts](../../../test/integration/rpg-records-schema.integration-spec.ts) — `preserves existing content, enforces constraints and cascades every ancestor`: Cascata de conta remove hierarquia e registros no PostgreSQL.

As evidências acima são testes existentes, com os resultados esperados descritos; execução e ambiente são tratados no plan. Para regras compartilhadas, consultar as fontes do contrato comum.

## Fontes da implementação

- [src/modules/identity/presentation/http/controllers/user.controller.ts](../../../src/modules/identity/presentation/http/controllers/user.controller.ts)
- [src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts](../../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts)
- [src/modules/shared/infrastructure/auth/cookie-origin.guard.ts](../../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts)
- [src/modules/identity/presentation/http/dto/identity-input.schemas.ts](../../../src/modules/identity/presentation/http/dto/identity-input.schemas.ts)
- [src/modules/identity/presentation/http/dto/delete-user.dto.ts](../../../src/modules/identity/presentation/http/dto/delete-user.dto.ts)
- [src/modules/identity/application/usecases/delete-user.use-case.ts](../../../src/modules/identity/application/usecases/delete-user.use-case.ts)
- [src/modules/identity/infrastructure/database/repositories/drizzle-user.repository-postgresql.ts](../../../src/modules/identity/infrastructure/database/repositories/drizzle-user.repository-postgresql.ts)
- [src/modules/identity/infrastructure/passport/jwt.strategy.ts](../../../src/modules/identity/infrastructure/passport/jwt.strategy.ts)
- [src/modules/identity/infrastructure/crypto/argon2-hash.adapter.ts](../../../src/modules/identity/infrastructure/crypto/argon2-hash.adapter.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts)
- [src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts](../../../src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts)
