# TO-DOS

## v2.0 Integration Gaps (from milestone audit 2026-02-25)

### ~~INTEGRATION-3: Fix cmdInitPlanPhase hardcoded paths~~ RESOLVED (Phase 15 Plan 01)
- **Priority:** High
- **File:** `get-shit-done/bin/lib/init.cjs` lines 138-140
- **Problem:** `cmdInitPlanPhase` hardcodes `state_path`, `roadmap_path`, `requirements_path` to `.planning/` instead of deriving them from `planningRoot(cwd, milestoneScope)`. Compare `cmdInitExecutePhase` (lines 76-77) which does this correctly.
- **Fix:** Replace hardcoded paths with `path.relative(cwd, path.join(root, 'STATE.md'))` etc., matching `cmdInitExecutePhase` pattern. Need to compute `const root = planningRoot(cwd, milestoneScope)` before the result object (it's already computed as `planning_root` at line 144).
- **Affects:** ROUTE-02, FLOW-1 (plan-phase in milestone context)
- **Audit ref:** `.planning/v2.0-MILESTONE-AUDIT.md` INTEGRATION-3

### ~~INTEGRATION-4: Wire milestoneScope into roadmap commands~~ RESOLVED (Phase 15 Plan 01)
- **Priority:** High
- **Files:**
  - `get-shit-done/bin/lib/roadmap.cjs` — `cmdRoadmapGetPhase` (line 10) and `cmdRoadmapAnalyze` (line 94) hardcode `.planning/ROADMAP.md`
  - `get-shit-done/bin/gsd-tools.cjs` — CLI router (lines 436-438) doesn't pass `milestoneScope` to roadmap functions
- **Problem:** Both roadmap commands ignore the `--milestone` flag. Workflows correctly pass `${MILESTONE_FLAG}` but it's silently dropped by the CLI router. For milestone-scoped projects, these read the wrong ROADMAP.md.
- **Fix:**
  1. Add `milestoneScope` param to `cmdRoadmapGetPhase(cwd, phaseNum, raw, milestoneScope)` and `cmdRoadmapAnalyze(cwd, raw, milestoneScope)`
  2. Import `planningRoot` from `core.cjs` and use `const roadmapPath = path.join(planningRoot(cwd, milestoneScope), 'ROADMAP.md')`
  3. Update CLI router to pass `milestoneScope`: `roadmap.cmdRoadmapGetPhase(cwd, args[2], raw, milestoneScope)`
- **Affects:** ROUTE-01, ROUTE-02, ROUTE-03, PATH-01, FLOW-2, FLOW-3
- **Audit ref:** `.planning/v2.0-MILESTONE-AUDIT.md` INTEGRATION-4
