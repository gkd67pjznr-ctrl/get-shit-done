---
phase: 32
slug: gate-to-correction-attribution
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-11
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/hooks/gate-attribution.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/hooks/gate-attribution.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 0 | ANLZ-01, ANLZ-02 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts` | ✅ | ✅ green |
| 32-01-02 | 01 | 1 | ANLZ-01 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "produces attributions"` | ✅ | ✅ green |
| 32-01-03 | 01 | 1 | ANLZ-01 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "maps all categories"` | ✅ | ✅ green |
| 32-01-04 | 01 | 1 | ANLZ-01 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "confidence"` | ✅ | ✅ green |
| 32-01-05 | 01 | 1 | ANLZ-02 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "writes output"` | ✅ | ✅ green |
| 32-01-06 | 01 | 1 | ANLZ-02 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "structured entries"` | ✅ | ✅ green |
| 32-01-07 | 01 | 1 | SC-3 | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "empty"` | ✅ | ✅ green |

*Status: ✅ green · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/hooks/gate-attribution.test.ts` — stubs for ANLZ-01, ANLZ-02, SC-3

*Existing infrastructure covers framework installation.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-03-11
