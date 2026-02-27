# Roadmap: GSD Enhanced Fork — Milestone v3.1

## Overview

Tech debt cleanup and documentation for the v3.0 tech debt system. Three phases: fix known behavioral bugs and CLI gaps, resolve file housekeeping issues, then ship the README. All nine requirements are addressed. Phase numbering continues from v3.0 (ended at 3.5).

## Phases

- [ ] **Phase 4: Bug Fixes** - Fix all behavioral bugs and CLI help gaps from v3.0
- [ ] **Phase 5: Housekeeping** - Resolve file structure and git tracking issues
- [ ] **Phase 6: Documentation** - Create README.md summarizing the fork

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
- [ ] 04-01-PLAN.md — Fix cmdMilestoneComplete phasesDir and execute-plan.md --milestone pass-through (FIX-01, FIX-02)
- [ ] 04-02-PLAN.md — Fix DEBT.md initialization paths and TO-DOS.md placement (FIX-03, FIX-04, FIX-05)
- [ ] 04-03-PLAN.md — Complete CLI --help text for all commands (CLI-01)

### Phase 5: Housekeeping
**Goal**: Agent files are tracked in git and fix-debt.md has a single authoritative source
**Depends on**: Phase 4
**Requirements**: MAINT-01, MAINT-02
**Success Criteria** (what must be TRUE):
  1. `git ls-files` shows `gsd-executor.md` and `gsd-verifier.md` tracked in the repository
  2. There is exactly one copy of `fix-debt.md`; no divergence between installed and repo copies
**Plans**: TBD

Plans:
- [ ] 05-01: Track agent files in git and consolidate fix-debt.md (MAINT-01, MAINT-02)

### Phase 6: Documentation
**Goal**: README.md exists at repo root and gives a clear picture of what this fork is and what it delivers
**Depends on**: Phase 5
**Requirements**: DOC-01
**Success Criteria** (what must be TRUE):
  1. `README.md` exists at repo root
  2. README covers what the fork adds (quality enforcement, concurrent milestones, tech debt system) without duplicating UPGRADES.md verbatim
  3. A reader unfamiliar with the project can understand the fork's purpose and key features from README alone
**Plans**: TBD

Plans:
- [ ] 06-01: Write README.md condensed from UPGRADES.md (DOC-01)

## Progress

**Execution Order:** 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 4. Bug Fixes | 1/3 | In Progress|  |
| 5. Housekeeping | 0/1 | Not started | - |
| 6. Documentation | 0/1 | Not started | - |
