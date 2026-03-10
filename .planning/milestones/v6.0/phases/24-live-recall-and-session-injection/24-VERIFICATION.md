---
phase: 24
slug: live-recall-and-session-injection
verifier: claude-sonnet-4-6
verified_at: 2026-03-10
verdict: PASS WITH ISSUES
---

# Verification Report: Phase 24 — Live Recall and Session Injection

## Summary

Phase 24 goal: Claude remembers its past mistakes — corrections and preferences are surfaced at session boundaries and during active work.

All three plans executed and committed. The core machinery is sound and all 13 tests pass. Four issues found, one of which (dedup key separator inconsistency) is a latent logic bug between the unit test and the production hook.

---

## Acceptance Criteria Results

### Plan 24-01 must_haves

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `readCorrections({ status: 'active' })` returns entries from active + archive files sorted by timestamp descending | PASS | Implementation at `/Users/tmac/Projects/gsdup/.claude/hooks/lib/write-correction.cjs` lines 237–283 matches spec exactly |
| Entries with truthy `retired_at` excluded when `status: 'active'` | PASS | Line 270–271 of write-correction.cjs: `entries = entries.filter(e => !e.retired_at)` |
| `readCorrections` exported via `module.exports` alongside `writeCorrection` | PASS | Line 285: `module.exports = { writeCorrection, readCorrections }` |
| `tests/hooks/recall-injection.test.ts` passes `npx vitest run` | PASS | 13/13 tests green, confirmed by live run |
| Tests for RECL-01, RECL-03, PREF-04 behaviors present and green | PASS | Tests for all three behaviors exist and pass |

### Plan 24-02 must_haves

| Criterion | Result | Evidence |
|-----------|--------|----------|
| Hook produces no output when no corrections/preferences exist | PASS | Integration test "silent when no data" passes; hook verified manually |
| Output wrapped in `<system-reminder>` with `## Correction Recall` header | PASS | Confirmed in hook source (lines 53, 76, 80) and via `node gsd-recall-corrections.cjs` live run |
| Up to 10 total entries, preferences filling slots first | PASS | `MAX_ENTRIES = 10`, `selectedPrefs.slice(0, MAX_ENTRIES)`, `filteredCorrections.slice(0, remainingSlots)` |
| Corrections promoted to a preference (matching `diagnosis_category+scope`) excluded | PASS | Dedup Set built from preferences; corrections filtered against it (lines 22–27 of hook) |
| Entries with truthy `retired_at` excluded | PASS | `readCorrections({ status: 'active' })` and `readPreferences({ status: 'active' })` called (lines 16–19) |
| Soft 3K token cap with overflow footer | PASS | `MAX_TOKENS = 3000`, footer appended when `skipped > 0` |
| Hook registered in `.claude/settings.json` SessionStart array | PASS | SessionStart has 5 entries; 5th is `node .claude/hooks/gsd-recall-corrections.cjs` |
| `npx vitest run tests/hooks/recall-injection.test.ts` all-green | PASS | 13/13 green confirmed |

### Plan 24-03 must_haves

| Criterion | Result | Evidence |
|-----------|--------|----------|
| `.claude/skills/session-awareness/SKILL.md` contains `## Correction Recall` section | PASS | `grep -c "Correction Recall"` returns `1` |
| Section includes the exact instruction text | PASS | "Before writing code or making decisions, review any correction reminders from session start to avoid repeating known mistakes" confirmed in SKILL.md line 77 |
| Rest of SKILL.md content unchanged | PASS | All prior sections (GSD Artifact Map, skill-creator Artifacts, all Response Patterns, Core Rule) intact |
| RECL-02 satisfied | PASS | In-skill reminder present and correctly placed after Core Rule |

---

## Requirement ID Coverage

| Requirement ID | Definition | Coverage | Verdict |
|----------------|-----------|----------|---------|
| RECL-01 | Session-start recall loads corrections/preferences, capped at 10 corrections (~3K tokens) | `gsd-recall-corrections.cjs` hook with 10-slot cap and 3K token budget | PASS with gap (see Issue 2) |
| RECL-02 | Live within-session recall so Claude catches itself before repeating known mistakes | `## Correction Recall` section in session-awareness SKILL.md | PASS |
| RECL-03 | Recalled items baked into skills are excluded | `retired_at` filter in `readCorrections()` and `readPreferences()` | PASS (note: exclusion is by `retired_at` flag only — the flag is set by Phase 26 skill refinement workflow, not yet implemented) |
| PREF-04 | When a preference is baked into a skill refinement, it is retired from active preference store and recall pipeline | Dedup logic excludes corrections promoted to preferences; `retired_at` filter excludes retired entries | PARTIAL — see Issue 3 |

All four IDs from the plan frontmatter are accounted for.

---

## Commits

| Plan | Commit | Message | Format |
|------|--------|---------|--------|
| 24-01 | 739dc71 | `feat(recall): add readCorrections() and recall injection test scaffold` | PASS |
| 24-02 | f550e6c | `feat(recall): implement gsd-recall-corrections SessionStart hook` | PASS |
| 24-03 | 4d12dd9 | `feat(recall): add correction recall hint to session-awareness skill` | PASS |

All commits follow Conventional Commits format with correct `feat(recall):` type/scope.

---

## Issues Found

### Issue 1 — MAJOR: Dedup key separator inconsistency between unit test and production hook

**File:** `/Users/tmac/Projects/gsdup/tests/hooks/recall-injection.test.ts` lines 235–242 vs `/Users/tmac/Projects/gsdup/.claude/hooks/gsd-recall-corrections.cjs` lines 22–27

The unit test for PREF-04 dedup (the `describe('dedup — promoted corrections excluded')` block) builds the promoted keys Set using `+` as the separator:

```typescript
preferences.map((p) => `${p.category}+${p.scope}`)
// produces: "code.wrong_pattern+file"
```

The production hook builds the same Set using `:` as the separator:

```javascript
allPreferences.map(p => p.category + ':' + p.scope)
// produces: "code.wrong_pattern:file"
```

The unit test tests its own inline dedup logic, not the hook's dedup logic. The test passes because it is self-consistent internally, but if the hook dedup were imported and tested directly, the test keys would not match the hook keys. The integration test (which spawns the actual hook) does validate the hook's dedup behavior end-to-end, but the unit test for dedup logic misrepresents the separator the hook actually uses.

This is a latent documentation/regression risk: any developer reading the unit test would infer `+` is the canonical separator. The integration test provides real coverage but the unit test gives a false impression of internal consistency.

**Severity:** MAJOR

### Issue 2 — MINOR: RECL-01 definition specifies phase filtering; implementation has no phase filter

**File:** `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` line 26 vs `/Users/tmac/Projects/gsdup/.claude/hooks/gsd-recall-corrections.cjs`

RECL-01 states: "filtered by current phase". The hook loads all active corrections with no phase filtering. The CONTEXT.md decision explicitly overrides this: "No phase filtering — all active corrections shown regardless of current phase/milestone (concurrent milestones mean sessions span many phases)". This deviation from the REQUIREMENTS.md definition is documented and deliberate, but the REQUIREMENTS.md definition was never updated to reflect the changed behavior.

**Severity:** MINOR (decision is correct and documented; only documentation is inconsistent)

### Issue 3 — MINOR: PREF-04 requirement definition and implementation address different concerns

**File:** `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` line 22

PREF-04 states: "When a preference is baked into a skill refinement, it is retired from the active preference store and recall pipeline." Phase 24 implements the recall-pipeline side (excluding entries by `retired_at` flag and deduplicating promoted corrections). However, the mechanism for setting `retired_at` when a skill is refined is Phase 26's responsibility, not yet implemented. The REQUIREMENTS.md traceability table shows PREF-04 assigned to Phase 24, but only half of PREF-04 can be satisfied here — the retirement-from-store half depends on Phase 26 wiring.

**Severity:** MINOR (the Phase 24 contribution is correct; the requirement spans two phases and the table is misleading)

### Issue 4 — MINOR: REQUIREMENTS.md traceability table and ROADMAP.md not updated to reflect phase 24 completion

**Files:**
- `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` lines 87–90: all four IDs still show `Pending`
- `/Users/tmac/Projects/gsdup/.planning/milestones/v6.0/ROADMAP.md` lines 60–61: Plans 24-02 and 24-03 show as unchecked `[ ]`, and the plan names are wrong (they say "inject-recall.cjs PreToolUse Hook" and "Integration and Verification" — the old draft plan names — rather than the actual plans that were built)

**Severity:** MINOR (documentation drift; does not affect runtime behavior or test correctness)

---

## Recommendations

1. **Fix the dedup separator mismatch in the unit test** (Issue 1). The `describe('dedup — promoted corrections excluded')` block in `tests/hooks/recall-injection.test.ts` should use `:` as the separator to match the hook, or the test should be rewritten to call `assembleRecall`/the hook directly rather than reimplementing the dedup inline with a different key format. The integration test provides the real safety net, but the unit test is misleading.

2. **Update REQUIREMENTS.md traceability** (Issue 4). Change the four PREF-04/RECL-01/RECL-02/RECL-03 rows from `Pending` to `Complete` (or `Partial` for PREF-04 pending Phase 26). Update ROADMAP.md phase 24 plan list to reflect the actual plan names and check them off.

3. **Add a note to PREF-04 in REQUIREMENTS.md** (Issue 3) that coverage is split across Phase 24 (recall exclusion) and Phase 26 (setting `retired_at` after skill refinement). This prevents future verifiers from marking Phase 26's PREF-04 contribution as redundant.

---

## Test Results

```
npx vitest run tests/hooks/recall-injection.test.ts
  13/13 tests passed (98ms)

npm test
  956/958 pass
  2 pre-existing failures (check-patches, config quality — unrelated to Phase 24)
```

---

## Overall Verdict

**PASS WITH ISSUES**

The core deliverables are correct and all tests pass. The SessionStart hook works end-to-end, `readCorrections()` is properly exported, and the session-awareness skill correctly reminds Claude to review correction recall. The dedup key separator inconsistency (Issue 1) is a real bug in the test suite that could mislead future maintainers; the remaining issues are documentation gaps. No deliverable is broken or missing.
