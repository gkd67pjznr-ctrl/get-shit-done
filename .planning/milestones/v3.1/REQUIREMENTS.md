# Requirements: GSD Enhanced Fork — v3.1

**Defined:** 2026-02-27
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v3.1 Requirements

Requirements for tech debt cleanup and documentation. Each maps to roadmap phases.

### Bug Fixes

- [x] **FIX-01**: `cmdMilestoneComplete` uses `planningRoot()` for phasesDir instead of hardcoded `.planning/phases/`
- [x] **FIX-02**: `execute-plan.md` passes `--milestone` flag to `roadmap update-plan-progress`
- [x] **FIX-03**: DEBT.md auto-created during project initialization (not just on first `debt log`)
- [x] **FIX-04**: `migrate --apply` creates DEBT.md for existing projects that lack it
- [x] **FIX-05**: TO-DOS.md in `.planning/` root doesn't capture todos meant for the todos folder

### CLI

- [x] **CLI-01**: CLI `--help` output lists all commands including `migrate`, `debt`, and `milestone`

### Maintenance

- [x] **MAINT-01**: Agent files (`gsd-executor.md`, `gsd-verifier.md`) tracked in git repo
- [x] **MAINT-02**: `fix-debt.md` has single authoritative copy (eliminate dual-file divergence)

### Documentation

- [ ] **DOC-01**: README.md exists at repo root summarizing the fork (condensed from UPGRADES.md)

### Legacy Strip

- [x] **STRIP-01**: `migrate.cjs` deleted entirely, `migrate` CLI command removed from `gsd-tools.cjs`
- [ ] **STRIP-02**: `detectLayoutStyle()` deleted from `core.cjs`, no code anywhere checks or branches on layout style
- [ ] **STRIP-03**: `planningRoot()` always resolves to milestone path — no legacy fallback branch in `findPhaseInternal`
- [ ] **STRIP-04**: Zero occurrences of `layout_style` / `LAYOUT` variable in workflow `.md` files
- [ ] **STRIP-05**: All tests pass after strip (~316 from current 349; delta = deleted legacy-only test files)

## Future Requirements

None — this is a cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent Teams (intra-milestone parallelism) | Deferred to v2.1+, different scope |
| USER-GUIDE.md full command reference | Separate documentation milestone |
| Ground-up GSD rebuild (Path B) | Feasibility analysis (quick-13) showed Path A (surgical strip) is sufficient |
| Upstream GSD PR (Path C) | Upstream acceptance uncertain; strip is fork-local |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 4 | Complete |
| FIX-02 | Phase 4 | Complete |
| FIX-03 | Phase 4 | Complete |
| FIX-04 | Phase 4 | Complete |
| FIX-05 | Phase 4 | Complete |
| CLI-01 | Phase 4 | Complete |
| MAINT-01 | Phase 5 | Complete |
| MAINT-02 | Phase 5 | Complete |
| STRIP-01 | Phase 7 | Complete |
| STRIP-02 | Phase 8 | Pending |
| STRIP-03 | Phase 8 | Pending |
| STRIP-04 | Phase 9 | Pending |
| STRIP-05 | Phase 9 | Pending |
| DOC-01 | Phase 10 | Pending |

**Coverage:**
- v3.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-03-03 — STRIP-01 marked complete (07-01 executed)*
