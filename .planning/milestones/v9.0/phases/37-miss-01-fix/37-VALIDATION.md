---
phase: 37
slug: miss-01-fix
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | none — run directly |
| **Quick run command** | `node --test tests/state.test.cjs` |
| **Full suite command** | `node --test tests/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/state.test.cjs`
- **After every plan wave:** Run `node --test tests/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 37-01-W0 | 01 | 0 | scaffold | structural | `node --test tests/state.test.cjs` | ❌ W0 | ⬜ pending |
| 37-01-01 | 01 | 1 | DEBT-01, DEBT-02 | unit | `node --test tests/state.test.cjs` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | DEBT-03 | integration | `node --test tests/state.test.cjs` | ❌ W0 | ⬜ pending |
| 37-01-03 | 01 | 1 | DEBT-01, DEBT-02, DEBT-03 | integration | `node --test tests/state.test.cjs` | ❌ W0 | ⬜ pending |
| 37-01-04 | 01 | 2 | all | gate | `node --test tests/*.test.cjs` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Add `describe('state update-progress')` block in `tests/state.test.cjs` — stubs for DEBT-01, DEBT-02, DEBT-03

*Existing infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
