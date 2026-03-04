# Roadmap: GSD Enhanced Fork — Milestone v3.1

## Overview

Tech debt cleanup, legacy layout strip, and documentation for the GSD enhanced fork. Six phases: fix known behavioral bugs and CLI gaps (done), resolve file housekeeping issues (done), strip all legacy flat-layout code to make milestone-scoped the only layout, then ship the README. All fourteen requirements are addressed. Phase numbering continues from v3.0 (ended at 3.5).

## Phases

- [x] **Phase 4: Bug Fixes** - Fix all behavioral bugs and CLI help gaps from v3.0
- [x] **Phase 5: Housekeeping** - Resolve file structure and git tracking issues (completed 2026-02-27)
- [x] **Phase 7: Delete Legacy Files** - Delete migrate.cjs, legacy test files, and migrate CLI command
- [x] **Phase 8: Strip Core Legacy** - Remove detectLayoutStyle and all dual-layout branching from source
- [ ] **Phase 9: Workflow & Test Cleanup** - Remove layout conditionals from workflows, clean up remaining tests
- [ ] **Phase 10: Documentation** - Create README.md summarizing the fork (reflects simplified codebase)

## Phase Details

### Phase 4: Bug Fixes
**Goal**: All known behavioral bugs from v3.0 are fixed and the CLI help is complete
**Depends on**: Nothing (first phase of this milestone)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, CLI-01
**Success Criteria** (what must be TRUE):
  1. `gsd milestone complete` runs without error in a milestone-scoped layout (phasesDir resolves correctly)
  2. Running execute-plan.md with `--milestone` causes `roadmap update-plan-progress` to receive the milestone flag
  3. `gsd init` creates DEBT.md in the project root; `migrate --apply` creates DEBT.md for projects that lack it
  4. TO-DOS.md files created by the system land in the correct todos directory, not the .planning/ root
  5. `gsd --help` lists `migrate`, `debt`, and `milestone` commands alongside existing commands
**Plans**: 3 plans (wave 1 — all parallel)

Plans:
- [x] 04-01-PLAN.md — Fix cmdMilestoneComplete phasesDir and execute-plan.md --milestone pass-through (FIX-01, FIX-02)
- [x] 04-02-PLAN.md — Fix DEBT.md initialization paths and TO-DOS.md placement (FIX-03, FIX-04, FIX-05)
- [x] 04-03-PLAN.md — Complete CLI --help text for all commands (CLI-01)

### Phase 5: Housekeeping
**Goal**: Agent files are tracked in git and fix-debt.md has a single authoritative source
**Depends on**: Phase 4
**Requirements**: MAINT-01, MAINT-02
**Success Criteria** (what must be TRUE):
  1. `git ls-files` shows `gsd-executor.md` and `gsd-verifier.md` tracked in the repository
  2. There is exactly one copy of `fix-debt.md`; no divergence between installed and repo copies
**Plans**: 1 plan (wave 1)

Plans:
- [x] 05-01-PLAN.md — Merge Debt Auto-Log sections into repo agent files and verify fix-debt.md single-copy status (MAINT-01, MAINT-02)

### Phase 7: Delete Legacy Files
**Goal**: All legacy-only files are removed — migrate.cjs, legacy test files, migrate CLI command
**Depends on**: Phase 5
**Requirements**: STRIP-01
**Success Criteria** (what must be TRUE):
  1. `get-shit-done/bin/lib/migrate.cjs` does not exist
  2. `tests/compat.test.cjs` does not exist
  3. `tests/migrate.test.cjs` does not exist
  4. `migrate` case block removed from `gsd-tools.cjs` CLI router
  5. All remaining tests pass
**Plans**: 1 plan — COMPLETE (2026-03-03)

Plans:
- [x] 07-01: Delete migrate.cjs, legacy test files, remove migrate CLI command (STRIP-01)

### Phase 8: Strip Core Legacy
**Goal**: No code checks or branches on layout style — milestone-scoped is the only path
**Depends on**: Phase 7
**Requirements**: STRIP-02, STRIP-03
**Success Criteria** (what must be TRUE):
  1. `detectLayoutStyle` function does not exist in `core.cjs`
  2. `detectLayoutStyle` is not imported or called anywhere in the codebase
  3. `getArchivedPhaseDirs` function does not exist in `core.cjs`
  4. `findPhaseInternal` has no legacy fallback branch (no `path.join(cwd, '.planning', 'phases')` search)
  5. `layout_style` field removed from all `init.cjs` command outputs
  6. `roadmap.cjs`, `phase.cjs`, `commands.cjs` conditionals simplified (no `detectLayoutStyle` guards)
  7. All remaining tests pass
**Plans**: 2 plans

Plans:
- [x] 08-01: Delete detectLayoutStyle, legacy findPhaseInternal branch, getArchivedPhaseDirs from core.cjs (STRIP-02, STRIP-03)
- [x] 08-02: Update imports and simplify conditionals in init.cjs, roadmap.cjs, phase.cjs, commands.cjs (STRIP-02, STRIP-03)

**Note:** Success criterion #4 (findPhaseInternal legacy fallback) deferred to Phase 9. The `detectLayoutStyle` dynamic branching is fully removed, but the unconditional `.planning/phases/` fallback search was restored because `createTempProject()` test helper creates flat-layout projects. Phase 9 will migrate test helpers and remove the fallback.

### Phase 9: Workflow & Test Cleanup
**Goal**: Zero legacy layout references in workflows; test suite clean and passing
**Depends on**: Phase 8
**Requirements**: STRIP-04, STRIP-05
**Success Criteria** (what must be TRUE):
  1. Zero occurrences of `layout_style` or `LAYOUT` variable in any workflow `.md` file
  2. No `if layout_style` / `if layoutStyle` conditional blocks in workflows
  3. `core.test.cjs` has no `detectLayoutStyle` test cases
  4. `init.test.cjs` has no `layout_style` assertions
  5. Full test suite passes (~316 tests — current 349 minus deleted legacy tests)
**Plans**: TBD

Plans:
- [ ] 09-01: Remove LAYOUT variable and layout conditionals from 7 workflow files (STRIP-04)
- [ ] 09-02: Clean up legacy test cases in core.test.cjs and init.test.cjs, full regression pass (STRIP-05)

### Phase 10: Documentation
**Goal**: README.md exists at repo root and gives a clear picture of what this fork is and what it delivers
**Depends on**: Phase 9
**Requirements**: DOC-01
**Success Criteria** (what must be TRUE):
  1. `README.md` exists at repo root
  2. README covers what the fork adds (quality enforcement, concurrent milestones, tech debt system) without duplicating UPGRADES.md verbatim
  3. A reader unfamiliar with the project can understand the fork's purpose and key features from README alone
  4. README reflects the simplified milestone-only architecture (no references to legacy layout)
**Plans**: TBD

Plans:
- [ ] 10-01: Write README.md condensed from UPGRADES.md (DOC-01)

## Progress

**Execution Order:** 4 → 5 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Bug Fixes | 3/3 | Complete | 2026-02-27 |
| 5. Housekeeping | 1/1 | Complete | 2026-02-27 |
| 7. Delete Legacy Files | 1/1 | Complete | 2026-03-03 |
| 8. Strip Core Legacy | 1/2 | In Progress | - |
| 9. Workflow & Test Cleanup | 0/2 | Not started | - |
| 10. Documentation | 0/1 | Not started | - |
