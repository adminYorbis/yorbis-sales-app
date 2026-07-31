# Pocket 5 migration runbook

1. Run the migration command in dry-run mode and confirm only `20260730_003` is pending on a Pocket 4 database.
2. Capture protected-table signatures and the database identity.
3. Apply through `yie:migrate`; do not paste individual statements or enable automatic startup migration.
4. Confirm 15 new Pocket 5 tables, a ledger row with the expected checksum, and unchanged protected-table signatures.
5. Rerun the migration and confirm no versions are applied.

Rollback is forward-only: disable Pocket 5 callers. Do not drop tables containing evidence history.
