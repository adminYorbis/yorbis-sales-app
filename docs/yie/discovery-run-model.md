# Discovery run model

A Discovery Run pins one Pocket 4 session, intent version, Search Plan version, provider key, execution budgets, and correlation identity. Lifecycle states are `CREATED`, `PREPARING`, `EXECUTING`, `EXTRACTING`, `RESOLVING`, `COMPLETED`, `PARTIALLY_COMPLETED`, `FAILED`, `CANCELLED`, and `SUPERSEDED`.

Every run is shadow-only. A final query failure produces `PARTIALLY_COMPLETED` when durable evidence from other queries remains. Dry runs persist their bounded plan but perform no provider calls.
