---
phase: 89-synthesis-review-and-resume
plan: "89-01"
subsystem: workflows
tags: [multi-milestone, roadmapping, synthesis, parallel-agents]

requires:
  - phase: 88-batch-workflow-stages
    provides: Stages 0-3 of multi-milestone.md with Stage 4 stub placeholder

provides:
  - Stage 4 full implementation in get-shit-done/workflows/multi-milestone.md
  - next_starting_phase determination via init new-milestone --raw
  - N concurrent proposal-mode gsd-roadmapper Task() invocation pattern
  - Proposal validation with ROADMAP BLOCKED re-spawn logic
  - gsd-roadmap-synthesizer spawn with files_to_read and context blocks
  - SYNTHESIS BLOCKED abort handling
  - BATCH-SESSION.md update after synthesis completes
  - Synthesis summary display to user

affects: [multi-milestone, gsd-roadmapper, gsd-roadmap-synthesizer, batch-workflow]

tech-stack:
  added: []
  patterns:
    - "Parallel Task() spawning with proposal mode — roadmappers write PROPOSAL.md only"
    - "Two-phase synthesis: N parallel roadmappers then one synthesizer serializes numbering"
    - "Cursor algorithm for sequential gap-free phase number assignment across milestones"

key-files:
  created: []
  modified:
    - get-shit-done/workflows/multi-milestone.md

key-decisions:
  - "next_starting_phase queried via `init new-milestone --raw` before any roadmapper spawns — ensures accurate phase slot assignment"
  - "Only blocked milestone re-spawns; valid proposals from other milestones are preserved across the re-spawn"
  - "SYNTHESIS BLOCKED aborts with user instructions — no silent retry on synthesizer failure"

patterns-established:
  - "Proposal validation: check for PHASE-A entry presence; ROADMAP BLOCKED triggers re-spawn with clarification"
  - "files_to_read block lists all N PROPOSAL.md and REQUIREMENTS.md files for synthesizer"
  - "context block passes next_starting_phase and milestones_in_order as structured data"

requirements-completed:
  - RSYN-03
  - RSYN-04

duration: 15min
completed: 2026-04-04
---

# Plan 89-01: Parallel Roadmapper Spawning and Synthesizer Artifact Writing

**Stage 4 of multi-milestone.md implemented: N concurrent proposal-mode roadmapper agents feed a single synthesizer that assigns sequential phase numbers across all milestones**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-04
- **Completed:** 2026-04-04
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Replaced the Stage 4 stub in `get-shit-done/workflows/multi-milestone.md` with 7-step full implementation (Steps 4.1-4.7)
- Step 4.1 determines `next_starting_phase` by calling `init new-milestone --raw` before spawning any roadmapper
- Step 4.3 spawns N concurrent Task() calls with `subagent_type="gsd-roadmapper"` and `mode="proposal"`, each writing to its milestone workspace's PROPOSAL.md only
- Step 4.4 validates proposals (PHASE-A presence check) with re-spawn logic for ROADMAP BLOCKED — preserves valid proposals from other milestones
- Step 4.5 spawns `gsd-roadmap-synthesizer` with correctly-structured `files_to_read` and `context` blocks, handles SYNTHESIS BLOCKED by aborting with user instructions
- Step 4.6 updates BATCH-SESSION.md Stage Status table and Milestones table after synthesis completes
- Step 4.7 displays Phase Allocation Summary from the synthesizer's SYNTHESIS COMPLETE block

## Task Commits

1. **Task 1: Replace Stage 4 stub with full parallel roadmapping and synthesis content** — `4161e72` (feat)

## Files Created/Modified

- `get-shit-done/workflows/multi-milestone.md` — Stage 4 stub (~4 lines) replaced with full implementation (~153 lines added net)

## Decisions Made

- Updated `<purpose>` block to remove the incorrect "Stages 0-3 only" claim since Stage 4 is now implemented in this same file
- Preserved exact agent invocation contracts from reading `gsd-roadmapper.md` and `gsd-roadmap-synthesizer.md` — Task() prompt structure matches what the agents expect

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Stage 4 is now fully implemented in multi-milestone.md
- Plan 89-02 will add Stage 5 (the next stub)
- The multi-milestone workflow now covers the complete happy path through synthesis

---
*Phase: 89-synthesis-review-and-resume*
*Completed: 2026-04-04*
