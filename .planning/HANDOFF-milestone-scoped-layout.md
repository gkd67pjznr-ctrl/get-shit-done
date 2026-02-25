# Handoff: Activate Milestone-Scoped Layout

**Created:** 2026-02-25
**Status:** Research complete, zero code changes made yet
**Resume with:** "Implement the plan in .planning/HANDOFF-milestone-scoped-layout.md"

---

## What Was Done This Session

- Read ALL critical files in full (core.cjs, phase.cjs, roadmap.cjs, init.cjs, gsd-tools.cjs, config.json)
- Read ALL existing test files (core.test.cjs, phase.test.cjs, roadmap.test.cjs)
- Read ALL planning docs (ROADMAP.md, STATE.md, REQUIREMENTS.md, MILESTONES.md)
- Read phase file contents (15-01-PLAN.md, 16-RESEARCH.md, 16.1-01-PLAN.md)
- Verified filesystem structure (phases/, milestones/, research/)
- **NO code changes were made. Everything below is TODO.**

---

## 3-Wave Plan

### Wave 1: Filesystem Migration + Root Coordination

#### Task 1.1: Create v3.0 workspace and move phases

```bash
# Create workspace structure
mkdir -p .planning/milestones/v3.0/phases
mkdir -p .planning/milestones/v3.0/research

# Move + rename phase dirs
mv .planning/phases/15-integration-fixes .planning/milestones/v3.0/phases/3.1-integration-fixes
mv .planning/phases/16-core-debt-module .planning/milestones/v3.0/phases/3.2-core-debt-module
mv .planning/phases/16.1-planning-directory-cleanup-and-gsd-flow-fixes .planning/milestones/v3.0/phases/3.2.1-planning-directory-cleanup-and-gsd-flow-fixes
```

**Rename files inside each moved dir:**

Phase 3.1 (was 15):
- `15-RESEARCH.md` → `3.1-RESEARCH.md`
- `15-01-PLAN.md` → `3.1-01-PLAN.md`
- `15-01-SUMMARY.md` → `3.1-01-SUMMARY.md`
- `15-VERIFICATION.md` → `3.1-VERIFICATION.md`

Phase 3.2 (was 16):
- `16-RESEARCH.md` → `3.2-RESEARCH.md`
- `16-01-PLAN.md` → `3.2-01-PLAN.md`
- `16-01-SUMMARY.md` → `3.2-01-SUMMARY.md`
- `16-VERIFICATION.md` → `3.2-VERIFICATION.md`

Phase 3.2.1 (was 16.1):
- `16.1-RESEARCH.md` → `3.2.1-RESEARCH.md`
- `16.1-01-PLAN.md` → `3.2.1-01-PLAN.md`
- `16.1-01-SUMMARY.md` → `3.2.1-01-SUMMARY.md`
- `16.1-02-PLAN.md` → `3.2.1-02-PLAN.md`
- `16.1-02-SUMMARY.md` → `3.2.1-02-SUMMARY.md`
- `16.1-VERIFICATION.md` → `3.2.1-VERIFICATION.md`

**Update internal references in moved files:**
- Frontmatter `phase:` field: `15-integration-fixes` → `3.1-integration-fixes`, `16.1-planning-directory-cleanup-and-gsd-flow-fixes` → `3.2.1-planning-directory-cleanup-and-gsd-flow-fixes`
- Body text: `Phase 15` → `Phase 3.1`, `Phase 16` → `Phase 3.2`, `Phase 16.1` → `Phase 3.2.1`
- File references: `15-01-PLAN.md` → `3.1-01-PLAN.md` etc.

#### Task 1.2: Create milestone-scoped documents

- `.planning/milestones/v3.0/ROADMAP.md` — v3.0-only roadmap with phases 3.1-3.5 (renumbered from 15-19)
- `.planning/milestones/v3.0/STATE.md` — Milestone-specific state tracking
- `.planning/milestones/v3.0/REQUIREMENTS.md` — Copy from root, update phase references
- Copy research: `cp -r .planning/research/* .planning/milestones/v3.0/research/`
- Create `.planning/milestones/v3.0/conflict.json` (empty conflicts file)

#### Task 1.3: Set up root coordination

- `.planning/config.json` — Add `"concurrent": true`
- `.planning/STATE.md` — Rewrite as lightweight coordinator
- `.planning/MILESTONES.md` — Update v3.0 section with new phase numbers
- `.planning/ROADMAP.md` — Replace with stub pointing to milestone workspaces
- Remove `.planning/REQUIREMENTS.md` (now lives at milestone level)

### Wave 2: Tooling Fixes

#### Task 2.1: Fix normalizePhaseName in core.cjs (CRITICAL)

**File:** `get-shit-done/bin/lib/core.cjs` line 164

Current bug: `normalizePhaseName('3.1')` → `'03.1'` → `searchPhaseInDir` looks for dirs starting with `03.1` → no match against `3.1-integration-fixes/`

Fix (line 167):
```javascript
// BEFORE:
const padded = match[1].padStart(2, '0');
// AFTER:
const decimal = match[3] || '';
const padded = decimal ? match[1] : match[1].padStart(2, '0');
```

This makes `normalizePhaseName('3.1')` → `'3.1'` (no padding when decimals present).
Backward compat: `normalizePhaseName('3')` still → `'03'`, `normalizePhaseName('15')` still → `'15'`.

#### Task 2.2: Fix findPhaseInternal + getRoadmapPhaseInternal + getMilestoneInfo in core.cjs

Add `milestoneScope` param to:
- `findPhaseInternal(cwd, phase, milestoneScope)` — line 246: When milestoneScope provided, search `planningRoot(cwd, milestoneScope)/phases/` instead of `.planning/phases/`
- `getRoadmapPhaseInternal(cwd, phaseNum, milestoneScope)` — line 320: Use `planningRoot(cwd, milestoneScope)` for ROADMAP path
- `getMilestoneInfo(cwd, milestoneScope)` — line 388: Use `planningRoot(cwd, milestoneScope)` for ROADMAP read

#### Task 2.3: Thread milestoneScope in init.cjs

Pass milestoneScope to `findPhaseInternal` and `getRoadmapPhaseInternal` in:
- `cmdInitExecutePhase` — line 17: `findPhaseInternal(cwd, phase)` → `findPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitExecutePhase` — line 20: `getRoadmapPhaseInternal(cwd, phase)` → `getRoadmapPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitExecutePhase` — line 18: `getMilestoneInfo(cwd)` → `getMilestoneInfo(cwd, milestoneScope)`
- `cmdInitPlanPhase` — line 98: `findPhaseInternal(cwd, phase)` → `findPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitPlanPhase` — line 100: `getRoadmapPhaseInternal(cwd, phase)` → `getRoadmapPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitVerifyWork` — line 370: `findPhaseInternal(cwd, phase)` → `findPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitPhaseOp` — line 403: `findPhaseInternal(cwd, phase)` → `findPhaseInternal(cwd, phase, milestoneScope)`
- `cmdInitPhaseOp` — line 407: `getRoadmapPhaseInternal(cwd, phase)` → `getRoadmapPhaseInternal(cwd, phase, milestoneScope)`

#### Task 2.4: Fix phase.cjs — add milestoneScope to all phase operations

All 8 functions use hardcoded `.planning/phases/`. Change to use `planningRoot(cwd, milestoneScope)/phases/`:
- `cmdPhasesList(cwd, options, raw, milestoneScope)` — line 11
- `cmdFindPhase(cwd, phase, raw, milestoneScope)` — line 151
- `cmdPhasePlanIndex(cwd, phase, raw, milestoneScope)` — line 195
- `cmdPhaseAdd(cwd, description, raw, milestoneScope)` — line 303 — ALSO needs milestone-prefix numbering
- `cmdPhaseInsert(cwd, afterPhase, description, raw, milestoneScope)` — line 359
- `cmdPhaseNextDecimal(cwd, basePhase, raw, milestoneScope)` — line 86
- `cmdPhaseRemove(cwd, targetPhase, options, raw, milestoneScope)` — line 440

Phase numbering logic for `cmdPhaseAdd` with milestoneScope:
```javascript
if (milestoneScope) {
  const vMatch = milestoneScope.match(/v(\d+)/);
  const majorPrefix = vMatch ? parseInt(vMatch[1], 10) : null;
  // Find max N in phases matching majorPrefix.N pattern
  // Next phase = majorPrefix.(max+1)
}
```

#### Task 2.5: Fix roadmap.cjs — milestoneScope for updatePlanProgress

`cmdRoadmapUpdatePlanProgress(cwd, phaseNum, raw, milestoneScope)` — line 220:
- Change `path.join(cwd, '.planning', 'ROADMAP.md')` → `path.join(planningRoot(cwd, milestoneScope), 'ROADMAP.md')`
- Change `findPhaseInternal(cwd, phaseNum)` → `findPhaseInternal(cwd, phaseNum, milestoneScope)`

#### Task 2.6: Thread milestoneScope in CLI router (gsd-tools.cjs)

Add `milestoneScope` as last arg to ~9 dispatch sites:
- `find-phase` — line 286: `phase.cmdFindPhase(cwd, args[1], raw)` → add milestoneScope
- `phase-plan-index` — line 667: `phase.cmdPhasePlanIndex(cwd, args[1], raw)` → add milestoneScope
- `phases list` — line 444: `phase.cmdPhasesList(cwd, options, raw)` → add milestoneScope
- `roadmap update-plan-progress` — line 458: add milestoneScope
- `phase add` — line 521: add milestoneScope
- `phase insert` — line 523: add milestoneScope
- `phase next-decimal` — line 519: add milestoneScope
- `phase remove` — line 526: add milestoneScope
- `verify phase-completeness` — line 361: add milestoneScope

### Wave 3: Tests + Verification

#### Task 3.1: Core tests (tests/core.test.cjs)

- `normalizePhaseName` with dot-hierarchy: `'3.1'` → `'3.1'` (NOT `'03.1'`), `'3.2.1'` → `'3.2.1'`, `'15'` → `'15'`
- `findPhaseInternal` with milestoneScope: finds phase in workspace
- `getRoadmapPhaseInternal` with milestoneScope: reads workspace ROADMAP

#### Task 3.2: Phase operation tests (tests/phase.test.cjs)

- `cmdPhaseAdd` with milestoneScope `v3.0`: generates `3.N` numbering
- `cmdPhasePlanIndex` with milestoneScope: indexes workspace phases
- `cmdFindPhase` with milestoneScope: finds in workspace

#### Task 3.3: Roadmap tests (tests/roadmap.test.cjs)

- `cmdRoadmapUpdatePlanProgress` with milestoneScope: reads/writes workspace ROADMAP

#### Task 3.4: Full suite + manual verification

```bash
npx jest --verbose  # all 262+ tests pass
```

Manual CLI checks:
```bash
node get-shit-done/bin/gsd-tools.cjs find-phase 3.1 --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs roadmap get-phase 3.1 --milestone v3.0
node get-shit-done/bin/gsd-tools.cjs phase-plan-index 3.1 --milestone v3.0
```

---

## Critical Files Summary

| File | Changes Needed |
|------|---------------|
| `get-shit-done/bin/lib/core.cjs` | normalizePhaseName fix (line 167), findPhaseInternal +milestoneScope (line 246), getRoadmapPhaseInternal +milestoneScope (line 320), getMilestoneInfo +milestoneScope (line 388) |
| `get-shit-done/bin/lib/phase.cjs` | All 8 phase functions +milestoneScope, milestone-prefix numbering in cmdPhaseAdd |
| `get-shit-done/bin/lib/roadmap.cjs` | cmdRoadmapUpdatePlanProgress +milestoneScope (line 220) |
| `get-shit-done/bin/lib/init.cjs` | Thread milestoneScope to ~8 internal calls |
| `get-shit-done/bin/gsd-tools.cjs` | Thread milestoneScope to ~9 dispatch sites |
| `.planning/config.json` | Add `"concurrent": true` |
| `.planning/milestones/v3.0/` | New workspace with ROADMAP, STATE, REQUIREMENTS, phases/ |
| `.planning/STATE.md` | Rewrite as coordinator |
| `tests/core.test.cjs` | normalizePhaseName dot-hierarchy tests, milestone-scoped lookup tests |
| `tests/phase.test.cjs` | milestone-scoped phase operation tests |
| `tests/roadmap.test.cjs` | milestone-scoped updatePlanProgress test |

## Key Risk

`normalizePhaseName('3.1')` currently returns `'03.1'` → `searchPhaseInDir` looks for dirs starting with `03.1` → no match against `3.1-integration-fixes/`. **Every phase lookup breaks.** This must be fixed in Wave 2 Task 2.1 before any milestone-scoped operations will work.

## Execution Order

1. Wave 1 first (filesystem changes are independent of code)
2. Wave 2 next (code changes - do normalizePhaseName FIRST as it's the critical path)
3. Wave 3 last (tests verify everything works)

## Existing Tests Status

Tests use `node --test` runner (Node.js built-in). Run with:
```bash
cd /Users/tmac/Projects/gsdup && node --test tests/*.test.cjs
```
Currently ~262+ tests. The `createConcurrentProject('v2.0')` helper in `tests/helpers.cjs` creates milestone workspace fixtures.
