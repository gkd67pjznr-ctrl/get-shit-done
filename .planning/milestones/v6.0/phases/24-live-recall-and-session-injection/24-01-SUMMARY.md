---
phase: 24
plan: "01"
status: complete
commit: 739dc71
duration_minutes: 15
---

# Summary: Plan 24-01 — readCorrections() and Test Scaffold

## What Was Done

### Task 24-01-01: Added readCorrections() to write-correction.cjs

Added `readCorrections(filters, options)` to `.claude/hooks/lib/write-correction.cjs` following the `readPreferences()` API mirror pattern from `write-preference.cjs`. The function:

- Gathers both `corrections.jsonl` and all `corrections-*.jsonl` archive files from `.planning/patterns/`
- Applies optional `status: 'active'` (excludes `retired_at` truthy) or `status: 'retired'` filters
- Sorts entries by `timestamp` descending (most recent first)
- Is exported via `module.exports` alongside `writeCorrection`
- Silently handles missing directories, unreadable files, and malformed JSON lines

Updated `module.exports` from `{ writeCorrection }` to `{ writeCorrection, readCorrections }`.

### Task 24-01-02: Created tests/hooks/recall-injection.test.ts

Created `tests/hooks/recall-injection.test.ts` with 9 passing tests covering:

1. Basic read — entries returned in timestamp-descending order
2. Archive file reads — entries from both active and archive files returned
3. Active filter (RECL-03) — retired entries excluded when `status: 'active'`
4. Retired filter — only retired entries returned
5. Empty/missing file returns `[]`
6. Malformed lines skipped — only valid JSON entries returned
7. Token budget (RECL-01) — `assembleRecall()` with small `maxTokens` forces truncation and overflow footer
8. Dedup (PREF-04) — corrections matching promoted preference category+scope are excluded
9. Silent output — empty inputs produce empty string

### Task 24-01-03: Commit

Committed both files as `feat(recall): add readCorrections() and recall injection test scaffold` (739dc71).

## Decisions / Deviations

- **Token budget test maxTokens adjusted:** The plan suggested testing with 3000 token budget and asserting output < 4000 chars. With 50-word entries, 25 entries still fit under 3000 tokens (each ~65 tokens, 25 × 65 = 1625 tokens), so no skipping occurred. Fixed by using `maxTokens = 200` to force truncation — this correctly validates the overflow footer behavior without changing the logic under test.
- **`countMatchingCorrections` location:** The plan referenced it as being in `write-correction.cjs`, but it was actually in `write-preference.cjs`. The file-gathering loop template was correctly reused from there.

## Verification

- `typeof readCorrections` returns `"function"` — verified
- `npx vitest run tests/hooks/recall-injection.test.ts` — 9/9 tests green
- Full suite: 956/958 pass, 2 pre-existing failures unchanged (check-patches, config quality)
