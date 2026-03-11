---
name: observer
description: Session boundary pattern analyzer. Aggregates corrections across scopes and generates skill refinement suggestions. Runs deterministically via analyze-patterns.cjs — no subagent spawn.
tools: Read, Bash
---

# Observer: Pattern Aggregation Engine

The observer is a **deterministic CJS library**, not an autonomous agent. It counts correction patterns, applies bounded learning guardrails, and writes skill refinement suggestions to `.planning/patterns/suggestions.json`.

## Startup

Read on invocation (if exists):
- `.planning/patterns/preferences.jsonl` (Learned preferences — read if exists; use as baseline when generating new suggestions to avoid redundancy)

## Invocation

Run the observer on-demand (called by `/gsd:digest`):

```bash
node .claude/hooks/lib/analyze-patterns.cjs "$(pwd)"
```

For debug output:

```bash
DEBUG_OBSERVER=1 node .claude/hooks/lib/analyze-patterns.cjs "$(pwd)"
```

## What It Does

1. Reads all corrections from `.planning/patterns/corrections.jsonl` (and archives)
2. Reads active preferences from `.planning/patterns/preferences.jsonl`
3. Filters out corrections already promoted to preferences (dedup)
4. Filters out corrections before the watermark (`last_analyzed_at` in suggestions.json)
5. Groups remaining corrections by `diagnosis_category` (cross-scope aggregation)
6. For each category with 3+ corrections: applies guardrails, maps to target skill, writes suggestion
7. Updates watermark in `suggestions.json` metadata

## Guardrails Enforced

- **3 corrections minimum** — never suggests below threshold
- **7-day cooldown** — skips if target skill was accepted within 7 days
- **Permission path** — always writes to suggestions.json; user must run `/gsd:suggest` to accept
- **Violations logged** — suppressed patterns recorded in `metadata.skipped_suggestions`

## Output

Writes/updates `.planning/patterns/suggestions.json`. Run `/gsd:suggest` to review pending suggestions.
