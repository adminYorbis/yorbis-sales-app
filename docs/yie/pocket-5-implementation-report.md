# Pocket 5 implementation report

Pocket 5 adds a shadow-only, evidence-first candidate discovery boundary after Pocket 4 planning. It does not change the production discovery route, UI, Auth.js, or legacy sales tables.

The implemented chain is: accepted Search Plan query → bounded execution step → provider attempt → canonical public source → immutable run observation → bounded excerpt → validated entity mention → conservative candidate identity decision → proposed claim → source evidence link.

Normal development and acceptance runs use deterministic fake search, mention-extraction, and claim-extraction providers. No live provider is selected implicitly.

Run `npm run test:yie-pocket-5` for the isolated acceptance suite. Apply migration `20260730_003` explicitly through the existing migration runner before using the shadow CLI.
