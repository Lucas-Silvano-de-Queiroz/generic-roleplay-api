# DELETE /users/me — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Excluir a conta identificada pelo access cookie após confirmar a senha atual.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-06-delete-users-me.md](../specs/2026-10-05-06-delete-users-me.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Senha inválida → 400; senha incorreta com formato válido → 401.
- JWT válido de conta excluída → 404 User not found.
- Excluir conta com múltiplos logins → todos os refresh removidos.
- Conta com hierarquia de conteúdo → cascade de todos os descendentes.
- Sucesso → 204 sem limpeza explícita de cookies; conferir controller.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/identity/presentation/http/controllers/user.controller.ts](../../../src/modules/identity/presentation/http/controllers/user.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `DELETE`, caminho `/users/me` e entradas descritas na spec.
- Produz: chamada `UserController.delete` com as entradas validadas declaradas; resposta `204`, corpo vazio. Este handler não limpa cookies. A exclusão por FK remove conteúdo e refresh tokens da conta.

- [ ] Conferir o registro do método/caminho e a condição de acesso: Access cookie obrigatório; identidade vem de CurrentUser.id; origem validada; global + 5/IP/900 s.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] `ZodValidationPipe(deleteUserSchema)` valida senha; `@CurrentUser` fornece user.id.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

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

**Interfaces:**

- `DeleteUserUseCase.execute(input: DeleteUserInput): Promise<void>`; input `{userId:string,password:string}`.
- `DrizzleUserRepositoryPostgreSQL.findById(userId: string): Promise<User | null>`
- `DrizzleUserRepositoryPostgreSQL.deleteById(userId: string): Promise<void>`

- [ ] `DeleteUserUseCase.execute({userId:user.id,password:dto.password})` busca a conta por ID.
- [ ] Conta ausente gera `UserNotFoundError`; se existir, comparar senha com passwordHash via adapter.
- [ ] Senha incorreta gera `InvalidCredentialsError`; correta chama `deleteById(existingUser.id)`.
- [ ] DELETE em users aciona cascatas de sistemas/coleções/templates/registros e refresh_tokens; registrar `account_deleted`.
- [ ] Access já emitido continua passando na estratégia JWT até expirar; repetir esta operação encontra conta ausente e retorna 404.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts)
- [src/modules/identity/application/usecases/delete-user.use-case.spec.ts](../../../src/modules/identity/application/usecases/delete-user.use-case.spec.ts)
- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts)
- [test/integration/rpg-records-schema.integration-spec.ts](../../../test/integration/rpg-records-schema.integration-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `should delete the authenticated user when the password is correct` em [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts): 204; login posterior 401.
- [ ] Conferir `should return 401 when no access token is provided` em [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts): 401 Unauthorized.
- [ ] Conferir `should return 404 when a valid access token refers to a deleted user` em [test/e2e/app.e2e-spec.ts](../../../test/e2e/app.e2e-spec.ts): Segunda exclusão 404 User not found.
- [ ] Conferir `should throw InvalidCredentialsError when password does not match` em [src/modules/identity/application/usecases/delete-user.use-case.spec.ts](../../../src/modules/identity/application/usecases/delete-user.use-case.spec.ts): Não exclui conta com senha incorreta.
- [ ] Conferir `removes refresh tokens from every login when the account is deleted` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): Dois refresh anteriores falham com 401 após DELETE.
- [ ] Conferir `preserves existing content, enforces constraints and cascades every ancestor` em [test/integration/rpg-records-schema.integration-spec.ts](../../../test/integration/rpg-records-schema.integration-spec.ts): Cascata de conta remove hierarquia e registros no PostgreSQL.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run src/modules/identity/application/usecases/delete-user.use-case.spec.ts
```

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/app.e2e-spec.ts test/e2e/security.e2e-spec.ts test/integration/rpg-records-schema.integration-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** As regras compartilhadas também dependem dos componentes e testes vinculados no contrato comum. Sucesso dos testes selecionados não substitui a leitura dos casos específicos descritos na spec.
