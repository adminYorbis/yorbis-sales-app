# ICP Selection

Selection precedence:

1. Explicit active ICP ID
2. Recognized exact ICP name in the request
3. Deterministic token/field match against active ICP names, descriptions, target problems, industries, and business models
4. Optional AI proposal, subject to deterministic validation
5. Structured ad hoc intent with manual-review warning

The selected result contains exact ID/version, method, confidence, competitors, explanation, and warnings. A weak or tied deterministic result does not silently choose an ICP.

Pocket 4 allows ad hoc intent when no ICP has adequate support. In that case, the session stores null ICP pins and an explicit reason. Discovery input never edits or activates ICP knowledge.

Changing an existing session’s ICP requires explicit input, a persisted repin, an `ICP_SELECTED` event, and a new intent version.
