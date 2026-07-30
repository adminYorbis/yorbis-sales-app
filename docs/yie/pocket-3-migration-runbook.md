# Pocket 3 Migration and Seed Runbook

Pocket 3 does not automatically mutate production during build or application startup.

## Preflight

1. Confirm `TURSO_DATABASE_URL` identifies the intended database.
2. Confirm `TURSO_AUTH_TOKEN` is present.
3. Back up or create a Turso restore point under the normal operational policy.
4. Run the Pocket 3 test suite locally.

## Preview

```text
npm run yie:migrate -- --dry-run
npm run yie:seed:pocket-3 -- --dry-run
```

Review the migration version/checksum and seed `inserted`, `unchanged`, and `conflicting` records. A conflict means the stored stable ID/version differs from the approved seed; the command will not overwrite it.

## Apply

```text
npm run yie:migrate
npm run yie:seed:pocket-3
npm run yie:knowledge:diagnostic
```

The migration is additive and idempotent. Its ledger prevents reapplication and detects checksum drift. The seed inserts missing records, reports exact matches as unchanged, and preserves manual differences as conflicts.

## Verification

Confirm one active solution, at least 15 active ICPs, zero missing references, and one ledger row for `20260730_001`. Rerun preview commands; the migration should be `APPLIED` and the seed should report unchanged records.

## Rollback posture

There is no destructive automatic rollback. Existing tables are untouched. If deployment code must be rolled back, retain the additive `yie_*` tables; they are isolated and backward-compatible. Any data repair must be a new reviewed migration, never a dropped database or rewritten applied migration.
