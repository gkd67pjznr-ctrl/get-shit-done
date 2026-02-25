# Roadmap: GSD Enhanced Fork — v3.0 Tech Debt System

**Milestone:** v3.0 Tech Debt System
**Goal:** Build infrastructure for systematic tech debt tracking and resolution, plus a project migration tool for existing `.planning/` folders.
**Phases:** 15–19 (5 phases)
**Requirements:** 15 v3.0 requirements across 5 categories
**Depth:** Quick (per config.json)

---

## Phases

- [ ] **Phase 15: Integration Fixes** - Fix milestone-scoped path resolution bugs in `cmdInitPlanPhase` and roadmap commands before any v3.0 feature is built
- [ ] **Phase 16: Core Debt Module** - DEBT.md schema, `debt.cjs` module with log/list/resolve CLI commands, concurrent-safe writes
- [ ] **Phase 17: Migration Tool** - `migrate.cjs` with dry-run default, additive-only apply, and undo manifest
- [ ] **Phase 18: Agent Wiring** - Executor, verifier, and debugger auto-log discovered debt with quality-level gating
- [ ] **Phase 19: /gsd:fix-debt Skill** - On-demand orchestrator skill that routes debt entries through diagnosis and fix execution

---

## Phase Details

### Phase 15: Integration Fixes
**Goal**: Milestone-scoped path resolution works correctly in plan-phase initialization and roadmap commands — correctness prerequisite for all v3.0 features that write files to milestone workspaces
**Depends on**: Phase 14 (v2.0 complete)
**Requirements**: INTG-01, INTG-02
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:plan-phase --milestone v3.0` creates plan files inside `.planning/milestones/v3.0/phases/` not `.planning/phases/`
  2. Running `gsd-tools roadmap get-phase --milestone v3.0` reads from `.planning/milestones/v3.0/ROADMAP.md` not the root ROADMAP.md
  3. Running `gsd-tools roadmap analyze --milestone v3.0` returns phase data from the milestone-scoped roadmap
  4. All existing tests continue to pass — fixes are surgical and additive with no behavioral change for legacy projects
**Plans**: TBD

### Phase 16: Core Debt Module
**Goal**: DEBT.md exists as a structured hub that agents and users can read and write via CLI — the write and read APIs that all subsequent debt features depend on are tested and stable
**Depends on**: Phase 15
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. DEBT.md exists in the milestone workspace with `## Open` and `## Resolved` anchor sections and `### DEBT-NNN` entry headers containing all 10 structured fields
  2. Running `gsd-tools debt log --milestone v3.0 --type shortcut --severity high --component "lib/debt.cjs" --description "..."` appends a new entry with an auto-assigned TD-NNN ID and returns the ID
  3. Two concurrent `debt log` calls do not produce a race condition — both entries appear in DEBT.md with no data loss
  4. Running `gsd-tools debt list --status open --severity high` returns JSON-formatted entries matching the filter criteria
  5. Running `gsd-tools debt resolve TD-001 --status resolved` moves the entry from `## Open` to `## Resolved` atomically
**Plans**: TBD

### Phase 17: Migration Tool
**Goal**: An existing `.planning/` folder can be inspected and upgraded to current spec without destructive changes — dry-run reveals what would change, apply performs the moves with a rollback manifest
**Depends on**: Phase 15
**Requirements**: MIGR-01, MIGR-02, MIGR-03
**Success Criteria** (what must be TRUE):
  1. Running `gsd-tools migrate --dry-run` on a legacy project prints a summary of structural differences and files that would be moved without touching any files
  2. Running `gsd-tools migrate --apply` performs all moves, writes an `undo-manifest.json` before the first file is touched, and leaves the project in a valid state
  3. Running `gsd-tools migrate --apply` a second time on an already-migrated project produces no changes and exits cleanly — idempotent behavior
  4. Running `gsd-tools migrate --undo` using the undo manifest reverses all moves and restores the original layout
**Plans**: TBD

### Phase 18: Agent Wiring
**Goal**: Debt logging becomes automatic — executor, verifier, and debugger agents log discovered issues to DEBT.md without manual intervention, gated on quality level so fast mode generates zero overhead
**Depends on**: Phase 16
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04
**Success Criteria** (what must be TRUE):
  1. When an executor's Quality Sentinel finds a code quality issue it cannot resolve within the current plan, the issue appears as a new entry in DEBT.md after the plan completes
  2. When a verifier discovers an unresolved quality dimension finding, the finding is logged to DEBT.md with the source phase and plan in the provenance fields
  3. Running in `fast` quality mode produces zero `debt log` calls — no DEBT.md writes occur and plan execution is unaffected
  4. Running in `standard` mode logs only critical and high severity findings; `strict` mode logs all severities
  5. Every auto-logged entry includes `source_phase` and `source_plan` fields populated from the execution context
**Plans**: TBD

### Phase 19: /gsd:fix-debt Skill
**Goal**: A user can invoke `/gsd:fix-debt` to resolve a debt entry end-to-end — the skill routes undiagnosed entries through the debugger, diagnosed entries through plan execution, and marks the entry resolved on completion
**Depends on**: Phase 16, Phase 18
**Requirements**: FIXD-01, FIXD-02
**Success Criteria** (what must be TRUE):
  1. Running `/gsd:fix-debt` without arguments presents the current `## Open` entries from DEBT.md and prompts the user to select one by ID
  2. Selecting a `status: open` entry routes through `gsd-debugger` for root-cause diagnosis before any code change is attempted
  3. A `status: diagnosed` entry bypasses re-diagnosis and proceeds directly to `plan-phase --gaps` for fix execution
  4. After successful fix execution and verification, the entry's status in DEBT.md changes to `resolved` with a resolution date
  5. Attempting to invoke `/gsd:fix-debt` while another plan is actively executing triggers a warning based on STATE.md status check rather than silently proceeding
**Plans**: TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 15. Integration Fixes | v3.0 | 0/? | Not started | - |
| 16. Core Debt Module | v3.0 | 0/? | Not started | - |
| 17. Migration Tool | v3.0 | 0/? | Not started | - |
| 18. Agent Wiring | v3.0 | 0/? | Not started | - |
| 19. /gsd:fix-debt Skill | v3.0 | 0/? | Not started | - |

---

*Created: 2026-02-25*
*Milestone: v3.0 Tech Debt System*
