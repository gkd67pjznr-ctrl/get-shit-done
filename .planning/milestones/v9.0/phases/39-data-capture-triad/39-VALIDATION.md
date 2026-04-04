---
phase: 39
slug: data-capture-triad
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | None — direct invocation |
| **Quick run command** | `node --test tests/benchmark.test.cjs` |
| **Full suite command** | `node --test tests/*.test.cjs` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run relevant test file (`tests/benchmark.test.cjs`, `tests/debt.test.cjs`, or `tests/hooks/refine-skill-history.test.cjs`)
- **After every plan wave:** Run `node --test tests/*.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | SHST-01 | unit | `node --test tests/hooks/refine-skill-history.test.cjs` | No — Wave 0 | pending |
| 39-01-02 | 01 | 1 | SHST-02 | unit | `node --test tests/hooks/refine-skill-history.test.cjs` | No — Wave 0 | pending |
| 39-01-03 | 01 | 1 | SHST-03 | integration | `node --test tests/hooks/refine-skill-history.test.cjs` | No — Wave 0 | pending |
| 39-02-01 | 02 | 1 | BNCH-01 | unit | `node --test tests/benchmark.test.cjs` | No — Wave 0 | pending |
| 39-02-02 | 02 | 1 | BNCH-02 | unit | `node --test tests/benchmark.test.cjs` | No — Wave 0 | pending |
| 39-02-03 | 02 | 1 | BNCH-03 | manual | Read digest.md output | N/A | pending |
| 39-03-01 | 03 | 1 | DIMP-01 | unit | `node --test tests/debt.test.cjs` | Yes — extend | pending |
| 39-03-02 | 03 | 1 | DIMP-02 | unit | `node --test tests/debt.test.cjs` | Yes — extend | pending |
| 39-03-03 | 03 | 1 | DIMP-03 | manual | Run /gsd:fix-debt with debt entries and corrections | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/hooks/refine-skill-history.test.cjs` — stubs for SHST-01, SHST-02, SHST-03
- [ ] `tests/benchmark.test.cjs` — stubs for BNCH-01, BNCH-02
- [ ] `tests/hooks/` directory — ensure it exists
- [ ] `get-shit-done/bin/lib/benchmark.cjs` — new module (BNCH-01/02)

*Existing `tests/debt.test.cjs` covers DIMP-01 and DIMP-02 by extension — new test cases added within existing file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /gsd:digest shows benchmark trends | BNCH-03 | Markdown command output | Run /gsd:digest with >=5 benchmark entries, verify trend section appears |
| /gsd:fix-debt surfaces impact data | DIMP-03 | Markdown command output | Run /gsd:fix-debt with debt entries + corrections, verify ranked impact shown before selection |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
