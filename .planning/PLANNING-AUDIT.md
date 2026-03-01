# .planning/ Directory Audit

**Audited:** 2026-02-25
**Trigger:** Manual inspection after Phase 16 execution
**Scope:** All files in `.planning/` tree — orphaned, stale, misplaced, and missing files + systemic GSD flow flaws

---

## 1. ORPHANED / MISPLACED FILES

### v2.0 Milestone Structure Split Across Three Locations

| File | Current Location | Expected Location |
|------|-----------------|-------------------|
| `v2.0-MILESTONE-AUDIT.md` | `.planning/milestones/` root | `.planning/milestones/v2.0/MILESTONE-AUDIT.md` |
| `v2.0-REQUIREMENTS.md` | `.planning/milestones/` root | `.planning/milestones/v2.0/REQUIREMENTS.md` |
| `v2.0-ROADMAP.md` | `.planning/milestones/` root | `.planning/milestones/v2.0/ROADMAP.md` (duplicate) |
| `v2.0-phases/` (7 phase dirs) | `.planning/milestones/v2.0-phases/` | `.planning/milestones/v2.0/phases/` |

The `milestones/v2.0/` directory exists but contains only a single `ROADMAP.md` — an identical stale copy. The actual phase directories live at `milestones/v2.0-phases/` with a dash-prefix naming convention that no GSD workflow produces. This is a manual or early-iteration artifact that was never normalized.

### v-test Milestone — Test Artifact Never Cleaned Up

`milestones/v-test/` contains skeleton files from milestone workspace development testing:
- STATE.md (5 lines, "Initializing")
- REQUIREMENTS.md (2 lines, empty)
- ROADMAP.md (2 lines, empty)
- conflict.json
- Empty `phases/` and `research/` dirs

Should be deleted entirely.

### v3.0 Milestone Workspace — Created But Never Used

`milestones/v3.0/` was scaffolded by `new-milestone` but all v3.0 work happens at root `.planning/` because `layout_style` returns `"legacy"`. The workspace has:
- `STATE.md` — stale (says "Phase 15, Ready to plan" — we're Phase 16 complete)
- `ROADMAP.md` — stale (all 5 phases show "Not started")
- Empty `phases/` and `research/` dirs

### Root-Level research/ — v3.0 Research in Legacy Location

`.planning/research/` contains v3.0 research (ARCHITECTURE.md, FEATURES.md, PITFALLS.md, STACK.md, SUMMARY.md) at root instead of `milestones/v3.0/research/` because the project runs in legacy mode. Not wrong per se, but contradicts the v3.0 workspace that was created to house them.

### 03-CONTEXT.md — Non-Standard Naming

`milestones/v1.0/phases/03-quality-dimensions/03-CONTEXT.md` — Every other phase uses `{NN}-RESEARCH.md`. This was created before the naming convention solidified.

---

## 2. STALE FILES (Right Place, Never Updated)

### TO-DOS.md — Write-Only, Never Resolved

Still shows INTEGRATION-3 and INTEGRATION-4 as open items with full descriptions. Both were resolved by Phase 15 Plan 01. STATE.md notes they're "RESOLVED" but TO-DOS.md was never touched.

### v2.0 MILESTONE-AUDIT.md — Gaps Never Closed

Frontmatter says `status: gaps_found` with INTEGRATION-3/4 as open high-severity gaps. Phase 15 resolved both. Audit was never updated to `status: resolved`.

### All Milestone-Scoped ROADMAPs — Frozen at Creation Time

Every milestone ROADMAP is frozen in its initial planning state:

- **v1.0 ROADMAP:** Phase 3 plans `03-01`, `03-02` unchecked. Phase 4 plan `04-01` unchecked. Phase-level checkboxes correct but plan-level never updated.
- **v1.1 ROADMAP:** Phase 7 shows "Not started, 0/1" but was completed. Phases 5-6 progress table has broken column alignment.
- **v2.0 ROADMAP (both copies):** All phases show "Not started, 0/?" despite all being complete.
- **v3.0 ROADMAP:** All phases "Not started" despite 15-16 being complete.

### Root ROADMAP.md — Plan Checkboxes Stale

Phase-level `[x]` checkboxes are correct but plan-level checkboxes are never updated:
- `- [ ] 15-01-PLAN.md` (actually complete)
- `- [ ] 16-01-PLAN.md` (actually complete)
- Same pattern for all v2.0 plans in the root ROADMAP

### v3.0 Milestone STATE.md — Contradictory Design Decision

Contains: "DEBT.md is milestone-local, not project-global."
Actual implementation and root STATE.md both say the opposite: "DEBT.md is project-level at `.planning/DEBT.md` (NOT milestone-scoped)."

### v1.1 ROADMAP — Emoji Formatting Drift

Uses emoji formatting (checkmark emoji, construction emoji) that was abandoned in later milestones. Minor but shows formatting was never normalized.

---

## 3. MISSING FILES

| What's Missing | Expected Location | Impact |
|----------------|-------------------|--------|
| `MILESTONE-AUDIT.md` for v1.1 | `milestones/v1.1/` | v1.0 and v2.0 both have audits. v1.1 shipped without one. |
| `MILESTONE-AUDIT.md` inside v2.0 dir | `milestones/v2.0/` | Audit exists but at wrong path (`v2.0-MILESTONE-AUDIT.md` at milestones root) |
| v3.0 entry in `MILESTONES.md` | root `.planning/MILESTONES.md` | v1.0, v1.1, v2.0 all documented. v3.0 in-progress has no tracking entry. |
| v1.0 entry in `RETROSPECTIVE.md` | root `.planning/RETROSPECTIVE.md` | Retro covers v1.1 and v2.0 but skips v1.0 entirely. |
| Phase 05 `RESEARCH.md` | `milestones/v1.1/phases/05-config-foundation/` | Phases 1-4 and 6-16 all have RESEARCH.md. Phase 5 doesn't. |

---

## 4. GSD FLOW FLAWS (Systemic)

These are not one-off mistakes — they're gaps in the GSD workflow definitions.

### FLAW 1: Plan-level checkboxes are never updated

**Where:** `gsd-tools.cjs` `phase complete` command (and `roadmap update-plan-progress`)
**What happens:** Phase-level `[x]` checkboxes and progress table rows are updated, but plan-level checkboxes within phase detail sections stay `[ ]` forever.
**Scope:** Every plan checkbox in every ROADMAP across all milestones is `[ ]` regardless of completion status.
**Root cause:** No CLI command or workflow step targets plan-level checkboxes. `roadmap update-plan-progress` likely updates the "Plans: X/Y plans complete" text but not the individual `- [ ]` lines.

### FLAW 2: Milestone-scoped ROADMAPs are write-once, never maintained

**Where:** `new-milestone` workflow creates milestone ROADMAP; no subsequent workflow updates it.
**What happens:** `plan-phase`, `execute-phase`, and `phase complete` only update the root ROADMAP.md. The milestone workspace copy is never touched again.
**Root cause:** All roadmap update commands (`phase complete`, `roadmap update-plan-progress`) operate on the root ROADMAP.md resolved by `planningRoot()`. In legacy mode, that's `.planning/ROADMAP.md`. In milestone-scoped mode, it should be the milestone ROADMAP — but even then, the duplicate at root was never addressed.

### FLAW 3: `complete-milestone` doesn't finalize milestone workspace files

**Where:** `complete-milestone` workflow
**What happens:** Updates MILESTONES.md and root ROADMAP but leaves the milestone workspace's own ROADMAP, STATE, etc. frozen in their initial creation state.
**Root cause:** Archive operation copies/moves files without first updating them to reflect final status.

### FLAW 4: TO-DOS.md is write-only — no workflow resolves items

**Where:** No workflow references TO-DOS.md for updates
**What happens:** Todos are created manually and referenced in STATE.md, but no workflow step marks them resolved when the referenced work is done.
**Root cause:** `close_parent_artifacts` in execute-phase handles UAT/debug artifacts for decimal phases, but there's no equivalent for TO-DOS.md. No executor or orchestrator step reads/writes TO-DOS.md.

### FLAW 5: Cross-milestone gap closure doesn't update source audit

**Where:** execute-phase `close_parent_artifacts` step
**What happens:** v2.0 MILESTONE-AUDIT found INTEGRATION-3/4. These were deferred to v3.0 Phase 15, which resolved them. But no workflow step went back to update the v2.0 audit.
**Root cause:** `close_parent_artifacts` only handles decimal/polish phases within the same phase numbering scheme, not cross-milestone gap closures.

### FLAW 6: Milestone workspace creation without subsequent use

**Where:** `new-milestone` → v3.0 workspace creation
**What happens:** `new-milestone` created `milestones/v3.0/` but the project's `layout_style` is `"legacy"`. All v3.0 work happens at root `.planning/`. The workspace sits empty.
**Root cause:** `new-milestone` always creates a workspace, but `detectLayoutStyle()` returns `legacy` for this project because `concurrent: true` was never set in config.json. The two operations are decoupled — workspace creation doesn't trigger the mode switch.

### FLAW 7: Milestone workspace STATE.md diverges from root STATE.md

**Where:** v3.0 milestone STATE.md
**What happens:** Contains "DEBT.md is milestone-local" but actual implementation says "DEBT.md is project-level." The milestone STATE.md was populated during new-milestone from research findings, but the design decision changed during Phase 16 planning. No workflow reconciles the two.
**Root cause:** STATE.md updates only happen to the file resolved by `planningRoot()`. If a stale copy exists elsewhere (milestone workspace), nothing updates it.

---

## 5. ROOT CAUSE ANALYSIS

The majority of issues trace to one pattern:

> **GSD workflows maintain the "active" tracking files resolved by `planningRoot()` but don't maintain historical copies, cross-cutting artifacts, or milestone workspace duplicates.**

Specifically:
1. **Forward-only updates:** Workflows create files and move forward but never go back to update related artifacts when status changes.
2. **Single-source assumption:** `planningRoot()` resolves ONE path. If files exist at other paths (milestone workspaces, audit files, TO-DOS), they rot.
3. **No cleanup step:** `complete-milestone` archives but doesn't finalize. `new-milestone` scaffolds but doesn't verify the project will actually use the workspace.

---

## 6. RECOMMENDED ACTIONS

### Immediate Cleanup (Manual)

1. Delete `milestones/v-test/` entirely
2. Move `v2.0-MILESTONE-AUDIT.md`, `v2.0-REQUIREMENTS.md` into `milestones/v2.0/`
3. Move `v2.0-phases/` contents into `milestones/v2.0/phases/`
4. Delete the duplicate `v2.0-ROADMAP.md` at milestones root
5. Delete the stale `milestones/v3.0/` workspace (or populate it correctly)
6. Update `v2.0-MILESTONE-AUDIT.md` status to `resolved` for INTEGRATION-3/4
7. Mark TO-DOS.md items as resolved
8. Rename `03-CONTEXT.md` to `03-RESEARCH-CONTEXT.md` or leave as historical

### Flow Fixes (Code Changes)

1. **`roadmap update-plan-progress` or `phase complete`:** Also update plan-level `- [ ]` → `- [x]` checkboxes
2. **`complete-milestone`:** Before archiving, update the milestone workspace ROADMAP progress table and checkboxes to final state
3. **`execute-phase` / `phase complete`:** If TO-DOS.md references exist in STATE.md for resolved items, mark them resolved
4. **`new-milestone`:** Verify `layout_style` will actually be `milestone-scoped` before creating workspace, or set `concurrent: true` in config.json
5. **Cross-milestone gap closure:** When a phase resolves audit gaps from a previous milestone, update the source MILESTONE-AUDIT.md

---

*Audited: 2026-02-25*
*Auditor: Claude (manual inspection)*
