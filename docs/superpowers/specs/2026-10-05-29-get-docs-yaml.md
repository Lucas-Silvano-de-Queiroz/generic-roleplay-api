# Spec — GET /docs-yaml

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Servir a documentação da própria API em text/yaml, quando o bootstrap está em desenvolvimento.
**Entrada no código:** `SwaggerModule.setup` em [src/main.ts](../../../src/main.ts).
**Plan correspondente:** [2026-10-05-29-get-docs-yaml.md](../plans/2026-10-05-29-get-docs-yaml.md).

## Escopo e acesso

Registrada diretamente no adapter; não exige access/refresh. NODE_ENV=production não registra Swagger.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path/body/query | Sem parâmetros de negócio ou validação Zod; caminho fornecido pela biblioteca. |

## Resposta de sucesso

`200` com Content-Type `text/yaml` em desenvolvimento. Documento OpenAPI com paths dos controllers e schemas compartilhados.

## Fluxo implementado

1. No bootstrap, condicionar setup a env.isDevelopment; criar DocumentBuilder com título Generic Roleplay API, descrição de contas/conteúdo privado, versão 1.0 e dois esquemas apiKey em cookie (cookieAuth/refreshCookieAuth).
2. Factory chama createOpenApiDocument(app,config), que usa SwaggerModule.createDocument e acrescenta contentOpenApiSchemas()/recordsOpenApiSchemas() aos components.schemas.
3. SwaggerModule.setup("docs",app,documentFactory) usa defaults ui=true e raw=true; adapter registra as rotas fora de controllers/guards.
4. A biblioteca guarda o documento produzido pela factory para reutilização; não consulta o banco para cada GET.
5. Serializar o mesmo documento com jsyaml.dump({skipInvalid:true,noRefs:true}) e Content-Type text/yaml no caminho padrão <setup-path>-yaml.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 404 | Rota não registrada | Em produção estes caminhos não são registrados pelo bootstrap; ausência não é uma política JWT. |

Estes handlers são diretos do adapter. As respostas e erros de domínio dos controllers não são respostas próprias destes endpoints; consultar o contrato compartilhado e a biblioteca local.

## Interfaces e persistência

- `createOpenApiDocument(app: INestApplication, config: Omit<OpenAPIObject, "paths">): OpenAPIObject`
- `SwaggerModule.setup("docs", app, documentFactory)` em main.ts.

## Evidências e critérios de conferência

- [test/e2e/rpg-content.e2e-spec.ts](../../../test/e2e/rpg-content.e2e-spec.ts) — `documents every route, strict bodies, errors and field defaults in OpenAPI`: createOpenApiDocument contém paths de conteúdo, default fields e cookieAuth.
- [test/e2e/rpg-records.e2e-spec.ts](../../../test/e2e/rpg-records.e2e-spec.ts) — `documents dynamic values, pagination, cookie auth and all five operations`: createOpenApiDocument inclui records, query limit/cursor e respostas de cascata.

Os testes existentes validam a geração do objeto OpenAPI, não GET dos endpoints de Swagger nem bootstrap de produção. Registro, formato e aliases foram conferidos estaticamente em main.ts e na biblioteca local instalada. Headers/exceções de handlers diretos do adapter não devem ser confundidos com os filtros dos controllers.

## Fontes da implementação

- [src/main.ts](../../../src/main.ts)
- [src/modules/shared/presentation/create-openapi-document.ts](../../../src/modules/shared/presentation/create-openapi-document.ts)
- [src/modules/rpg-content/presentation/http/content.openapi.ts](../../../src/modules/rpg-content/presentation/http/content.openapi.ts)
- [src/modules/rpg-content/presentation/http/records.openapi.ts](../../../src/modules/rpg-content/presentation/http/records.openapi.ts)
- [node_modules/@nestjs/swagger/dist/swagger-module.js](../../../node_modules/@nestjs/swagger/dist/swagger-module.js)
