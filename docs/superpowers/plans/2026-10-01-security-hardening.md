# Security hardening implementation plan

> Execution: inline in this task using systematic debugging, TDD and verification before completion. The user authorized corrections from the security/performance audit; preserve existing unrelated files and leave changes available for review without committing.

**Goal:** correct the actionable findings in `docs/security-performance-audit-2026-10-01.md`.

**Architecture:** keep NestJS layers and PostgreSQL/Drizzle. Persist refresh sessions and atomic rate-limit counters in PostgreSQL. Rotate signed refresh tokens with a session ID and random token ID; stale signed tokens revoke the session. Access tokens are bound to active sessions, enabling logout and deletion to invalidate access immediately.

**Constraints:** Node 24+, pnpm 11.25.0, tabs/double quotes, no secrets in source. No production DB changes performed automatically. PostgreSQL is the only new-state backend. Global/per-IP/per-account limits have documented configuration and bounded retention. Existing clients must store the new refresh token returned by refresh; existing stateless tokens require login after deployment.

## Tasks

- [x] 1. Add failing boundary tests for oversized/blank names, oversized passwords/tokens, e-mail bounds and whitespace. Replace ambiguous e-mail regex with linear scans and share DTO limits.
- [x] 2. Add failing tests for bounded hashing concurrency/queue and unknown-account password verification. Use explicit Argon2 parameters and one startup dummy hash; retain the existing registration 409 contract with its privacy implication documented.
- [x] 3. Add session schema/repository and integration tests for rotation/replay/concurrency/expiry/user deletion. Add login/refresh/logout end-to-end tests. Implement atomic rotation, session-bound access and logout; update token contracts and HTTP examples.
- [x] 4. Add shared rate-limit schema/repository and integration tests for independent instances, concurrency and expiration. Replace in-memory limiter with global/origin/account limits on login, signup, refresh and delete. Prune expired records in bounded batches; configure trusted proxy CIDRs explicitly.
- [x] 5. Add tests for safe error logging and pool error handling. Set connection/query/lock deadlines, harden key/env validation, add structured security events and readiness.
- [x] 6. Remove unused Nodemailer, upgrade affected dependency resolutions compatibly, audit the result. Align CI versions and PR coverage, use ephemeral test keys, remove pnpm@latest in runner, repair Compose and bind development DB to localhost.
- [x] 7. Provide additive SQL schema rollout, configuration docs, client compatibility notes, alert guidance and corrected audit status. Run unit/e2e, build, Biome, audit and SQL/Compose checks; review the final diff.

## Review focus

Concurrent refresh must allow at most one rotation; replay revocation must commit rather than be rolled back with a thrown exception. Unknown or forged tokens must not revoke another session. A database failure must fail closed without leaking SQL, keys or tokens. A refresh race with deletion must not recreate the account/session. Rate-limit keys must not retain raw e-mail/token data or unbounded attacker-controlled strings. Hash queue failures must release slots.

## Decisions / execution ledger

- Working in the current checkout to preserve the user's untracked audit/docs; no branch or commit is needed for these authorized reversible edits.
- Registration keeps HTTP 409 because hiding account existence requires a product decision and email-confirmation flow; login timing is corrected, and the remaining registration disclosure is documented.
- Deployment-specific TLS certificates, secrets, image digest rollout and external alerts cannot be provisioned from this repository alone; add enforceable checks/configuration and exact operational guidance.

- Final verification: 56 unit tests / 27 PostgreSQL integration and HTTP tests passed; Biome and diff checks clean; two consecutive builds emitted dist/main.js; pnpm audit across all dependencies returned zero advisories. Production image built and its actual entrypoint started with Node 24.21.0, readiness returned controlled 503 without a database, and production Swagger returned 404. Additive SQL, Compose configuration and Drizzle generation also verified.
- Independent review caught a legacy Argon2 cost mismatch and a production output path/cache issue; both corrected and verified. Final reviewer found no remaining material issue.
- Deployment remains a documented operator action: apply additive SQL, update refresh clients and require re-login; no existing database was migrated and no changes committed or pushed.
