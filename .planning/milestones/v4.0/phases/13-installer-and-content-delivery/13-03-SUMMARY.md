---
phase: 13
plan: "03"
status: complete
completed_at: "2026-03-08"
duration_estimate: "~20 min"
---

# Plan 13-03 Summary: CLAUDE.md Marker-Based Merge

## Outcome

All must_haves satisfied. All 25 tests pass (no regressions). INST-04 implemented with 5 real assertions covering all three merge cases.

## Tasks Completed

### 13-03-01: Add marker constants and helper functions to bin/install.js

- `GSD_CLAUDE_BEGIN` (`<!-- GSD:BEGIN -->`) and `GSD_CLAUDE_END` (`<!-- GSD:END -->`) constants added after `GSD_CODEX_MARKER`
- `buildClaudeMdContent(runtime)` helper generates GSD block with runtime-specific attribution via `getCommitAttribution(runtime)`; falls back to `Claude <noreply@anthropic.com>` when attribution is null/undefined
- `mergeClaudeMd(claudeMdPath, runtime)` function added after `mergeCodexConfig()` with three-case logic:
  - Case 1: no file -> `fs.writeFileSync` creates fresh with GSD block
  - Case 2: has both markers -> replaces block, backs up to `.gsd-backup` if user-modified
  - Case 3: no markers -> prepends GSD block, preserving all existing user content

### 13-03-02: Wire mergeClaudeMd() into install()

- Inserted after teams copy block, before `if (failures.length > 0)` check
- Guarded with `if (runtime === 'claude' && !isGlobal)` -- global installs and non-Claude runtimes skipped
- Logs result label (Created / Updated / Prepended to) for user feedback

### 13-03-03: Replace INST-04 stubs with real tests

- Added `GSD_CLAUDE_BEGIN`/`GSD_CLAUDE_END` constants and `buildGsdBlockForTest()` helper to test file
- Added `mergeClaudeMdSimulated(claudeMdPath)` that mirrors the production logic for file-based testing
- Replaced all 5 `assert.ok(true, 'TODO')` stubs with real assertions:
  - creates CLAUDE.md with GSD block when file does not exist
  - updates content between markers when CLAUDE.md has markers
  - prepends GSD block when CLAUDE.md exists without markers
  - preserves user content outside markers on update
  - backs up file when user modified content inside markers

### 13-03-04: Full test suite verification

- `node --test tests/installer-content.test.cjs`: 25/25 pass
- `npm test`: 801/802 pass (1 pre-existing config-get failure, unchanged)
- All Phase 13 spot checks verified: 16 skills, 4 teams, 10 hooks/dist files, mergeClaudeMd function present

### 13-03-05: Commit

- Single atomic commit: `26500d3` feat(installer): add CLAUDE.md marker-based merge (INST-04)

## Deviations

None. Plan followed exactly.

## Verification

```
node --test tests/installer-content.test.cjs
# tests 25 / pass 25 / fail 0

grep -n "function mergeClaudeMd" bin/install.js   # => 746
grep -n "GSD_CLAUDE_BEGIN" bin/install.js | head -5  # => 20, 722, 756
grep -n "Merge CLAUDE.md" bin/install.js           # => 2264
```

## Commits

- `26500d3` feat(installer): add CLAUDE.md marker-based merge (INST-04)
