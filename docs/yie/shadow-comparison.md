# Shadow Comparison

Shadow comparison accepts a bounded snapshot of the current production interpretation and compares it with the persisted YIE intent.

It records matched fields, differing fields, production-only fields, YIE-only fields, semantic warnings, restoration mismatch, cache/session-reuse risk, confidence, and a stable fingerprint.

## False restore

`POSSIBLE_FALSE_RESTORE` is emitted only when:

1. production reports that it restored an earlier discovery;
2. raw input or normalized intent differs materially;
3. the user did not explicitly request restore; and
4. YIE classified the operation as something other than RESTORE.

An explicit restore with matching intent does not emit the warning. The comparison never changes production state, routes, results, or UI.
