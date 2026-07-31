# Pocket 5 database design

Migration `20260730_003` is additive and creates 15 `yie_` tables for runs, execution plans and steps, attempts, canonical sources, source observations and excerpts, candidate mentions and companies, aliases and mention links, identity decisions, proposed claims, evidence links, and checkpoints.

Existing Auth.js, prospect, contact, outreach, and legacy search tables are protected by migration signature checks. Candidate and claim tables explicitly reject a `VERIFIED` status. Pocket 5 is forward-only: rollback means disabling callers while retaining the evidence history.

Pocket 6 may consume these proposals for verification and evidence weighting, but it must not rewrite Pocket 5 observations or excerpts.
