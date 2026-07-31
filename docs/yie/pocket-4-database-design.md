# Pocket 4 Database Design

Migration `20260730_002` adds six tables:

- `yie_discovery_sessions`
- `yie_discovery_intent_versions`
- `yie_discovery_session_events`
- `yie_search_plans`
- `yie_search_plan_queries`
- `yie_shadow_comparisons`

Core session fields and pins are queryable columns. Structured intent, plan, event payload, and comparison records use bounded schema-validated JSON because each is an immutable aggregate snapshot. Queries are additionally normalized into their own table for filtering and integrity.

Composite foreign keys pin exact Pocket 3 Solution, ICP, session-intent, and plan versions. Primary/unique keys prevent intent, plan, query, event-sequence, and comparison mutation through duplicate insertion.

Indexes cover actor, status, creation time, Solution/ICP pins, production references, plan/comparison fingerprints, and query order.

No Pocket 3, Auth.js, sales, or current search table is altered.
