---
phase: 40
slug: session-report
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node --test) |
| **Config file** | none — uses existing test infrastructure |
| **Quick run command** | `node --test tests/session-report.test.cjs` |
| **Full suite command** | `node --test tests/session-report.test.cjs` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/session-report.test.cjs`
- **After every plan wave:** Run `node --test tests/session-report.test.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | SRPT-01 | unit | `node --test tests/session-report.test.cjs` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | SRPT-02 | unit | `node --test tests/session-report.test.cjs` | ❌ W0 | ⬜ pending |
| 40-01-03 | 01 | 1 | SRPT-03 | unit | `node --test tests/session-report.test.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/session-report.test.cjs` — stubs for SRPT-01, SRPT-02, SRPT-03
- [ ] Test helpers for creating temp JSONL fixtures (sessions.jsonl, gate-executions.jsonl, phase-benchmarks.jsonl)

*Existing test infrastructure (tests/helpers.cjs with createTempProject) covers shared fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| /gsd:session-report renders formatted output | SRPT-01 | Slash command rendering depends on Claude Code UI | Run `/gsd:session-report --last 3` and verify table formatting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
