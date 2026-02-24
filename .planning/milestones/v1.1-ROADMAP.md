# Roadmap: GSD Enhanced Fork

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-02-24)
- 🚧 **v1.1 Quality UX** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-02-24</summary>

- [x] Phase 1: Foundation (2/2 plans) — completed 2026-02-23
- [x] Phase 2: Executor Sentinel (3/3 plans) — completed 2026-02-23
- [x] Phase 3: Quality Dimensions (2/2 plans) — completed 2026-02-23
- [x] Phase 4: Wire Quality Scan Handoff (1/1 plan) — completed 2026-02-24

</details>

### 🚧 v1.1 Quality UX (In Progress)

**Milestone Goal:** Make quality enforcement discoverable, configurable, and observable — users know what mode they're in, can switch easily, and can see what the quality gates are doing.

- [x] **Phase 5: Config Foundation** - Config migration, global defaults, validation, and token cap — the plumbing everything else depends on (completed 2026-02-24)
- [x] **Phase 6: Commands and UX** - User-facing set-quality command, global flag, progress display, and help reminder (completed 2026-02-24)
- [ ] **Phase 7: Quality Observability** - SUMMARY.md quality gates section showing what checks ran and their outcomes

## Phase Details

### Phase 5: Config Foundation
**Goal**: Quality config is reliably present, validated, and inheritable — any command that touches config either finds the quality block or creates it with sane defaults, warns loudly on missing sections, and respects a configurable Context7 token cap
**Depends on**: Phase 4
**Requirements**: QCFG-02, QCFG-03, QOBS-03, INFR-01
**Success Criteria** (what must be TRUE):
  1. Running any GSD command on a project missing the `quality` config block automatically adds it with default values (no silent failure, no crash)
  2. `~/.gsd/defaults.json` exists after first GSD usage and new projects inherit quality level from it during config initialization
  3. When required config sections are absent, the user sees a warning identifying the missing section rather than a silent fallback
  4. `quality.context7_token_cap` is read from config and applied to Context7 queries; changing the value changes behavior without code edits
**Plans**: 2 plans
Plans:
- [ ] 05-01-PLAN.md — Config auto-migration, global defaults bootstrap, missing-section warnings (TDD)
- [ ] 05-02-PLAN.md — Context7 configurable token cap in executor agent (TDD)

### Phase 6: Commands and UX
**Goal**: Users can set quality level via a dedicated command (per-project or globally), and can see the current quality level when checking progress
**Depends on**: Phase 5
**Requirements**: QCFG-01, QCFG-04, QOBS-02, INFR-02
**Success Criteria** (what must be TRUE):
  1. User runs `/gsd:set-quality strict` (or fast/standard) and the project's quality.level updates immediately; subsequent commands enforce the new level
  2. User runs `/gsd:set-quality --global standard` and `~/.gsd/defaults.json` is updated; new projects initialized after this inherit the global level
  3. `/gsd:progress` output includes the current quality level so users know what mode they are in without inspecting config files
  4. `/gsd:help` output shows a `/gsd:reapply-patches` reminder at the top when patches exist that need reapplying after a framework update
**Plans**: 2 plans
Plans:
- [ ] 06-01-PLAN.md — TDD backend: set-quality CLI, check-patches, progress quality-level
- [ ] 06-02-PLAN.md — UX layer: set-quality command/workflow, help patches reminder, progress display

### Phase 7: Quality Observability
**Goal**: Execution summaries surface what quality gates ran and what they found, so users can see the quality enforcement loop in action
**Depends on**: Phase 6
**Requirements**: QOBS-01
**Success Criteria** (what must be TRUE):
  1. SUMMARY.md written after plan execution includes a "Quality Gates" section listing which sentinel steps ran (pre-task scan, library lookup, test step, diff review) and their outcomes (passed, warned, skipped)
  2. The Quality Gates section is absent (not present as empty) when quality.level is fast, since fast mode skips all gates
  3. In strict mode, any gate that blocked execution is identified in the section so the user understands why a plan stopped
**Plans**: 1 plan
Plans:
- [ ] 07-01-PLAN.md — Quality gate outcome tracking in executor and summary templates

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 2/2 | Complete | 2026-02-23 |
| 2. Executor Sentinel | v1.0 | 3/3 | Complete | 2026-02-23 |
| 3. Quality Dimensions | v1.0 | 2/2 | Complete | 2026-02-23 |
| 4. Wire Quality Scan Handoff | v1.0 | 1/1 | Complete | 2026-02-24 |
| 5. Config Foundation | 2/2 | Complete   | 2026-02-24 | - |
| 6. Commands and UX | 2/2 | Complete   | 2026-02-24 | - |
| 7. Quality Observability | v1.1 | 0/1 | Not started | - |
