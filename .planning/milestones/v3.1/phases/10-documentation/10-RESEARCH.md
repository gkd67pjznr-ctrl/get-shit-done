# Phase 10: Documentation - Research

**Researched:** 2026-03-04
**Domain:** README authorship — condensing UPGRADES.md into a readable fork-identity document
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DOC-01 | README.md exists at repo root summarizing the fork (condensed from UPGRADES.md) | README already exists; needs targeted updates to meet all success criteria |
</phase_requirements>

## Summary

A README.md already exists at the repo root (`/README.md`). It has a fork-specific header section (lines 1–37) followed by the full upstream GSD README (lines 39–743). The fork header covers the three systems (quality enforcement, concurrent milestones, tech debt), links to UPGRADES.md and FORK-GUIDE.md, and provides a quick stats table.

The fork-specific section is structurally solid but contains two stale data points and one problematic feature reference. The stats table lists "4 (v1.0 through v3.0)" milestones and "298 across 14 suites" tests — both are outdated after v3.1 work (710 tests passing at end of Phase 9). The "What's Different" table lists "planning layout migration tool" under Tech Debt System, which references `migrate.cjs` — a tool deleted in Phase 7 (STRIP-01). No legacy layout references appear in the fork header, and the upstream portion is not fork-authored content.

The plan task is to update the existing README rather than write a new one. The work is narrow: fix the stats, remove the deleted migrate reference, and confirm no other stale or legacy references exist. The success criteria are already substantially met — the file exists, it gives a clear picture of the fork, and a reader unfamiliar with the project can understand the fork's purpose from it.

**Primary recommendation:** Update the existing README fork header section — fix two stale stats (milestones count, tests count), remove the "planning layout migration tool" from the Tech Debt System row, and verify no other references to deleted features or legacy layout architecture remain.

## Standard Stack

This phase produces no code. The deliverable is a Markdown document. No library research needed.

### What Already Exists

| File | Lines | Status |
|------|-------|--------|
| `README.md` | 743 | Exists — fork header at lines 1–37, upstream content lines 39–743 |
| `UPGRADES.md` | 512 | Source of truth — full milestone-by-milestone documentation |
| `FORK-GUIDE.md` | 268 | Installation and usage instructions |

## Architecture Patterns

### Current README Structure

```
README.md
├── Lines 1–37   Fork-specific header
│   ├── # GSD Enhanced Fork
│   ├── ## What This Fork Is  (3 systems, links to UPGRADES.md + FORK-GUIDE.md)
│   ├── ## What's Different   (table of 3 systems)
│   ├── ## Quick Stats        (stats table — STALE)
│   └── ## Getting Started    (links to FORK-GUIDE.md, UPGRADES.md, set-quality)
└── Lines 39–743 Upstream GSD README (unchanged from upstream)
    └── (Do not modify — this is upstream content)
```

### Correct Stats After v3.1 Phase 9

From STATE.md and REQUIREMENTS.md:
- **Tests passing:** 710 (710/710 at end of Phase 9, per STATE.md last_activity)
- **Test suites:** Check current count — UPGRADES.md says 14 suites but tests have changed
- **Milestones shipped:** v1.0, v1.1, v2.0, v3.0 = 4 milestones (v3.1 is the current in-progress cleanup milestone, not yet complete)

Note: "4 (v1.0 through v3.0)" in the stats table is still accurate — v3.1 is not yet shipped. The milestones count does not need changing. The test count "298 across 14 suites" needs updating.

### Stale/Incorrect Content Identified

| Location | Current Text | Problem | Correct Text |
|----------|-------------|---------|-------------|
| Line 27 | `298 across 14 suites` | Stale — Phase 9 brought this to 710/710 | `710 across 14 suites` (confirm suite count) |
| Line 20 | `planning layout migration tool` | migrate.cjs deleted in Phase 7 (STRIP-01) | Remove this entry; the row describes only remaining features |

### Success Criteria Mapping

| Criterion | Current Status | Action Needed |
|-----------|---------------|---------------|
| README.md exists at repo root | PASS — file exists | None |
| Covers what fork adds without duplicating UPGRADES.md verbatim | PASS — uses table and brief descriptions, links to UPGRADES.md | None |
| Unfamiliar reader can understand fork purpose and key features | PASS — "What This Fork Is" and "What's Different" sections are clear | None |
| Reflects simplified milestone-only architecture (no legacy layout references) | PARTIAL — fork header has no legacy refs; but row 20 mentions the now-deleted migration tool | Remove the "planning layout migration tool" reference |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Stats accuracy | Manual counting | Read STATE.md last_activity, REQUIREMENTS.md test count |
| Stale feature list | Rewriting from memory | Check STRIP-01 completion in REQUIREMENTS.md to confirm migrate.cjs deleted |

## Common Pitfalls

### Pitfall 1: Over-editing the Upstream Section
**What goes wrong:** Modifying lines 39–743 (upstream GSD README content) when only the fork header needs updating.
**Why it happens:** The file is one document but has two conceptually distinct sections.
**How to avoid:** Only modify lines 1–37. Upstream content is not fork-authored — changes there require deliberate intent.
**Warning signs:** Edits below line 38 (the `<div align="center">` delimiter).

### Pitfall 2: Removing the migrate.cjs Migration Commands Section from UPGRADES.md
**What goes wrong:** Confusing the README (which references the migration tool) with UPGRADES.md (which documents the milestone-by-milestone history).
**Why it happens:** UPGRADES.md is a historical record — it should document that migrate.cjs existed and was built, even though it was later deleted. Only the README should be updated.
**How to avoid:** Edit README only. Do not edit UPGRADES.md.

### Pitfall 3: Updating the Milestones Count Incorrectly
**What goes wrong:** Changing "4 (v1.0 through v3.0)" to "5" because v3.1 exists.
**Why it happens:** v3.1 is the current in-progress cleanup milestone, not yet shipped.
**How to avoid:** Only count shipped/completed milestones. v3.1 is not yet complete — leave the count at 4.

### Pitfall 4: Introducing Legacy Layout Language
**What goes wrong:** Adding content that references "legacy mode," "detectLayoutStyle," "single .planning/ directory," or migration from legacy to milestone-scoped.
**Why it happens:** UPGRADES.md v2.0 section and the decisions log discuss legacy compatibility, which is tempting to summarize.
**How to avoid:** The fork dropped legacy layout entirely in v3.1. The README should not mention it. Milestone-only is now the only architecture.

## Code Examples

### The Fork Header (Lines 1–37) — Current State

```markdown
# GSD Enhanced Fork

**Quality enforcement + concurrent milestones + tech debt tracking on top of vanilla GSD.**

## What This Fork Is

This is a forked version of [GSD (Get Shit Done)](...) that adds three major systems: ...

## What's Different

| System | Version | What It Adds |
|--------|---------|--------------|
| Quality Enforcement | v1.0-v1.1 | Quality Sentinel in executor, Context7 library lookup before coding,
  mandatory tests for new logic, config-gated levels (fast/standard/strict), `/gsd:set-quality` command |
| Concurrent Milestones | v2.0 | Isolated workspaces per milestone, lock-free dashboard,
  advisory conflict detection, `--milestone` flag throughout all 7 workflows |
| Tech Debt System | v3.0 | DEBT.md with TD-NNN entries, `debt log/list/resolve` CLI commands,
  executor/verifier auto-logging, `/gsd:fix-debt` skill, planning layout migration tool |
                                                                           ^^^^^^^^^^^^^^^^^^^^^^^^^
                                                                           REMOVE THIS — migrate.cjs deleted in Phase 7

## Quick Stats

| Dimension | Value |
|-----------|-------|
| Milestones shipped | 4 (v1.0 through v3.0) |      ← CORRECT (v3.1 not yet shipped)
| Tests passing | 298 across 14 suites |             ← STALE — update to 710
| Source modules | 13 lib modules |
| Validated requirements | 85+ |
```

### Required Edits (Surgical)

**Edit 1:** Line 20 — remove "planning layout migration tool" from Tech Debt System row

Before:
```
| Tech Debt System | v3.0 | DEBT.md with TD-NNN entries, `debt log/list/resolve` CLI commands, executor/verifier auto-logging, `/gsd:fix-debt` skill, planning layout migration tool |
```

After:
```
| Tech Debt System | v3.0 | DEBT.md with TD-NNN entries, `debt log/list/resolve` CLI commands, executor/verifier auto-logging, `/gsd:fix-debt` skill |
```

**Edit 2:** Line 27 — update test count

Before:
```
| Tests passing | 298 across 14 suites |
```

After:
```
| Tests passing | 710 across 14 suites |
```

Note: "14 suites" should be verified against the current test directory count before writing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `migrate.cjs` tool for legacy-to-milestone-scoped migration | Tool deleted; milestone-scoped is the only layout | Phase 7 (STRIP-01, v3.1) | README must not reference migrate as a feature |
| Legacy single `.planning/` layout supported alongside milestone-scoped | Milestone-scoped only; no legacy fallback | Phase 8 (STRIP-02/03, v3.1) | README must not mention legacy layout or compatibility |
| 298 tests | 710 tests | Phase 9 (09-02, v3.1) | Stats table needs update |

## Open Questions

1. **Test suite count (14 suites)**
   - What we know: UPGRADES.md says 14 suites; some test files were deleted in v3.1 (migrate tests removed in Phase 7, 349→309→300 test count shrinkage)
   - What's unclear: Does the suite count remain 14 or was a test file deleted?
   - Recommendation: Run `ls tests/*.test.cjs | wc -l` before writing to confirm the suite count. Update "14 suites" if the actual count differs.

## Sources

### Primary (HIGH confidence)
- Direct file read: `/Users/tmac/Projects/gsdup/README.md` — current state of all 743 lines confirmed
- Direct file read: `/Users/tmac/Projects/gsdup/UPGRADES.md` — source material, all 512 lines
- Direct file read: `/Users/tmac/Projects/gsdup/.planning/milestones/v3.1/REQUIREMENTS.md` — STRIP-01 confirmed complete (migrate.cjs deleted)
- Direct file read: `/Users/tmac/Projects/gsdup/.planning/milestones/v3.1/STATE.md` — "710 pass, 1 pre-existing fail" confirmed in last_activity

### Secondary (MEDIUM confidence)
- Direct file read: `/Users/tmac/Projects/gsdup/FORK-GUIDE.md` — cross-reference for fork feature descriptions

## Metadata

**Confidence breakdown:**
- What needs changing: HIGH — files read directly, stale content identified precisely
- Correct values to use: HIGH — test count from STATE.md authoritative, milestone count from requirements status
- What not to touch: HIGH — upstream README section boundary is clear (line 38 delimiter)

**Research date:** 2026-03-04
**Valid until:** 2026-03-14 (stable content; no external dependencies)
