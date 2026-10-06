# Spec — GET /health/ready

**Data:** 2026-10-05. Retrato do working tree, incluindo alterações locais existentes.
**Objetivo:** Informar se a consulta ao banco encontra as duas tabelas de segurança esperadas.
**Entrada no código:** `HealthController.ready` em [src/modules/shared/presentation/controllers/health.controller.ts](../../../src/modules/shared/presentation/controllers/health.controller.ts).
**Plan correspondente:** [2026-10-05-01-get-health-ready.md](../plans/2026-10-05-01-get-health-ready.md).

## Escopo e acesso

`@Public()`: não exige access ou refresh; sem política de rate limit de identidade.

Esta spec incorpora o [contrato compartilhado da API](../api-contracts.md), inclusive unidades de comprimento, cookies, parsing, ownership, erros e serialização. Documenta o comportamento implementado, sem propor alterações.

## Requisição

| Entrada | Regra implementada |
| --- | --- |
| Path/body/query | Nenhum parâmetro declarado; query extra não é validada por schema. |

## Resposta de sucesso

`200 application/json` com `{"status":"ready"}`.

## Fluxo implementado

1. Executar `SELECT to_regclass('public.refresh_tokens') IS NOT NULL AND to_regclass('public.rate_limits') IS NOT NULL AS ready` via `db.execute`.
2. Se `result.rows[0]?.ready` for verdadeiro, devolver `{ status: "ready" }`.
3. Se a consulta lançar erro, não propagar detalhes; se o resultado não indicar prontidão, lançar `ServiceUnavailableException("Service unavailable")`.

## Erros efetivos desta operação

| Status | Mensagem/condição | Quando ocorre |
| --- | --- | --- |
| 503 | Service unavailable | Banco indisponível, tabelas ausentes ou resultado sem ready verdadeiro. |

Também valem os erros e cabeçalhos do [contrato compartilhado](../api-contracts.md), incluindo 413 do parser e 500 para falhas inesperadas.

## Interfaces e persistência

- `HealthController.ready(): Promise<{ status: "ready" }>`
- `db.execute<{ ready: boolean }>(sql)`

## Evidências e critérios de conferência

- [test/e2e/security.e2e-spec.ts](../../../test/e2e/security.e2e-spec.ts) — `reports database/schema readiness without exposing infrastructure details`: HTTP 200; body exatamente `{status:"ready"}`.

O teste HTTP existente cobre readiness positiva. As condições de 503 e a abrangência limitada do SQL são conferidas estaticamente; não há teste de falha específico nesse arquivo.

## Fontes da implementação

- [src/modules/shared/presentation/controllers/health.controller.ts](../../../src/modules/shared/presentation/controllers/health.controller.ts)
- [src/modules/shared/infrastructure/database/drizzle.ts](../../../src/modules/shared/infrastructure/database/drizzle.ts)
