# Roadmap: v1.1 Quality UX

**Milestone Goal:** Make quality enforcement discoverable, configurable, and observable — users know what mode they're in, can switch easily, and can see what the quality gates are doing.

## Phases

- [x] **Phase 5: Config Foundation** - Config migration, global defaults, validation, and token cap — the plumbing everything else depends on (completed 2026-02-24)
- [x] **Phase 6: Commands and UX** - User-facing set-quality command, global flag, progress display, and help reminder (completed 2026-02-24)
- [x] **Phase 7: Quality Observability** - SUMMARY.md quality gates section showing what checks ran and their outcomes (completed 2026-02-24)

### Phase 5: Config Foundation

**Goal:** Quality config is reliably present, validated, and inheritable — any command that touches config either finds the quality block or creates it with sane defaults, warns loudly on missing sections, and respects a configurable Context7 token cap.

**Requirements:** QCFG-02, QCFG-03, QOBS-03, INFR-01

**Plans:** 2/2 plans complete

Plans:
- [x] 05-01-PLAN.md — Config auto-migration, global defaults bootstrap, missing-section warnings (TDD)
- [x] 05-02-PLAN.md — Context7 configurable token cap in executor agent (TDD)

### Phase 6: Commands and UX

**Goal:** Users can set quality level via a dedicated command (per-project or globally), and can see the current quality level when checking progress.

**Requirements:** QCFG-01, QCFG-04, QOBS-02, INFR-02

**Plans:** 2/2 plans complete

Plans:
- [x] 06-01-PLAN.md — TDD backend: set-quality CLI, check-patches, progress quality-level
- [x] 06-02-PLAN.md — UX layer: set-quality command/workflow, help patches reminder, progress display

### Phase 7: Quality Observability

**Goal:** Execution summaries surface what quality gates ran and what they found, so users can see the quality enforcement loop in action.

**Requirements:** QOBS-01

**Plans:** 1/1 plans complete

Plans:
- [x] 07-01-PLAN.md — Quality gate outcome tracking in executor and summary templates

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Config Foundation | 2/2 | Complete | 2026-02-24 |
| 6. Commands and UX | 2/2 | Complete | 2026-02-24 |
| 7. Quality Observability | 1/1 | Complete | 2026-02-24 |

---
