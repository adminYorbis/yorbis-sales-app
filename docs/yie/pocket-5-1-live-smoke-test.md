# Pocket 5.1 controlled live smoke test

Live Gemini is opt-in. The default remains the deterministic fake provider. Before testing, explicitly apply Pocket 5 migration `20260730_003`, seed Pocket 3 knowledge, and set `GEMINI_API_KEY` in the local shell. Never place the key in source control.

```powershell
npm.cmd run yie:discover:shadow -- --query "Find California food and beverage distributors with 20-200 employees importing from Southeast Asia" --provider gemini-live --max-queries 6 --max-sources 30 --max-candidates 15 --timeout-ms 10000 --max-retries 1
```

Start with `--max-queries 1 --max-sources 5 --max-candidates 3` when validating a new key or model. The command reports the centralized discovery model, provider calls, grounding chunks, model-only URLs, persisted evidence artifacts, retries, failures, latency, and explicit zero counts for verification, scoring, contacts, and outreach.

Only URLs from `@google/genai` Google Search grounding chunks enter the canonical source registry. URLs present only in model JSON are diagnostic counts and attempt metadata; they are not sources. Candidate and claim extraction operate on persisted excerpts. Replay remains provider-free.

This command is shadow-only. It does not call `/api/prospects/discover`, alter the production UI, or write legacy prospect/contact/outreach records.
