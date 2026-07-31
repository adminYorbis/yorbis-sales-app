# Pocket 4 Migration Runbook

## Preview

```text
npm run yie:migrate -- --dry-run
```

Confirm `20260730_001` is already applied and `20260730_002` is pending. Dry-run does not create the ledger or tables.

## Apply and verify

```text
npm run yie:migrate
npm run yie:knowledge:diagnostic
```

Then run a shadow plan:

```text
npm run yie:plan:shadow -- --query "California food distributors importing from Southeast Asia with 20-200 employees"
```

The CLI defaults to the fake planning provider. `--provider deterministic` disables all provider proposals. Live Gemini is intentionally not available through this Pocket 4 command.

Derived examples:

```text
npm run yie:plan:shadow -- --query "Also include agriculture" --mode EXPAND --prior-session <id>
npm run yie:plan:shadow -- --query "Restore the first interpretation" --mode RESTORE --prior-session <id> --restore-version 1
```

## Rollback

Stop invoking the shadow CLI/services or revert the application commit. Retain additive tables for diagnosis. Do not drop tables or reverse the migration. Production discovery remains the rollback path because it was never changed.
