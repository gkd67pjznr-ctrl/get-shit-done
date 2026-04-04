---
phase: 42
slug: skill-relevance-scoring
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (`node --test`) |
| **Config file** | none — driven by `scripts/run-tests.cjs` |
| **Quick run command** | `node --test tests/skill-scorer.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/skill-scorer.test.cjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 0 | SREL-01..04 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-02 | 01 | 1 | SREL-01 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-03 | 01 | 1 | SREL-01 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-04 | 01 | 1 | SREL-02 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-05 | 01 | 1 | SREL-03 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-06 | 01 | 1 | SREL-04 | unit | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-07 | 01 | 2 | SREL-01 | integration | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |
| 42-01-08 | 01 | 2 | SREL-01..04 | integration | `node --test tests/skill-scorer.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/skill-scorer.test.cjs` — stubs for SREL-01, SREL-02, SREL-03, SREL-04
- [ ] No framework config needed — existing `scripts/run-tests.cjs` auto-discovers `*.test.cjs`

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ranked list used by skill-integration loading protocol | SREL-01 | Integration with Claude session startup | Verify `loading-protocol.md` references `skill-score` output; run `/gsd:resume-work` and confirm skill ordering |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
