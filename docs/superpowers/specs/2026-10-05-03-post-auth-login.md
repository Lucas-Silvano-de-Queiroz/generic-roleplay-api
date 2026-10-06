# Spec — POST /auth/login

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Validar credenciais e emitir access/refresh apenas em cookies HttpOnly.
**Entrada no código:** `AuthenticationController.login` em [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
**Plan correspondente:** [2026-10-05-03-post-auth-login.md](../plans/2026-10-05-03-post-auth-login.md).

## Escopo e acesso

`@Public()`; origem validada; global + 5/IP/900 s + 5/e-mail normalizado/900 s.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Body | `loginSchema = z.object({email,password})`; extras removidos. |
| email | String bruta ≤512; trim/minúsculas; ≤255 e e-mail válido. |
| password | String 1–1024 unidades UTF-16, sem trim. |

## Resposta de sucesso

`204`, corpo vazio, dois `Set-Cookie`: access 15 minutos e refresh 15 dias. Opções e nomes definidos no contrato compartilhado.

## Fluxo implementado

1. Validar `loginSchema`; `LoginUseCase.execute(dto)` normaliza via `Email.create` e busca por e-mail.
2. Executar `comparePassword(password, user?.passwordHash ?? null)`; usuário ausente usa hash dummy.
3. Usuário ausente ou senha incorreta gera `InvalidCredentialsError`.
4. `JwtTokenService.issueTokens(user.id)` calcula expiração absoluta em segundos e assina os dois JWTs.
5. Persistir somente SHA-256 do refresh, userId e expiresAt em refresh_tokens; emitir `tokens_issued`.
6. `writeAuthCookies` envia o par no response passthrough; o controller retorna void.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 400 | Validation failed | Body inválido. |
| 401 | Invalid credentials | Conta ausente ou senha incorreta. |
| 503 | Authentication capacity exceeded. Try again later. | Fila de hashing saturada. |

Além dos ramos abaixo, valem parsing/cabeçalhos/erros inesperados do [contrato compartilhado](../api-contracts.md). Nas rotas de identidade, também valem 403 de origem, 429 com Retry-After e 503 do store; esses códigos não implicam consulta de banco na validação do access token.

## Interfaces e persistência

- `LoginUseCase.execute(input: LoginInput): Promise<LoginOutput>`; `{email:string,password:string}` → `{accessToken:string,refreshToken:string,tokenType:"Bearer"}` interno.
- `JwtTokenService.issueTokens(userId: string): Promise<TokenPair>`
- `writeAuthCookies(response: Response, tokens: TokenPair): void`

## Evidências e critérios de conferência

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `issues cookies instead of JSON and authenticates using the access cookie`: 204 vazio; dois HttpOnly SameSite=Lax Path=/ sem Domain; Bearer sozinho gera 401 na probe.
- [src/modules/identity/application/usecases/login.use-case.spec.ts](../../../src/modules/identity/application/usecases/login.use-case.spec.ts) — `should throw InvalidCredentialsError when user does not exist`: Comparação com null e InvalidCredentialsError.
- [src/modules/identity/application/usecases/login.use-case.spec.ts](../../../src/modules/identity/application/usecases/login.use-case.spec.ts) — `should throw InvalidCredentialsError when password does not match`: Senha incorreta não emite tokens.
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `limits invalid login attempts before more expensive verification`: 5 falhas 401; sexta 429 com Retry-After.
- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts) — `rejects cross-origin login before setting cookies`: 403; sem Set-Cookie.

As evidências acima são testes existentes, com os resultados esperados descritos; execução e ambiente são tratados no plan. Para regras compartilhadas, consultar as fontes do contrato comum.

## Fontes da implementação

- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts)
- [src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts](../../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts)
- [src/modules/shared/infrastructure/auth/cookie-origin.guard.ts](../../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts)
- [src/modules/identity/presentation/http/dto/identity-input.schemas.ts](../../../src/modules/identity/presentation/http/dto/identity-input.schemas.ts)
- [src/modules/identity/infrastructure/auth/jwt-token.service.ts](../../../src/modules/identity/infrastructure/auth/jwt-token.service.ts)
- [src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts](../../../src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts)
- [src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts](../../../src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts)
- [src/modules/identity/identity.module.ts](../../../src/modules/identity/identity.module.ts)
- [src/modules/shared/infrastructure/auth/auth-cookies.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.ts)
- [src/modules/identity/presentation/http/dto/login.dto.ts](../../../src/modules/identity/presentation/http/dto/login.dto.ts)
- [src/modules/identity/application/usecases/login.use-case.ts](../../../src/modules/identity/application/usecases/login.use-case.ts)
- [src/modules/identity/infrastructure/crypto/argon2-hash.adapter.ts](../../../src/modules/identity/infrastructure/crypto/argon2-hash.adapter.ts)
- [src/modules/identity/infrastructure/crypto/bounded-work-queue.ts](../../../src/modules/identity/infrastructure/crypto/bounded-work-queue.ts)
