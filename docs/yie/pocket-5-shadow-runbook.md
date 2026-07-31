# Pocket 5 shadow runbook

Use `npm run yie:discover:shadow -- --session-id <id> --dry-run` to inspect the bounded plan. Remove `--dry-run` only in a controlled non-production shadow environment. The default CLI provider is deterministic and performs no live web research. Resume with `--resume <run-id>`. Inspect persisted output with `npm run yie:discovery:replay -- --run-id <id>`.

Never connect this command to the production prospect route in Pocket 5.
