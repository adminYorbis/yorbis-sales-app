# Pocket 3 Database Design

## Decision

Knowledge types share one definition/version model because they require the same lifecycle, provenance, history, and uniqueness rules. ICPs use their own aggregate because constraints and references have distinct query and integrity needs.

## Tables

- `yie_schema_migrations`: migration ledger and checksum.
- `yie_knowledge_definitions`: stable identities for solution, capability, problem, persona, trigger, and negative signal.
- `yie_knowledge_versions`: immutable lifecycle versions.
- `yie_solution_relationships`: version-pinned solution composition.
- `yie_icp_profiles`: stable ICP identities.
- `yie_icp_profile_versions`: versioned ICP narrative and targeting definition.
- `yie_icp_criteria`: typed required, preferred, and excluded constraints.
- `yie_icp_capabilities`, `yie_icp_personas`, `yie_icp_triggers`: version-pinned knowledge references.
- `yie_icp_pain_hypotheses`, `yie_icp_source_recommendations`: ordered ICP guidance.

All foreign keys point to explicit versions. Indexes support lifecycle, definition, relationship, constraint, and active-record lookups. No existing Auth.js, prospect, contact, outreach, or search table is altered.

## Lifecycle and consistency

Repositories use transactional batches for aggregate writes and activation. Services own lifecycle policy and approval validation. The database owns referential integrity and unique identities. Only one version per stable definition is treated as active by service-controlled activation.
