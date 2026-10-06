# Spec — POST /auth/logout

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Limpar cookies locais e revogar somente o refresh apresentado, quando reconhecido pelo leitor.
**Entrada no código:** `AuthenticationController.logout` em [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
**Plan correspondente:** [2026-10-05-05-post-auth-logout.md](../plans/2026-10-05-05-post-auth-logout.md).

## Escopo e acesso

`@Public()`; access dispensado; refresh opcional; origem validada; global + 30/IP/60 s.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Cookie | Refresh opcional, lido por readAuthCookie; regras do leitor no contrato compartilhado. |
| Body/query | Nenhum schema ou parâmetro declarado. Conteúdo do body não seleciona token. |

## Resposta de sucesso

`204`, sem corpo; dois cookies limpos com data de expiração no passado. Mesmo hash já revogado retorna 204 se o JWT apresentado ainda é válido.

## Fluxo implementado

1. No handler, chamar `clearAuthCookies(response)` antes de ler/verificar refresh.
2. Ler cookie via `readAuthCookie(request, refreshCookieName())`; null encerra com 204.
3. Se token for string, `revokeRefreshToken` verifica assinatura/claims e chama DELETE por SHA-256 + payload.sub, sem exigir existência da linha.
4. Registrar `refresh_token_revoked` após a revogação. Outros refresh tokens e todos os access emitidos continuam independentes.
5. JWT reconhecido pelo leitor, mas inválido/expirado, gera 401 com cookies já limpos. Guard de origem/rate limit pode impedir chegar à limpeza.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 401 | Invalid credentials | String de cookie reconhecida, mas JWT inválido/expirado ou tokenUse incorreto. |

Além dos ramos abaixo, valem parsing/cabeçalhos/erros inesperados do [contrato compartilhado](../api-contracts.md). Nas rotas de identidade, também valem 403 de origem, 429 com Retry-After e 503 do store; esses códigos não implicam consulta de banco na validação do access token.

## Interfaces e persistência

- `AuthenticationController.logout(request: Request, response: Response): Promise<void>`
- `JwtTokenService.revokeRefreshToken(token: string): Promise<void>`
- `DrizzleRefreshTokenRepository.revoke(tokenHash: string, userId: string): Promise<void>`
- `clearAuthCookies(response: Response): void`

## Evidências e critérios de conferência

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `revokes the refresh and clears both cookies on logout`: 204, Expires no passado; refresh posterior 401; access continua autenticando.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `revokes only the refresh cookie on logout without requiring access`: Sem access funciona; repetir logout com mesmo JWT válido gera 204.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `requires a valid refresh token to log out and leaves other logins valid`: Sem cookie 204; string inválida/access/forjada 401; outro login renova.
- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `rejects cross-origin logout and browser mutations without Origin`: 403 para origem inválida/cross-site sem Origin; refresh anterior permanece ativo.
- [src/modules/shared/infrastructure/auth/auth-cookies.spec.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.spec.ts) — `clears the same cookie names and scope used when issuing tokens`: Limpeza usa os nomes de produção e mesmas opções.

O leitor trata duplicação/escape inválido como ausência; o ramo de logout para esses casos é evidência estática combinada com testes unitários do leitor. Não generalizar “cookie presente inválido” para todo header malformado.

## Fontes da implementação

- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts)
- [src/modules/identity/infrastructure/auth/jwt-token.service.ts](../../../src/modules/identity/infrastructure/auth/jwt-token.service.ts)
- [src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts](../../../src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts)
- [src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts](../../../src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts)
- [src/modules/identity/identity.module.ts](../../../src/modules/identity/identity.module.ts)
- [src/modules/shared/infrastructure/auth/auth-cookies.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.ts)
- [src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts](../../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts)
- [src/modules/shared/infrastructure/auth/cookie-origin.guard.ts](../../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts)
