# POST /auth/logout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Limpar cookies locais e revogar somente o refresh apresentado, quando reconhecido pelo leitor.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-05-post-auth-logout.md](../specs/2026-10-05-05-post-auth-logout.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Leitor retorna null para cookie duplicado, vazio, grande ou escape inválido → limpa cookies e 204.
- String reconhecida com JWT inválido → limpa cookies e 401.
- JWT válido cujo hash já não existe → 204 idempotente.
- Origem inválida/rate limit rejeitado → handler não limpa cookies.
- Logout de um login → outros refresh e access anteriores continuam válidos.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/identity/presentation/http/controllers/authentication.controller.ts](../../../src/modules/identity/presentation/http/controllers/authentication.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `POST`, caminho `/auth/logout` e entradas descritas na spec.
- Produz: chamada `AuthenticationController.logout` com as entradas validadas declaradas; resposta `204`, sem corpo; dois cookies limpos com data de expiração no passado. Mesmo hash já revogado retorna 204 se o JWT apresentado ainda é válido.

- [ ] Conferir o registro do método/caminho e a condição de acesso: `@Public()`; access dispensado; refresh opcional; origem validada; global + 30/IP/60 s.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] No handler, chamar `clearAuthCookies(response)` antes de ler/verificar refresh.
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

**Interfaces:**

- `AuthenticationController.logout(request: Request, response: Response): Promise<void>`
- `JwtTokenService.revokeRefreshToken(token: string): Promise<void>`
- `DrizzleRefreshTokenRepository.revoke(tokenHash: string, userId: string): Promise<void>`
- `clearAuthCookies(response: Response): void`

- [ ] Ler cookie via `readAuthCookie(request, refreshCookieName())`; null encerra com 204.
- [ ] Se token for string, `revokeRefreshToken` verifica assinatura/claims e chama DELETE por SHA-256 + payload.sub, sem exigir existência da linha.
- [ ] Registrar `refresh_token_revoked` após a revogação. Outros refresh tokens e todos os access emitidos continuam independentes.
- [ ] JWT reconhecido pelo leitor, mas inválido/expirado, gera 401 com cookies já limpos. Guard de origem/rate limit pode impedir chegar à limpeza.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts)
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts)
- [src/modules/shared/infrastructure/auth/auth-cookies.spec.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `revokes the refresh and clears both cookies on logout` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): 204, Expires no passado; refresh posterior 401; access continua autenticando.
- [ ] Conferir `revokes only the refresh cookie on logout without requiring access` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Sem access funciona; repetir logout com mesmo JWT válido gera 204.
- [ ] Conferir `requires a valid refresh token to log out and leaves other logins valid` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Sem cookie 204; string inválida/access/forjada 401; outro login renova.
- [ ] Conferir `rejects cross-origin logout and browser mutations without Origin` em [test/e2e/cookie-auth.e2e-spec.ts](../../../test/e2e/cookie-auth.e2e-spec.ts): 403 para origem inválida/cross-site sem Origin; refresh anterior permanece ativo.
- [ ] Conferir `clears the same cookie names and scope used when issuing tokens` em [src/modules/shared/infrastructure/auth/auth-cookies.spec.ts](../../../src/modules/shared/infrastructure/auth/auth-cookies.spec.ts): Limpeza usa os nomes de produção e mesmas opções.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run src/modules/shared/infrastructure/auth/auth-cookies.spec.ts
```

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/cookie-auth.e2e-spec.ts test/e2e/security.e2e-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** O leitor trata duplicação/escape inválido como ausência; o ramo de logout para esses casos é evidência estática combinada com testes unitários do leitor. Não generalizar “cookie presente inválido” para todo header malformado.
