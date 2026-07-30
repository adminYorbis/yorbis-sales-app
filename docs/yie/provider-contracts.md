# YIE Pocket 2 — Provider Contracts

## Boundary

YIE separates three capabilities even when one vendor can provide more than one:

1. `AIReasoningProvider`
2. `SearchGroundingProvider`
3. `SourceRetrievalProvider`

Provider outputs are untrusted proposals. Domain code accepts only provider-neutral values that pass Zod validation. No provider SDK type crosses into `src/domain/yie` or `src/application/yie`.

## AIReasoningProvider

Implemented task-oriented operations:

- `parseDiscoveryIntent`
- `proposeSearchPlan`

Future optional operations are declared without implementation:

- `extractCompanyClaims`
- `assessEvidenceSupport`
- `identifyDecisionMakers`
- `extractBuyingSignals`
- `draftOpportunityNarrative`
- `draftOutreach`

The interface deliberately avoids a universal `generate<T>()`.

## SearchGroundingProvider

Implemented contract:

- `discoverCandidates`
- explicit capability metadata;
- excluded-domain input;
- timeout/retry/token budget;
- optional continuation token;
- provider-neutral candidates;
- grounding metadata separate from model-emitted source proposals.

Gemini shadow capability currently declares web grounding and no continuation support.

## SourceRetrievalProvider

Contract only:

- requested and canonical URL;
- retrieval status;
- metadata;
- relevant excerpt;
- fingerprint;
- timeout budget.

Full source content is not stored by default. Pocket 2 does not implement a crawler or retrieval provider.

## Provider operation metadata

Every successful operation can return:

- provider and model;
- operation;
- request ID;
- start/completion timestamps and duration;
- retry count;
- token usage when available;
- grounding-used flag;
- partial-output-available flag.

Prompts, API keys, tokens, and sensitive contact data are not metadata fields.

## Provider errors

Stable codes:

- `CONFIGURATION`
- `AUTHENTICATION`
- `RATE_LIMIT`
- `QUOTA`
- `TIMEOUT`
- `UNSUPPORTED_CAPABILITY`
- `MALFORMED_RESPONSE`
- `SAFETY_BLOCK`
- `UPSTREAM`
- `CANCELLED`
- `UNKNOWN`

Only RATE_LIMIT, TIMEOUT, and appropriate upstream failures are retried. Authentication, quota exhaustion, malformed output, safety blocks, unsupported capabilities, cancellation, and unknown failures do not silently retry.

## Gemini shadow adapter

The adapter uses:

- current `@google/genai` SDK instantiated only in `src/infrastructure/yie/composition-root.ts`;
- injected neutral client in the adapter;
- per-operation model policy:
  - `GEMINI_INTENT_MODEL`
  - `GEMINI_PLANNING_MODEL`
  - `GEMINI_DISCOVERY_MODEL`
- centralized current fallback `gemini-3.1-flash-lite`;
- explicit rejection of `gemini-2.0*`;
- bounded retry and timeout;
- fenced/surrounded JSON extraction fallback;
- strict Zod output validation;
- separate SDK grounding-source translation.

It can perform intent proposal, search-plan proposal, and grounded candidate proposal in shadow/composition mode. Nothing imports the composition root from a production route.

## Registry and health

`ProviderRegistry` supports:

- registration without silent replacement;
- capability lookup;
- per-operation model lookup;
- configuration health checks;
- explicit unsupported-capability errors.

The Gemini registration supplies reasoning and grounded search but not source retrieval.

## Production isolation

Pocket 2 does not alter:

- the direct Gemini import in the existing production Discover route;
- existing production model selection;
- the legacy outreach SDK/path;
- any route composition.

The new provider layer remains unused unless a future pocket explicitly wires it or a test instantiates it.
