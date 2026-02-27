# Requirements: GSD Enhanced Fork — v3.1

**Defined:** 2026-02-27
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v3.1 Requirements

Requirements for tech debt cleanup and documentation. Each maps to roadmap phases.

### Bug Fixes

- [ ] **FIX-01**: `cmdMilestoneComplete` uses `planningRoot()` for phasesDir instead of hardcoded `.planning/phases/`
- [ ] **FIX-02**: `execute-plan.md` passes `--milestone` flag to `roadmap update-plan-progress`
- [ ] **FIX-03**: DEBT.md auto-created during project initialization (not just on first `debt log`)
- [ ] **FIX-04**: `migrate --apply` creates DEBT.md for existing projects that lack it
- [ ] **FIX-05**: TO-DOS.md in `.planning/` root doesn't capture todos meant for the todos folder

### CLI

- [x] **CLI-01**: CLI `--help` output lists all commands including `migrate`, `debt`, and `milestone`

### Maintenance

- [ ] **MAINT-01**: Agent files (`gsd-executor.md`, `gsd-verifier.md`) tracked in git repo
- [ ] **MAINT-02**: `fix-debt.md` has single authoritative copy (eliminate dual-file divergence)

### Documentation

- [ ] **DOC-01**: README.md exists at repo root summarizing the fork (condensed from UPGRADES.md)

## Future Requirements

None — this is a cleanup milestone.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Agent Teams (intra-milestone parallelism) | Deferred to v2.1+, different scope |
| USER-GUIDE.md full command reference | Separate documentation milestone |
| Rewriting GSD core workflow | This fork is additive upgrades only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 4 | Pending |
| FIX-02 | Phase 4 | Pending |
| FIX-03 | Phase 4 | Pending |
| FIX-04 | Phase 4 | Pending |
| FIX-05 | Phase 4 | Pending |
| CLI-01 | Phase 4 | Complete |
| MAINT-01 | Phase 5 | Pending |
| MAINT-02 | Phase 5 | Pending |
| DOC-01 | Phase 6 | Pending |

**Coverage:**
- v3.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — traceability populated after roadmap creation*
