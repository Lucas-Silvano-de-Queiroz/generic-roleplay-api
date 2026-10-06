# POST /auth/login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Validar credenciais e emitir access/refresh apenas em cookies HttpOnly.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-03-post-auth-login.md](../specs/2026-10-05-03-post-auth-login.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Origem não confiável → 403 antes do handler.
- Corpo excessivo → 413 antes da validação por campo.
- Orçamento excedido → 429 com Retry-After positivo.
- Falha no store de rate limit → 503 Authentication service unavailable.
- Propriedades extras nos DTOs z.object → removidas, sem rejeição por strictObject.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `POST`, caminho `/auth/login` e entradas descritas na spec.
- Produz: chamada `AuthenticationController.login` com as entradas validadas declaradas; resposta `204`, corpo vazio, dois `Set-Cookie`: access 15 minutos e refresh 15 dias. Opções e nomes definidos no contrato compartilhado.

- [ ] Conferir o registro do método/caminho e a condição de acesso: `@Public()`; origem validada; global + 5/IP/900 s + 5/e-mail normalizado/900 s.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] Validar `loginSchema`; `LoginUseCase.execute(dto)` normaliza via `Email.create` e busca por e-mail.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

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

**Interfaces:**

- `LoginUseCase.execute(input: LoginInput): Promise<LoginOutput>`; `{email:string,password:string}` → `{accessToken:string,refreshToken:string,tokenType:"Bearer"}` interno.
- `JwtTokenService.issueTokens(userId: string): Promise<TokenPair>`
- `writeAuthCookies(response: Response, tokens: TokenPair): void`

- [ ] Executar `comparePassword(password, user?.passwordHash ?? null)`; usuário ausente usa hash dummy.
- [ ] Usuário ausente ou senha incorreta gera `InvalidCredentialsError`.
- [ ] `JwtTokenService.issueTokens(user.id)` calcula expiração absoluta em segundos e assina os dois JWTs.
- [ ] Persistir somente SHA-256 do refresh, userId e expiresAt em refresh_tokens; emitir `tokens_issued`.
- [ ] `writeAuthCookies` envia o par no response passthrough; o controller retorna void.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts)
- [src/modules/identity/application/usecases/login.use-case.spec.ts](../../../src/modules/identity/application/usecases/login.use-case.spec.ts)
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `issues cookies instead of JSON and authenticates using the access cookie` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): 204 vazio; dois HttpOnly SameSite=Lax Path=/ sem Domain; Bearer sozinho gera 401 na probe.
- [ ] Conferir `should throw InvalidCredentialsError when user does not exist` em [src/modules/identity/application/usecases/login.use-case.spec.ts](../../../src/modules/identity/application/usecases/login.use-case.spec.ts): Comparação com null e InvalidCredentialsError.
- [ ] Conferir `should throw InvalidCredentialsError when password does not match` em [src/modules/identity/application/usecases/login.use-case.spec.ts](../../../src/modules/identity/application/usecases/login.use-case.spec.ts): Senha incorreta não emite tokens.
- [ ] Conferir `limits invalid login attempts before more expensive verification` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): 5 falhas 401; sexta 429 com Retry-After.
- [ ] Conferir `rejects cross-origin login before setting cookies` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): 403; sem Set-Cookie.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run src/modules/identity/application/usecases/login.use-case.spec.ts
```

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/cookie-auth.e2e-spec.ts test/e2e/security.e2e-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** As regras compartilhadas também dependem dos componentes e testes vinculados no contrato comum. Sucesso dos testes selecionados não substitui a leitura dos casos específicos descritos na spec.
