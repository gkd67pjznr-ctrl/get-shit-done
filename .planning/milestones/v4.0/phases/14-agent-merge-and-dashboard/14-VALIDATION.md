---
phase: 14
slug: agent-merge-and-dashboard
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-08
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | `scripts/run-tests.cjs` |
| **Quick run command** | `node --test tests/agent-merge.test.cjs tests/dashboard-integration.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/agent-merge.test.cjs tests/dashboard-integration.test.cjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | AGNT-01 | unit | `node --test tests/agent-merge.test.cjs` | Yes | ✅ green |
| 14-01-02 | 01 | 1 | AGNT-02 | unit | `node --test tests/agent-merge.test.cjs` | Yes | ✅ green |
| 14-01-03 | 01 | 1 | AGNT-03 | unit | `node --test tests/agent-merge.test.cjs` | Yes | ✅ green |
| 14-02-01 | 02 | 2 | DASH-01 | unit | `node --test tests/dashboard-integration.test.cjs` | Yes | ✅ green |
| 14-02-02 | 02 | 2 | DASH-02 | unit | `node --test tests/dashboard-integration.test.cjs` | Yes | ✅ green |
| 14-02-03 | 02 | 2 | DASH-03 | integration | `node --test tests/dashboard-integration.test.cjs` | Yes | ✅ green |
| 14-02-04 | 02 | 2 | DASH-04 | integration | `node --test tests/dashboard-integration.test.cjs` | Yes | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/agent-merge.test.cjs` — stubs for AGNT-01, AGNT-02, AGNT-03
- [x] `tests/dashboard-integration.test.cjs` — stubs for DASH-01, DASH-02, DASH-03, DASH-04

*Existing test infrastructure covers framework needs — no new framework install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard visual output | DASH-04 | CLI visual output | Run `/gsd:dashboard generate`, verify markdown output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
