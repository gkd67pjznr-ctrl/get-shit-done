---
quick_task: "21"
status: complete
commit: ef6b726
date: 2026-03-09
---

# Quick Task 21 Summary — Fix Dashboard Milestone Status to Read from ROADMAP.md

## What Was Done

Inserted a ROADMAP.md-authoritative override block into `parseAllMilestones()` in
`get-shit-done/bin/lib/server.cjs` immediately after the roadmap parse try/catch block
(formerly ending at line 329).

## Change Description

The existing STATE.md-based `entry.active` logic ran first as a fallback.
The new block runs after roadmap data is available and overrides `entry.active`
based on checkbox counts from `entry.roadmap.phases`:

- `allDone = completedPhases === totalPhases` (all `- [x]` phases)
- `entry.active = !allDone`
- `entry.state.progress` is replaced with `[X/Y phases] Z%` computed from roadmap

When no roadmap phases exist the existing STATE.md logic is preserved.

## Verification

- `node -c get-shit-done/bin/lib/server.cjs` — syntax OK
- `node --test tests/server.test.cjs` — 7/7 pass, 0 failures

## Deviations

None. Implementation matched the plan exactly.
