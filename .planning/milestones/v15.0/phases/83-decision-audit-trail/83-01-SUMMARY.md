---
plan: "83-01"
phase: 83
status: complete
started_at: "2026-04-04"
completed_at: "2026-04-04"
commits:
  - 7991bf3
  - 5ca44cc
deviations: []
---

# Summary: Plan 83-01 — Decision Parser and Jaccard Correction Matcher

## What Was Done

Implemented the `decision-audit.cjs` module under `.claude/hooks/lib/` with three exported functions, and a full 13-test suite in `tests/decision-audit.test.cjs`.

## Artifacts Created

- `.claude/hooks/lib/decision-audit.cjs` — new module (154 lines)
- `tests/decision-audit.test.cjs` — 13 tests across 3 describe blocks

## Functions Implemented

**`parseDecisions(content)`**
Accepts the full PROJECT.md text. Locates the `## Key Decisions` section, splits each pipe-delimited row, and returns `{ decision, rationale }` objects. Skips header and separator rows. Returns `[]` when the section is absent.

Verified against live PROJECT.md: 35 decisions parsed, first entry correctly extracted.

**`matchCorrectionsToDecision(corrections, decision)`**
Builds token sets for the decision (decision text + rationale) and each correction (`correction_to` + `diagnosis_text`). Computes Jaccard overlap. Returns `{ correction, score }` pairs where `score >= 0.05`.

Tokenization (`tokenize`, `jaccardScore`, `STOP_WORDS`) copied verbatim from `get-shit-done/bin/lib/skill-scorer.cjs` as specified.

**`detectTensions(options)`**
Reads PROJECT.md and active corrections (via `readCorrections` from `write-correction.cjs`). Matches corrections to each decision. Flags tensions where 3+ corrections match. Returns tension objects with `decision_text`, `rationale`, `matched_corrections`, `confidence` (average Jaccard), `correction_count`. Never throws — all errors caught and returned as `[]`.

## Test Results

All 13 tests pass:
- `parseDecisions`: 4 tests (empty input, single row, header skip, multiple rows)
- `matchCorrectionsToDecision`: 3 tests (no match, match above threshold, field presence)
- `detectTensions`: 6 tests (no PROJECT.md, no corrections, below threshold, at threshold, field completeness, invalid cwd no-throw)

Zero regressions in `review-profile.test.cjs` and `auto-apply.test.cjs` (21 tests pass).

## Deviations

None. Plan executed as specified.

## Next

Plan 83-02: Surface decision tensions in `/gsd:digest` with evidence formatting.
