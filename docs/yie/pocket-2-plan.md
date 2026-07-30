# Yorbis Intelligence Engine — Pocket 2 Implementation Plan

Status: approved-scope implementation plan  
Security precondition: passed on current `main`; `Auth - secret.txt` and `Turbo Token.txt` are no longer tracked. Credential values were not read. Replacement credentials were confirmed externally by the user.

## Baseline reviewed

- `docs/yie/current-state-audit.md`
- `docs/yie/system-architecture.md`
- `docs/yie/domain-model.md`
- `docs/yie/migration-plan.md`
- `docs/yie/implementation-roadmap.md`
- Active repository at the credential-remediation revision

## Baseline discrepancies

1. The Pocket 1 audit names revision `f8601fb`; the repository now includes later documentation and credential-remediation commits. Production application source behavior remains the audited behavior.
2. The current compatibility contract still exposes lowercase `reprioritize`. Pocket 2 will map that value to formal YIE `REFINE` with preference-patch semantics; it will not add REPRIORITIZE to the YIE mode enum.
3. Current production discovery directly imports `@google/genai`, and outreach directly imports the retired `@google/generative-ai` path/default. Pocket 2 will not modify either production path; new YIE code will enforce the provider boundary in shadow-only modules.
4. Pocket 1 identified tracked credential artifacts. Those artifacts are now absent from Git tracking. Tracked local database files remain an existing repository risk but are outside the credential precondition and Pocket 2 scope.

## Exact files to create

### Pure domain

- `src/domain/yie/enums.ts`
- `src/domain/yie/contracts.ts`
- `src/domain/yie/schemas.ts`
- `src/domain/yie/intent-policies.ts`

### Provider contracts and application utilities

- `src/application/yie/providers/ai-reasoning-provider.ts`
- `src/application/yie/providers/search-grounding-provider.ts`
- `src/application/yie/providers/source-retrieval-provider.ts`
- `src/application/yie/providers/provider-errors.ts`
- `src/application/yie/providers/provider-registry.ts`
- `src/application/yie/compatibility/current-discovery-adapter.ts`
- `src/application/yie/compatibility/shadow-comparison.ts`

### Gemini infrastructure and composition

- `src/infrastructure/yie/ai/gemini-model-policy.ts`
- `src/infrastructure/yie/ai/safe-json.ts`
- `src/infrastructure/yie/ai/gemini-adapter.ts`
- `src/infrastructure/yie/composition-root.ts`

### Deterministic fixtures and tests

- `src/infrastructure/yie/testing/test-providers.ts`
- `scripts/test-yie-pocket-2.ts`

### Documentation

- `docs/yie/provider-contracts.md`
- `docs/yie/domain-contracts.md`
- `docs/yie/pocket-2-implementation-report.md`

## Exact files to modify

- `package.json`: add Zod and a Pocket 2 test script.
- `package-lock.json`: dependency lock update.

No existing page, route, authentication, database, migration, or production provider file will be modified.

## Compatibility approach

- YIE uses uppercase formal modes and five-state evidence vocabulary.
- Small pure adapters translate current lowercase modes and current intent fields into YIE proposals.
- Legacy `reprioritize` translates to YIE `REFINE`; priority markets become an explicit preferred-signal/preference patch.
- A reverse adapter supports comparison with the existing normalized intent without replacing it.
- A shadow comparison utility returns structured differences only. It performs no provider call, database write, logging, or production routing.
- The current production `/api/prospects/discover` handler remains unchanged and enabled.

## Provider approach

- `AIReasoningProvider`, `SearchGroundingProvider`, and `SourceRetrievalProvider` are independent capabilities.
- Provider-neutral proposal types cross capability boundaries.
- Gemini model selection is centralized per operation and rejects retired `gemini-2.0*` models.
- Only the composition root instantiates the Gemini SDK.
- The Gemini adapter receives a narrow injected client interface, validates all structured output with Zod, uses bounded retry/timeout behavior, and translates errors into stable provider errors.
- Gemini intent parsing, search-plan proposal, and grounded candidate discovery are available only through shadow/composition wiring; no route uses them in this pocket.
- Source retrieval is a contract only; no crawler is implemented.

## Test plan

1. Exact enum values and legacy mode mapping.
2. NEW blank-state construction and rejection of inherited state.
3. REFINE patch whitelist and immutability.
4. EXPAND named widening only.
5. EXCLUDE negative-only behavior.
6. RESTORE snapshot validation with an explicit no-provider test.
7. Unknown patch-key rejection through strict Zod schemas.
8. Safe fenced/surrounded JSON extraction and malformed JSON rejection.
9. Provider timeout/error mapping.
10. Retryable versus non-retryable behavior and retry limit.
11. Registry capability lookup and explicit unsupported-capability failure.
12. Provider-neutral output validation and no Gemini shape leakage.
13. Compatibility and shadow-difference fixtures.
14. Static import audit for new YIE source.
15. Static retired-model audit for new active code.
16. Existing discovery tests and persistence tests.
17. TypeScript no-emit check.
18. Production Next.js build.

Normal tests use deterministic fake clients/providers and require no live Gemini call or credential.

## Rollback boundary

Pocket 2 is additive source code plus one dependency. Rollback is:

1. remove the new `src/domain/yie`, `src/application/yie`, and `src/infrastructure/yie` files;
2. remove the Pocket 2 test/docs;
3. remove Zod and restore the package lock.

Because no route imports the composition root and there are no schema/UI/Auth changes, rollback requires no data action and production behavior is unaffected.

## Explicitly excluded

- Database tables, migrations, repositories, or runtime DDL.
- Knowledge-base or ICP persistence.
- Candidate-collection redesign or orchestration cutover.
- Source crawler/content storage.
- Final verification implementation.
- Opportunity scoring changes.
- Outreach migration.
- Queues, background jobs, durable workflows, or resumable pipelines.
- UI or Auth.js changes.
- Production route/model changes.
- Broad legacy cleanup.
