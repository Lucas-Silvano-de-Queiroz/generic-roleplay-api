# POST /rpg-templates/:templateId/records — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Criar registros dentro do escopo do usuário autenticado, com o contrato atual.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-22-post-rpg-templates-templateId-records.md](../specs/2026-10-05-22-post-rpg-templates-templateId-records.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Cookie ausente/refresh usado como access → 401.
- Pai alheio/ausente → 404 antes de validar values contra fields ou conferir quota.
- UUID inválido → 400 nas rotas com parâmetro; sem exigência exclusiva de UUIDv7.
- Queries não declaradas → ignoradas; na listagem de records, schema estrito gera 400.
- Concorrência na quota → lock do pai conserva máximo de 1000.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/rpg-content/presentation/http/records.controller.ts](../../../src/modules/rpg-content/presentation/http/records.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `POST`, caminho `/rpg-templates/:templateId/records` e entradas descritas na spec.
- Produz: chamada `RecordsController.create` com as entradas validadas declaradas; resposta `201` JSON `RpgRecord`: `{id,templateId,values,createdAt,updatedAt}`; mapa literal, sem name fixo ou userId.

- [ ] Conferir o registro do método/caminho e a condição de acesso: Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] `RecordsController.create` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `RecordsService.create(user.id, templateId, input)`.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

- [src/modules/rpg-content/application/records.service.ts](../../../src/modules/rpg-content/application/records.service.ts)
- [src/modules/rpg-content/domain/records.schemas.ts](../../../src/modules/rpg-content/domain/records.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-records.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-records.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/records.repository.ts](../../../src/modules/rpg-content/domain/records.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/records.openapi.ts](../../../src/modules/rpg-content/presentation/http/records.openapi.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts)
- [src/modules/rpg-content/domain/record-values.ts](../../../src/modules/rpg-content/domain/record-values.ts)
- [src/modules/rpg-content/application/records.errors.ts](../../../src/modules/rpg-content/application/records.errors.ts)

**Interfaces:**

- `DrizzleRecordsRepository.create(owner: string, templateId: string, input: CreateRecord): Promise<RpgRecord | null>`
- `RecordsService.create` delega ao repositório; null → ContentNotFoundError via requireContent.
- `validateRecordValues(values: RecordValues, fields: readonly FieldDefinition[]): RecordValidationIssue[]`

- [ ] `create` abre transação; localiza pai em rpg_templates com ownership e bloqueia `FOR UPDATE`; pai ausente/alheio retorna null, convertido pelo serviço em 404.
- [ ] Validar values com fields atuais: apenas keys conhecidas; required próprio e não-whitespace; maxLength efetivo min(template,100000). Sem transformação do texto.
- [ ] Depois da validação, contar rpg_records por templateId; count>=1000 gera RecordLimitError.
- [ ] INSERT SELECT revalida templateScope(owner,templateId), grava UUIDv7, values JSONB literal e now() para as duas datas; returning retorna row ou null.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts)
- [test/integration/rpg-records.repository.integration-spec.ts](../../../test/integration/rpg-records.repository.integration-spec.ts)
- [src/modules/rpg-content/domain/record-values.spec.ts](../../../src/modules/rpg-content/domain/record-values.spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `implements CRUD with literal Unicode, replacement and no-op timestamps` em [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts): Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [ ] Conferir `authenticates all routes and returns identical missing and foreign 404s` em [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts): Sem access cookie → 401; acesso alheio e IDs ausentes → 404 idêntico.
- [ ] Conferir `rejects strict payloads, query parameters, invalid UUIDs and over-sized bodies` em [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts): Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [ ] Conferir `serializes two creates at 999 to exactly 1000 records` em [test/integration/rpg-records.repository.integration-spec.ts](../../../test/integration/rpg-records.repository.integration-spec.ts): Só uma criação vence; outra RecordLimitError; total=1000.
- [ ] Conferir `counts UTF-16 and enforces template and global lengths` em [src/modules/rpg-content/domain/record-values.spec.ts](../../../src/modules/rpg-content/domain/record-values.spec.ts): Comprimento efetivo conta UTF-16 e respeita maxLength/global.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run src/modules/rpg-content/domain/record-values.spec.ts
```

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/rpg-records.e2e-spec.ts test/integration/rpg-records.repository.integration-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.
