# GET /rpg-systems/:systemId/collections — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans para uma reprodução autorizada deste plan, tarefa por tarefa. As etapas usam checkboxes. Esta entrega é documental: as etapas abaixo descrevem a implementação já existente e sua conferência; não autorizam mudança do runtime.

**Goal:** Listar coleções dentro do escopo do usuário autenticado, com o contrato atual.

**Architecture:** Controller NestJS usa guards globais e os pipes declarados, encaminhando entradas para a camada de aplicação e persistência PostgreSQL/Drizzle existente. O retorno HTTP e os erros seguem a spec vinculada e o contrato compartilhado.

**Tech Stack:** TypeScript, NestJS 11, Express, Zod 4, PostgreSQL, Drizzle ORM; Vitest/Supertest; JWT RS256 e Argon2id nas operações de identidade que os utilizam.

**Spec:** [2026-10-05-13-get-rpg-systems-systemId-collections.md](../specs/2026-10-05-13-get-rpg-systems-systemId-collections.md). Ler também [api-contracts.md](../api-contracts.md).

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
- Queries não declaradas → ignoradas; na listagem de records, schema estrito gera 400.
- Resposta → datas ISO e apenas as propriedades da view/row prevista.

Cada condição deve ser confrontada com o código vinculado e com as evidências da tarefa 3. Quando não há teste existente para a condição, a conferência é estática; a lacuna fica explicitada na spec, sem inventar cobertura ou ampliar o escopo.

---

## Tarefa 1: Contrato HTTP e acesso

**Arquivos existentes para leitura:**
- [src/modules/rpg-content/presentation/http/collections.controller.ts](../../../src/modules/rpg-content/presentation/http/collections.controller.ts).
- [api-contracts.md](../api-contracts.md) e as fontes dos guards/pipes nele vinculadas.

**Interfaces:**
- Consome: método `GET`, caminho `/rpg-systems/:systemId/collections` e entradas descritas na spec.
- Produz: chamada `CollectionsController.list` com as entradas validadas declaradas; resposta `200` JSON array `RpgCollection[]`, inclusive `[]`, em ID crescente; sem paginação. Cada item: `{id,systemId,name,identifier,description?,createdAt,updatedAt}`; description SQL NULL omitida.

- [ ] Conferir o registro do método/caminho e a condição de acesso: Access cookie obrigatório; owner obtido de CurrentUser.id; sem política de rate limit de identidade.
- [ ] Conferir campo por campo a tabela de requisição da spec, inclusive diferenças entre omissão, null, extras e defaults quando aplicáveis.
- [ ] `CollectionsController.list` obtém `@CurrentUser`; valida parâmetros/body/query declarados e chama `CollectionsService.list(user.id, systemId)`.
- [ ] Conferir status, corpo e headers no handler, no filtro/middleware ou no registro direto do adapter, conforme a spec.

## Tarefa 2: Aplicação e persistência

**Arquivos existentes para leitura:**

- [src/modules/rpg-content/application/collections.service.ts](../../../src/modules/rpg-content/application/collections.service.ts)
- [src/modules/rpg-content/domain/content.schemas.ts](../../../src/modules/rpg-content/domain/content.schemas.ts)
- [src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts](../../../src/modules/rpg-content/infrastructure/database/drizzle-content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/content-ownership.ts](../../../src/modules/rpg-content/infrastructure/database/content-ownership.ts)
- [src/modules/rpg-content/domain/content.repository.ts](../../../src/modules/rpg-content/domain/content.repository.ts)
- [src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts](../../../src/modules/rpg-content/infrastructure/database/schema/rpg-content.schema.ts)
- [src/modules/rpg-content/application/content.errors.ts](../../../src/modules/rpg-content/application/content.errors.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)

**Interfaces:**

- `DrizzleContentRepository.listCollections(owner: string, systemId: string): Promise<RpgCollection[] | null>`
- `CollectionsService.list` delega ao repositório; null → ContentNotFoundError via requireContent.

- [ ] `listCollections` verifica existência/ownership do pai via findSystem; null é convertido em 404.
- [ ] Selecionar collections por ID do pai e ownership transitivo; orderBy(id); converter com collectionView. Pai próprio sem filhos retorna [].
- [ ] Conferir cada linha da tabela de erros da spec no ponto que a produz; não inferir erros próprios de uma rota a partir do grupo de decorators OpenAPI.
- [ ] Confrontar os cinco itens de Review Focus com os predicados, schemas e guards relevantes; registrar como conferência estática o que os testes existentes não exercitam.

## Tarefa 3: Evidências e verificação

**Arquivos de testes existentes:**

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts)

**Interfaces:**
- Consome: spec e fluxo das tarefas 1–2; testes já existentes e configuração Vitest da API.
- Produz: evidência de correspondência entre contrato e implementação; quando executados, saída de teste com exit code 0 e nenhuma falha, ou relato concreto da limitação.

- [ ] Conferir `creates, lists, reads, patches and deletes the full hierarchy` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Exercita a operação com cookie próprio, status e resposta previstos nesta spec.
- [ ] Conferir `returns indistinguishable 404s for foreign and missing resources in every operation` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Listagem raiz com cookie de outro owner devolve []; demais operações sobre recurso ou pai alheio/ausente geram 404 idêntico.
- [ ] Conferir `requires authentication on all 15 routes and rejects malformed UUIDs` em [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts): Sem access cookie, operação retorna 401; o mesmo cenário confere UUID inválido nos GETs com parâmetro.

- [ ] Executar os comandos pertinentes abaixo. Esperado: Vitest conclui com exit code 0 e testes selecionados sem falhas; não usar este texto como evidência de que foram executados.

```sh
pnpm exec vitest run --config ./vitest.config.e2e.ts test/e2e/rpg-content.e2e-spec.ts
```

- [ ] Conferir links e cobertura documental: esta rota deve possuir exatamente uma spec e um plan no [índice](../README.md).
- [ ] Confirmar que a conferência não alterou runtime, testes ou migrations; manter alterações locais preexistentes.

**Limite de cobertura:** Os testes de hierarquia exercitam várias rotas no mesmo cenário. Os comandos do plan selecionam esses testes existentes, sem afirmar um teste isolado para cada método. Regras específicas não explicitamente exercitadas são conferidas no schema, controller e SQL vinculados.
