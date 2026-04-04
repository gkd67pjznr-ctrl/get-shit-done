---
phase: 38
slug: skill-call-tracking
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | `scripts/run-tests.cjs` |
| **Quick run command** | `node --test tests/gate-runner-skills.test.cjs` |
| **Full suite command** | `node scripts/run-tests.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/gate-runner-skills.test.cjs`
- **After every plan wave:** Run `node scripts/run-tests.cjs`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | STRK-01 | manual smoke | `grep skills_loaded .planning/patterns/sessions.jsonl` | N/A | ⬜ pending |
| 38-01-02 | 01 | 1 | STRK-02 | unit | `node --test tests/gate-runner-skills.test.cjs` | ❌ W0 | ⬜ pending |
| 38-01-03 | 01 | 1 | STRK-03 | manual smoke | `grep skills_loaded .planning/patterns/sessions.jsonl \| wc -l` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/gate-runner-skills.test.cjs` — unit test for STRK-02: gate entry includes `skills_active` when `.claude/skills/` exists; returns `[]` when directory missing

*Existing infrastructure covers STRK-01 (workflow markdown — manual smoke test) and STRK-03 (persistence is structural).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workflow observe steps write real skill names to sessions.jsonl | STRK-01 | Observe steps are embedded in workflow markdown, not directly unit-testable | Run any GSD workflow (e.g., `/gsd:plan-phase`), then `grep skills_loaded .planning/patterns/sessions.jsonl` — confirm non-empty arrays |
| Entries accumulate across sessions | STRK-03 | Structural property of append-only JSONL | Run two separate workflow commands, count `skills_loaded` entries — confirm count increases |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
