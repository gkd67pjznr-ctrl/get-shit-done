---
phase: XX-name
plan: YY
subsystem: [primary category]
tags: [searchable tech]
requires:
  - phase: [prior phase]
    provides: [what that phase built]
provides:
  - [bullet list of what was built/delivered]
affects: [list of phase names or keywords]
tech-stack:
  added: [libraries/tools]
  patterns: [architectural/code patterns]
key-files:
  created: [important files created]
  modified: [important files modified]
key-decisions:
  - "Decision 1"
patterns-established:
  - "Pattern 1: description"
duration: Xmin
completed: YYYY-MM-DD
---

# Phase [X]: [Name] Summary (Complex)

**[Substantive one-liner describing outcome]**

## Performance
- **Duration:** [time]
- **Tasks:** [count completed]
- **Files modified:** [count]

## Accomplishments
- [Key outcome 1]
- [Key outcome 2]

## Task Commits
1. **Task 1: [task name]** - `hash`
2. **Task 2: [task name]** - `hash`
3. **Task 3: [task name]** - `hash`

## Files Created/Modified
- `path/to/file.ts` - What it does
- `path/to/another.ts` - What it does

## Decisions Made
[Key decisions with brief rationale]

## Deviations from Plan (Auto-fixed)
[Detailed auto-fix records per GSD deviation rules]

## Quality Gates

<!-- This section is CONDITIONAL:
  - ABSENT when quality.level is "fast" (do not include, not even as empty)
  - PRESENT when quality.level is "standard" or "strict"
-->

**Quality Level:** {standard|strict}

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | [brief description] |
| 1 | context7_lookup | skipped | [reason] |
| 1 | test_baseline | passed | [N tests passing] |
| 1 | test_gate | passed | [description] |
| 1 | diff_review | passed | [description] |

**Summary:** {N} gates ran, {M} passed, {W} warned, {S} skipped, {B} blocked

<!-- If any gate blocked (strict mode only): -->
**Blocked gates:** Task {N} {gate_name} — {detail}. Execution was halted per strict mode policy.

## Issues Encountered
[Problems during planned work and resolutions]

## Next Phase Readiness
[What's ready for next phase]
[Blockers or concerns]
