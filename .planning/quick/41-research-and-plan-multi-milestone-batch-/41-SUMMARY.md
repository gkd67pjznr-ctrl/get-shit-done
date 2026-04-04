---
quick_task: 41
status: complete
date: "2026-04-04"
commit: be24f30
---

# Quick Task 41 — Summary

## Task Completed

Produced `MULTI-MILESTONE-PLANNER-DESIGN.md` — a comprehensive design document for a new `/gsd:multi-plan` command that enables planning N milestones in a single batch session.

## Key Decisions Made

**Requirements UX:** Recommended Option C (Quick-Scope). Binary Y/N per feature per milestone, not full conversational scoping. Rationale: batch planning is about breadth — detailed scoping belongs in `/gsd:discuss-phase` per phase.

**Phase slot algorithm:** Pre-assignment with buffers before roadmappers spawn. Formula: `slot_size = ceil(req_count × 1.5) + max(3, ceil(req_count × 0.75))`. Roadmappers are told `starting_phase` and `slot_end` explicitly. Post-roadmap validation detects collisions. Root ROADMAP.md updated by orchestrator only — never by roadmappers directly.

**Scope verdict:** This is milestone-sized work, not a quick task. Recommended as a 3-phase milestone (v16.0 Multi-Milestone Batch Planner).

**gsd-tools.cjs additions:** One new subcommand recommended: `milestone phase-slots`. The slot algorithm is deterministic arithmetic that belongs in tested code, not workflow prose.

## Open Questions for User (Section 5 of design doc)

1. Q1: Is Option C (quick-scope) the right requirements UX, or should `--quick` be a flag?
2. Q2: Should research be skippable per-milestone within a batch?
3. Q3: Buffer size (50% of estimate): too generous or too tight?
4. Q4: Command name — `gsd:multi-plan` vs `gsd:plan-milestones` vs others
5. Q5: Max batch size — is N ≤ 5 acceptable?
6. Q6: Should `gsd:new-milestone` suggest `multi-plan` when 3+ milestones are active?
7. Q7: Should `--from-brainstorm NN` shortcut be in scope for v16.0 or a follow-on?

## Artifact

- `/Users/tmac/Projects/gsdup/.planning/quick/41-research-and-plan-multi-milestone-batch-/MULTI-MILESTONE-PLANNER-DESIGN.md` (810 lines)
  - Section 1: Current workflow analysis (5 subsections)
  - Section 2: 5-stage proposed workflow with full UX detail
  - Section 3: Implementation requirements (6 subsections including full slot algorithm)
  - Section 4: Milestone estimate and 3-phase breakdown with milestone brief
  - Section 5: 7 open questions

## Files Read (Research)

- `~/.claude/get-shit-done/workflows/new-milestone.md`
- `~/.claude/get-shit-done/workflows/plan-phase.md`
- `~/.claude/get-shit-done/workflows/discuss-phase.md`
- `~/.claude/get-shit-done/references/path-variables.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/milestones/v11.0/ROADMAP.md`
- `.planning/milestones/v12.0/ROADMAP.md`
- `~/.claude/get-shit-done/bin/lib/init.cjs` (getHighestPhaseNumber)
- `~/.claude/get-shit-done/bin/lib/milestone.cjs` (cmdMilestoneNewWorkspace)
- `~/.claude/get-shit-done/bin/gsd-tools.cjs` (milestone subcommands routing)
