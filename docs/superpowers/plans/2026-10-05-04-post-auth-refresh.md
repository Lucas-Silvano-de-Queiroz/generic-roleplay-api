# POST /auth/refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Consumir um refresh ativo e emitir novo par de cookies, conservando sua expiração absoluta.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-04-post-auth-refresh.md](../specs/2026-10-05-04-post-auth-refresh.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Token ausente/duplicado/malformado no leitor → 401 Unauthorized.
- Assinatura/tipo/expiração incorretos → 401 antes da rotação.
- Duas rotações concorrentes → uma 204, outra 401, vencedor permanece ativo.
- Token legado com sid e hash ativo → aceita, conserva exp, novo token sem sid.
- Origem inválida → 403 sem consumir o refresh.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `POST`, caminho `/auth/refresh` e entradas descritas na spec.
- Produz: chamada `AuthenticationController.refresh` com as entradas validadas declaradas; resposta `204`, corpo vazio, dois cookies novos. `exp` do refresh novo igual ao anterior; access anterior permanece válido até expirar.

- [ ] Conferir o registro do método/caminho e a condição de acesso: `@Public()` dispensa access; cookie de refresh obrigatório; origem validada; global + 30/IP/60 s.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] `requireRefreshCookie(request)` retorna token ou lança UnauthorizedException.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

- [src/modules/identity/infrastructure/auth/jwt-token.service.ts](../../../src/modules/identity/infrastructure/auth/jwt-token.service.ts)
- [src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts](../../../src/modules/identity/infrastructure/database/repositories/drizzle-refresh-token.repository.ts)
- [src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts](../../../src/modules/identity/infrastructure/database/schema/refresh-tokens.schema.ts)
- [src/modules/identity/identity.module.ts](../../../src/modules/identity/identity.module.ts)
- [src/modules/shared/infrastructure/auth/auth-cookies.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.ts)
- [src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts](../../../src/modules/shared/infrastructure/auth/identity-rate-limit.guard.ts)
- [src/modules/shared/infrastructure/auth/cookie-origin.guard.ts](../../../src/modules/shared/infrastructure/auth/cookie-origin.guard.ts)
- [src/modules/identity/application/usecases/refresh-access-token.use-case.ts](../../../src/modules/identity/application/usecases/refresh-access-token.use-case.ts)
- [src/modules/identity/domain/repositories/refresh-token.repository.ts](../../../src/modules/identity/domain/repositories/refresh-token.repository.ts)

**Interfaces:**

- `RefreshAccessTokenUseCase.execute(input: RefreshAccessTokenInput): Promise<RefreshAccessTokenOutput>`; `{readonly refreshToken:string}` → `TokenPair`.
- `JwtTokenService.refreshTokens(token: string): Promise<TokenPair>`
- `DrizzleRefreshTokenRepository.rotate(previousHash: string, next: RefreshTokenRecord): Promise<boolean>`

- [ ] `RefreshAccessTokenUseCase.execute({refreshToken})` delega para `tokenService.refreshTokens`.
- [ ] Verificar JWT e payload antes de qualquer consumo. Assinar novo par mantendo payload.sub/payload.exp; novo jti aleatório.
- [ ] Rotacionar em transação: DELETE do hash antigo com userId coincidente e expiresAt > now(), RETURNING; sem linha, retornar false; com linha, INSERT do próximo hash.
- [ ] False gera `refresh_rejected` e 401; sucesso gera `tokens_refreshed` e `writeAuthCookies`.
- [ ] Só uma renovação concorrente vence. Reuso não revoga o substituto nem access existentes.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts)
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `rotates from the refresh cookie without accepting a token in the body` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): 204 com novo refresh; reuso 401; só body gera 401.
- [ ] Conferir `rotates refresh tokens and rejects reuse without invalidating the replacement` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Reuso 401; substituto ainda renova com 204.
- [ ] Conferir `allows at most one concurrent refresh and keeps the winning token valid` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Duas chamadas → status ordenados [204,401]; vencedor renova.
- [ ] Conferir `accepts a registered legacy refresh token and preserves its exact expiration` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Novo exp igual ao legado; novo payload sem sid.
- [ ] Conferir `rejects cross-origin refresh without consuming the valid token` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): Origem inválida 403; token continua renovável.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/cookie-auth.e2e-spec.ts test/e2e/security.e2e-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** As regras compartilhadas também dependem dos componentes e testes vinculados no contrato comum. Sucesso dos testes selecionados não substitui a leitura dos casos específicos descritos na spec.
