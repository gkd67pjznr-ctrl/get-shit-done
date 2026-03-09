---
phase: 16
slug: commands-and-deprecation
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-09
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner |
| **Config file** | none |
| **Quick run command** | `node --test tests/commands-deprecation.test.cjs` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/commands-deprecation.test.cjs`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CMD-01, CMD-02, CMD-03, CMD-04, DEPR-01, DEPR-02, DEPR-03, DEPR-04 | unit | `node --test tests/commands-deprecation.test.cjs` | Yes | ✅ green |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [x] `tests/commands-deprecation.test.cjs` — test scaffold for CMD-01 through CMD-04 and DEPR-01 through DEPR-04
  - CMD-01: `commands/gsd/suggest.md` exists with correct YAML frontmatter
  - CMD-02: `commands/gsd/digest.md` exists with correct YAML frontmatter
  - CMD-03: `commands/gsd/session-start.md` exists with correct YAML frontmatter
  - CMD-04: 13 standalone commands exist in `commands/gsd/` with correct names
  - DEPR-01: No files in `.claude/commands/wrap/`
  - DEPR-02: No files in `.claude/commands/sc/`
  - DEPR-03: No `skill-creator.json` references in skill files; no `wrapper_commands` in schema
  - DEPR-04: Deprecation notice exists in docs

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/gsd:suggest` analyzes observations correctly | CMD-01 | Requires real session data and interactive use | Run `/gsd:suggest` with existing sessions.jsonl |
| `/gsd:digest` produces coherent summary | CMD-02 | Requires real session data | Run `/gsd:digest` with existing sessions.jsonl |
| `/gsd:session-start` shows correct briefing | CMD-03 | Requires project state | Run `/gsd:session-start` and verify output |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
