# Discovery Session Model

Pocket 4 sessions are durable planning records and are always `shadowOnly=true`.

## Lifecycle

`CREATED → INTERPRETING → PLANNED`

Terminal states are `FAILED`, `CANCELLED`, and `SUPERSEDED`. Candidate collection states intentionally do not exist yet.

A session records actor and correlation provenance, current intent version, exact Solution Profile ID/version, optional exact ICP ID/version, optional legacy production reference, timestamps, failure code, and bounded metadata.

## Immutability

Intent versions, plans, queries, comparisons, and events are insert-only. The session row may advance lifecycle/current-version pointers and may record an explicit ICP repin. A repin is never silent: it accompanies a new intent version and `ICP_SELECTED` event.

Historical reconstruction loads the exact stored Solution and ICP versions, even if a later version becomes active.

## Events

Events use a unique `(session_id, sequence)` and cover session creation, pins, intent proposal/validation/version creation, conflicts, plan proposal/validation/creation, comparisons, and terminal states. This is an audit log, not a full event-sourcing system.
