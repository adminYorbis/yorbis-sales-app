# Intent Transition Policies

## Modes

- **NEW** creates an independent session from explicit input plus selected ICP defaults.
- **REFINE** changes named attributes and preserves everything else.
- **EXPAND** adds values only to named broadened fields. It cannot remove criteria or exclusions.
- **EXCLUDE** adds explicit structured exclusions only.
- **RESTORE** copies an exact historical normalized intent into a new immutable version and adds `RESTORED_NO_NEW_RESEARCH`.

Legacy `reprioritize` maps to `REFINE` with a preference-change marker.

## Merge precedence

1. Current user exclusions
2. Current user requirements
3. Current user preferences
4. Prior intent
5. ICP requirements
6. ICP preferences
7. ICP exclusions
8. Solution hypotheses
9. AI proposals

User requirements replace same-field ICP preferences. They do not silently delete ICP hard requirements or exclusions. Contradictory hard values create `HARD_CONSTRAINT_CONFLICT` and require review.

Required, preferred, and excluded criteria remain separate typed arrays. Every criterion has a validated operator/value combination, explicit `FAIL`, `ALLOW`, or `REVIEW` unknown handling, origin, and source reference.

## Examples

- “Only 50–150 employees” with REFINE changes employee size and preserves industry/geography.
- “Also agriculture” with EXPAND adds agriculture and preserves exclusions.
- “Exclude restaurants” creates an EXCLUDED criterion without modifying older versions.
- RESTORE version 1 creates a later intent version whose normalized content exactly matches version 1.
