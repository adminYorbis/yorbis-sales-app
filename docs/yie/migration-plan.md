# Yorbis Intelligence Engine — Additive Migration Plan

Status: planning only; no SQL written or executed

## Objectives

- Preserve all current production data and behavior.
- Leave Auth.js and its tables untouched.
- Introduce normalized Intelligence Engine storage additively.
- Support dual-read/dual-write compatibility until the new path is proven.
- Make rollback a routing/configuration action rather than a destructive database action.

## Existing tables that remain unchanged

| Table | Protection |
|---|---|
| `settings` | Preserve exactly; investigate ownership before any future use |
| `prospects` | Preserve rows and columns; continue as legacy CRM/read projection |
| `contacts` | Preserve; continue current reads/writes during compatibility |
| `outreach` | Preserve; continue storing current drafts/status |
| `saved_searches` | Preserve even though no active path was found |
| `search_runs` | Preserve as current search history |
| `search_run_results` | Preserve current restoration behavior until snapshot cutover |
| `user`, `account`, `session`, `verificationToken`, `authenticator` | Auth.js-owned; never modify in YIE migrations |

No existing table is dropped, renamed, rebuilt, or repurposed.

## Existing tables that may be wrapped or extended later

### `prospects`

Treat as a compatibility projection of the latest accepted intelligence and current CRM state. Do not make it the canonical owner of claims, sources, scores, or search snapshots. If a link to a canonical YIE company is later required, add a nullable indexed ID only after new company storage exists.

### `contacts`

Continue current behavior while DecisionMaker records become authoritative. A later nullable link may associate a legacy contact with a verified decision maker.

### `outreach`

Continue as the operational draft/message table. A later nullable link may associate a row with an evidence-safe OutreachRecommendation version.

### `search_runs` and `search_run_results`

Continue powering current recent-search UI. New YIE sessions/runs should be linked through a compatibility mapping or nullable reference, not by rewriting old rows. New immutable result snapshots eventually replace mutable joins for RESTORE.

## Proposed new table groups

Names below are planning identifiers, not approved SQL.

### 1. Knowledge and ICP

- `yie_solution_profiles`
- `yie_capabilities`
- `yie_problems_solved`
- `yie_buyer_personas`
- `yie_buying_triggers`
- `yie_negative_fit_signals`
- `yie_icp_profiles`
- `yie_icp_constraints`
- `yie_icp_preferences`
- required many-to-many relationship tables

### 2. Discovery state and orchestration

- `yie_discovery_sessions`
- `yie_discovery_intents`
- `yie_discovery_runs`
- `yie_search_plans`
- `yie_search_strategies`
- `yie_run_checkpoints`
- `yie_run_errors`

### 3. Company identity and evidence

- `yie_companies`
- `yie_company_aliases`
- `yie_candidate_companies`
- `yie_company_sources`
- `yie_candidate_sources`
- `yie_company_claims`
- `yie_claim_sources`
- `yie_verification_results`

### 4. Intelligence and scoring

- `yie_company_signals`
- `yie_buying_signals`
- `yie_decision_makers`
- `yie_decision_maker_sources`
- `yie_opportunity_scores`
- `yie_score_components`
- `yie_opportunity_recommendations`
- `yie_outreach_recommendations`
- `yie_result_snapshots`

### 5. Learning and feedback

- `yie_user_feedback`
- `yie_search_feedback`
- `yie_sales_outcomes`

### 6. Compatibility and operations

- `yie_legacy_mappings`
- `yie_projection_jobs` if projection retries are needed
- a non-Auth migration ledger such as `yie_schema_migrations`

## Migration order

1. **Contracts without storage:** introduce domain enums/contracts, provider abstraction, repository interfaces, and tests. No DB change.
2. **Migration framework:** establish one canonical additive YIE migration runner and migration ledger. It must refuse destructive SQL and verify database identity.
3. **Knowledge/ICP tables:** create versioned definitions and seed only explicitly approved Yorbis knowledge.
4. **Discovery tables:** create sessions, intents, runs, plans, strategies, checkpoints, and error records.
5. **Company/evidence tables:** create canonical identity, candidates, sources, claims, and verification structures.
6. **Intelligence tables:** create signals, people, scores, components, recommendations, and immutable snapshots.
7. **Feedback tables:** add user/search feedback and sales outcomes.
8. **Compatibility mappings:** add mapping/projection structures; avoid changing legacy tables unless a nullable link is demonstrably necessary.
9. **Dual write:** engine writes canonical tables, then projects to legacy tables. Current reads remain unchanged.
10. **Shadow read/evaluation:** compare engine read model to current output without changing the CEO UI.
11. **Controlled cutover:** switch current Discover API response to engine read model behind a server-side feature flag.
12. **Legacy retirement:** only after telemetry and rollback window; remove code, not data. Table removal is outside the current roadmap.

## Backfill needs

Backfill must preserve uncertainty rather than manufacture provenance.

| Existing data | Backfill treatment |
|---|---|
| Prospect company name/domain/website | Create or match canonical company using deterministic domain rules |
| `evidence_json` / `source_urls` | Import as `legacy_import` sources; do not automatically mark claims VERIFIED |
| `signals_json` | Import as proposed legacy signals with original status and provenance label |
| `unknown_signals_json` | Import as UNKNOWN |
| `constraint_evaluations_json` | Import as legacy verification observations, not authoritative current verification |
| `score_breakdown` / `icp_score` | Preserve as legacy score snapshot with policy `legacy-v1` |
| Embedded prospect contact | Import as proposed decision maker; email verified only if explicit legacy source exists |
| `contacts` | Import separately and dedupe cautiously; do not merge people solely by name |
| `outreach` | Link to mapped company/prospect where possible; do not infer source claims from message text |
| Search runs/results | Create compatibility links; historical mutable state cannot be reconstructed as truly immutable |

Backfills should be resumable, idempotent, count-preserving, and produce a reconciliation report with imported/skipped/conflicting records.

## Compatibility strategy

### Write path

1. Engine commits canonical run/candidate/evidence/score snapshot.
2. A compatibility projector maps the accepted result to `prospects`.
3. Existing search history is written until the current UI reads YIE sessions.
4. Projection failure is retriable and does not invalidate canonical data.

### Read path

- Phase A: current reads only; engine operates in shadow mode.
- Phase B: engine results translated to the existing API shape.
- Phase C: current API reads immutable YIE snapshots with fallback to legacy runs.
- Phase D: legacy API paths become adapters or are retired.

### Identity compatibility

Preserve legacy prospect IDs. Maintain an explicit mapping between legacy prospect ID and canonical YIE company ID. Do not replace prospect IDs or re-key foreign tables.

## Rollback strategy

- Use server-side feature flags at orchestration and read-model boundaries.
- On failure, disable YIE execution and route requests back to the existing `/api/prospects/discover` implementation.
- Stop dual writes while retaining all new YIE tables for diagnosis.
- Continue legacy reads/writes without data conversion.
- Roll back application deployment; do not reverse additive migrations.
- Never delete backfilled or canonical records as part of application rollback.
- If a bad policy/model version is deployed, deactivate that version and re-run affected candidates into new snapshots.

## Authentication protections

- YIE migrations must explicitly exclude Auth.js tables.
- The migration runner must snapshot Auth.js table names/columns and sales row counts before and after migration.
- No foreign keys from Auth.js tables into YIE tables.
- YIE tables may store the authenticated actor’s stable email/user reference as application metadata, without altering Auth.js records.
- New API handlers must call `auth()` directly in addition to the existing proxy.
- Migration execution must use a separately authorized operational path/script, never a public route.

## Deployment sequencing

1. Rotate/purge tracked credentials in a separate security change before expanding access.
2. Merge contract/provider code with no behavior switch.
3. Deploy additive migrations independently and verify schema/database identity.
4. Deploy repositories and shadow orchestration disabled by default.
5. Enable for development, then preview, then approved production users.
6. Compare counts, source validity, score reproducibility, latency, errors, and projected legacy records.
7. Enable production dual write.
8. Enable production engine reads for a controlled percentage/user.
9. Complete authenticated end-to-end validation.
10. Expand rollout only after rollback criteria remain healthy.

## Major risks and controls

| Risk | Control |
|---|---|
| Migration touches production Auth/sales data | Additive SQL allowlist, pre/post snapshots, explicit table ownership |
| New and legacy identity diverge | Explicit mapping table and reconciliation job |
| Backfill falsely upgrades evidence | Mark imported provenance; no automatic VERIFIED state |
| Dual writes partially fail | Canonical-first transaction + retriable projection status |
| Immutable snapshots increase storage | Retention policy and compact source fingerprints |
| Runtime exceeds Vercel limits | Stage checkpoints; later durable execution decision |
| Source storage creates legal/privacy obligations | Decide content-versus-metadata policy before evidence schema |
| Scoring changes alter rankings | Versioned policies and shadow comparison |
| Stale model/provider behavior | Capability-driven adapter and per-operation model policy |

## Migration completion criteria

- Zero existing rows lost or mutated unexpectedly.
- Auth.js adapter lifecycle still passes.
- Current production Discover remains usable with feature flag off.
- Every new migration is idempotent and recorded.
- Backfill reconciliation totals match source records.
- Engine results can project into the existing UI response shape.
- Disabling the feature flag restores the legacy path without database rollback.
