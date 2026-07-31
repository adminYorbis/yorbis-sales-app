# Pocket 4 Implementation Report

## Outcome

Pocket 4 implements persistent shadow-only Discovery Sessions, immutable intent versions, deterministic five-mode transitions, exact Solution/ICP pins, structured immutable Search Plans, bounded AI proposals, shadow comparison, and false-restore diagnostics.

## Safety boundary

No route, page, Auth.js module, production discovery adapter, candidate operation, grounding/search provider, source retriever, or current sales/search table changed. The only entry point is a script. Standard tests use the fake planning provider and an isolated libSQL database.

## Verification

The Pocket 4 integration suite covers:

- NEW isolation and exact pins;
- REFINE preservation/non-mutation;
- EXPAND-only broadening and exclusion preservation;
- immutable EXCLUDE;
- exact RESTORE with no-new-research warning;
- legacy reprioritize mapping;
- explicit, named, deterministic, and ambiguous ICP selection;
- merge precedence, hard conflicts, and category separation;
- unknown-handling and operator validation;
- duplicate/unsafe/fabricated query rejection, bounds, diversity, and deterministic fingerprints;
- immutable plans and append-only events;
- exact historical reconstruction after a later knowledge version;
- safe provider failure persistence;
- possible-false-restore and identical-restore behavior;
- migration idempotency and unchanged protected schemas;
- zero grounding, candidate, and live Gemini calls.

## Assumptions and limitations

- Deterministic raw-query normalization is deliberately bounded and conservative; AI parsing can be added as a proposal only.
- Ad hoc intent is allowed when ICP support is weak and is explicitly marked for review.
- Query text is a future research instruction, never evidence or a verified company conclusion.
- Cross-aggregate governance should coordinate future Solution and active ICP version changes.
- No candidate volume is actually produced; `expectedCandidateVolume` is planning guidance.

## Pocket 5 handoff

Pocket 5 may execute accepted plans through the existing SearchGroundingProvider, but must add run-scoped candidates, canonical company identity, canonical sources, atomic proposed claims, immutable checkpoints, and source reconciliation. It must not yet assign final verification, decision makers, opportunity scores, or outreach.
