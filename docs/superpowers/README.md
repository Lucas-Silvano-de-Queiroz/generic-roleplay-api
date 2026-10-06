# Specs e plans da API implementada

Documentação do working tree em **2026-10-05**, incluindo alterações locais anteriores a esta tarefa. Foram percorridos os controllers, schemas, serviços/use cases, guards, repositórios, constraints, geração OpenAPI e testes existentes da API.

São **26 operações de controllers**, cada uma com sua spec e seu plan, mais **3 endpoints principais de documentação em desenvolvimento**. Cada spec foi escrita antes de seu plan correspondente. Os aliases e assets gerados pelo Swagger estão documentados na spec de `/docs`.

Comece pelo [contrato compartilhado](api-contracts.md). Os pares abaixo descrevem o estado atual, sem proposta de implementação nova. Nenhum plan autoriza executar mudanças de código ou migrations. Os comandos dos plans são roteiros de conferência e não um relatório de testes executados.

## Operações de controllers

| # | Rota | Spec | Plan |
| --- | --- | --- | --- |
| 1 | `GET /health/ready` | [Spec](specs/2026-10-05-01-get-health-ready.md) | [Plan](plans/2026-10-05-01-get-health-ready.md) |
| 2 | `POST /users` | [Spec](specs/2026-10-05-02-post-users.md) | [Plan](plans/2026-10-05-02-post-users.md) |
| 3 | `POST /auth/login` | [Spec](specs/2026-10-05-03-post-auth-login.md) | [Plan](plans/2026-10-05-03-post-auth-login.md) |
| 4 | `POST /auth/refresh` | [Spec](specs/2026-10-05-04-post-auth-refresh.md) | [Plan](plans/2026-10-05-04-post-auth-refresh.md) |
| 5 | `POST /auth/logout` | [Spec](specs/2026-10-05-05-post-auth-logout.md) | [Plan](plans/2026-10-05-05-post-auth-logout.md) |
| 6 | `DELETE /users/me` | [Spec](specs/2026-10-05-06-delete-users-me.md) | [Plan](plans/2026-10-05-06-delete-users-me.md) |
| 7 | `POST /rpg-systems` | [Spec](specs/2026-10-05-07-post-rpg-systems.md) | [Plan](plans/2026-10-05-07-post-rpg-systems.md) |
| 8 | `GET /rpg-systems` | [Spec](specs/2026-10-05-08-get-rpg-systems.md) | [Plan](plans/2026-10-05-08-get-rpg-systems.md) |
| 9 | `GET /rpg-systems/:systemId` | [Spec](specs/2026-10-05-09-get-rpg-systems-systemId.md) | [Plan](plans/2026-10-05-09-get-rpg-systems-systemId.md) |
| 10 | `PATCH /rpg-systems/:systemId` | [Spec](specs/2026-10-05-10-patch-rpg-systems-systemId.md) | [Plan](plans/2026-10-05-10-patch-rpg-systems-systemId.md) |
| 11 | `DELETE /rpg-systems/:systemId` | [Spec](specs/2026-10-05-11-delete-rpg-systems-systemId.md) | [Plan](plans/2026-10-05-11-delete-rpg-systems-systemId.md) |
| 12 | `POST /rpg-systems/:systemId/collections` | [Spec](specs/2026-10-05-12-post-rpg-systems-systemId-collections.md) | [Plan](plans/2026-10-05-12-post-rpg-systems-systemId-collections.md) |
| 13 | `GET /rpg-systems/:systemId/collections` | [Spec](specs/2026-10-05-13-get-rpg-systems-systemId-collections.md) | [Plan](plans/2026-10-05-13-get-rpg-systems-systemId-collections.md) |
| 14 | `GET /rpg-collections/:collectionId` | [Spec](specs/2026-10-05-14-get-rpg-collections-collectionId.md) | [Plan](plans/2026-10-05-14-get-rpg-collections-collectionId.md) |
| 15 | `PATCH /rpg-collections/:collectionId` | [Spec](specs/2026-10-05-15-patch-rpg-collections-collectionId.md) | [Plan](plans/2026-10-05-15-patch-rpg-collections-collectionId.md) |
| 16 | `DELETE /rpg-collections/:collectionId` | [Spec](specs/2026-10-05-16-delete-rpg-collections-collectionId.md) | [Plan](plans/2026-10-05-16-delete-rpg-collections-collectionId.md) |
| 17 | `POST /rpg-collections/:collectionId/templates` | [Spec](specs/2026-10-05-17-post-rpg-collections-collectionId-templates.md) | [Plan](plans/2026-10-05-17-post-rpg-collections-collectionId-templates.md) |
| 18 | `GET /rpg-collections/:collectionId/templates` | [Spec](specs/2026-10-05-18-get-rpg-collections-collectionId-templates.md) | [Plan](plans/2026-10-05-18-get-rpg-collections-collectionId-templates.md) |
| 19 | `GET /rpg-templates/:templateId` | [Spec](specs/2026-10-05-19-get-rpg-templates-templateId.md) | [Plan](plans/2026-10-05-19-get-rpg-templates-templateId.md) |
| 20 | `PATCH /rpg-templates/:templateId` | [Spec](specs/2026-10-05-20-patch-rpg-templates-templateId.md) | [Plan](plans/2026-10-05-20-patch-rpg-templates-templateId.md) |
| 21 | `DELETE /rpg-templates/:templateId` | [Spec](specs/2026-10-05-21-delete-rpg-templates-templateId.md) | [Plan](plans/2026-10-05-21-delete-rpg-templates-templateId.md) |
| 22 | `POST /rpg-templates/:templateId/records` | [Spec](specs/2026-10-05-22-post-rpg-templates-templateId-records.md) | [Plan](plans/2026-10-05-22-post-rpg-templates-templateId-records.md) |
| 23 | `GET /rpg-templates/:templateId/records` | [Spec](specs/2026-10-05-23-get-rpg-templates-templateId-records.md) | [Plan](plans/2026-10-05-23-get-rpg-templates-templateId-records.md) |
| 24 | `GET /rpg-records/:recordId` | [Spec](specs/2026-10-05-24-get-rpg-records-recordId.md) | [Plan](plans/2026-10-05-24-get-rpg-records-recordId.md) |
| 25 | `PATCH /rpg-records/:recordId` | [Spec](specs/2026-10-05-25-patch-rpg-records-recordId.md) | [Plan](plans/2026-10-05-25-patch-rpg-records-recordId.md) |
| 26 | `DELETE /rpg-records/:recordId` | [Spec](specs/2026-10-05-26-delete-rpg-records-recordId.md) | [Plan](plans/2026-10-05-26-delete-rpg-records-recordId.md) |

## Swagger de desenvolvimento

| # | Rota | Spec | Plan |
| --- | --- | --- | --- |
| 27 | `GET /docs` | [Spec](specs/2026-10-05-27-get-docs.md) | [Plan](plans/2026-10-05-27-get-docs.md) |
| 28 | `GET /docs-json` | [Spec](specs/2026-10-05-28-get-docs-json.md) | [Plan](plans/2026-10-05-28-get-docs-json.md) |
| 29 | `GET /docs-yaml` | [Spec](specs/2026-10-05-29-get-docs-yaml.md) | [Plan](plans/2026-10-05-29-get-docs-yaml.md) |

## Abrangência e diferenças que precisam ser preservadas

- DTOs de identidade removem extras; corpos de conteúdo/registros rejeitam extras.
- Login/refresh retornam 204 e cookies; access é stateless e logout não invalida access já emitido.
- Logout distingue cookie não reconhecido pelo leitor (204) de string reconhecida com JWT inválido (401 com limpeza).
- Não há quota de sistemas; quotas de filhos usam locks transacionais e identifiers únicos por pai.
- PATCH sem mudança preserva timestamps; values/fields enviados substituem integralmente suas estruturas.
- Mudança incompatível de fields retorna 409 e rollback; exclusões de pais usam cascade.
- Somente a listagem de records valida query e pagina; cursor arbitrário é filtro por ID no template autorizado.
- Readiness verifica apenas as tabelas refresh_tokens/rate_limits pela consulta implementada.
- Swagger só é registrado no bootstrap de desenvolvimento; seus handlers diretos não são controllers de negócio.

Specs Markdown e plans foram criados somente nesta API. Os testes TypeScript existentes continuam sendo evidências e não foram reescritos como documentos. Esta entrega não requer visualizar ou alterar o projeto web.
