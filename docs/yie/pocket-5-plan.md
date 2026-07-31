# YIE Pocket 5 — Implementation Plan

Baseline: `7f55177`. Pocket 2–4 and legacy discovery/persistence tests pass. The existing `.gitignore` modification is user-owned and excluded from this work.

## Evidence-first aggregate boundaries

- **DiscoveryRun** executes one immutable Pocket 4 Search Plan in shadow mode and owns budgets, provider totals, lifecycle, failure summary, and resume provenance.
- **SearchExecutionPlan** is an immutable deterministic projection of accepted Pocket 4 queries. It owns ordered steps and execution limits but never changes query meaning.
- **SearchAttempt** records each provider attempt independently.
- **Source Registry** owns canonical public-source identity and bounded retrieval metadata.
- **SourceObservation/Excerpt** preserve run/query context, attributed snippets, and bounded evidence text.
- **CandidateMention** is a source-backed extraction proposal.
- **CandidateCompany** is an unverified canonical identity linked to accepted mentions and sources. Aliases and identity decisions preserve merge history.
- **ProposedClaim** is an unverified statement with mandatory source evidence links.
- **DiscoveryCheckpoint** is append-only progress/resume metadata.
- **Replay** is a read-only reconstruction service, not a run.

## Execution lifecycle

`CREATED → PREPARING → EXECUTING → EXTRACTING → RESOLVING → COMPLETED`

Terminal alternatives are `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`, and `SUPERSEDED`.

- all query steps fail: `FAILED`;
- at least one succeeds and usable sources/candidates exist, but another step or extraction fails: `PARTIALLY_COMPLETED`;
- all eligible steps complete and extraction resolves deterministically: `COMPLETED`;
- successful queries with no usable sources: `FAILED / RUN_NO_USABLE_SOURCES`;
- sources with no accepted company mentions: `PARTIALLY_COMPLETED / RUN_NO_CANDIDATES`.

Runs are synchronous, bounded, and `shadowOnly=true`.

## Provider operations

Pocket 5 adds separate focused contracts:

- `EvidenceSearchProvider.executeSearchQuery`
- existing `SourceRetrievalProvider.retrieveSource` (optional; attributed snippets may remain `PROVIDER_SNIPPET_ONLY`)
- `CandidateExtractionProvider.extractCandidateMentions`
- `ClaimExtractionProvider.extractProposedClaims`

Search and extraction are separate instances/capabilities. No verification, decision-maker, buying-signal, scoring, or outreach operation is reachable.

Normal tests use deterministic fake providers only. The CLI defaults to fake mode; controlled live mode may use an explicitly configured search adapter later without changing production routes.

## Search Execution Plan

The builder:

- accepts only `ACCEPTED` Pocket 4 queries;
- normalizes/deduplicates execution-equivalent text;
- orders by priority then stable ID;
- preserves source category and wording;
- enforces maximum queries, per-query results, total sources, candidate mentions, candidates, timeout, and retries;
- records skipped query IDs/reasons;
- uses a stable semantic fingerprint excluding runtime IDs/timestamps.

Defaults for initial shadow operation: maximum 8 queries, concurrency 1, one retry, 10-second query timeout, 10 sources/query, 50 total sources, 60 mentions, and 25 candidates. CLI flags may lower these bounds, never exceed hard policy maxima.

## Source model and content limits

Canonical URLs lowercase hosts, remove fragments/default ports/trailing-slash noise and common tracking parameters, retain meaningful parameters, and conservatively normalize `www`. Identity uses canonical URL, optionally content/excerpt hashes—not title alone.

Persist only metadata, provider snippets, bounded excerpts (maximum 2,000 characters), hashes, access status, and provenance. No full pages, paywall/access bypass, or prohibited scraping.

The same canonical source may have multiple immutable run/query observations.

## Candidate and identity model

A mention requires a persisted source and defensible name occurrence in its excerpt/snippet. Product, person, publication, category/page-title, and unsupported entities are rejected.

Candidate companies never use a verified status. Creation requires an accepted mention and source. Automatic linking is limited to exact canonical domain or exact legal name plus matching location/context. Similar name alone, common abbreviations, industry, state, directory co-occurrence, or model assertions produce separate/ambiguous identities.

## Proposed claims and evidence

Allowed statuses: `PROPOSED`, `CONFLICTING`, `AMBIGUOUS`, `REJECTED`, `SUPERSEDED`. Every claim is inserted transactionally with at least one evidence link to a persisted source and bounded excerpt/observation. Support distinguishes direct text, metadata, snippets, official profiles, directory entries, and explicit inference.

Claims about Yorbis need, payment pain, buying readiness, budget, decision makers, transaction volume, qualification, or score are rejected.

## Checkpoints and resume

Checkpoints are append-only with unique run sequence and stable fingerprint. Resume uses the original run and immutable Search Plan/Execution Plan, skips successful query/extraction artifacts, retries only eligible failed steps, and relies on unique fingerprints to prevent duplicate sources, observations, excerpts, mentions, candidates, claims, or evidence.

No event-sourcing or background workflow system is introduced.

## Replay

Replay loads session/intent, Pocket 4 plan, execution plan, attempts, sources/observations/excerpts, mentions, candidates/aliases/identity decisions, claims/evidence, checkpoints, and summary. It performs zero provider calls and zero writes, retains original timestamps/fingerprints, and labels output historical/stale.

## Persistence design

Migration `20260730_003` adds only:

1. `yie_discovery_runs`
2. `yie_search_execution_plans`
3. `yie_search_execution_steps`
4. `yie_search_attempts`
5. `yie_sources`
6. `yie_source_observations`
7. `yie_source_excerpts`
8. `yie_candidate_mentions`
9. `yie_candidate_companies`
10. `yie_candidate_company_aliases`
11. `yie_candidate_mention_links`
12. `yie_identity_resolution_decisions`
13. `yie_proposed_claims`
14. `yie_claim_evidence_links`
15. `yie_discovery_checkpoints`

All migration SQL is additive. Pocket 3/4, Auth.js, production prospects/contacts/outreach/search tables remain unchanged.

## Failure and concurrency policy

Execution is sequential (`maximumConcurrentQueries=1`) for the first implementation, making budget enforcement and resume deterministic. Retry uses provider error retryability and the step retry limit. Each final failure is persisted with a bounded summary. Individual failure continues; run completion policy evaluates all steps.

Provider responses, raw content, and error text are bounded before persistence/logging. Logs contain IDs, counts, latency, retries, costs, checkpoints, and status—not secrets or full content.

## File and test plan

Create Pocket 5 domain schemas/policies; focused provider contracts; run/source/candidate repository interface and Turso implementation; run, execution, extraction, identity, replay, and summary services; fake providers/fixtures; shadow and replay scripts; isolated test suite; and required documentation.

Modify only the YIE migration catalog/runner script and `package.json`. No production route or UI file changes.

Tests cover all 72 requested behaviors through unit/integration/migration/provider/retry/resume/replay assertions, plus every prior suite, TypeScript, scoped lint, and build.

## Rollback and exclusions

Rollback disables the shadow CLI/services or reverts the application commit. Additive tables remain for diagnosis; no down migration.

Excluded: final verification, ICP qualification, evidence weighting, buying signals, decision makers, scoring, outreach, queues/workers/orchestration, production endpoints, UI, Auth.js, and legacy projections.
