# YIE Pocket 3 — Implementation Plan

Baseline: `8b4c1d8`; Pocket 2, discovery, and persistence tests pass.

## Physical tables

1. `yie_schema_migrations`
2. `yie_knowledge_definitions`
3. `yie_knowledge_versions`
4. `yie_solution_relationships`
5. `yie_icp_profiles`
6. `yie_icp_profile_versions`
7. `yie_icp_criteria`
8. `yie_icp_capabilities`
9. `yie_icp_personas`
10. `yie_icp_triggers`
11. `yie_icp_pain_hypotheses`
12. `yie_icp_source_recommendations`

The knowledge tables use a definition-and-version model shared by SolutionProfile, Capability, ProblemSolved, BuyerPersona, BuyingTrigger, and NegativeFitSignal. This avoids duplicating lifecycle logic across twelve physical tables while retaining queryable kind, stable ID, normalized name, version, status, approval/effective dates, provenance, and relationships. Bounded type-specific attributes use JSON; core lifecycle and relationships do not.

## Aggregate boundaries

- Solution Knowledge owns knowledge definitions, immutable versions, and solution-to-knowledge relationships.
- ICP owns ICP definitions, immutable versions, typed criteria, and version-pinned relationships to solution/capability/persona/trigger versions.
- Migration runner owns only the `yie_` migration ledger and applies allowlisted additive YIE DDL.
- Auth.js and existing sales/search tables remain external protected dependencies.

## Files to create

- `src/domain/yie/knowledge-schemas.ts`
- `src/domain/yie/icp-schemas.ts`
- `src/domain/yie/lifecycle-policy.ts`
- `src/application/yie/knowledge/solution-knowledge-repository.ts`
- `src/application/yie/knowledge/icp-repository.ts`
- `src/application/yie/knowledge/solution-knowledge-service.ts`
- `src/application/yie/knowledge/icp-service.ts`
- `src/infrastructure/yie/persistence/migrations.ts`
- `src/infrastructure/yie/persistence/migration-runner.ts`
- `src/infrastructure/yie/persistence/turso-solution-knowledge-repository.ts`
- `src/infrastructure/yie/persistence/turso-icp-repository.ts`
- `src/infrastructure/yie/seeding/pocket-3-catalog.ts`
- `src/infrastructure/yie/seeding/pocket-3-seed.ts`
- `scripts/yie-migrate.ts`
- `scripts/yie-seed-pocket-3.ts`
- `scripts/yie-knowledge-diagnostic.ts`
- `scripts/test-yie-pocket-3.ts`
- Pocket 3 documentation listed in the brief

## Files to modify

- `package.json` for migrate, seed, diagnostic, and test scripts.
- `src/domain/yie/enums.ts` to add the approved knowledge lifecycle values without changing Pocket 2 enums.

No route, page, Auth.js, legacy DB service, migration, or UI file will change.

## Versioning and approval

- Stable definition row + immutable numbered version rows.
- DRAFT is editable.
- APPROVED, ACTIVE, and RETIRED content is immutable.
- Editing ACTIVE clones it to a new DRAFT.
- Approval validates required fields, provenance, references, and typed criteria.
- Activation requires APPROVED, atomically retires the previous active version, and preserves history.
- Lifecycle actor and timestamps are explicit.

## Seed approach

- Deterministic stable IDs and version `1`.
- Explicit `approved_business_context`, `manual_seed`, and seed version provenance.
- Seed inserts missing definitions, reports unchanged records, and detects conflicting content.
- Existing active/manual content is never overwritten.
- Dry-run and isolated local/test database support.

## Migration execution

- Script-only runner using `@libsql/client`.
- Connectivity check, stable checksums, migration ledger, dry-run plan.
- Destructive SQL and non-`yie_` mutation statements rejected.
- Protected Auth.js and sales/search table signatures captured before and verified after.
- Standard tests use an isolated temporary libSQL database.

## Rollback boundary

- Disable use of Pocket 3 scripts/services and revert application commit.
- Additive tables remain; no down migration or destructive rollback.
- No production route reads these tables, so rollback has no runtime or data-path dependency.

## Tests

- Lifecycle editing, approval, activation, retirement, clone, immutability, history.
- Missing references and invalid typed criteria.
- One-active-version invariant.
- Migration idempotency, ledger, dry-run, destructive-SQL rejection, protected-table signatures.
- Seed idempotency, drift, manual-change protection, relationship integrity, 15 active ICPs, detailed California ICP.
- Pocket 2 and existing tests, TypeScript, scoped lint, and production build.

## Explicit exclusions

Discovery changes, production routing, candidate collection, source retrieval, verification, decision-maker discovery, scoring, outreach, UI, Auth.js, queues, workers, and orchestration.
