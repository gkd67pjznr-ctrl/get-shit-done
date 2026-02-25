# Phase 3: Quality Dimensions - Context

**Gathered:** 2026-02-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the verifier, planner, and plan-checker agents with quality enforcement checks (duplication, dead code, missing tests, pattern consistency). This completes the quality enforcement loop: planner embeds quality directives → executor follows them → verifier validates after execution → plan-checker gates plan quality before execution. Config-level gating (fast/standard/strict) applies to all new checks.

</domain>

<decisions>
## Implementation Decisions

### Findings presentation (VERIFICATION.md)
- Step 7b gets its own clearly separated section: `## Step 7b: Quality Findings`
- Findings grouped by check type (Duplication, Dead Code/Orphaned Exports, Missing Tests) — not by file
- Two severity levels only: FAIL and WARN — binary, no vanity metrics
- Each finding includes report + suggested fix (e.g., "Duplication: utils.cjs lines 12-30 duplicates helpers.cjs lines 5-23. Consider extracting to shared helper.")
- Count summary at end of section: "Step 7b: 2 WARN findings (1 duplication, 1 missing test)"

### Quality scan format (planner task actions)
- `<quality_scan>` is mandatory for ALL tasks — not just code tasks. Non-code tasks can have minimal/N/A content
- "Code to reuse" includes both: known targets (file paths + function names) AND grep patterns for executor discovery
- "Tests to write" includes both: suggested test file name + description of what to test. Executor can deviate if structure calls for it
- "Docs to consult" includes both: Context7 library ID if known + plain text description of what to look up
- Planner self-check rejects any task with empty `<quality_scan>` before returning the plan

### Detection heuristics
- Duplication scope: same-phase only — only flag duplication between files created/modified in this phase, don't scan entire codebase
- Orphaned exports: project-wide check — grep the full project for imports of each new export, flag any with zero importers
- False positives: report all findings, mark uncertain ones as INFO rather than WARN/FAIL (e.g., CLI entry points, public API exports)
- Test file exemptions: reuse `quality.test_exemptions` from config.json — one source of truth shared with executor

### Blocker vs warning behavior
- Fast mode: Step 7b section exists but shows "Skipped (quality.level: fast)" — visible that it was intentionally skipped
- Standard mode: all findings are WARN — appear in output with count summary, don't block verification
- Strict mode: findings are FAIL — verification collects ALL findings first, then marks as FAILED (no stop-on-first-fail)
- Plan-checker Dimension 9: in strict mode, rejects the entire plan if quality_scan is incomplete — planner must revise and resubmit
- Plan-checker Dimension 9: in standard mode, Dimension 9 is a warning only

### Claude's Discretion
- Exact format of `<quality_scan>` XML structure within task actions
- How duplication detection works internally (string matching, AST, heuristic)
- Step 7b ordering relative to existing verification steps
- Exact wording of suggested fixes in findings

</decisions>

<specifics>
## Specific Ideas

- User mentioned a persistent quality debt file that `/gsd:debug` and `/gsd:quick` could consume — verifier findings feeding into a running debt tracker for periodic review
- Binary FAIL/WARN aligns with existing project philosophy: "no vanity metrics, use binary pass/fail gates with actionable messages"
- Quality scan format mirrors how Phase 2's executor sentinel works — planner pre-loads what executor needs, similar to how executor pre-scans before writing code

</specifics>

<deferred>
## Deferred Ideas

- Persistent quality debt file consumed by `/gsd:debug` and `/gsd:quick` — would allow periodic quality review outside verification. New capability, future phase.

</deferred>

---

*Phase: 03-quality-dimensions*
*Context gathered: 2026-02-23*
