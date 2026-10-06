# Spec — POST /auth/refresh

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Consumir um refresh ativo e emitir novo par de cookies, conservando sua expiração absoluta.
**Entrada no código:** `AuthenticationController.refresh` em [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
**Plan correspondente:** [2026-10-05-04-post-auth-refresh.md](../plans/2026-10-05-04-post-auth-refresh.md).

## Escopo e acesso

`@Public()` dispensa access; cookie de refresh obrigatório; origem validada; global + 30/IP/60 s.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Cookie | Nome refresh conforme ambiente; uma ocorrência decodificada de 1–4096 unidades. |
| JWT | RS256, issuer, audience, exp válido; payload com sub/jti UUID, tokenUse="refresh", exp inteiro positivo. |
| Body/query | Não declarados no handler; refreshToken no body não substitui o cookie. Body não passa por schema de refresh. |

## Resposta de sucesso

`204`, corpo vazio, dois cookies novos. `exp` do refresh novo igual ao anterior; access anterior permanece válido até expirar.

## Fluxo implementado

1. `requireRefreshCookie(request)` retorna token ou lança UnauthorizedException.
2. `RefreshAccessTokenUseCase.execute({refreshToken})` delega para `tokenService.refreshTokens`.
3. Verificar JWT e payload antes de qualquer consumo. Assinar novo par mantendo payload.sub/payload.exp; novo jti aleatório.
4. Rotacionar em transação: DELETE do hash antigo com userId coincidente e expiresAt > now(), RETURNING; sem linha, retornar false; com linha, INSERT do próximo hash.
5. False gera `refresh_rejected` e 401; sucesso gera `tokens_refreshed` e `writeAuthCookies`.
6. Só uma renovação concorrente vence. Reuso não revoga o substituto nem access existentes.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 401 | Unauthorized | Cookie ausente ou leitor retornou null. |
| 401 | Invalid credentials | JWT inválido/expirado, tipo errado, hash ausente/consumido/revogado/expirado ou conta excluída sem hash ativo. |

Além dos ramos abaixo, valem parsing/cabeçalhos/erros inesperados do [contrato compartilhado](../api-contracts.md). Nas rotas de identidade, também valem 403 de origem, 429 com Retry-After e 503 do store; esses códigos não implicam consulta de banco na validação do access token.

## Interfaces e persistência

- `RefreshAccessTokenUseCase.execute(input: RefreshAccessTokenInput): Promise<RefreshAccessTokenOutput>`; `{readonly refreshToken:string}` → `TokenPair`.
- `JwtTokenService.refreshTokens(token: string): Promise<TokenPair>`
- `DrizzleRefreshTokenRepository.rotate(previousHash: string, next: RefreshTokenRecord): Promise<boolean>`

## Evidências e critérios de conferência

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `rotates from the refresh cookie without accepting a token in the body`: 204 com novo refresh; reuso 401; só body gera 401.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `rotates refresh tokens and rejects reuse without invalidating the replacement`: Reuso 401; substituto ainda renova com 204.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `allows at most one concurrent refresh and keeps the winning token valid`: Duas chamadas → status ordenados [204,401]; vencedor renova.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `accepts a registered legacy refresh token and preserves its exact expiration`: Novo exp igual ao legado; novo payload sem sid.
- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `rejects cross-origin refresh without consuming the valid token`: Origem inválida 403; token continua renovável.

As evidências acima são testes existentes, com os resultados esperados descritos; execução e ambiente são tratados no plan. Para regras compartilhadas, consultar as fontes do contrato comum.

## Fontes da implementação

- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts)
- [src/modules/identity/infrastructure/auth/jwt-token.service.ts](../../../src/modules/identity/infrastructure/auth/jwt-token.service.ts)
- [src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts](../../../src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts)
- [src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts](../../../src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts)
- [src/modules/identity/identity.module.ts](../../../src/modules/identity/identity.module.ts)
- [src/modules/shared/infrastructure/auth/auth-cookies.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.ts)
- [src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts](../../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts)
- [src/modules/shared/infrastructure/auth/cookie-origin.guard.ts](../../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts)
- [src/modules/identity/application/usecases/refresh-access-token.use-case.ts](../../../src/modules/identity/application/usecases/refresh-access-token.use-case.ts)
- [src/modules/identity/domain/repositories/refresh-token.repository.ts](../../../src/modules/identity/domain/repositories/refresh-token.repository.ts)
