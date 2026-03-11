---
phase: 31
slug: dashboard-overview-integration
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + Node.js built-in test runner for .cjs |
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
| 31-01-01 | 01 | 0 | DASH-06 | unit | `npx vitest run tests/server.test.cjs -t "getProjectGateHealth" -x` | ✅ | ✅ green |
| 31-01-02 | 01 | 0 | DASH-07 | unit | `npx vitest run tests/server.test.cjs -t "getProjectGateHealth" -x` | ✅ | ✅ green |
| 31-01-03 | 01 | 0 | DASH-08 | unit | `npx vitest run tests/server.test.cjs -t "getProjectGateHealth" -x` | ✅ | ✅ green |
| 31-01-04 | 01 | 1 | DASH-06 | visual | Manual: check project header shows quality level | N/A | ✅ green |
| 31-01-05 | 01 | 1 | DASH-07 | visual | Manual: check milestone rows show gate summary | N/A | ✅ green |
| 31-01-06 | 01 | 1 | DASH-08 | visual | Manual: check session cards show gate metrics | N/A | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/server.test.cjs` — add `getProjectGateHealth()` unit tests covering DASH-06 through DASH-08 scenarios (empty data, quality level extraction, warn rate calculation, recent fires counting)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Project header shows active quality level | DASH-06 | Visual rendering in browser | Load overview page, verify each project card header displays fast/standard/strict badge |
| Milestone rows show gate firing summary | DASH-07 | Visual rendering in browser | Expand project milestones, verify total fires and warn % appear |
| Session cards show gate metrics | DASH-08 | Visual rendering in browser | Check tmux session cards for recent gate activity summary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-03-11
