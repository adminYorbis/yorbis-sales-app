# Search Planning

A Search Plan is an immutable, non-executed research specification tied to one session intent version and exact Solution/ICP versions.

It stores objective, qualification/disqualification strategies, themes, source categories and recommendations, evidence requirements, volume/result/freshness limits, geography/industry/size/persona/trigger strategies, ambiguity handling, stopping rules, warnings, provenance, queries, and a stable SHA-256 fingerprint.

## Query validation

Each query has purpose, target constraint, source category, priority, expected yield, rationale, required evidence type, optional qualifiers, and status.

Deterministic validation:

- requires non-empty, sufficiently specific text;
- normalizes and removes duplicates;
- caps accepted queries at 20;
- rejects unsupported product claims and conclusion-oriented language;
- rejects queries contradicting explicit exclusions;
- requires at least three accepted queries and warns on poor source diversity;
- sorts by priority then stable ID.

Normal families include industry/geography, official company sites, trade associations/directories, import/export language, business models, and expansion/hiring/ERP triggers. Source recommendations are planning guidance, not verified evidence.

AI may propose Pocket 2 `SearchPlanProposal` strategies. Those proposals never bypass the same deterministic validator. Pocket 4 invokes no web-grounding operation.
