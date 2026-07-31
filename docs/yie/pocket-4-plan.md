# YIE Pocket 4 — Implementation Plan

Baseline: `8366652`. Pocket 2, Pocket 3, current discovery, and discovery-persistence tests pass before implementation.

## Proposed tables

Migration `20260730_002` will add only:

1. `yie_discovery_sessions`
2. `yie_discovery_intent_versions`
3. `yie_discovery_session_events`
4. `yie_search_plans`
5. `yie_search_plan_queries`
6. `yie_shadow_comparisons`

The existing migration ledger remains canonical. Pocket 3 tables are referenced by stable ID/version but are not altered. Auth.js, prospects, contacts, outreach, `search_runs`, and `search_run_results` remain protected and unchanged.

## Aggregate boundaries

- **Discovery Session** owns shadow lifecycle, actor/correlation provenance, exact Solution/ICP pins, current intent pointer, failure state, and append-only events.
- **Intent Version** is an immutable session child containing raw input, formal mode, normalized structured intent, deterministic patch/merge result, explanations, warnings, validation, and proposal metadata.
- **Search Plan** is an immutable child of one exact intent version. Its query rows are part of the aggregate and cannot be updated.
- **Shadow Comparison** is an immutable diagnostic comparing a supplied production interpretation with the YIE interpretation. It never authorizes production behavior.
- Pocket 3 repositories remain the only knowledge/ICP table readers.

## Session lifecycle

`CREATED → INTERPRETING → PLANNED`, with terminal `FAILED`, `CANCELLED`, or `SUPERSEDED`. Pocket 4 has no candidate/research statuses. Every created session is `shadowOnly=true`. Failure is recorded safely and never touches production state.

## Intent-version model and transitions

Intent records are insert-only, numbered sequentially, and point to an optional parent version. Core intent is structured and runtime validated.

- `NEW`: independent session and clean intent.
- `REFINE`: apply only named changes and preserve unrelated values.
- `EXPAND`: broaden only requested dimensions; never remove exclusions.
- `EXCLUDE`: add explicit exclusions only.
- `RESTORE`: copy the selected historical normalized intent exactly into a new version, record its source version, and explicitly state that no research occurred.

Legacy `reprioritize` remains a compatibility input mapped to `REFINE`.

## Merge precedence

1. Current user exclusions
2. Current user required constraints
3. Current user preferences
4. Prior intent for derived modes
5. Pinned ICP required criteria
6. Pinned ICP preferences
7. Pinned ICP exclusions
8. Pinned Solution hypotheses
9. AI proposal

Conflicts are returned as structured records. Explicit user constraints may override preferences, but do not silently remove ICP hard requirements or exclusions. Hard contradictions require review.

## Knowledge-version pinning

At session creation, the active Solution Profile is loaded once and pinned by ID/version. ICP selection returns an exact active ICP ID/version or an explicit no-ICP/manual-review result. This implementation allows ad hoc intent only when no ICP has adequate support; the session stores a null ICP and an explicit warning/reason. Planning never refetches “current active” knowledge after pinning. Reconstruction always loads exact stored versions.

## ICP selection

Precedence is explicit ID, recognized exact name, deterministic field/token match, optional AI proposal, then ad hoc/manual review. The result contains method, confidence, competitors, explanation, and warnings. Ambiguity never silently selects a weak match.

## Search Plan

The deterministic planner builds generic query families from structured intent and pinned ICP guidance: industry/geography, importer/exporter, supplier/customer geography, business model, trigger/hiring/ERP, official directories/registries, trade associations, and company-site research. AI may propose additional queries through the Pocket 2 reasoning interface, but deterministic code validates, deduplicates, bounds, rejects conclusions/product claims, and records rationale origin.

Plan fingerprints are stable hashes of canonical content. Plans and queries are immutable after insertion.

## Shadow comparison

The comparator accepts a bounded production interpretation snapshot supplied by the CLI or application caller. It reports matched/differing/production-only/YIE-only fields, semantic warnings, restore mismatch, cache/session-reuse risk, confidence, and a stable fingerprint. `POSSIBLE_FALSE_RESTORE` is emitted only when production restored, intent materially differs, and the user did not explicitly request restore.

## Failure behavior

- Provider output is always a proposal and must pass strict Zod plus deterministic policy.
- Provider failure is converted to a safe failure code, session failure state, and append-only event.
- No grounding/search provider is registered or invoked by the shadow planner.
- No candidate operation is reachable from Pocket 4 services.
- No route, page, Auth.js module, or legacy table is changed.

## File plan

Create:

- `src/domain/yie/planning-schemas.ts`
- `src/domain/yie/planning-policies.ts`
- `src/domain/yie/icp-selection-policy.ts`
- `src/domain/yie/search-plan-policy.ts`
- `src/domain/yie/shadow-comparison-policy.ts`
- `src/application/yie/discovery/discovery-planning-repository.ts`
- focused session, intent, selection, planning, comparison, and reconstruction services under `src/application/yie/discovery/`
- `src/infrastructure/yie/persistence/turso-discovery-planning-repository.ts`
- `src/infrastructure/yie/testing/fake-planning-provider.ts` if the existing fake cannot express bounded query proposals cleanly
- `scripts/yie-plan-shadow.ts`
- `scripts/test-yie-pocket-4.ts`
- Pocket 4 documentation required by the brief

Modify:

- `src/infrastructure/yie/persistence/migrations.ts` to append migration `20260730_002`
- `package.json` for Pocket 4 test, migration, and shadow-planning commands
- Pocket 2 contracts only if a narrowly compatible optional field is required; otherwise adapt at the Pocket 4 boundary.

## Migration execution

The existing script-only YIE migration runner applies the next additive migration. Dry-run remains non-mutating. Standard tests use an isolated local libSQL database, apply Pocket 3 migration and seed first, then Pocket 4.

Rollback is application-only: stop invoking the shadow CLI/services or revert the commit. Additive Pocket 4 tables remain for diagnosis. No down migration or production-table mutation is permitted.

## Test plan

Tests will cover all five modes and immutability, state isolation, exact restore, ICP selection precedence/ambiguity, exact knowledge pinning/reconstruction after later versions, merge conflicts and category separation, unknown handling, AI-proposal rejection, query diversity/dedupe/bounds/unsupported claims/fabricated facts/fingerprint/immutability, append-only events, safe provider failure, false-restore diagnostics, no grounding/candidate/live Gemini calls, migration idempotency, protected signatures, and every existing regression/build gate.

## Explicit exclusions

Candidate collection, web search, grounding, source retrieval, evidence capture, claims, verification, decision makers, buying signals, scoring, outreach, queues/workers/orchestration, public endpoints, production route integration, Auth.js changes, and UI changes.
