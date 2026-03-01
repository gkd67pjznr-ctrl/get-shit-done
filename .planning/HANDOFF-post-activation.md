# Handoff: Post Milestone-Scoped Layout Activation

**Created:** 2026-02-25
**Status:** Activation complete, minor follow-ups remain
**Resume with:** "Continue from .planning/HANDOFF-post-activation.md"

---

## What Was Done

### Commit: `c3d18e6` — feat: activate milestone-scoped layout for v3.0

**Wave 1: Filesystem Migration**
- Created `.planning/milestones/v3.0/` workspace (STATE.md, ROADMAP.md, REQUIREMENTS.md, conflict.json, phases/, research/)
- Moved+renamed 3 phase dirs: 15→3.1, 16→3.2, 16.1→3.2.1
- All internal file references updated (frontmatter, body text, filenames)
- Root STATE.md/ROADMAP.md rewritten as coordinator stubs
- `concurrent: true` added to config.json
- Root REQUIREMENTS.md removed (now at milestone level)

**Wave 2: Tooling Fixes**
- **normalizePhaseName** fixed: no padding when decimals present (`3.1`→`3.1`, not `03.1`)
- **findPhaseInternal(cwd, phase, milestoneScope)** — searches milestone workspace when scope provided
- **getRoadmapPhaseInternal(cwd, phaseNum, milestoneScope)** — reads milestone-scoped ROADMAP.md
- **getMilestoneInfo(cwd, milestoneScope)** — reads milestone-scoped ROADMAP.md
- **phase.cjs** — all 7 functions accept milestoneScope (list, find, planIndex, add, insert, remove, nextDecimal)
- **roadmap.cjs** — `updatePlanProgress` uses milestone-scoped paths
- **verify.cjs** — `phaseCompleteness` threads milestoneScope
- **init.cjs** — cmdInitExecutePhase, cmdInitPlanPhase, cmdInitVerifyWork, cmdInitPhaseOp all thread milestoneScope
- **gsd-tools.cjs** — all 9 dispatch sites thread milestoneScope

**Wave 3: Tests**
- Updated 6 test assertions for new normalizePhaseName behavior
- **262/266 tests pass** (4 pre-existing failures: check-patches, config quality section)
- Manual CLI verification confirmed all 3 key commands work with `--milestone v3.0`

---

## Remaining Work

### Priority 1: Add Milestone-Scoped Tests (from original handoff Wave 3)

These tests were specified but not yet written:

**Task 3.1: Core tests (tests/core.test.cjs)**
```javascript
// normalizePhaseName with dot-hierarchy (already updated existing tests, but add explicit coverage):
assert.strictEqual(normalizePhaseName('3.1'), '3.1');  // NOT '03.1'
assert.strictEqual(normalizePhaseName('3.2.1'), '3.2.1');
assert.strictEqual(normalizePhaseName('15'), '15');  // still no change for 2-digit

// findPhaseInternal with milestoneScope
// Setup: createConcurrentProject('v3.0'), add phase dir 3.1-test in workspace
// Test: findPhaseInternal(cwd, '3.1', 'v3.0') finds the phase in workspace

// getRoadmapPhaseInternal with milestoneScope
// Setup: write v3.0 ROADMAP.md with "### Phase 3.1: Test"
// Test: getRoadmapPhaseInternal(cwd, '3.1', 'v3.0') returns phase data
```

**Task 3.2: Phase operation tests (tests/phase.test.cjs)**
```javascript
// cmdPhaseAdd with milestoneScope v3.0 generates 3.N numbering
// cmdPhasePlanIndex with milestoneScope indexes workspace phases
// cmdFindPhase with milestoneScope finds in workspace
```

**Task 3.3: Roadmap tests (tests/roadmap.test.cjs)**
```javascript
// cmdRoadmapUpdatePlanProgress with milestoneScope reads/writes workspace ROADMAP
```

### Priority 2: Pre-Existing Test Failures (4 tests)

These existed before our changes:
- `check-patches` — `returns has_patches false when no patches directory`
- `config quality section` — `config-ensure-section creates quality key with fast default`
- `config quality section` — `config-get quality.level returns fast on fresh config`
- `config auto-migration` — `config-ensure-section adds quality block to existing config missing it`

### Priority 3: Continue v3.0 Development

Next phase: **3.3 Migration Tool** (`--milestone v3.0`)
- `gsd-tools migrate --dry-run` inspects layout
- `gsd-tools migrate --apply` performs additive-only changes
- Idempotent

---

## Key File Locations

| File | Purpose |
|------|---------|
| `.planning/milestones/v3.0/ROADMAP.md` | v3.0 milestone roadmap (phases 3.1-3.5) |
| `.planning/milestones/v3.0/STATE.md` | v3.0 milestone state |
| `.planning/milestones/v3.0/REQUIREMENTS.md` | v3.0 requirements |
| `.planning/config.json` | Has `concurrent: true` |
| `.planning/STATE.md` | Coordinator stub |
| `.planning/ROADMAP.md` | Coordinator stub |
| `get-shit-done/bin/lib/core.cjs` | normalizePhaseName fix, milestoneScope on 3 functions |
| `get-shit-done/bin/lib/phase.cjs` | milestoneScope on 7 functions + milestone-prefix numbering |
| `tests/helpers.cjs` | `createConcurrentProject(version)` helper for tests |

## CLI Verification Commands

```bash
# These all work now:
node get-shit-done/bin/gsd-tools.cjs find-phase 3.1 --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 3.1 --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs phase-plan-index 3.1 --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs phases list --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs roadmap analyze --milestone v3.0
```
