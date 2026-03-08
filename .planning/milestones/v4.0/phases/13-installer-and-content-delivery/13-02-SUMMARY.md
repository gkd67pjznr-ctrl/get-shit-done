---
phase: 13-installer-and-content-delivery
plan: "02"
subsystem: installer
tags: [hooks, session-hooks, settings-json, hook-registration, build-hooks]

requires:
  - phase: 13-01
    provides: skills/teams delivery, INST-01/INST-02/INST-05 tests

provides:
  - 7 GSD-native hook source files in hooks/ (no skill-creator dependency)
  - scripts/build-hooks.js updated to copy all 10 hooks to dist
  - GSD_HOOK_REGISTRY constant in bin/install.js (9 hooks)
  - buildShellHookCommand() helper in bin/install.js
  - Unified hook registration loop replacing individual checks
  - cleanupOrphanedHooks() extended with stale gsd- hook detection
  - Real tests for INST-03, HOOK-01, HOOK-02, HOOK-03, HOOK-04

affects: [13-03, installer, hook-registration]

tech-stack:
  added: []
  patterns:
    - "GSD_HOOK_REGISTRY pattern: single source of truth for all hook registrations"
    - "registerHooksSimulated(): test helper mirrors installer hook logic exactly"
    - "hooks/ = source (git-tracked); hooks/dist/ = build output (gitignored, npm-published)"

key-files:
  created:
    - hooks/gsd-inject-snapshot.js
    - hooks/gsd-restore-work-state.js
    - hooks/gsd-save-work-state.js
    - hooks/gsd-snapshot-session.js
    - hooks/session-state.sh
    - hooks/validate-commit.sh
    - hooks/phase-boundary-check.sh
  modified:
    - scripts/build-hooks.js
    - bin/install.js
    - tests/installer-content.test.cjs

key-decisions:
  - "hooks/dist/ is gitignored (build artifact for npm) -- source hooks live in hooks/ (tracked)"
  - "GSD_HOOK_REGISTRY defined after MANIFEST_NAME constant -- function hoisting ensures no issue at call time"
  - "Removed postToolEvent variable -- Gemini AfterTool substitution now handled inline in registry loop"
  - "phase-boundary-check.sh echo message references 'skill-creator' as a user-facing reminder string, not a functional dependency"

patterns-established:
  - "GSD_HOOK_REGISTRY: add new hooks here, registration loop handles the rest"
  - "Duplicate prevention: same command string = skip, no double-registration ever"
  - "Orphan cleanup: any /hooks/gsd- path not in current registry gets removed on next install"

requirements-completed:
  - INST-03
  - HOOK-01
  - HOOK-02
  - HOOK-03
  - HOOK-04

duration: 35min
completed: 2026-03-08
---

# Plan 13-02: Hook Bundling and Consolidated Hook Registration Summary

**GSD-native session and validation hook files added to hooks/, unified GSD_HOOK_REGISTRY loop replaces individual hook registration checks in install()**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-08T~04:00Z
- **Completed:** 2026-03-08T~04:35Z
- **Tasks:** 4 executed (Task 5 was commit, integrated into atomics)
- **Files modified:** 10

## Accomplishments

- Added 7 GSD-native hook source files (4 JS session hooks, 3 shell scripts) -- zero skill-creator dependencies
- Updated scripts/build-hooks.js to include all 10 hooks in build
- Replaced individual hasGsdUpdateHook/hasContextMonitorHook checks with GSD_HOOK_REGISTRY loop covering all 9 hooks
- Extended cleanupOrphanedHooks() to detect/remove stale /hooks/gsd-* entries not in current registry
- All 25 installer-content tests pass including new INST-03, HOOK-01 through HOOK-04

## Task Commits

1. **Task 13-02-01: Hook sources and build script** - `688669f` (feat)
2. **Task 13-02-02: GSD_HOOK_REGISTRY and unified registration loop** - `5c746a1` (feat)
3. **Task 13-02-03: INST-03 and HOOK-01 through HOOK-04 tests** - `78bbe91` (test)

## Files Created/Modified

- `hooks/gsd-inject-snapshot.js` - SessionStart: reads sessions.jsonl, outputs last entry summary
- `hooks/gsd-restore-work-state.js` - SessionStart: reads STATE.md head for orientation
- `hooks/gsd-save-work-state.js` - SessionEnd: updates last_updated timestamp in STATE.md
- `hooks/gsd-snapshot-session.js` - SessionEnd: appends SessionEnd entry to sessions.jsonl
- `hooks/session-state.sh` - SessionStart: outputs STATE.md reminder with mode info
- `hooks/validate-commit.sh` - PreToolUse/Bash: blocks non-Conventional-Commits messages
- `hooks/phase-boundary-check.sh` - PostToolUse/Write: detects .planning/ file writes
- `scripts/build-hooks.js` - Extended HOOKS_TO_COPY from 3 to 10 hooks
- `bin/install.js` - buildShellHookCommand(), GSD_HOOK_REGISTRY, cleanupOrphanedHooks() extension, unified loop
- `tests/installer-content.test.cjs` - registerHooksSimulated(), GSD_HOOK_REGISTRY, 10 new real tests

## Decisions Made

- `hooks/dist/` is gitignored as a build artifact for npm publishing; hook sources live in `hooks/` (git-tracked). The plan said to create files in `hooks/dist/` but the correct location for sources is `hooks/` -- this is a deviation that was auto-fixed.
- `GSD_HOOK_REGISTRY` is defined after `MANIFEST_NAME` constant (~line 1831). No temporal dead zone issue since the function that uses it (`cleanupOrphanedHooks`) is only called at runtime, by which point the constant is initialized.
- Removed `postToolEvent` variable from the hook registration section since the unified loop handles Gemini's `AfterTool` substitution inline.

## Deviations from Plan

### Auto-fixed Issues

**1. hooks/dist/ is gitignored -- source files go in hooks/**
- **Found during:** Task 13-02-01 (hook file creation)
- **Issue:** Plan said to create files in `hooks/dist/`, but that directory is gitignored as build artifact
- **Fix:** Created source files in `hooks/` (git-tracked) and updated `scripts/build-hooks.js` to include them in the build. The `hooks/dist/` files are generated by `npm run build:hooks`.
- **Files modified:** hooks/*.js, hooks/*.sh, scripts/build-hooks.js
- **Verification:** `node scripts/build-hooks.js` copies all 10 files to hooks/dist/
- **Committed in:** 688669f

---

**Total deviations:** 1 auto-fixed (wrong target directory -- hooks/ vs hooks/dist/)
**Impact on plan:** Necessary correction -- committing to gitignored dir is not possible. Architecture preserved, source files tracked correctly.

## Issues Encountered

None beyond the hooks/dist/ gitignore issue (handled as auto-fix above).

## Next Phase Readiness

- Phase 13 requirements INST-03, HOOK-01, HOOK-02, HOOK-03, HOOK-04 are complete
- INST-04 (CLAUDE.md marker-based merge) tests were already implemented in the test file
- Remaining: INST-04 real implementation in install.js (may be Plan 13-03)
- All 25 tests pass, no regressions

---
*Phase: 13-installer-and-content-delivery*
*Completed: 2026-03-08*
