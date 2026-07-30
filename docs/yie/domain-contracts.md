# YIE Pocket 2 — Domain Contracts

## Formal vocabulary

Evidence:

- `VERIFIED`
- `INFERRED`
- `UNKNOWN`
- `CONFLICTING`
- `REJECTED`

Discovery:

- `NEW`
- `REFINE`
- `EXPAND`
- `EXCLUDE`
- `RESTORE`

Constraints:

- kinds: `REQUIRED`, `PREFERRED`, `EXCLUDED`
- outcomes: `PASS`, `FAIL`, `UNKNOWN`, `CONFLICTING`, `NOT_APPLICABLE`

Source trust:

- `PRIMARY`, `HIGH`, `MEDIUM`, `LOW`, `UNTRUSTED`

Legacy lowercase `reprioritize` maps to formal `REFINE` and is marked as a preference change. It is not a YIE mode.

## DiscoveryIntent

The authoritative contract contains:

- identity, raw request, formal mode, version;
- optional versioned ICP reference;
- industries and geographies;
- company-size range;
- business models;
- required, preferred, and excluded signals;
- buyer roles;
- desired result count;
- parent intent/session references;
- named widened fields.

Zod validation is strict. Unknown keys are rejected.

### NEW invariant

`createNewIntent()` constructs from only explicit input and defaults. It always has:

- mode NEW;
- version 1;
- no parent intent;
- no session;
- no inherited widened fields;
- empty arrays for every unspecified criterion;
- default desired count of 25 when omitted.

Passing an authoritative previous intent is not part of its API.

## DiscoveryIntentPatch

Supported operations:

- `set`: selected ICP, company-size range, desired result count;
- `add`: whitelisted array fields;
- `remove`: whitelisted array fields;
- `clear`: whitelisted fields.

Mode, IDs, versions, session lineage, raw request, and arbitrary properties cannot be patched.

## Pure intent policies

### REFINE

Starts from a validated authoritative base, applies only the strict patch, preserves every untouched field, increments the version, records the parent, and returns a deep-frozen value.

### EXPAND

Accepts named additions, a genuinely wider company-size range, and a non-decreasing desired result count. It rejects removals, arbitrary fields, a raised minimum, a lowered maximum, or a smaller desired count. Widened fields are recorded.

### EXCLUDE

Adds only explicit excluded signals and preserves all positive criteria. Any other key is rejected.

### RESTORE

Validates and deep-freezes a stored snapshot with mode RESTORE. It has no provider dependency and creates no plan.

### Transition validation

Deterministically verifies:

- NEW has no base, parent, or session;
- derived modes have an authoritative parent;
- session ownership cannot change;
- versions increment exactly once;
- RESTORE is read-only snapshot semantics.

## Provider proposal contracts

The following strict proposal schemas are deliberately separate from authoritative records:

- `DiscoveryIntentProposal`
- `SearchPlanProposal`
- `SearchStrategyProposal`
- `CandidateCompanyProposal`
- `CompanySourceProposal`
- `CompanyClaimProposal`
- `DecisionMakerProposal`
- `BuyingSignalProposal`
- `ProviderOperationMetadata`

Proposal types may contain model-proposed states, people, sources, and facts. Validation proves shape, not truth. Later pockets must perform source and business validation before authoritative use.

## Compatibility

The current-to-YIE adapter maps:

- lowercase modes to formal modes;
- current industry/company type to industries;
- geography and employee bounds;
- current supplier/payment/import-export signals;
- current exclusions;
- legacy priority/international markets to preferences.

The reverse adapter exists only for behavior comparison. The shadow comparator reports field differences and never performs I/O.
