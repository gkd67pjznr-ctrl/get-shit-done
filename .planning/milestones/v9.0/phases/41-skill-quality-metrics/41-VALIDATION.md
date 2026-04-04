---
phase: 41
slug: skill-quality-metrics
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none — driven by `scripts/run-tests.cjs` |
| **Quick run command** | `node --test tests/skill-metrics.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/skill-metrics.test.cjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-01 | 01 | 0 | SQLQ-01,02,03 | unit | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-02 | 01 | 1 | SQLQ-01 | unit | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-03 | 01 | 1 | SQLQ-02 | unit | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-04 | 01 | 1 | SQLQ-01 | unit | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-05 | 01 | 1 | SQLQ-02 | unit | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-06 | 01 | 2 | SQLQ-03 | integration | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |
| 41-01-07 | 01 | 2 | SQLQ-03 | integration | `node --test tests/skill-metrics.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/skill-metrics.test.cjs` — stubs for SQLQ-01, SQLQ-02, SQLQ-03
- [ ] No framework config needed — existing `scripts/run-tests.cjs` auto-discovers `*.test.cjs`

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
