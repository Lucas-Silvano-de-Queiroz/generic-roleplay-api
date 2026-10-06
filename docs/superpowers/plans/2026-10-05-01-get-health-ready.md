# GET /health/ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Informar se a consulta ao banco encontra as duas tabelas de segurança esperadas.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-01-get-health-ready.md](../specs/2026-10-05-01-get-health-ready.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Banco sem conexão → 503 genérico; conferir o catch do controller.
- Ausência de uma das duas tabelas → 503; conferir o AND no SQL.
- Schema users/conteúdo incompleto → esta consulta não o verifica.
- Sem cookies → leitura pública; teste E2E não envia cookie.
- Resultado vazio/falso → 503; conferir `rows[0]?.ready`.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/shared/presentation/controllers/health.controller.ts](../../../src/modules/shared/presentation/controllers/health.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `GET`, caminho `/health/ready` e entradas descritas na spec.
- Produz: chamada `HealthController.ready` com as entradas validadas declaradas; resposta `200 application/json` com `{"status":"ready"}`.

- [ ] Conferir o registro do método/caminho e a condição de acesso: `@Public()`: não exige access ou refresh; sem política de rate limit de identidade.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] Executar `SELECT to_regclass('public.refresh_tokens') IS NOT NULL AND to_regclass('public.rate_limits') IS NOT NULL AS ready` via `db.execute`.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

- [src/modules/shared/infrastructure/database/drizzle.ts](../../../src/modules/shared/infrastructure/database/drizzle.ts)

**Interfaces:**

- `HealthController.ready(): Promise<{ status: "ready" }>`
- `db.execute<{ ready: boolean }>(sql)`

- [ ] Se `result.rows[0]?.ready` for verdadeiro, devolver `{ status: "ready" }`.
- [ ] Se a consulta lançar erro, não propagar detalhes; se o resultado não indicar prontidão, lançar `ServiceUnavailableException("Service unavailable")`.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `reports database/schema readiness without exposing infrastructure details` em [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts): HTTP 200; body exatamente `{status:"ready"}`.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/security.e2e-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** O teste HTTP existente cobre readiness positiva. As condições de 503 e a abrangência limitada do SQL são conferidas estaticamente; não há teste de falha específico nesse arquivo.
