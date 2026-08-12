# Yorbis Sales Intelligence Engine — OpenCode Handoff

Last updated: 2026-08-12  
Repository: `https://github.com/adminYorbis/yorbis-sales-app`  
Production application: `https://yorbis-sales.vercel.app/`  
Branch: `main`  
Current implementation commit: `eac353f` (`feat(yie): add opt-in Gemini live discovery`)

## 1. Read this first

This repository contains two discovery paths:

1. The existing production prospect experience under `/api/prospects/discover` and the current browser UI.
2. The new Yorbis Intelligence Engine (YIE), implemented through Pocket 5.1 as a shadow-only pipeline.

Do not assume the new pipeline is already connected to the production UI. It is not. Pocket 5.1 can be exercised through its CLI after its database migrations are applied, but the CEO-facing Discover page still uses the older production path.

The next implementation should preserve this separation until a controlled browser integration is explicitly approved.

## 2. Business objective

Yorbis needs a CEO-friendly system that can:

1. Accept a natural-language prospect request.
2. Interpret it against Yorbis solution knowledge and ICPs.
3. Create a bounded public-source search plan.
4. Discover real candidate companies.
5. Preserve source evidence and provenance.
6. Later verify, qualify, find decision makers, generate outreach, track activity, and book meetings.

The primary business objective is qualified meetings and eventually new transacting Yorbis customers. The new engine deliberately stops before qualification and outreach because evidence integrity must be proven first.

## 3. Product context

Yorbis helps SMBs:

- accept customer payments;
- process credit and debit cards;
- send domestic and international fiat payments;
- pay vendors and suppliers globally;
- use stablecoin payment capabilities where appropriate.

Positioning: **Get paid. Pay vendors. Move money globally. One platform.**

Plans:

- Launch: $0/month with standard pricing/higher spread.
- Core: $100/month with improved commercial terms.

Do not lead prospect messaging with stablecoins unless the use case makes it relevant.

## 4. Current technical stack

- Next.js App Router, TypeScript, React 19, Tailwind CSS v4
- Vercel deployment from GitHub `main`
- Turso/libSQL via `@libsql/client`
- Auth.js v5 beta with Drizzle adapter and Resend magic links
- Gemini via `@google/genai`
- Zod for strict provider/domain validation

Important environment variables:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `GEMINI_API_KEY`
- `AUTH_SECRET`
- `AUTH_RESEND_KEY`
- `AUTH_EMAIL_FROM`

Never print secret values. Diagnostics may report presence, sanitized host, or token length only.

## 5. Authentication state

Auth.js email-link authentication was designed for these allowed users:

- `sun@yorbisapp.com`
- `anant@yorbisapp.com`

The production Turso database originally lacked Auth.js tables. Auth tables were subsequently addressed separately from YIE. Do not redesign authentication as part of intelligence-engine work.

Required Auth.js tables are `user`, `account`, `session`, `verificationToken`, and `authenticator`.

## 6. Intelligence Engine implementation status

### Pocket 2 — complete

Commit: `8b4c1d8`

- domain/provider boundaries;
- centralized Gemini model policy;
- provider errors and capability contracts;
- Gemini shadow adapter;
- compatibility and safety tests.

Current centralized default model: `gemini-3.1-flash-lite`.

### Pocket 3 — complete

Commit: `8366652`

- versioned Yorbis solution knowledge;
- ICP catalog and selection data;
- additive migration and deterministic seed;
- Turso repositories and diagnostics.

### Pocket 4 — complete

Commit: `7f55177`

- natural-language intent interpretation;
- immutable intent versions;
- NEW/REFINE/EXPAND/EXCLUDE/RESTORE behavior;
- deterministic, bounded Search Plans;
- shadow comparison with legacy discovery;
- no search execution at this stage.

### Pocket 5 — complete

Commit: `e9975e0`

Evidence-first shadow pipeline:

`Search Plan → Execution Plan → Search Attempt → Source → Observation → Excerpt → Mention → Candidate → Proposed Claim → Evidence Link`

Implemented:

- discovery runs and bounded execution plans;
- attempts, retry classification, and partial completion;
- canonical source registry;
- run-specific observations;
- excerpts bounded to 2,000 characters;
- source-backed candidate mentions;
- rejection of products/people/publications as companies;
- conservative candidate identity resolution;
- proposed claims linked to evidence;
- append-only checkpoints;
- safe resume;
- provider-free, read-only replay;
- deterministic fake providers as the default.

Explicitly excluded:

- verification;
- qualification;
- fit scoring;
- buying signals;
- decision-maker/contact discovery;
- outreach;
- production UI integration.

### Pocket 5.1 — complete in code

Commit: `eac353f`

- opt-in live Gemini provider for the Pocket 5 shadow pipeline;
- fake provider remains the default;
- live use requires `--provider gemini-live`;
- uses centralized model policy;
- uses `@google/genai` Google Search grounding;
- only grounding-chunk URLs enter the canonical source registry;
- URLs emitted only inside model JSON remain diagnostic metadata;
- malformed responses and timeouts are mapped to provider errors;
- live calls remain disabled in normal tests;
- CLI reporting includes model, queries, calls, grounding sources, model-only URLs, persisted artifacts, failures, retries, and latency;
- reports explicit zero counts for verification, scores, contacts, and outreach.

## 7. Critical architecture rules

These are intentional safety boundaries. Do not bypass them casually.

1. Search execution may run only Pocket 4 queries with `ACCEPTED` status.
2. Fake providers must remain the default in tests and CLI.
3. Live Gemini must always be an explicit opt-in.
4. Model-emitted URLs are not validated sources.
5. Only URLs attributed by Gemini Google Search grounding may become live sources.
6. A candidate mention must be supported by a persisted source excerpt.
7. A claim must have a persisted evidence link.
8. Candidates and claims are unverified in Pocket 5/5.1.
9. Similar names alone must not force a company merge.
10. Replay must perform no provider calls and no writes.
11. Existing production discovery, Auth.js, prospects, contacts, and outreach must remain unchanged unless the next scope explicitly authorizes integration.

## 8. Database state and migrations

YIE migrations are defined in:

`src/infrastructure/yie/persistence/migrations.ts`

Migration ledger:

- `20260730_001` — Pocket 3 knowledge/ICP foundation
- `20260730_002` — Pocket 4 discovery planning
- `20260730_003` — Pocket 5 evidence-first discovery

Migration 003 adds 15 `yie_` tables:

- `yie_discovery_runs`
- `yie_search_execution_plans`
- `yie_search_execution_steps`
- `yie_search_attempts`
- `yie_sources`
- `yie_source_observations`
- `yie_source_excerpts`
- `yie_candidate_mentions`
- `yie_candidate_companies`
- `yie_candidate_company_aliases`
- `yie_candidate_mention_links`
- `yie_identity_resolution_decisions`
- `yie_proposed_claims`
- `yie_claim_evidence_links`
- `yie_discovery_checkpoints`

Migrations are additive and protected-table signatures are checked. Do not drop or recreate the production database.

### Production migration status

**Not confirmed in this handoff.** Before running the new engine against production Turso, inspect `yie_schema_migrations` and `sqlite_schema`. Do not infer migration state from the deployed code version.

Safe sequence:

```powershell
npm.cmd run yie:migrate -- --dry-run
npm.cmd run yie:migrate
```

Use production credentials only in an explicitly controlled environment. Record the sanitized database hostname and migration versions before and after.

## 9. Current usability

### Usable now

- all deterministic tests;
- Pocket 4 shadow planning CLI;
- Pocket 5 fake-provider shadow execution after migrations;
- Pocket 5.1 opt-in Gemini live shadow execution after migrations and with `GEMINI_API_KEY`;
- replay and resume from CLI.

### Not yet usable by the CEO in the browser

The CEO-facing Discover UI and `/api/prospects/discover` are not connected to Pocket 5/5.1. Deploying the current commit does not make the new pipeline visible in the UI.

## 10. Commands

Install and validate:

```powershell
npm.cmd install
npm.cmd exec tsc -- --noEmit
npm.cmd run build
```

Tests:

```powershell
npm.cmd run test:yie-pocket-2
npm.cmd run test:yie-pocket-3
npm.cmd run test:yie-pocket-4
npm.cmd run test:yie-pocket-5
npm.cmd run test:yie-pocket-5-1
npm.cmd run test:discovery
npm.cmd run test:discovery-persistence
```

Plan a search:

```powershell
npm.cmd run yie:plan:shadow -- --query "Find California food and beverage distributors importing from Southeast Asia"
```

Dry-run an existing Pocket 4 session:

```powershell
npm.cmd run yie:discover:shadow -- --session-id SESSION_ID --dry-run --json
```

Small deterministic execution:

```powershell
npm.cmd run yie:discover:shadow -- --session-id SESSION_ID --provider fake --max-queries 1 --max-sources 5 --max-candidates 3 --json
```

Small opt-in live smoke test:

```powershell
npm.cmd run yie:discover:shadow -- --query "Find California food and beverage distributors importing from Southeast Asia" --provider gemini-live --max-queries 1 --max-sources 5 --max-candidates 3 --timeout-ms 10000 --max-retries 1
```

Replay:

```powershell
npm.cmd run yie:discovery:replay -- --run-id RUN_ID
```

Resume:

```powershell
npm.cmd run yie:discover:shadow -- --session-id SESSION_ID --resume RUN_ID --json
```

## 11. Last verified test state

At Pocket 5.1 completion:

- Pocket 2 tests: passed
- Pocket 3 tests: passed
- Pocket 4 tests: passed
- Pocket 5 tests: 78 assertions passed
- Pocket 5.1 mocked-live tests: 23 assertions passed
- legacy discovery tests: passed
- legacy persistence tests: passed
- TypeScript: passed
- Pocket 5.1 scoped lint: passed
- production build: passed

Repository-wide lint had pre-existing errors in legacy API/UI files unrelated to Pocket 5.1. Do not claim full lint is clean without rerunning it.

No real Gemini request was executed as part of Pocket 5.1 completion, so live data quality and production persistence are not yet proven.

## 12. Important files

Planning and domain:

- `src/domain/yie/evidence-schemas.ts`
- `src/domain/yie/execution-plan-policy.ts`
- `src/domain/yie/source-policy.ts`
- `src/domain/yie/candidate-evidence-policy.ts`
- `src/application/yie/evidence/evidence-execution-service.ts`
- `src/application/yie/evidence/evidence-repository.ts`

Providers:

- `src/application/yie/providers/evidence-providers.ts`
- `src/application/yie/providers/search-grounding-provider.ts`
- `src/infrastructure/yie/ai/gemini-model-policy.ts`
- `src/infrastructure/yie/ai/gemini-adapter.ts`
- `src/infrastructure/yie/ai/gemini-live-evidence-provider.ts`
- `src/infrastructure/yie/composition-root.ts`

Persistence:

- `src/infrastructure/yie/persistence/migrations.ts`
- `src/infrastructure/yie/persistence/migration-runner.ts`
- `src/infrastructure/yie/persistence/turso-evidence-repository.ts`
- `src/infrastructure/yie/persistence/turso-discovery-planning-repository.ts`

CLI/tests:

- `scripts/yie-discover-shadow.ts`
- `scripts/yie-discovery-replay.ts`
- `scripts/test-yie-pocket-5.ts`
- `scripts/test-yie-pocket-5-1.ts`

Production path that must remain unchanged unless explicitly authorized:

- `src/app/api/prospects/discover/route.ts`

## 13. Recommended immediate next actions

Do these in order.

### Step 1 — production-state audit

Read-only checks:

- verify deployed Git commit;
- verify production Vercel environment-variable presence without exposing values;
- inspect production `yie_schema_migrations`;
- inspect whether all Pocket 3–5 tables exist;
- confirm Pocket 3 seed data exists;
- confirm the production app and current legacy discovery still work.

### Step 2 — apply missing YIE migrations safely

If migration 003 is missing:

- dry-run first;
- verify database identity;
- apply through the existing migration runner;
- rerun and confirm idempotency;
- confirm protected Auth.js and sales-table signatures remain unchanged.

### Step 3 — controlled live smoke test

Run one query with:

- `--provider gemini-live`
- one query maximum;
- five sources maximum;
- three candidates maximum;
- 10-second timeout;
- one retry.

Inspect:

- grounding URLs versus model-only URLs;
- canonical source deduplication;
- snippets and evidence quality;
- candidate false positives;
- unsupported entities rejected;
- claims and evidence links;
- retries/failures/latency;
- replay with no provider calls;
- resume with no duplicate artifacts.

Do not widen budgets until this passes.

### Step 4 — decide the next pocket

Recommended next milestone: **Pocket 5.2 — controlled browser integration**.

Scope should be narrow:

- add a new authenticated YIE shadow endpoint rather than replacing the legacy route immediately;
- create/start a Pocket 4 plan from the natural-language query;
- execute Pocket 5.1 asynchronously or within safe Vercel duration limits;
- expose run status and persisted unverified candidates;
- render sources, evidence, ambiguity, failures, and retry state in the CEO Discover experience;
- protect rollout with an explicit server-side feature flag and allowlist;
- retain the legacy route for rollback;
- do not introduce verification, scoring, contacts, or outreach in the same change.

If Vercel request duration is insufficient, use a durable job mechanism. Do not hide long-running work behind a fragile synchronous request.

## 14. Pocket 5.2 proposed acceptance criteria

1. Only authenticated allowed users can start a YIE search.
2. Feature is off by default in production.
3. Natural-language query creates a Pocket 4 session and Pocket 5 run.
4. UI shows planning/executing/partial/completed/failed states.
5. Results show “Candidate company — unverified.”
6. Every visible claim links to source evidence.
7. Model-only URLs are never displayed as validated sources.
8. Partial results remain visible when one query fails.
9. Refreshing the page reconstructs state from persistence.
10. Replay performs no provider calls.
11. Legacy Discover remains available for rollback.
12. No writes occur to legacy `prospects`, `contacts`, or `outreach` tables.
13. No scoring, verification, contacts, decision makers, buying signals, or outreach are added.
14. Production migration state is checked before enabling the flag.
15. Full Pocket 2–5.2 regression and production build pass.

## 15. Known limitations and risks

- Production migration/seed state is unknown until audited.
- Live Gemini quality has not been manually reviewed against real results.
- Search grounding can return redirects or low-quality directory pages.
- The registrable-domain calculation is deliberately simple and is not a full public-suffix implementation.
- Candidate identity resolution intentionally prefers duplicates over false merges.
- Extraction provider calls currently use persisted snippets rather than fully retrieved web pages.
- Candidate website proposals are still proposals and must not be described as verified.
- Current CLI executes sequentially and is optimized for control, not throughput.
- Vercel execution duration may constrain synchronous browser integration.
- Full repository lint includes unrelated existing failures.

## 16. Working-tree warning

At handoff creation, the repository had two local changes not belonging to Pocket 5.1:

- `.gitignore` — existing user change; preserve it.
- `tsconfig.tsbuildinfo` — generated TypeScript cache; do not include it in a feature commit.

Always inspect `git status` before editing. Do not reset or overwrite user changes.

## 17. Definition of “CEO usable”

The system is CEO usable only when all of the following are true:

- required production migrations and seed data are confirmed;
- one controlled live search has passed data-quality review;
- the authenticated CEO Discover page can create a run;
- run progress is understandable without technical knowledge;
- persisted candidates, evidence, sources, and partial failures render correctly;
- refresh/recovery works;
- feature can be disabled without a database rollback;
- legacy discovery remains available during rollout.

Current status: **shadow engine complete through Pocket 5.1; not yet CEO usable through the browser.**

## 18. Instructions to OpenCode

Before changing code:

1. Read this file completely.
2. Read `docs/yie/pocket-5-plan.md` and `docs/yie/pocket-5-1-live-smoke-test.md`.
3. Inspect `git status`, current branch, and deployed commit.
4. Audit production migration state read-only.
5. Run existing tests before implementation.
6. Produce a concise keep/refactor/remove or implementation assessment.

While implementing:

- preserve evidence-first boundaries;
- use additive migrations only;
- keep fake providers as test defaults;
- never print credentials;
- do not fabricate sources, contacts, or claims;
- do not modify production discovery/UI unless the requested scope explicitly authorizes Pocket 5.2 integration;
- keep commits narrowly scoped and exclude `.gitignore` and `tsconfig.tsbuildinfo` unless separately requested.

Stop at the requested pocket. Do not bundle later verification, scoring, contacts, or outreach work into browser integration.
