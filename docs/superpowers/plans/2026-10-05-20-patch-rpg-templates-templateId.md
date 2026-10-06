# PATCH /rpg-templates/:templateId — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Atualizar parcialmente templates dentro do escopo do usuário autenticado, com o contrato atual.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-20-patch-rpg-templates-templateId.md](../specs/2026-10-05-20-patch-rpg-templates-templateId.md). Ler também [api-contracts.md](../api-contracts.md).

## Global Constraints

- Trabalhar somente em `generic-roleplay-api`.
- Usar o comportamento do working tree em 2026-10-05; o HEAD sozinho não inclui todas as alterações locais.
- Este plan é descritivo da implementação atual. Os arquivos de runtime e testes listados já existem; não criar, refatorar ou alterar código ao executar apenas a conferência documental.
- Cookies, validações, defaults, ownership, timestamps, quotas e mensagens devem manter os valores da spec e do contrato compartilhado.
- Comandos são relativos à raiz da API. Integração/E2E exigem Docker para o PostgreSQL temporário do Testcontainers; não aplicar migrations no banco de desenvolvimento para esta tarefa.
- Checkboxes representam passos de conferência/reprodução, não alegações de testes executados nesta entrega.

## Review Focus

- Cookie ausente/refresh usado como access → 401.
- Recurso ou pai alheio/ausente → 404 idêntico.
- UUID inválido → 400 nas rotas com parâmetro; sem exigência exclusiva de UUIDv7.
- PATCH vazio/semanticamente igual → ambas as datas preservadas.
- fields incompatíveis → 409 e rollback integral, inclusive metadados.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/rpg-content/presentation/http/templates.controller.ts](../../../src/modules/rpg-content/presentation/http/templates.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `PATCH`, caminho `/rpg-templates/:templateId` e entradas descritas na spec.
- Produz: chamada `TemplatesController.update` com as entradas validadas declaradas; resposta `200` JSON `RpgTemplate`: `{id,collectionId,name,identifier,description?,category?,fields,createdAt,updatedAt}`; SQL NULL omitido nos opcionais; fields em ordem com defaults.

- [ ] Conferir o registro do método/caminho e a condição de acesso: Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade. Origem validada pelo CookieOriginGuard antes de executar mutation.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] `TemplatesController.update` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `TemplatesService.update(user.id, templateId, input)`.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

- [src/modules/rpg-content/application/templates.service.ts](../../../src/modules/rpg-content/application/templates.service.ts)
- [src/modules/rpg-content/domain/content.schemas.ts](../../../src/modules/rpg-content/domain/content.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/content.repository.ts](../../../src/modules/rpg-content/domain/content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-records.schema.ts)
- [src/modules/rpg-content/domain/record-values.ts](../../../src/modules/rpg-content/domain/record-values.ts)
- [src/modules/rpg-content/application/records.errors.ts](../../../src/modules/rpg-content/application/records.errors.ts)

**Interfaces:**

- `DrizzleContentRepository.updateTemplate(owner: string, id: string, input: UpdateTemplate): Promise<RpgTemplate | null>`
- `TemplatesService.update` delega ao repositório; null → ContentNotFoundError via requireContent.

- [ ] Transação: buscar templateScope e bloquear FOR UPDATE; ausência retorna null → 404.
- [ ] changed(current,input) compara valores definidos com isDeepStrictEqual; se nada mudou, devolver view atual sem alterar datas.
- [ ] Se fields definido e diferente do atual, percorrer todos os records em lotes de 50 por ID e aplicar validateRecordValues(record.values,input.fields).
- [ ] Qualquer issue gera TemplateRecordsConflictError, rollback integral e 409; metadados, fields, timestamps e records preservados.
- [ ] Se compatível, UPDATE dos campos fornecidos + updatedAt=new Date(), com templateScope; createdAt e values dos records preservados.
- [ ] Identifier repetido na mesma coleção é traduzido em 409; renomear não muda identifier; omitir fields preserva, [] tenta retirar todos os fields.
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts)
- [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `creates, lists, reads, patches and deletes the full hierarchy` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [ ] Conferir `returns indistinguishable 404s for foreign and missing resources in every operation` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [ ] Conferir `requires authentication on all 15 routes and rejects malformed UUIDs` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.
- [ ] Conferir `rejects unknown properties, moves, null, invalid fields and excessive sizes` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Bodies inválidos geram 400 com Validation failed/details; excesso no parser gera 413.
- [ ] Conferir `allows empty parents, empty templates and no-op PATCH without timestamps changing` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Teste HTTP de {} no template preserva timestamps; o mesmo helper changed rege sistemas/coleções, conferidos no repositório.
- [ ] Conferir `enforces scoped identifier uniqueness in create and PATCH` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Identifier repetido no mesmo pai gera 409; outro pai permite repetir.
- [ ] Conferir `rejects incompatible fields atomically without changing timestamps or values` em [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts): 409 de domínio; template inteiro, timestamps e records preservados.
- [ ] Conferir `checks every batch, including an incompatible record after the first 100` em [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts): Incompatibilidade no 101º registro também impede atualização.
- [ ] Conferir `allows metadata, reordering, optional additions, unused removal and already-filled required fields` em [test/integration/rpg-template-records.integration-spec.ts](../../../test/integration/rpg-template-records.integration-spec.ts): Alterações compatíveis passam; {} e fields idênticos preservam estado.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/rpg-content.e2e-spec.ts test/integration/rpg-template-records.integration-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.
