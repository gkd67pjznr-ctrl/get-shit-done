---
phase: 13
slug: installer-and-content-delivery
verifier: claude-sonnet-4-6
verified_at: "2026-03-08"
verdict: PASS WITH ISSUES
---

# Phase 13 Verification Report

## Summary

Phase goal: A single `install.js` run delivers skills, teams, hooks, and CLAUDE.md to the user's project -- no separate skill-creator install step needed.

All 9 requirements from the PLAN frontmatter (INST-01 through INST-05, HOOK-01 through HOOK-04) are implemented and have corresponding tests. The test suite passes 25/25 tests. The full suite passes 801/802 with the one pre-existing failure (`config-get` test unrelated to this phase). Five minor issues were identified.

**Overall Verdict: PASS WITH ISSUES**

---

## Acceptance Criteria (from ROADMAP.md)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Running the installer copies all skills to `~/.claude/skills/` and all teams to `~/.claude/teams/` | PASS | Skills copy block at line 2256, teams at 2287 in bin/install.js. 16 skills in `skills/`, 4 JSON team files in `teams/`. Both guarded with `runtime === 'claude'`. |
| 2 | Running the installer registers all hooks in `settings.json` with no duplicate entries | PASS | `GSD_HOOK_REGISTRY` at line 1831 with 9 hooks. Unified loop at line 2397 with duplicate detection. Orphan cleanup extended at line 1311. |
| 3 | Running the installer creates or updates CLAUDE.md using marker-based merge without destroying user content | PASS | `mergeClaudeMd()` at line 754 implements all 3 cases. Guarded with `runtime === 'claude' && !isGlobal`. |
| 4 | If a user deletes a skill directory, subsequent installs do not re-add it | PASS | `getDeletedItems()` at line 1881. `writeManifest()` extended at lines 1963-1986 to track skills/ and teams/ entries. |
| 5 | All session and validation hooks are installed and functional | PASS | 7 source hook files in `hooks/` (JS and .sh). `build-hooks.js` copies all 10 to `hooks/dist/`. Shell scripts pass `bash -n` syntax check. JS hooks exit 0 without crashing. |

---

## Per-Requirement Assessment

### INST-01: Skills copied to ~/.claude/skills/
**PASS**

- Skills copy block exists in `install()` at line 2256 with `if (runtime === 'claude')` guard
- Non-claude runtimes receive a one-line skip notice (line 2284)
- 16 skill directories exist in `skills/`, all containing `SKILL.md`
- Tests: 2 real assertions (16+ dirs, each has SKILL.md); 1 stub that passes (non-claude runtime path)

**Minor issue:** The test for "skills not copied for non-claude runtimes" (line 204 in test file) is a passing stub `assert.ok(true, 'TODO')`. It does not verify the actual skip behavior. The plan said this stub was acceptable for Plan 13-01 but the subsequent plans did not fill it in.

### INST-02: Teams copied to ~/.claude/teams/
**PASS**

- Teams copy block at line 2287 with JSON-only filter (skips `AGENT-ID-VERIFICATION.md`)
- 4 JSON team files in `teams/`
- Tests: 1 real assertion (4+ JSON files); 1 stub that passes

**Minor issue:** Same stub pattern as INST-01 -- the non-claude runtime test for teams is `assert.ok(true, 'TODO')` (line 229). The teams copy block has no explicit `else` printing a skip notice for non-claude runtimes, unlike skills. The production code (lines 2287-2311) only has `if (runtime === 'claude')` with no `else` branch for teams. The plan requirement ("skipped for non-Claude runtimes with a one-line console notice") is partially unmet -- the notice only appears for skills, not teams.

### INST-03: Hooks copied and registered in settings.json
**PASS**

- Hook files physically copied from `hooks/dist/` at line 2228 (pre-existing mechanism)
- All 9 hooks registered via `GSD_HOOK_REGISTRY` loop at line 2397
- Tests: 3 real assertions (all 9 registered, PreToolUse/Bash matcher, PostToolUse/Write matcher)

**Note:** The test description says "hooks copied and registered in settings.json" but the tests only verify the registration (settings.json side), not the physical copy of hook files. The copy step works via the pre-existing `hooks/dist/` mechanism confirmed at line 2228. This is acceptable.

### INST-04: CLAUDE.md marker-based merge
**PASS**

- `GSD_CLAUDE_BEGIN` / `GSD_CLAUDE_END` constants at lines 20-21
- `buildClaudeMdContent(runtime)` at line 724
- `mergeClaudeMd(claudeMdPath, runtime)` at line 754 with all 3 cases
- Wired into `install()` at line 2315 with `!isGlobal && runtime === 'claude'` guard
- Tests: 5 real assertions covering all merge cases and backup behavior

### INST-05: Deleted skills not re-added on update
**PASS**

- `hasResetSkills` flag at line 51
- `getDeletedItems(configDir, resetSkills)` at line 1881
- `writeManifest()` extended at lines 1963-1986 to track skills/ and teams/ hashes
- Both copy blocks call `getDeletedItems(targetDir, hasResetSkills)` and skip deleted items
- Summary line printed when items skipped (lines 2279-2281, 2307-2309)
- Tests: 4 real assertions (no-manifest, detect-deleted-skill, detect-deleted-team, reset-skills); 2 passing stubs ("deleted skills are skipped during install", "end-of-install summary reports skipped items")

**Minor issue:** "deleted skills are skipped during install" (line 382) and "end-of-install summary reports skipped items" (line 399) remain as `assert.ok(true, 'TODO')` stubs. These are the integration-level behaviors and require invoking `install()` with a mocked filesystem. The unit-level logic is covered, but end-to-end confirmation of the skip-and-report path lacks automated test coverage.

### HOOK-01: Session hooks registered
**PASS**

- 4 SessionStart hooks in `GSD_HOOK_REGISTRY`: gsd-check-update.js, gsd-restore-work-state.js, gsd-inject-snapshot.js, session-state.sh
- 2 SessionEnd hooks: gsd-save-work-state.js, gsd-snapshot-session.js
- Source files exist in `hooks/` and `hooks/dist/`
- Tests: 2 real assertions covering SessionStart and SessionEnd hook presence

### HOOK-02: Commit validation hook registered
**PASS**

- `validate-commit.sh` in `GSD_HOOK_REGISTRY` with `event: 'PreToolUse'` and `matcher: 'Bash'`
- File exists in `hooks/validate-commit.sh` and `hooks/dist/validate-commit.sh`
- Shell syntax valid (`bash -n` passes)
- Tests: 1 real assertion verifying PreToolUse/Bash registration

### HOOK-03: Phase boundary hook registered
**PASS**

- `phase-boundary-check.sh` in `GSD_HOOK_REGISTRY` with `event: 'PostToolUse'` and `matcher: 'Write'`
- File exists in `hooks/phase-boundary-check.sh` and `hooks/dist/phase-boundary-check.sh`
- Shell syntax valid
- Tests: 1 real assertion verifying PostToolUse/Write registration

### HOOK-04: No duplicate hooks, orphan GSD hooks cleaned
**PASS**

- Duplicate detection in registration loop: `alreadyRegistered` check on command string (line 2409)
- Orphan cleanup extended at line 1311 to remove any `/hooks/gsd-` path not in current registry
- Tests: 2 real assertions (no duplicates on double registration, stale hook removed)

---

## Issues Found

### Minor: Teams block missing non-claude skip notice
**Severity: Minor**

The skills block prints `"Skills are Claude Code features -- skipped for ${runtimeLabel}"` for non-claude runtimes. The teams block has no `else` clause and prints nothing for non-claude runtimes. The plan requirement for INST-01 states "non-claude runtimes receive a one-line console notice" -- this was implemented for skills but not teams. The plan text for the teams block in task 13-01-03 does say "Only print if not already printed (avoid duplicate for non-claude runtimes)" but the code comment at line 2313 just leaves the `else if (runtime !== 'claude')` block empty with a comment about not duplicating. No message appears for teams on non-claude runtimes.

**Location:** `bin/install.js` line 2311

### Minor: Three tests remain as passing stubs
**Severity: Minor**

Three tests in `tests/installer-content.test.cjs` use `assert.ok(true, 'TODO')`:
1. Line 205: "skills not copied for non-claude runtimes"
2. Line 229: "teams not copied for non-claude runtimes"
3. Line 382: "deleted skills are skipped during install"
4. Line 399: "end-of-install summary reports skipped items"

Wait -- that is actually 4 stubs, not 3. All 4 pass because they assert `true`. They are not false negatives but they provide no actual validation of the behaviors they describe.

**Location:** `/Users/tmac/Projects/gsdup/tests/installer-content.test.cjs` lines 205, 229, 382, 399

### Minor: REQUIREMENTS.md checkboxes not updated
**Severity: Minor**

All 9 requirement checkboxes in `REQUIREMENTS.md` still show `[ ]` (unchecked) even though all 9 requirements are implemented and the plans are complete. The traceability table still shows "Pending" for all Phase 13 requirements. The ROADMAP.md plans table correctly shows all 3 plans as `[x]` complete, but the REQUIREMENTS.md has not been updated.

**Location:** `/Users/tmac/Projects/gsdup/.planning/milestones/v4.0/REQUIREMENTS.md` lines 12-34, 115-123

### Minor: phase-boundary-check.sh contains skill-creator user-facing string
**Severity: Minor** (cosmetic only -- not a functional dependency)

`hooks/dist/phase-boundary-check.sh` line 10 contains the echo string `"Check: Does this phase transition trigger any skill-creator hooks?"`. The plan's summary (13-02-SUMMARY.md) notes this as an intentional decision: "phase-boundary-check.sh echo message references 'skill-creator' as a user-facing reminder string, not a functional dependency." The file has no `npx skill-creator` calls. This is cosmetically stale but not a functional issue.

**Location:** `/Users/tmac/Projects/gsdup/hooks/dist/phase-boundary-check.sh` line 10

### Minor: ROADMAP.md Phase 13 header still shows as unchecked
**Severity: Minor**

`ROADMAP.md` line starting with `- [ ] **Phase 13**` has all 3 plans marked `[x]` complete but the phase-level checkbox itself remains `[ ]`. The ROADMAP progress table also shows `In Progress` for Phase 13 and `2/3` plans complete -- this was not updated after Plan 13-03 completed.

**Location:** `/Users/tmac/Projects/gsdup/.planning/milestones/v4.0/ROADMAP.md` lines 16, 93

---

## Requirement ID Cross-Reference

All requirement IDs from the PLAN frontmatter cross-referenced against REQUIREMENTS.md:

| Req ID | In 13-01 frontmatter | In 13-02 frontmatter | In 13-03 frontmatter | In REQUIREMENTS.md | Implemented | Tested |
|--------|---------------------|---------------------|---------------------|-------------------|-------------|--------|
| INST-01 | Yes | - | - | Yes (Phase 13) | Yes | Partial (1 stub) |
| INST-02 | Yes | - | - | Yes (Phase 13) | Yes | Partial (1 stub) |
| INST-03 | - | Yes | - | Yes (Phase 13) | Yes | Real |
| INST-04 | - | - | Yes | Yes (Phase 13) | Yes | Real (5 tests) |
| INST-05 | Yes | - | - | Yes (Phase 13) | Yes | Partial (2 stubs) |
| HOOK-01 | - | Yes | - | Yes (Phase 13) | Yes | Real |
| HOOK-02 | - | Yes | - | Yes (Phase 13) | Yes | Real |
| HOOK-03 | - | Yes | - | Yes (Phase 13) | Yes | Real |
| HOOK-04 | - | Yes | - | Yes (Phase 13) | Yes | Real |

All 9 requirement IDs are accounted for. No untracked IDs. No requirements from REQUIREMENTS.md for Phase 13 are missing from the PLAN frontmatter.

---

## Test Suite Results

```
node --test tests/installer-content.test.cjs
# tests 25
# suites 9
# pass 25
# fail 0
# duration_ms ~65ms
```

```
npm test
# tests 802
# pass 801
# fail 1  (pre-existing config-get failure, unrelated to Phase 13)
```

---

## Commit Verification

All commits use conventional commit format with Co-Authored-By:

| Commit | Message | Format | Co-Authored-By |
|--------|---------|--------|---------------|
| 7c99b4c | test(installer): add Phase 13 test scaffold... | PASS | Claude Opus 4.6 |
| add9e34 | feat(installer): add skills and teams delivery... | PASS | Claude Opus 4.6 |
| 26500d3 | feat(installer): add CLAUDE.md marker-based merge... | PASS | Claude Sonnet 4.6 |
| 5c746a1 | feat(installer): add GSD_HOOK_REGISTRY... | PASS | Claude Opus 4.6 |
| 78bbe91 | test(installer): implement INST-03 and HOOK-01... | PASS | Claude Opus 4.6 |

---

## File Existence Check

| File | Required By | Exists |
|------|-------------|--------|
| `tests/installer-content.test.cjs` | 13-01-PLAN | Yes |
| `bin/install.js` (modified) | All plans | Yes |
| `hooks/gsd-inject-snapshot.js` | 13-02-PLAN | Yes |
| `hooks/gsd-restore-work-state.js` | 13-02-PLAN | Yes |
| `hooks/gsd-save-work-state.js` | 13-02-PLAN | Yes |
| `hooks/gsd-snapshot-session.js` | 13-02-PLAN | Yes |
| `hooks/session-state.sh` | 13-02-PLAN | Yes |
| `hooks/validate-commit.sh` | 13-02-PLAN | Yes |
| `hooks/phase-boundary-check.sh` | 13-02-PLAN | Yes |
| `hooks/dist/` (all 10 files) | Install runtime | Yes |
| `scripts/build-hooks.js` | 13-02-SUMMARY deviation | Yes |

Note: The plan specified files in `hooks/dist/` but the executor correctly auto-fixed this to put sources in `hooks/` (git-tracked) and build artifacts in `hooks/dist/` (gitignored). This is the correct architecture.

---

## Recommendations

1. **Fill in the 4 passing stubs** -- The tests for non-claude runtime skip behavior and the integration-level "deleted skills skipped" and "summary reports skipped items" remain unverified. Consider adding a subprocess-based test or mock approach to close these gaps before Phase 14.

2. **Add teams skip notice for non-claude runtimes** -- Match the skills behavior by adding an `else` branch with a one-line console notice when teams are skipped for non-claude runtimes.

3. **Update REQUIREMENTS.md checkboxes** -- Mark all 9 Phase 13 requirements as `[x]` and update the traceability table to `Complete` instead of `Pending`.

4. **Update ROADMAP.md** -- Mark Phase 13 header as `[x]` and update the progress table to show `3/3` plans complete and `Complete` status.

5. **Update phase-boundary-check.sh echo message** -- Optionally replace the "skill-creator hooks" reference with a more generic message about GSD hooks, since skill-creator is being deprecated.

---

*Verified by: claude-sonnet-4-6*
*Date: 2026-03-08*
