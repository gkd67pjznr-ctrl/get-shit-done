---
phase: 30
slug: dashboard-gate-health-page
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/server.test.cjs -x` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/server.test.cjs -x`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | DASH-01 | unit | `npx vitest run tests/gate-health-page.test.cjs -x` | ❌ W0 | ⬜ pending |
| 30-01-02 | 01 | 1 | DASH-02 | unit | `npx vitest run tests/server.test.cjs -t "gate-health" -x` | ❌ W0 | ⬜ pending |
| 30-01-03 | 01 | 1 | DASH-03 | unit | `npx vitest run tests/server.test.cjs -t "quality-level" -x` | ❌ W0 | ⬜ pending |
| 30-01-04 | 01 | 1 | DASH-04 | unit | `npx vitest run tests/server.test.cjs -t "per-gate" -x` | ❌ W0 | ⬜ pending |
| 30-01-05 | 01 | 1 | DASH-05 | unit | `npx vitest run tests/server.test.cjs -t "context7" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/gate-health-page.test.cjs` — stubs for DASH-01 (page renders, navigation accessible)
- [ ] `tests/server.test.cjs` — add `aggregateGateHealth()` test cases for DASH-02 through DASH-05

*Existing infrastructure covers framework and config requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual layout matches design | DASH-01 | CSS/visual rendering | Open dashboard, navigate to Gate Health, verify layout matches section order from CONTEXT.md |
| Stacked bars render proportionally | DASH-02 | Visual proportions | Verify colored segments match expected ratios in test data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
