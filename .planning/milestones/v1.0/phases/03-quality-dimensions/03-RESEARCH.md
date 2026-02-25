# Phase 3: Quality Dimensions - Research

**Researched:** 2026-02-23
**Domain:** Agent markdown file editing — extending gsd-verifier.md, gsd-planner.md, and gsd-plan-checker.md with quality enforcement sections
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Findings presentation (VERIFICATION.md)**
- Step 7b gets its own clearly separated section: `## Step 7b: Quality Findings`
- Findings grouped by check type (Duplication, Dead Code/Orphaned Exports, Missing Tests) — not by file
- Two severity levels only: FAIL and WARN — binary, no vanity metrics
- Each finding includes report + suggested fix (e.g., "Duplication: utils.cjs lines 12-30 duplicates helpers.cjs lines 5-23. Consider extracting to shared helper.")
- Count summary at end of section: "Step 7b: 2 WARN findings (1 duplication, 1 missing test)"

**Quality scan format (planner task actions)**
- `<quality_scan>` is mandatory for ALL tasks — not just code tasks. Non-code tasks can have minimal/N/A content
- "Code to reuse" includes both: known targets (file paths + function names) AND grep patterns for executor discovery
- "Tests to write" includes both: suggested test file name + description of what to test. Executor can deviate if structure calls for it
- "Docs to consult" includes both: Context7 library ID if known + plain text description of what to look up
- Planner self-check rejects any task with empty `<quality_scan>` before returning the plan

**Detection heuristics**
- Duplication scope: same-phase only — only flag duplication between files created/modified in this phase, don't scan entire codebase
- Orphaned exports: project-wide check — grep the full project for imports of each new export, flag any with zero importers
- False positives: report all findings, mark uncertain ones as INFO rather than WARN/FAIL (e.g., CLI entry points, public API exports)
- Test file exemptions: reuse `quality.test_exemptions` from config.json — one source of truth shared with executor

**Blocker vs warning behavior**
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

### Deferred Ideas (OUT OF SCOPE)

- Persistent quality debt file consumed by `/gsd:debug` and `/gsd:quick` — would allow periodic quality review outside verification. New capability, future phase.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VRFY-01 | Verifier includes Step 7b after existing Step 7 that checks for code duplication across phase files | Addressed by new `<step_7b>` section in `gsd-verifier.md`: reads phase files from SUMMARY key-files, runs targeted grep for duplicated N-line blocks; same-phase only scope per user decision |
| VRFY-02 | Verifier Step 7b detects dead code and orphaned exports (artifacts that exist but are never imported) | Addressed by Step 7b orphaned-export check: for each exported symbol in phase files, grep full project for import of that symbol; zero matches = orphaned; CLI entry points and index.cjs marked INFO |
| VRFY-03 | Verifier Step 7b checks that new `.cjs/.js/.ts` logic files have corresponding test files | Addressed by Step 7b missing-test check: same file-extension + export logic as executor sentinel Step 4; uses `quality.test_exemptions` config for exemptions — same source of truth |
| VRFY-04 | Verifier quality findings appear in VERIFICATION.md with severity gated by `quality.level` — warnings in `standard`, blockers in `strict`, skipped in `fast` | Addressed by config-gate at entry of Step 7b: fast → show "Skipped" section header; standard → all findings WARN; strict → all findings FAIL, collect all before marking |
| PLAN-01 | Planner task `<action>` blocks include a `<quality_scan>` subsection specifying existing code to reuse, library docs to consult, and tests to write | Addressed by documenting `<quality_scan>` XML format in `gsd-planner.md` task_breakdown section; format includes three subsections: `<code_to_reuse>`, `<docs_to_consult>`, `<tests_to_write>` |
| PLAN-02 | Planner self-check verifies each task action has quality directives populated before returning the plan | Addressed by adding quality_scan check to existing `<context_fidelity>` self-check block in `gsd-planner.md`; reject (do not return plan) if any task's `<quality_scan>` is empty or missing |
| PCHK-01 | Plan-checker includes Dimension 9 that validates task actions contain quality directives (code to reuse, docs to consult, tests to write) | Addressed by new Dimension 9 section in `gsd-plan-checker.md` after Dimension 8; checks each `<action>` block for `<quality_scan>` presence and non-empty subsections |
| PCHK-02 | Dimension 9 is non-blocking in `standard` mode and blocking in `strict` mode | Addressed within Dimension 9: reads `quality.level` config; strict → blocker severity; standard → warning severity; fast → skip entirely (show "SKIPPED" in output) |

</phase_requirements>

---

## Summary

Phase 3 is a pure markdown editing phase — three agent files receive new sections or section extensions. No new CJS code is written, no new npm packages are required, and no infrastructure changes are needed. The entire phase builds on patterns already established in Phases 1 and 2: the config-gate pattern (`config-get quality.level`), the targeted grep scan pattern (EXEC-01), and the binary FAIL/WARN philosophy already in the verifier's anti-pattern categorization.

The two planned deliverables (03-01 and 03-02) map cleanly to non-overlapping file sets: 03-01 touches only `agents/gsd-verifier.md`, and 03-02 touches only `agents/gsd-planner.md` and `agents/gsd-plan-checker.md`. This makes them Wave 1 parallel candidates (no shared files, no dependency between them).

The highest-risk design decision is duplication detection. The user has delegated the internal heuristic to Claude's discretion. The simplest viable approach — line-block matching using `grep` — is the correct choice for this phase. AST-based detection would require a new tool and is out of scope. The duplication check must be scoped to same-phase files only (per locked decision), which makes grep-based matching feasible within the verifier's context budget.

**Primary recommendation:** Implement 03-01 (verifier) and 03-02 (planner + plan-checker) as parallel Wave 1 plans. Both are additive markdown edits. The `<quality_scan>` XML format in the planner should mirror how the executor's sentinel pre-task guidance is structured — pre-load the executor with what to look for, not what to do. Step 7b in the verifier is the backstop that confirms the executor's work landed correctly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `config-get quality.level` (gsd-tools CLI) | existing | Read quality level at every gate entry | Established in Phase 1 (CFG-04); same pattern used by executor sentinel; consistent across all agents |
| `grep` / Bash | native | Duplication detection, orphaned export check, test file existence check | Already available to verifier; used in Steps 3-7 today; no new tooling needed |
| `quality.test_exemptions` from config | existing | Exempt `.md`, `.json`, `templates/**`, `.planning/**` from test-existence check | CFG-03; already used by executor sentinel Step 4; single source of truth |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gsd-tools.cjs summary-extract` | existing | Extract key-files list from SUMMARY.md frontmatter | Used in verifier Step 7 today; Step 7b should use the same extraction to get phase file list |
| `gsd-tools.cjs config-get` | existing | Read `quality.level` at gate entry | Same CLI call as executor: `node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Grep-based line-block duplication detection | AST-based duplication (jscpd, etc.) | AST tools require npm install and produce reliable results for JS/TS; grep is already available and sufficient for same-phase CJS files. Use grep — AST is out of scope for this phase. |
| Per-gate config reads | Cached config at section entry | A single `QUALITY_LEVEL` read at Step 7b entry (like the executor sentinel's top-level guard) is simpler and cheaper. Cache at entry, use for all sub-checks. |
| Separate `<step_7b>` XML section | Inline prose within Step 7 | The user decided on a clearly separated section in VERIFICATION.md output (`## Step 7b: Quality Findings`). The verifier's protocol section should match — name it clearly as a distinct step. |

**Installation:** None required. All tooling already exists.

---

## Architecture Patterns

### Files Modified

Phase 3 touches exactly three files:

```
agents/
├── gsd-verifier.md      # MODIFIED: add Step 7b quality dimensions block after Step 7
├── gsd-planner.md       # MODIFIED: add <quality_scan> format to task_breakdown + self-check
└── gsd-plan-checker.md  # MODIFIED: add Dimension 9 quality directives block after Dimension 8
```

No new CJS files. No new test files. No changes to `gsd-tools.cjs`, `.mcp.json`, or any other file.

### Pattern 1: Step 7b in gsd-verifier.md

**What:** A new protocol block added after Step 7 (Anti-Pattern Scan) in `gsd-verifier.md`. It runs three quality sub-checks and writes a distinct `## Step 7b: Quality Findings` section to VERIFICATION.md.

**Placement in file:** After `## Step 7: Scan for Anti-Patterns` block and before `## Step 8: Identify Human Verification Needs`.

**Entry guard (same pattern as executor sentinel):**

```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

**Fast mode behavior:** Write `## Step 7b: Quality Findings` section header followed by `Skipped (quality.level: fast)` — then stop. The section must appear in VERIFICATION.md so users know it was intentionally skipped.

**Phase file discovery:** Reuse the same mechanism Step 7 already uses:

```bash
SUMMARY_FILES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs summary-extract "$PHASE_DIR"/*-SUMMARY.md --fields key-files)
```

This gives the list of files created/modified in this phase — the scope for all sub-checks.

**Sub-check 1: Duplication (same-phase only)**

```bash
# For each pair of phase files, extract N-line blocks and compare
# N = 5 lines minimum (avoid false positives on short functions)
# Use grep -n to get line numbers for the finding report
```

Strategy: For each phase file, extract meaningful code blocks (function bodies, 5+ line blocks). For each block, grep other phase files for the same lines. A match of 5+ consecutive identical lines is a duplication candidate. Output: file path, line range, duplicate location, suggested fix.

**Sub-check 2: Orphaned Exports (project-wide)**

```bash
# For each phase file, extract exported symbol names
grep -n "^export\|^module\.exports\|exports\." "$phase_file" 2>/dev/null

# For each exported symbol, grep entire project for import
grep -rn "require.*${symbol}\|import.*${symbol}" . \
  --include="*.cjs" --include="*.js" --include="*.ts" \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=.planning 2>/dev/null | grep -v "$phase_file"
```

Zero matches = orphaned. Mark as INFO if the file is a known CLI entry point (e.g., `bin/`, `cli.cjs`) or an index file — these have legitimate external importers.

**Sub-check 3: Missing Tests**

Same logic as executor sentinel Step 4 — already proven correct:

```bash
# For each phase file that is .cjs/.js/.ts and contains 'export'
# Check if corresponding .test.cjs exists
# Skip files matching quality.test_exemptions
```

**Severity assignment:**

| Mode | FAIL | WARN | INFO |
|------|------|------|------|
| fast | — (skipped) | — | — |
| standard | — | All findings | Uncertain findings |
| strict | All findings | — | Uncertain findings |

**Output format in VERIFICATION.md:**

```markdown
## Step 7b: Quality Findings

### Duplication

- WARN: `get-shit-done/bin/lib/utils.cjs` lines 12-30 duplicates `get-shit-done/bin/lib/helpers.cjs` lines 5-23. Consider extracting to a shared helper.

### Dead Code / Orphaned Exports

- INFO: `get-shit-done/bin/lib/debug.cjs` export `formatDebug` has no importers. Possible CLI entry or public API — verify manually.

### Missing Tests

- WARN: `get-shit-done/bin/lib/quality.cjs` has no corresponding test file. Expected: `tests/quality.test.cjs`.

**Step 7b: 2 WARN findings (1 duplication, 1 missing test), 1 INFO**
```

**Strict mode:** All findings become FAIL. Collect ALL before marking verification status. Do not stop on first fail.

### Pattern 2: `<quality_scan>` in gsd-planner.md

**What:** A documented XML subsection format added to the `<task_breakdown>` section of `gsd-planner.md`, plus a self-check gate added to `<context_fidelity>`.

**Placement:** In `<task_breakdown>` section, under the Task Anatomy block where `<action>` is described. The `<quality_scan>` is a required sub-element of `<action>`.

**Format:**

```xml
<action>
  [Specific implementation instructions]

  <quality_scan>
    <code_to_reuse>
      - Known: `get-shit-done/bin/lib/config.cjs` — `cmdConfigGet()` reads quality.level; reuse directly
      - Grep pattern: `grep -rn "quality\|level" get-shit-done/bin/lib/ --include="*.cjs" | head -10`
    </code_to_reuse>
    <docs_to_consult>
      - Context7: `/upstash/context7-mcp` — query "resolve-library-id tool call format"
      - Description: Check how gsd-tools.cjs config-get handles missing keys (fallback behavior)
    </docs_to_consult>
    <tests_to_write>
      - File: `tests/quality-verifier.test.cjs`
      - What to test: Step 7b output format for fast/standard/strict modes; duplication detection with known duplicate; orphaned export detection
    </tests_to_write>
  </quality_scan>
</action>
```

**Rules for population:**

- `<code_to_reuse>`: Always include at least a grep pattern, even if no known target exists. Pattern should be scoped to the directories the task touches.
- `<docs_to_consult>`: If task uses only Node.js built-ins or plain markdown editing, use `N/A — no external library dependencies`.
- `<tests_to_write>`: If task creates no `.cjs/.js/.ts` files with exports, use `N/A — no new exported logic`.
- Non-code tasks (docs, config, markdown edits): all three subsections may say `N/A` but the `<quality_scan>` wrapper must still be present.

**Self-check gate (addition to `<context_fidelity>` section):**

Add to the existing self-check list:

```markdown
- [ ] Every task `<action>` block contains a `<quality_scan>` with non-empty subsections (or explicit N/A)
```

If any task has an empty or missing `<quality_scan>`: do NOT return the plan. Fix inline, then proceed.

**Placement of self-check gate:** In `<context_fidelity>` section's "Self-check before returning" block. This is the existing checklist at lines 64-68 of `gsd-planner.md`. Add as a fourth bullet.

### Pattern 3: Dimension 9 in gsd-plan-checker.md

**What:** A new verification dimension added after Dimension 8 (Nyquist Compliance) in `gsd-plan-checker.md`.

**Placement:** After the `</dimension_8_skip_condition>` closing and before `</verification_dimensions>`.

**Structure:**

```markdown
## Dimension 9: Quality Directives

<dimension_9_skip_condition>
Skip this entire dimension if:
- workflow.plan_check is false in .planning/config.json
- quality.level is fast

If skipped, output: "Dimension 9: SKIPPED (quality.level: fast or plan_check disabled)"
</dimension_9_skip_condition>

**Question:** Does every task action contain a `<quality_scan>` block with non-empty subsections?

**Process:**
1. Read `quality.level` from config
2. For each `<task type="auto">` in each PLAN.md:
   - Parse the `<action>` element
   - Check for `<quality_scan>` presence
   - Check that `<code_to_reuse>`, `<docs_to_consult>`, `<tests_to_write>` are present and non-empty (or explicit N/A)
3. Flag tasks missing `<quality_scan>` or with empty subsections

**Severity:**

| Mode | Missing quality_scan | Empty subsection |
|------|---------------------|-----------------|
| fast | SKIPPED | SKIPPED |
| standard | warning | warning |
| strict | blocker | blocker |

**Example issue (standard):**
```yaml
issue:
  dimension: quality_directives
  severity: warning
  description: "Task 2 action missing <quality_scan> block"
  plan: "03-01"
  task: 2
  fix_hint: "Add <quality_scan> with code_to_reuse, docs_to_consult, tests_to_write subsections"
```

**Example issue (strict):**
```yaml
issue:
  dimension: quality_directives
  severity: blocker
  description: "Task 1 action has empty <code_to_reuse> — must name existing code to check or provide grep pattern"
  plan: "03-02"
  task: 1
  fix_hint: "Add known target path or grep pattern to <code_to_reuse>"
```
```

**Dimension 9 output block in checker report:**

```
## Dimension 9: Quality Directives

| Task | Plan | has quality_scan | code_to_reuse | docs_to_consult | tests_to_write | Status |
|------|------|-----------------|---------------|-----------------|----------------|--------|
| Task 1 | 03-01 | ✅ | ✅ | ✅ | ✅ | PASS |
| Task 2 | 03-01 | ❌ | — | — | — | WARN/FAIL |

### Overall Dimension 9 Status: ✅ PASS / ⚠️ WARNING / ❌ FAIL
```

### Pattern 4: Config-Gate Pattern (Established in Phase 1, Carried Forward)

This pattern is identical across all three files. Planner and plan-checker will read config at the point they need it (self-check time for planner, Step 1 for plan-checker). The verifier reads it at Step 7b entry.

```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

### Anti-Patterns to Avoid

- **Full codebase duplication scan:** The user locked same-phase-only scope for duplication. Scanning the entire project for duplication is wrong — it violates scope, burns context, and produces false positives.
- **AST-based detection:** `jscpd` or similar tools require npm install and architectural decisions outside this phase. Grep-based line matching is sufficient and available.
- **Orphaned export false positives without INFO downgrade:** CLI entry points (`bin/`, `cli.cjs`) and index files legitimately export symbols with zero project-internal importers. These must be downgraded to INFO, not WARN.
- **Stop-on-first-fail in strict mode:** The user locked "collect ALL findings first, then mark as FAILED." The verifier must not short-circuit on the first FAIL finding in strict mode.
- **Empty `<quality_scan>` allowed with a note:** The planner self-check must reject outright. A task with `<!-- TODO: add quality_scan -->` fails the gate identically to a missing one. Only explicit `N/A` is acceptable.
- **Dimension 9 always blocking:** The user locked standard = warning, strict = blocker. The plan-checker must read `quality.level` before assigning severity. Do not hardcode as blocker.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase file list for Step 7b | Walk filesystem and guess | `gsd-tools.cjs summary-extract` with `--fields key-files` | Step 7 already uses this; consistent source of truth for phase-modified files |
| Quality level reading | Hardcoded mode check | `config-get quality.level` | Phase 1 established this as the canonical pattern; all gates must read from config |
| Test exemption list | Inline `.md`, `.json` strings | `quality.test_exemptions` from `config-get` | CFG-03 made this the source of truth; executor sentinel already uses it this way |
| Duplication detection algorithm | Custom rolling-hash similarity | Grep N consecutive lines | For same-phase `.cjs` files, simple line matching at N=5 is sufficient; rolling hash is engineering for its own sake |
| Orphaned export detection | Tracking imports during execution | Post-hoc grep for each export | Grep is available, fast, and already the pattern in verifier Steps 4-5; no new tooling needed |

**Key insight:** Phase 3 is entirely additive markdown editing. Every tool needed (grep, config-get, summary-extract, git) already exists. The work is writing precise protocol instructions that use these tools correctly within the verifier, planner, and plan-checker contexts.

---

## Common Pitfalls

### Pitfall 1: Step 7b Not Appearing in Fast Mode

**What goes wrong:** The verifier's Step 7b block has a fast-mode guard that completely skips the section, including the section header. The VERIFICATION.md contains no trace of Step 7b.

**Why it happens:** The guard exits before writing anything to VERIFICATION.md. The user decided the section must appear (visible that it was intentionally skipped).

**How to avoid:** The fast-mode path must write `## Step 7b: Quality Findings\n\nSkipped (quality.level: fast)` to VERIFICATION.md before returning. Only the sub-checks are skipped — the section header is always written.

**Warning signs:** VERIFICATION.md with no Step 7b section after a fast-mode run.

### Pitfall 2: Orphaned Export False Positives on CLI Entry Points

**What goes wrong:** `bin/gsd-tools.cjs` or `bin/cli.cjs` exports symbols used only by external consumers (shell scripts, Claude Code commands). Grep finds zero internal importers and marks them FAIL/WARN.

**Why it happens:** The orphaned export check greps only the project's internal files. CLI entry points are consumed externally.

**How to avoid:** Check if the file lives in a `bin/` directory or is named `cli.cjs`, `index.cjs`, or similar. If so, downgrade to INFO with note "Possible CLI entry or public API — verify manually." The user locked this behavior explicitly.

**Warning signs:** FAIL findings for every export in `bin/gsd-tools.cjs`.

### Pitfall 3: Stop-on-First-Fail in Strict Mode

**What goes wrong:** Verifier encounters the first FAIL finding, immediately marks verification as FAILED, and stops running the remaining sub-checks. Step 7b shows incomplete findings.

**Why it happens:** The existing verifier stops on first FAILED truth in some paths. The Step 7b protocol must override this for its own section — it must collect all sub-check results regardless of severity.

**How to avoid:** The Step 7b section must initialize a findings array, run all three sub-checks, append findings, then evaluate the aggregate. Never evaluate severity mid-run. The final VERIFICATION.md status is FAILED only after all findings are written.

**Warning signs:** VERIFICATION.md Step 7b section with only one finding in strict mode, verifier exits early.

### Pitfall 4: `<quality_scan>` Self-Check Blocking on Non-Code Tasks

**What goes wrong:** The planner self-check rejects a documentation task (modifying a `.md` file) because its `<quality_scan>` is "empty." But `N/A` in all three subsections is valid per the user's decision.

**Why it happens:** The self-check checks for non-empty content without recognizing "N/A" as an acceptable value.

**How to avoid:** The self-check gate must define "non-empty" as: the subsection contains either (a) actual content (file path, grep pattern, library ID, test filename) OR (b) the literal string `N/A`. Missing subsection or empty subsection → reject.

**Warning signs:** Self-check rejecting plans for tasks that legitimately have no code-to-reuse or tests-to-write.

### Pitfall 5: Dimension 9 Always Blocking Regardless of Mode

**What goes wrong:** The plan-checker's Dimension 9 is written with hardcoded `blocker` severity, making it block plan execution even in `standard` mode.

**Why it happens:** The dimension is written before the config-gate logic is added, or the gate is added per-issue instead of at dimension entry.

**How to avoid:** Dimension 9 must read `quality.level` at its entry (same pattern as all other quality gates). Standard → downgrade all Dimension 9 issues to `warning`. Strict → issue as `blocker`. Fast → skip entirely and output "Dimension 9: SKIPPED."

**Warning signs:** Standard-mode plans being rejected by plan-checker for missing `<quality_scan>`.

### Pitfall 6: Duplication Detection Matching Short Boilerplate

**What goes wrong:** The duplication check flags `"use strict";`, module boilerplate, or standard license headers as "duplicates" because they appear in multiple phase files.

**Why it happens:** N-line block matching with a low N threshold catches any repeated pattern.

**How to avoid:** Set minimum block size to 5 consecutive non-blank, non-comment lines. Skip lines that are only: `"use strict"`, `const X = require(`, `module.exports`, comment lines. These are structural boilerplate, not duplicated logic.

**Warning signs:** Duplication findings on lines 1-5 of every CJS file.

### Pitfall 7: Planner Adding `<quality_scan>` After `</action>`

**What goes wrong:** The `<quality_scan>` is written as a sibling element to `<action>` instead of nested inside it. Plan-checker's Dimension 9 grep for `<quality_scan>` inside `<action>` finds nothing.

**Why it happens:** The planner's format documentation is ambiguous about nesting.

**How to avoid:** The format documentation in `gsd-planner.md` must show `<quality_scan>` explicitly nested inside `<action>`, with a code example that makes the nesting unambiguous. Dimension 9's parser must also be documented to look for `<quality_scan>` within the `<action>` block, not as a sibling.

**Warning signs:** Dimension 9 flagging tasks that visually appear to have quality_scan blocks.

---

## Code Examples

Verified patterns from direct inspection of existing agent files:

### Config-Gate Entry (from gsd-executor.md `<quality_sentinel>` — confirmed at line 107)

```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

Source: Direct inspection of `agents/gsd-executor.md` lines 107-108. This exact pattern must be used identically in Step 7b (verifier) and Dimension 9 (plan-checker).

### Phase File Extraction (from gsd-verifier.md Step 7 — confirmed at lines 270-272)

```bash
# Extract key-files list from phase SUMMARYs
SUMMARY_FILES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs summary-extract "$PHASE_DIR"/*-SUMMARY.md --fields key-files)

# Fallback: grep from SUMMARY.md directly
grep -E "^\- \`" "$PHASE_DIR"/*-SUMMARY.md | sed 's/.*`\([^`]*\)`.*/\1/' | sort -u
```

Source: Direct inspection of `agents/gsd-verifier.md` lines 270-280. Step 7b must use the same mechanism to get its file list.

### Test File Existence Check (from gsd-executor.md Step 4 — confirmed at lines 150-153)

```bash
# For each phase file: check if it's .cjs/.js/.ts with exports
if echo "$file" | grep -qE '\.(cjs|js|ts)$'; then
  if grep -q "export" "$file" 2>/dev/null; then
    TEST_FILE="${file%.cjs}.test.cjs"
    [ -f "$TEST_FILE" ] || echo "MISSING TEST: $file → expected $TEST_FILE"
  fi
fi
```

Source: Adapted from `agents/gsd-executor.md` lines 150-153 sentinel Step 4. The verifier uses identical logic — this is intentional (same check, post-hoc backstop).

### Orphaned Export Detection

```bash
# Extract exported symbols from a phase file
EXPORTS=$(grep -oE "exports\.[a-zA-Z_][a-zA-Z0-9_]*\s*=" "$phase_file" \
  | sed 's/exports\.\([^=]*\)\s*=.*/\1/' | tr -d ' ')

# For each exported symbol, check project-wide usage
for symbol in $EXPORTS; do
  COUNT=$(grep -rn "require\|import" . \
    --include="*.cjs" --include="*.js" --include="*.ts" \
    --exclude-dir=node_modules --exclude-dir=.git \
    --exclude-dir=.planning \
    2>/dev/null | grep "$symbol" | grep -v "$phase_file" | wc -l)
  if [ "$COUNT" -eq 0 ]; then
    echo "ORPHANED: $phase_file exports '$symbol' with zero importers"
  fi
done
```

Note: CLI entry points (files in `bin/` or named `cli.cjs`, `index.cjs`) should be downgraded to INFO automatically.

### Duplication Detection (N-line block matching)

```bash
# Extract 5-line blocks from one file, search for same block in another
BLOCK_SIZE=5
# For file A, generate rolling 5-line blocks and grep file B
awk 'NR>=start && NR<start+BLOCK_SIZE' start=$i "$file_a" \
  | grep -v '^\s*$\|^\s*//\|"use strict"\|require(\|module\.exports' \
  | head -$BLOCK_SIZE > /tmp/block.txt
grep -F -f /tmp/block.txt "$file_b" && echo "DUPLICATE: $file_a:$i → $file_b"
```

Note: The exact implementation is Claude's discretion. This sketch shows the approach — generate non-trivial line blocks, search for them in peer files. The planner must give the executor enough detail to implement this without asking clarifying questions.

### `<quality_scan>` Format in PLAN.md Task Action

```xml
<task type="auto">
  <name>Task 1: Add Step 7b quality dimensions to gsd-verifier.md</name>
  <files>agents/gsd-verifier.md</files>
  <action>
    Insert a new Step 7b block between Step 7 (Anti-Pattern Scan) and Step 8
    (Human Verification Needs) in gsd-verifier.md. The block must:
    [specific implementation instructions]

    <quality_scan>
      <code_to_reuse>
        - Known: `agents/gsd-verifier.md` Step 7 block — same SUMMARY_FILES extraction pattern; reuse `summary-extract --fields key-files` call
        - Known: `agents/gsd-executor.md` quality_sentinel Step 4 — test file existence check pattern; use identical logic
        - Grep pattern: `grep -n "Step 7\|quality\|QUALITY_LEVEL" agents/gsd-verifier.md | head -10`
      </code_to_reuse>
      <docs_to_consult>
        N/A — no external library dependencies; only gsd-tools CLI and bash grep
      </docs_to_consult>
      <tests_to_write>
        N/A — agents/gsd-verifier.md is a markdown template file; exempt per quality.test_exemptions (.md pattern)
      </tests_to_write>
    </quality_scan>
  </action>
  <verify>
    grep -n "Step 7b\|Quality Findings" agents/gsd-verifier.md | head -5
  </verify>
  <done>Step 7b block exists in gsd-verifier.md with duplication, orphaned export, and missing test sub-checks; config-gated on quality.level</done>
</task>
```

### Verifier VERIFICATION.md Step 7b Output (Standard Mode)

```markdown
## Step 7b: Quality Findings

### Duplication

- WARN: `get-shit-done/bin/lib/quality.cjs` lines 45-52 duplicates `get-shit-done/bin/lib/verifier.cjs` lines 12-19. Consider extracting to a shared helper in `get-shit-done/bin/lib/utils.cjs`.

### Dead Code / Orphaned Exports

- INFO: `get-shit-done/bin/lib/debug.cjs` export `formatDebug` has no project-internal importers. Possible CLI entry point or public API — verify manually.

### Missing Tests

- WARN: `get-shit-done/bin/lib/quality-dimensions.cjs` has no corresponding test file. Expected: `tests/quality-dimensions.test.cjs`.

**Step 7b: 2 WARN findings (1 duplication, 1 missing test), 1 INFO**
```

---

## Plan Structure Recommendation

Two plans, Wave 1 parallel (no shared files):

**03-01: Add Step 7b to gsd-verifier.md**
- Files: `agents/gsd-verifier.md`
- Tasks:
  1. Insert Step 7b block (duplication check, orphaned export check, missing test check, config gate, VERIFICATION.md output format)
- 1-2 tasks, ~35% context (markdown editing with grep pattern research)
- Requirements: VRFY-01, VRFY-02, VRFY-03, VRFY-04

**03-02: Add `<quality_scan>` to gsd-planner.md and Dimension 9 to gsd-plan-checker.md**
- Files: `agents/gsd-planner.md`, `agents/gsd-plan-checker.md`
- Tasks:
  1. Add `<quality_scan>` format to planner task_breakdown + self-check gate
  2. Add Dimension 9 block to plan-checker
- 2 tasks, ~40% context (two files, each with a new section)
- Requirements: PLAN-01, PLAN-02, PCHK-01, PCHK-02

Both plans are Wave 1 (no depends_on). No shared files. Can execute in parallel or sequential — either works.

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| Verifier checks goals and artifacts | Verifier also backstops quality (duplication, dead code, missing tests) | Phase 3 adds this | Closes the enforcement loop — executor sentinel gates pass, verifier confirms they worked |
| Planner writes task actions without quality pre-loading | Planner embeds `<quality_scan>` in every action block | Phase 3 adds this | Executor arrives at each task with explicit reuse targets and test plan — reduces improvisation |
| No plan-quality gate before execution | Plan-checker Dimension 9 validates quality directives exist | Phase 3 adds this | Plans missing quality scan blocked before they burn executor context |
| Executor enforces quality at write time | Verifier enforces quality at review time + planner enforces at plan time | Phase 2 + Phase 3 | Full loop: plan → execute → verify. Each agent enforces quality within its own scope. |

**What is already done:**
- `quality.level` config key and `config-get` CLI work (Phase 1, CFG-01 through CFG-04)
- `quality.test_exemptions` array in config, readable via `config-get` (Phase 1, CFG-03)
- Executor sentinel with pre-task scan, test gate, diff review (Phase 2, EXEC-01 through EXEC-08)
- Verifier Steps 1-9 structure fully established (gsd-verifier.md current state)
- Plan-checker Dimensions 1-8 structure fully established (gsd-plan-checker.md current state)
- Planner task anatomy with `<action>`, `<verify>`, `<done>`, `<files>` established (gsd-planner.md current state)

**What Phase 3 adds:**
- Step 7b in verifier (the post-execution quality backstop)
- `<quality_scan>` in planner actions (the pre-execution quality pre-load)
- Dimension 9 in plan-checker (the pre-execution quality directive gate)

---

## Open Questions

1. **Should Step 7b affect the overall VERIFICATION.md status?**
   - What we know: Standard mode → all findings WARN (don't block). Strict mode → findings FAIL (do block). User locked this.
   - What's unclear: The current VERIFICATION.md frontmatter has `status: passed | gaps_found | human_needed`. Does a strict-mode Step 7b FAIL produce `status: gaps_found`? Or a new status?
   - Recommendation: Strict mode Step 7b FAILs should set `status: gaps_found` and add entries to the `gaps:` frontmatter. This makes Step 7b failures addressable via `/gsd:plan-phase --gaps`. Standard mode WARN findings do NOT change the status.

2. **How does the verifier get the file list when no SUMMARY.md exists yet?**
   - What we know: `summary-extract` reads SUMMARY.md frontmatter `key-files` field. If Step 7b runs before SUMMARY.md is created (e.g., re-verification), the file list may be absent.
   - What's unclear: Is Step 7b ever run without a SUMMARY.md present?
   - Recommendation: Step 7b runs as part of the normal verification flow (after execution, not before). SUMMARY.md always exists at that point. If SUMMARY.md is missing, Step 7b should skip with a note: "Step 7b: Skipped (no SUMMARY.md found — file list unavailable)."

3. **Should Dimension 9 check `checkpoint:*` task types as well as `auto`?**
   - What we know: `checkpoint:*` tasks have no `<action>` block (per plan-checker Dimension 2 task type table). `<quality_scan>` is nested inside `<action>`.
   - What's unclear: The user said `<quality_scan>` is mandatory for ALL tasks. But checkpoint tasks have no action block.
   - Recommendation: Dimension 9 only checks `type="auto"` tasks. Checkpoint tasks have no action block to put `<quality_scan>` in. The planner self-check should follow the same rule — only validate `auto` tasks.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `agents/gsd-verifier.md` — Step 7 structure (anti-pattern scan), Step 8-9 ordering, VERIFICATION.md output format, existing grep patterns at lines 270-295
- Direct inspection of `agents/gsd-planner.md` — task_breakdown section (task anatomy), `<context_fidelity>` self-check block, plan format with `<action>` nesting
- Direct inspection of `agents/gsd-plan-checker.md` — Dimensions 1-8 structure, issue format, severity levels, skip condition pattern (Dimension 8 skip condition used as template for Dimension 9)
- Direct inspection of `agents/gsd-executor.md` — `<quality_sentinel>` section (lines 103-179) confirming config-gate pattern, Step 4 test existence check, Step 5 diff review; `<context7_protocol>` section
- Direct inspection of `.planning/phases/03-quality-dimensions/03-CONTEXT.md` — all user decisions, locked choices, deferred ideas
- Direct inspection of `.planning/REQUIREMENTS.md` — VRFY-01 through PCHK-02 requirement text
- Direct inspection of `.planning/STATE.md` — accumulated decisions, phase 2 patterns established
- Direct inspection of `get-shit-done/templates/config.json` — `quality.level` and `quality.test_exemptions` confirmed present

### Secondary (MEDIUM confidence)

- Direct inspection of `.planning/phases/02-executor-sentinel/02-RESEARCH.md` — duplication detection approach (grep-based), config-gate pattern details, sentinel structure
- Direct inspection of `.planning/phases/02-executor-sentinel/02-01-SUMMARY.md` through `02-03-SUMMARY.md` — Phase 2 decisions and patterns established

### Tertiary (LOW confidence)

- N/A — all critical claims verified from primary sources (direct file inspection)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all tools (grep, config-get, summary-extract) confirmed from direct inspection of existing agent files
- Architecture: HIGH — Step 7b structure derived from Step 7 pattern already in verifier; `<quality_scan>` format derived from task anatomy already in planner; Dimension 9 derived from Dimension 8 pattern already in plan-checker
- Pitfalls: HIGH — all pitfalls derived from user-locked decisions (fast mode section header requirement, INFO downgrade for CLI exports, no stop-on-first-fail in strict mode) or from Phase 2 research (boilerplate false positives, config gate placement)
- Open questions: MEDIUM — Step 7b status propagation and checkpoint task type handling are interpretive; recommendations are defensible but not confirmed by explicit user decision

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — markdown editing of existing agent files; agent section patterns are unlikely to change)
