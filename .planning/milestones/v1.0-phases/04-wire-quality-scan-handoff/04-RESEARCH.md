# Phase 4: Wire Quality Scan Handoff - Research

**Researched:** 2026-02-23
**Domain:** Agent markdown file editing — wiring `<quality_scan>` directives from planner into executor consumption and fixing plan-checker Dimension 9 config-gate pattern
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | Executor performs targeted codebase scan before each task — grep for existing patterns, utilities, and test baseline relevant to the task | Phase 2 implemented a generic Step 1 scan using `<name>` and `<files>` fields. Phase 4 extends it to consume `<code_to_reuse>` from the task's `<quality_scan>` block as the primary grep input. Planner already populates this field (Phase 3). |
| PLAN-01 | Planner task `<action>` blocks include a `<quality_scan>` subsection specifying existing code to reuse, library docs to consult, and tests to write | Phase 3 implemented the planner-side documentation and self-check gate. Phase 4 closes the loop: the executor must actually read and consume these three fields at runtime. PLAN-01 is a handoff requirement — it is only fully satisfied when both ends are wired. |
| CFG-04 | Every quality gate reads `quality_level` at its entry point before executing any checks | The canonical bash pattern established in Phase 1 is `QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null \|\| echo "fast")`. Plan-checker Dimension 9 currently says "Read `quality.level` from config using `config-get quality.level`" without showing this exact pattern. Phase 4 must update Dimension 9's process instructions to use the canonical bash pattern with the `|| echo "fast"` fallback guard. |

</phase_requirements>

---

## Summary

Phase 4 is a targeted markdown editing phase that wires the Plan→Execute→Verify loop end-to-end. Three agent files receive surgical edits: `agents/gsd-executor.md` (two changes to the `<quality_sentinel>` section) and `agents/gsd-plan-checker.md` (one change to Dimension 9). No new CJS code, no new npm packages, no infrastructure changes.

The planner-side work is complete: Phase 3 established the `<quality_scan>` XML format in `gsd-planner.md` and the self-check gate that enforces population. Every `type="auto"` task action now contains `<code_to_reuse>`, `<docs_to_consult>`, and `<tests_to_write>` subsections (or explicit `N/A`). The plan-checker's Dimension 9 validates their presence before execution. What is missing is the executor consuming these fields at runtime.

The three gaps this phase closes are narrow and independently testable:
1. Executor Step 1 reads `<code_to_reuse>` from the current task's `<action>` block and uses those patterns as grep input — instead of deriving patterns generically from `<name>` and `<files>`.
2. Executor Step 2 reads `<docs_to_consult>` from the current task's `<action>` block before deciding whether to call Context7 — instead of applying its own trigger heuristics independently.
3. Executor's test step consumes `<tests_to_write>` from `<quality_scan>` to guide the mandatory test step — instead of inferring what to test from the produced files alone.
4. Plan-checker Dimension 9 uses the canonical bash pattern with `|| echo "fast"` fallback — for CFG-04 consistency across all quality gates.

**Primary recommendation:** Plan as two parallel Wave 1 tasks: Task A edits `gsd-executor.md` (Steps 1, 2, and test step consumption); Task B edits `gsd-plan-checker.md` (Dimension 9 config-gate fix). These touch separate files with no shared dependency.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `config-get quality.level` (gsd-tools CLI) | existing | Read quality level at every gate entry | CFG-04 canonical pattern; identical across executor, verifier, plan-checker |
| `grep` / Bash | native | Consuming `<code_to_reuse>` patterns; scoped codebase scan | Already used in executor sentinel Step 1 and verifier Step 7b |
| `gsd-tools.cjs` | existing | Config reads, state management, commit tooling | Zero new dependencies |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in XML/text parsing | none | Executor reads task XML fields at runtime | The executor is Claude Code — it reads task `<action>` XML by reading the PLAN.md file; no parse library needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Consuming `<code_to_reuse>` as primary input | Deriving grep patterns from `<name>`+`<files>` (current behavior) | Current approach is generic and cannot use planner's domain knowledge. Consuming the planner's actual patterns is the intended design. |
| Canonical bash pattern with `\|\| echo "fast"` | Prose description without bash pattern | Prose is ambiguous for agents. The bash pattern is machine-precise and matches every other quality gate in the codebase. |

**Installation:** None required. Zero new dependencies.

---

## Architecture Patterns

### Files Modified

Phase 4 touches exactly two files:

```
agents/
├── gsd-executor.md      # MODIFIED: Step 1 reads <code_to_reuse>; Step 2 reads <docs_to_consult>; test step reads <tests_to_write>
└── gsd-plan-checker.md  # MODIFIED: Dimension 9 process step 1 uses canonical bash pattern
```

No new CJS files. No changes to `gsd-planner.md`, `gsd-verifier.md`, `gsd-tools.cjs`, or any other file.

### Pattern 1: Executor Step 1 — Consuming `<code_to_reuse>`

**Current state (lines 116-132 of `gsd-executor.md`):**

```
Step 1: Targeted Codebase Scan (skip if `fast`)

Identify the task's domain from its <name> and <files> fields. Run targeted grep
against files relevant to this domain only — not the full codebase.

[bash example using generic "export.*function" grep]

Rules:
- Scope to directories named in the task's <files> field or adjacent utility directories
- Search for existing exported functions that match the task's domain term
...
```

**Gap:** The executor derives its scan scope generically from `<name>` and `<files>`. The planner has already done this domain analysis and encoded the result in `<code_to_reuse>`. The executor ignores this.

**Required change to Step 1:**

Step 1 must be updated to:
1. Read the `<code_to_reuse>` subsection from the current task's `<action>` block (in the PLAN.md)
2. Use any **Known:** paths as direct reuse candidates to evaluate
3. Use any **Grep pattern:** lines as the actual grep commands to run (rather than deriving patterns)
4. Fall back to the current generic domain-based grep **only if** `<code_to_reuse>` says `N/A`

The fallback is important: tasks with `N/A` in `<code_to_reuse>` (e.g., pure documentation tasks) still run a basic scan, but the planner's explicit patterns take priority.

**Updated Step 1 protocol:**

```
Step 1: Targeted Codebase Scan (skip if `fast`)

Read <code_to_reuse> from the current task's <action> block in the PLAN.md.

If <code_to_reuse> contains Known: entries:
  - Evaluate each named file/function for direct reuse before writing new code.

If <code_to_reuse> contains Grep pattern: lines:
  - Run each pattern exactly as specified. Cap output with | head -10.
  - These patterns were composed by the planner for this task's domain — prefer them
    over generic export scans.

If <code_to_reuse> says N/A:
  - Fall back: identify domain from <name> and <files>, run generic export grep
    scoped to directories the task touches. Cap with | head -10.

Rules (unchanged from current):
- Maximum 10 lines of grep output — truncate with | head -10
- Document reuse decision in commit message
- Never scan node_modules, .git, .planning/, or archived phase directories
```

### Pattern 2: Executor Step 2 — Consuming `<docs_to_consult>`

**Current state (line 134 of `gsd-executor.md`):**

```
Step 2: Context7 Lookup (see <context7_protocol> section — skip if `fast`)
```

Step 2 defers entirely to `<context7_protocol>`, which has its own trigger heuristics (new external library, uncertain API method, framework-specific patterns). These heuristics are applied independently of what the planner put in `<docs_to_consult>`.

**Gap:** The planner may have specified a Context7 library ID and a specific query in `<docs_to_consult>`. The executor currently ignores this and applies its own trigger logic.

**Required change to Step 2:**

Step 2 must be updated to read `<docs_to_consult>` first, and use it to inform the Context7 decision:

```
Step 2: Context7 Lookup (skip if `fast`)

Read <docs_to_consult> from the current task's <action> block in the PLAN.md.

If <docs_to_consult> contains a Context7: entry (e.g., "/org/library — query 'X'"):
  - Resolve and query that library. The planner has pre-identified this as needed.
  - Skip the standard trigger heuristics — proceed directly to the Context7 call.

If <docs_to_consult> says N/A — no external library dependencies:
  - Skip Context7 entirely. The planner determined no docs are needed.

If <docs_to_consult> contains only a plain-text Description: (no Context7 ID):
  - Apply the standard trigger heuristics from <context7_protocol>.
    If triggered, resolve the library ID yourself before querying.

Token discipline (unchanged): one Context7 query per plan execution maximum.
```

**Rationale:** This preserves the `<context7_protocol>` for cases where the planner provided only a description, while giving the planner's explicit Context7 entries priority. It avoids redundant trigger evaluation when the planner has already done the analysis.

### Pattern 3: Executor Test Step — Consuming `<tests_to_write>`

**Current state (Step 4, lines 146-153 of `gsd-executor.md`):**

The post-task test gate (Step 4) checks whether new `.cjs/.js/.ts` files have corresponding test files and writes them if missing. It derives what to test from the produced files' exported functions.

**Gap:** The planner's `<tests_to_write>` specifies the test file path and describes what behaviors to validate (success cases, edge cases). The executor ignores this and infers test content independently.

**Required change to Step 4:**

Step 4 must be updated to read `<tests_to_write>` before writing test files:

```
Step 4: Test Gate (standard: new .cjs/.js/.ts with exports only; strict: always; fast: skip)

Read <tests_to_write> from the current task's <action> block in the PLAN.md.

If <tests_to_write> specifies a File: path and behavior description:
  - Use that file path (not a derived path) for the test file.
  - Use the described behaviors as the test cases: write tests covering the specified
    success cases and edge cases before writing any others.

If <tests_to_write> says N/A — no new exported logic:
  - Skip the test gate for this task. No test file needed.

If <tests_to_write> is absent (task predates Phase 4):
  - Fall back to current behavior: derive test file path from produced file names,
    derive test cases from exported function signatures.

[existing exemption rules: files matching quality.test_exemptions are always exempt]
```

### Pattern 4: Plan-Checker Dimension 9 — CFG-04 Bash Pattern Fix

**Current state (lines 428-431 of `gsd-plan-checker.md`):**

```
### Process

1. Read `quality.level` from config using `config-get quality.level`
2. For each <task type="auto"> in each PLAN.md:
```

**Gap:** This does not show the canonical bash pattern. It describes the intent in prose but omits the `|| echo "fast"` fallback guard that is the established CFG-04 convention across all quality gates.

**Canonical pattern (from Phase 1 research and confirmed in executor line 107):**
```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

**Required change to Dimension 9 Process step 1:**

Replace prose description with the canonical bash pattern:

```
### Process

1. Read quality level using the canonical CFG-04 bash pattern:
   ```bash
   QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
   ```
2. For each <task type="auto"> in each PLAN.md:
```

This is a single line replacement within Dimension 9. It does not affect the skip condition, severity matrix, examples, output block, or revision loop behavior — those remain unchanged.

### Anti-Patterns to Avoid

- **Rewriting the full `<context7_protocol>` section:** Step 2 only needs to check `<docs_to_consult>` first. The `<context7_protocol>` section governs the mechanics of HOW to call Context7. Do not merge these or replace one with the other.
- **Removing the N/A fallback in Step 1:** Tasks with `N/A` in `<code_to_reuse>` (docs, config, markdown) must still run a basic scan. Never silently skip Step 1 entirely.
- **Changing Dimension 9's severity matrix or revision loop:** CFG-04 fix is one line in the Process section. All other Dimension 9 content (skip condition, severity matrix, example issues, output table, revision loop) remains unchanged.
- **Adding logic to read PLAN.md in CJS code:** The executor is Claude Code — it reads PLAN.md as part of its context. "Reading `<code_to_reuse>` from the task's `<action>` block" means Claude reads the XML from the PLAN.md it has in context, not a programmatic parse.
- **Changing the token discipline rule:** One Context7 query per plan execution maximum remains. If `<docs_to_consult>` requests a second query in a later task, the executor follows the existing cap.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading `<docs_to_consult>` | Custom XML parser for PLAN.md | Claude reads the PLAN.md in context as text | The executor is Claude Code; it processes XML by reading the document it has loaded |
| Config-gate bash pattern | Custom quality level check | `config-get quality.level 2>/dev/null \|\| echo "fast"` | CFG-04 canonical pattern; identical to executor sentinel, verifier Step 7b |
| Test file naming | Derive from produced file | Use `<tests_to_write>` File: path directly | Planner has domain knowledge about correct test file placement |

**Key insight:** Phase 4 is a two-file markdown editing phase. All tooling already exists. The work is adding precise protocol instructions that direct the executor to read specific XML fields from the plan it is executing.

---

## Common Pitfalls

### Pitfall 1: Step 1 Discarding Planner Knowledge When Grep Pattern Fails

**What goes wrong:** The executor runs the `<code_to_reuse>` grep pattern, finds no matches, and concludes there is nothing to reuse — without considering the Known: entries that name specific files and functions.

**Why it happens:** The grep pattern and the Known: entries are treated as alternatives rather than complements.

**How to avoid:** Step 1 must evaluate Known: entries and Grep pattern: lines independently. A grep that returns zero results is still informative (no match = write new code). Known: entries must always be evaluated regardless of grep output.

**Warning signs:** Step 1 running a grep from `<code_to_reuse>` but not checking the Known: named paths.

### Pitfall 2: Step 2 Calling Context7 Even When `<docs_to_consult>` Says N/A

**What goes wrong:** The executor reads `<docs_to_consult>` as N/A but still applies the standard `<context7_protocol>` trigger heuristics, which fire because the task uses an external library.

**Why it happens:** Step 2 reads `<docs_to_consult>` but then falls through to standard trigger evaluation regardless.

**How to avoid:** `N/A — no external library dependencies` in `<docs_to_consult>` must be a hard skip — the planner determined this, and the executor must honor it. The planner and executor must agree on what N/A means.

**Warning signs:** Context7 calls on tasks where the planner explicitly said N/A.

### Pitfall 3: `<tests_to_write>` N/A Overriding Test Exemption Check

**What goes wrong:** A task produces a `.cjs` file with exports but `<tests_to_write>` says N/A. The executor skips the test gate entirely, bypassing the mandatory test requirement.

**Why it happens:** Step 4 defers to `<tests_to_write>` N/A without checking whether the file type and export pattern mandate a test.

**How to avoid:** `N/A` in `<tests_to_write>` is only valid when the task produces no `.cjs/.js/.ts` files with exports OR when the files match `quality.test_exemptions`. If a task produces an exported `.cjs` file, the executor must write tests even if `<tests_to_write>` says N/A — the planner may have made an error. Log this as a deviation (Rule 2: missing critical functionality).

**Warning signs:** Committed `.cjs` files with exports but no test file, where `<tests_to_write>` said N/A.

### Pitfall 4: Dimension 9 Process Step Numbering Shifted by the Edit

**What goes wrong:** Replacing step 1 in Dimension 9's process with a bash pattern accidentally shifts or removes the subsequent steps if done without care.

**Why it happens:** Markdown editing inserts a fenced code block at step 1, which can misalign bullet numbering if the surrounding prose is not preserved exactly.

**How to avoid:** The edit is a single targeted replacement of step 1's content. Steps 2 and 3 remain unchanged. Verify with `grep -n "Process" gsd-plan-checker.md` after edit to confirm the block is intact.

**Warning signs:** Dimension 9 Process section with only one step after the edit.

### Pitfall 5: Breaking the E2E Loop with Overly Strict Step 2 Logic

**What goes wrong:** Step 2 is updated to require `<docs_to_consult>` to have a Context7 entry before making any Context7 call. Tasks that predate Phase 4 (no `<quality_scan>`) lose Context7 access entirely.

**Why it happens:** The fallback case (no `<quality_scan>`) is not handled.

**How to avoid:** If `<quality_scan>` or `<docs_to_consult>` is absent from the task action (task predates Phase 4), fall back to the standard `<context7_protocol>` trigger heuristics in full. The new behavior applies only when `<docs_to_consult>` is explicitly present.

---

## Code Examples

### Step 1 Revised Protocol (for gsd-executor.md)

```
**Step 1: Targeted Codebase Scan** (skip if `fast`)

Read `<code_to_reuse>` from the current task's `<action>` block in the PLAN.md.

**If `<code_to_reuse>` contains `Known:` entries:**
- Evaluate each named file/function as a reuse candidate before writing new code.

**If `<code_to_reuse>` contains `Grep pattern:` lines:**
- Run each pattern exactly as specified. Cap output with `| head -10`.
  ```bash
  # Use the pattern from <code_to_reuse> directly:
  # e.g., grep -rn "cmdConfigGet\|quality.level" get-shit-done/bin/lib/ --include="*.cjs" | head -10
  ```
- These patterns encode the planner's domain analysis — prefer them over generic export scans.

**If `<code_to_reuse>` says `N/A` (or is absent — task predates Phase 4):**
- Fall back: identify domain from `<name>` and `<files>`, run generic targeted grep scoped to directories the task touches. Cap with `| head -10`.

**Rules (all cases):**
- Maximum 10 lines of grep output — truncate with `| head -10`
- If similar function found: evaluate for reuse before writing new code
- Document reuse decision in commit message: "Reuses X from Y" or "New because X differs in Z way"
- Never scan `node_modules`, `.git`, `.planning/`, or archived phase directories
```

### Step 2 Revised Protocol (for gsd-executor.md)

```
**Step 2: Context7 Lookup** (skip if `fast`)

Read `<docs_to_consult>` from the current task's `<action>` block in the PLAN.md.

**If `<docs_to_consult>` contains a `Context7:` entry** (e.g., `Context7: /org/library — query "specific question"`):
- Call Context7 for this library with the specified query. The planner has pre-identified this as needed.
- Skip the standard trigger heuristics — proceed directly to the Context7 call.

**If `<docs_to_consult>` says `N/A — no external library dependencies`:**
- Skip Context7 entirely for this task. The planner determined no docs are needed.

**If `<docs_to_consult>` contains only a `Description:` (no Context7 ID), or is absent:**
- Apply the standard trigger heuristics from `<context7_protocol>`.

Token discipline: one Context7 query per plan execution maximum (see `<context7_protocol>`).
```

### Step 4 Revised Protocol (for gsd-executor.md)

```
**Step 4: Test Gate** (standard: new `.cjs/.js/.ts` with exports only; strict: always; fast: skip)

Read `<tests_to_write>` from the current task's `<action>` block in the PLAN.md.

**If `<tests_to_write>` specifies a `File:` path and behavior description:**
- Use that file path for the test file.
- Use the described behaviors as the test cases (success cases and edge cases specified).

**If `<tests_to_write>` says `N/A — no new exported logic`:**
- Skip the test gate for this task, UNLESS the task produced a `.cjs/.js/.ts` file with
  exports that is not in `quality.test_exemptions`. In that case, write tests and log
  as a deviation (Rule 2: planner marked N/A but new exported logic was produced).

**If `<tests_to_write>` is absent (task predates Phase 4):**
- Fall back to current behavior: derive test file path and test cases from the produced
  files and their exported function signatures.

[Remaining exemption rules unchanged: files matching `quality.test_exemptions` are always exempt]
```

### Dimension 9 Process Step 1 Fix (for gsd-plan-checker.md)

Current text to replace:
```
1. Read `quality.level` from config using `config-get quality.level`
```

Replacement:
```
1. Read quality level using the canonical CFG-04 bash pattern:
   ```bash
   QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
   ```
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Executor Step 1 derives grep from `<name>`+`<files>` | Step 1 reads `<code_to_reuse>` from `<quality_scan>` | Phase 4 | Planner's domain analysis used directly; no re-derivation |
| Executor Step 2 applies own Context7 trigger heuristics | Step 2 reads `<docs_to_consult>` from `<quality_scan>` first | Phase 4 | Planner's library identification honored; Context7 skip when planner says N/A |
| Executor Step 4 infers test content from file exports | Step 4 reads `<tests_to_write>` from `<quality_scan>` | Phase 4 | Planner's test specification used as primary guide |
| Dimension 9 process uses prose description of config read | Dimension 9 uses canonical bash pattern with `\|\| echo "fast"` | Phase 4 | CFG-04 consistency across all quality gates |

**What is already complete (do not change):**

- `gsd-planner.md`: `<quality_scan>` format documented with three required subsections, nesting example, population rules (Phase 3, PLAN-01 planner-side, PLAN-02)
- `gsd-planner.md`: Self-check gate that rejects plans with missing/empty `<quality_scan>` (Phase 3)
- `gsd-plan-checker.md`: Dimension 9 structure — skip condition, question, severity matrix, example issues, output table, revision loop behavior (Phase 3, PCHK-01, PCHK-02)
- `gsd-executor.md`: `<quality_sentinel>` section with pre-task and post-task protocols, fast bypass, gate behavior matrix (Phase 2)
- `gsd-executor.md`: `<context7_protocol>` with trigger conditions, skip conditions, token discipline (Phase 2)
- `gsd-executor.md`: `execute_tasks` step wired to call pre-task and post-task sentinel (Phase 2)
- `get-shit-done/templates/config.json`: `quality.level: "fast"` and `quality.test_exemptions` present (Phase 1)
- `config-get quality.level` CLI with dot-notation traversal (Phase 1)

---

## Open Questions

1. **Should Step 1's fallback (when `<code_to_reuse>` is absent) match the current behavior exactly or be simplified?**
   - What we know: The current Step 1 says "Identify the task's domain from its `<name>` and `<files>` fields." This is unchanged for the N/A case.
   - What's unclear: Should the fallback trigger only when `<quality_scan>` is entirely absent (task predates Phase 4), or also when `<code_to_reuse>` contains only `N/A`?
   - Recommendation: Trigger fallback for both: `N/A` and absent. Behavioral difference is zero — the planner confirmed no reuse targets exist, and the executor uses its own heuristic as a safety net.

2. **Should Step 2 completely override Context7 trigger heuristics when `<docs_to_consult>` has a Context7 entry, or just add it as a trigger?**
   - What we know: The planner's Context7 entry is specific to the task. The heuristics in `<context7_protocol>` are general.
   - What's unclear: If the planner specified Context7 for library X, and the task also uses library Y (which would trigger the heuristic), what happens?
   - Recommendation: One Context7 query maximum per plan execution. If the planner specified a Context7 entry, use that. Trust the planner's judgment. Document in commit if a second library was also relevant but skipped.

3. **Is an E2E integration test plan needed as a third plan in Phase 4?**
   - What we know: Phase 2 had a Plan 03 that ran integration checks across all Phase 2 changes. Phase 3 was verified end-to-end by the gsd-verifier.
   - What's unclear: Phase 4 changes are to markdown instruction files, not CJS code. End-to-end testing requires executing a plan and observing executor behavior — not feasible via automated test fixture.
   - Recommendation: No separate integration plan. Include verification steps in each task's `<verify>` element that confirm the correct text appears in the right location (grep-based). The Phase 4 verifier will validate the wiring end-to-end.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `agents/gsd-executor.md` — `<quality_sentinel>` section (lines 103-179): current Step 1, Step 2 reference, Step 4 test gate; `<context7_protocol>` section (lines 371-418); `execute_tasks` wiring at lines 86, 90
- Direct inspection of `agents/gsd-plan-checker.md` — Dimension 9 block (lines 414-490): current Process step 1 text ("Read `quality.level` from config using `config-get quality.level`"), skip condition, severity matrix
- Direct inspection of `agents/gsd-planner.md` — `<quality_scan>` format documentation (lines 163-204): three subsections, Known/Grep pattern/Description structure, N/A rules, nesting requirement
- Direct inspection of `.planning/REQUIREMENTS.md` — EXEC-01 (pending), PLAN-01 (pending), CFG-04 (complete in Phase 1 but Dimension 9 not yet consistent) traceability table
- Direct inspection of `.planning/phases/01-foundation/01-RESEARCH.md` — CFG-04 canonical bash pattern established: `QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")`
- Direct inspection of `.planning/phases/03-quality-dimensions/03-VERIFICATION.md` — Phase 3 verified status, evidence that PLAN-01 planner-side is satisfied but executor consumption is not
- Direct inspection of `.planning/STATE.md` — accumulated decisions, Phase 3 completion status, EXEC-01/PLAN-01 reset to Pending for Phase 4

### Secondary (MEDIUM confidence)

- `.planning/phases/02-executor-sentinel/02-03-SUMMARY.md` — Integration Check 5 confirms EXEC-01 was verified in Phase 2 (generic Step 1 exists), explaining why EXEC-01 was later reset to Pending: the generic scan passed but planner-driven consumption was not yet possible (Phase 3 planner format came after Phase 2)
- `.planning/phases/03-quality-dimensions/03-RESEARCH.md` — Confirmed canonical bash pattern must be used in Dimension 9 (listed as "identical pattern must be used")

### Tertiary (LOW confidence)

- N/A — all claims verified from primary sources

---

## Metadata

**Confidence breakdown:**
- EXEC-01 gap identification: HIGH — direct inspection confirms executor Step 1 does not reference `<code_to_reuse>`; planner populates it (Phase 3 verified)
- PLAN-01 gap identification: HIGH — REQUIREMENTS.md traceability shows PLAN-01 reset to Pending; Phase 3 verification confirms planner-side complete, executor-consumption-side not yet wired
- CFG-04 gap identification: HIGH — direct inspection of Dimension 9 process step 1 vs. canonical pattern in executor line 107; gap is one prose line vs. one bash pattern
- Architecture (two-file edit scope): HIGH — no shared file conflicts; changes are additive to existing sections
- Pitfalls: HIGH — derived from locked decisions in Phase 2 and Phase 3 (N/A handling, fallback behavior, Context7 one-query cap)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — markdown editing of existing agent files; no external API dependencies)
