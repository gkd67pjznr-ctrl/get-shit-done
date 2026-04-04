---
name: gsd:brainstorm
description: Run a 3-stage mechanical brainstorming session (Seed → Expand → Converge)
argument-hint: "<topic> [--wild] [--from-corrections] [--from-debt] [--for-milestone]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
---
<objective>
Run a full 3-stage brainstorming pipeline for the given topic.

Stage 1 — Seed: build a context-blind seed brief from project signals (corrections, debt, sessions).
Stage 2 — Expand: generate ideas through freeform dump, SCAMPER cycling, starbursting, and perspective shifts. Evaluation is mechanically blocked during expand.
Stage 3 — Converge: cluster ideas, score on 4 dimensions, rank, select finalists, write output.

Output lands in `.planning/quick/NN-brainstorm-[topic]/` with FEATURE-IDEAS.md, BRAINSTORM-SESSION.md, and ideas.jsonl.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/brainstorm.md
</execution_context>

<context>
Arguments: $ARGUMENTS

**Topic:** All non-flag words in $ARGUMENTS. Required — if missing the workflow will ask.

**Flags:**
- `--wild` — Activates maximum unhinged mode: quantity floors double (freeform: 30, SCAMPER: 4/lens, starburst: 6/angle, perspectives: 6/each), eval detection widens to include hedging language, all 7 perspectives are used instead of 2-3
- `--from-corrections` — Seed brief includes correction pattern analysis (Phase 48)
- `--from-debt` — Seed brief includes open debt items (Phase 48)
- `--for-milestone` — Seed brief combines all data sources (Phase 48)

Flags compose without conflict: `--wild --for-milestone` activates both wild enforcement and milestone-aware seeding.
</context>

<process>
Follow the brainstorm workflow from @~/.claude/get-shit-done/workflows/brainstorm.md end-to-end.

Parse $ARGUMENTS for topic and flags before starting. Do not skip any stage. The workflow enforces stage order — expand cannot be skipped, converge requires all expand techniques to reach their floors first (or explicit user choice to advance).
</process>
