# Yorbis Intelligence Engine — Implementation Roadmap

Status: future work plan; Pocket 1 ends with these documents

## Sequencing rule

Each pocket must preserve production behavior, use additive changes, pass existing tests, and include its own rollback boundary. No pocket may silently absorb work explicitly assigned to a later pocket.

The brief’s seven future implementation workstreams are numbered below as Pockets 2–8 because the current repository-audit/architecture engagement is Pocket 1.

## Pocket 2 — Domain contracts and AI provider abstraction

### Objective

Create pure domain contracts, verification/mode enums, provider capability interfaces, typed structured-output boundaries, and a Gemini adapter that can reproduce current provider operations without switching production traffic.

### Dependencies

- Approved system architecture and domain vocabulary.
- Decision on the public status of REPRIORITIZE.
- Current `@google/genai` behavior and model configuration.

### Files likely to change

- New `src/domain/yie/*`
- New `src/application/yie/contracts/*`
- New `src/infrastructure/yie/ai/*`
- `src/lib/discovery-contract.ts` only through compatibility adapters
- `src/app/api/prospects/discover/route.ts` only to introduce a disabled seam, not behavior change
- `package.json` if a schema-validation library is approved

### Tests required

- Provider interface contract tests.
- Structured-output validation and malformed response tests.
- Capability tests for grounded search versus non-search generation.
- Model policy/config fallback tests.
- Verification-state and discovery-mode enum tests.
- NEW never inherits any previous intent.

### Completion criteria

- No route imports a new provider adapter directly except composition root.
- Gemini operations can be invoked through the abstraction in tests.
- Existing production route behavior remains unchanged by default.
- Both Gemini SDK usages are inventoried with an explicit migration path.

### Risks

- Designing an abstraction too close to Gemini response shapes.
- Accidentally changing model selection or output behavior.

### Explicit exclusions

- Knowledge/ICP persistence.
- New DB tables or migrations.
- New discovery orchestration.
- UI changes.
- Outreach migration.

## Pocket 3 — Solution Knowledge Base and ICP Library

### Objective

Implement versioned, approved knowledge about Yorbis solutions, capabilities, problems, personas, triggers, negative fits, ICP constraints, and preferences.

### Dependencies

- Pocket 2 domain contracts and repository interfaces.
- Approved source-of-truth content for Yorbis products and pricing.
- Additive migration review.

### Files likely to change

- New `src/domain/yie/knowledge/*`
- New `src/application/yie/knowledge/*`
- New `src/infrastructure/yie/persistence/knowledge-*`
- New additive migrations/scripts
- Administrative seed/import script; no CEO UI redesign

### Tests required

- Version activation/retirement.
- Referential integrity and invalid-version rejection.
- Constraint/preference typed validation.
- Approved-content seed idempotency.
- Auth/sales table preservation checks.

### Completion criteria

- One approved active Yorbis solution profile and at least one active ICP can be loaded by ID/version.
- AI-drafted knowledge cannot become active without approval.
- Existing tables and Auth.js counts remain unchanged.

### Risks

- Encoding unapproved product claims.
- Treating preferences as hard constraints.

### Explicit exclusions

- Search execution.
- Candidate collection.
- Scoring implementation.
- UI management screens unless separately approved.

## Pocket 4 — Discovery state and planning

### Objective

Make discovery sessions, intent versions, mode transitions, search plans, strategies, budgets, and checkpoints authoritative and durable.

### Dependencies

- Pockets 2–3.
- Approved lifecycle and partial-result policy.
- Additive discovery migration.

### Files likely to change

- New `src/domain/yie/discovery/*`
- New `src/application/yie/discovery/*`
- New discovery repositories/migrations
- Compatibility adapter around `discovery-contract.ts`
- Thin changes to the current Discover route behind a flag

### Tests required

- Exact NEW/REFINE/EXPAND/EXCLUDE/RESTORE transition matrix.
- NEW stale-state regression.
- Patch whitelist and clear/add/remove semantics.
- Server-authoritative session ownership.
- Plan coverage/budget/idempotency.
- Restore performs no provider call or write.

### Completion criteria

- Every run has an authoritative session, intent version, mode, plan, and lifecycle state.
- Client-supplied prior intent cannot override stored session state.
- Current UI can receive its existing intent response through an adapter.

### Risks

- Session vocabulary divergence from current `requestType`.
- Introducing stateful behavior without reliable resume semantics.

### Explicit exclusions

- Real candidate search.
- Claims/source validation.
- Decision makers and scoring.

## Pocket 5 — Candidate collection and evidence

### Objective

Execute plans through provider adapters, collect raw candidates, normalize company identity, deduplicate, canonicalize sources, and create atomic proposed claims with immutable run context.

### Dependencies

- Pocket 4 plans/checkpoints.
- Source storage/privacy decision.
- Provider rate/time budgets.

### Files likely to change

- New candidate/company/source/claim domain and application modules
- Gemini search adapter
- New persistence repositories/migrations
- Compatibility projection into existing prospect shape

### Tests required

- Domain and URL canonicalization.
- Same-company/different-domain ambiguity.
- Exact duplicate handling.
- Grounding-chunk to source reconciliation.
- Source access/fingerprint behavior.
- Claim extraction schema validation.
- Provider timeout/quota/malformed output.
- Partial candidate checkpoint/resume.

### Completion criteria

- Every accepted candidate has canonical identity or explicit unresolved status.
- Every proposed factual claim has at least one canonical source association or UNKNOWN state.
- A run can return and later resume partial candidate results.
- Current prospect response can be projected without switching the UI.

### Risks

- False identity merges.
- Search result/source licensing constraints.
- Function duration limits.

### Explicit exclusions

- Final verification state.
- Decision makers.
- Opportunity scoring and outreach.

## Pocket 6 — Verification, decision makers, signals, and scoring

### Objective

Implement source-backed verification, conflicts/rejections, constraint evaluation, company and buying signals, persona-matched decision makers, and deterministic versioned scores.

### Dependencies

- Pocket 5 canonical candidates/sources/claims.
- Active Solution/ICP versions.
- Approved scoring policy and inferred-evidence policy.

### Files likely to change

- New verification/signal/decision-maker/scoring modules
- New repositories/migrations
- Compatibility adapters around `discovery-constraints.ts` and `prospect-scoring.ts`
- Legacy contact route adapter

### Tests required

- All five verification states.
- Supporting and contradicting source cases.
- Guessed email rejection.
- Persona matching by company size/use case.
- Signal expiry and trigger recency.
- Hard-constraint rejection.
- Score reproducibility, bounds, component arithmetic, and policy versions.
- Golden dataset ranking tests.

### Completion criteria

- No unsupported fact is VERIFIED.
- No guessed email is stored as verified.
- Scores reproduce exactly from stored components.
- Rejected candidates cannot receive actionable recommendations.
- Legacy UI can display source-backed findings and score explanation.

### Risks

- Semantic verification false positives.
- Overweighting inferred signals.
- Sparse public decision-maker data.

### Explicit exclusions

- Full orchestration API cutover.
- Automated email sending.
- Learning-driven policy changes.

## Pocket 7 — Pipeline orchestration and APIs

### Objective

Combine all modules into an idempotent, observable discovery pipeline with partial results, retries, immutable snapshots, compatibility projections, and thin authenticated APIs.

### Dependencies

- Pockets 2–6.
- Decision on synchronous versus durable execution.
- Production feature-flag and observability plan.

### Files likely to change

- New `src/application/yie/orchestration/*`
- New `src/app/api/yie/*` or thin current-route adapter
- Current `/api/prospects/discover` and `/api/searches` compatibility wiring
- Projection and run-error repositories
- Vercel configuration only if duration/execution architecture requires it

### Tests required

- Full stage state machine.
- Idempotent replay and duplicate request.
- Partial failure at every stage.
- Canonical transaction versus projection failure.
- Authorization/ownership on every endpoint.
- Stable error envelopes and safe logging.
- Restore immutable snapshot.
- Legacy fallback and feature-flag rollback.

### Completion criteria

- One application service owns the pipeline.
- Route handlers contain only HTTP/auth/translation concerns.
- A failed stage is resumable or explicitly terminal.
- Existing production API response remains compatible.
- Feature flag can revert to the old path without DB rollback.

### Risks

- Vercel execution limits.
- Cross-stage transaction complexity.
- Dual-write drift.

### Explicit exclusions

- CEO UI redesign.
- Automated outreach sending.
- Automatic model/policy learning.

## Pocket 8 — UI integration and end-to-end validation

### Objective

Connect the existing CEO-first Discover UI to the engine read model, expose verification/conflict/partial states clearly, preserve outreach review, and validate the complete authenticated production journey.

### Dependencies

- Pocket 7 stable APIs and snapshots.
- Approved UX treatment for partial/conflicting/rejected evidence.
- Production test account and magic-link access.

### Files likely to change

- `src/app/page.tsx`
- `src/app/page.module.css`
- Shared YIE read-model types
- Outreach generation route/service adapter
- Browser end-to-end test assets

### Tests required

- Authenticated NEW → review → discover.
- REFINE, EXPAND, EXCLUDE, and RESTORE.
- No stale filters after NEW.
- Partial-result recovery.
- Source links and conflicting evidence.
- Decision-maker unknown/verified cases.
- Score explanation.
- Generate outreach uses only permitted claims.
- Responsive/accessibility smoke tests.
- Production Vercel/Turso end-to-end verification.

### Completion criteria

- CEO completes the primary search-to-outreach flow without legacy-state leakage.
- Restored results are immutable.
- UI distinguishes all verification states and partial runs.
- Current login and Auth.js session persistence remain unchanged.
- Production rollback path is tested.

### Risks

- Overloading the CEO UI with evidence mechanics.
- Browser validation blocked by magic-link access.
- Legacy and engine read models diverging during rollout.

### Explicit exclusions

- Bulk automated sending.
- A general-purpose CRM redesign.
- Unreviewed automated learning or score mutation.

## Cross-pocket quality gates

Every pocket must demonstrate:

1. Existing production data preserved.
2. Auth.js tables/configuration untouched.
3. Additive migrations only where the pocket explicitly allows them.
4. Stable and safe error contracts.
5. Deterministic tests for all business decisions.
6. AI output treated as untrusted until validated.
7. Feature-flagged compatibility and documented rollback.
8. No factual outreach statement without approved knowledge or source-backed claim.

## Recommended next step

Proceed with Pocket 2 only: domain contracts and provider abstraction in shadow mode. It should produce no schema or UI change, keep the current model behavior intact, and establish the seams required for all later work.
