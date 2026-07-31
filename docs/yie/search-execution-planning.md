# Search execution planning

Only Pocket 4 queries with `ACCEPTED` status may execute. The policy sorts deterministically, removes normalized duplicates, applies query/source/candidate limits, and records skipped queries with reasons. Execution is sequential in Pocket 5 and retries only provider failures explicitly marked retryable.
