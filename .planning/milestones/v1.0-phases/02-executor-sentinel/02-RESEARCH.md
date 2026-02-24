# Phase 2: Executor Sentinel - Research

**Researched:** 2026-02-23
**Domain:** Agent markdown file editing, MCP configuration, quality protocol design in LLM agent instructions
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXEC-01 | Executor performs targeted codebase scan before each task — grep for existing patterns, utilities, and test baseline relevant to the task | Addressed by `<quality_sentinel>` pre-task section: targeted grep against task-relevant directories; cap output at 10 results; skip in fast mode |
| EXEC-02 | Executor has Context7 MCP tools (`resolve-library-id`, `query-docs`) in its tools frontmatter and calls them before implementing code using external libraries | Two changes: (1) add `mcp__context7__*` to the `tools:` frontmatter line of `agents/gsd-executor.md`; (2) add `<context7_protocol>` section specifying when and how to call these tools |
| EXEC-03 | Executor runs mandatory test step for new logic — any task creating new `.cjs/.js/.ts` files with exported functions gets test coverage before commit | Addressed by `<quality_sentinel>` post-task section: check if task produced new `.cjs/.js/.ts` with exported functions; if so, write test file before the commit runs; gate is skipped in fast mode, required in standard/strict |
| EXEC-04 | Executor performs post-task diff review before each commit — reads own diff, checks for duplication, validates naming consistency | Addressed by `<quality_sentinel>` post-task section: `git diff --staged` → self-report duplication or naming inconsistency found; gate is skipped in fast mode |
| EXEC-05 | Quality Sentinel protocol is documented as `<quality_sentinel>` section in `gsd-executor.md` with pre-task, during-task, and post-task gates | This is the section name. Research confirms the three-phase structure (pre-task, during-task, post-task) with config-gated behavior. |
| EXEC-06 | Context7 usage protocol is documented as `<context7_protocol>` section in `gsd-executor.md` specifying when and how to consult library docs | This is a distinct named section. Research confirms its required contents: trigger conditions, the two-step tool call sequence, token discipline rules, and fast-mode bypass. |
| EXEC-07 | `.mcp.json` includes Context7 MCP server configuration (project-scoped) | `.mcp.json` file in project root with `mcpServers.context7` entry using `npx -y @upstash/context7-mcp@latest`. Exact format confirmed from existing project `.mcp.json` files. |
| EXEC-08 | Quality gates are skipped entirely when `quality.level` is `fast`; reduced gates for `standard`; all gates for `strict` | Config-gate pattern: read `quality.level` via `config-get` at sentinel entry; each gate is wrapped in a level check. Behavior matrix defined in Architecture Patterns section. |

</phase_requirements>

---

## Summary

Phase 2 is a pure markdown editing phase. No new CJS code is written — all changes are to two files: `agents/gsd-executor.md` (adding new protocol sections and modifying the tools frontmatter) and creating `.mcp.json` at the project root. The config foundation from Phase 1 (`quality.level` defaults to `fast`, readable via `config-get quality.level`) is the dependency this phase builds on.

The three plans map cleanly to three additive edits to `gsd-executor.md`, each independent in scope: (1) add Context7 to the tools frontmatter and create `.mcp.json`; (2) write the `<quality_sentinel>` and `<context7_protocol>` sections as new named blocks; (3) wire the quality-level config reads into each sentinel gate so fast/standard/strict gating works end to end. Plans 02-01 and 02-02 can proceed in any order; Plan 02-03 must come last because it edits the sections that Plans 02-01 and 02-02 create.

The single highest-risk element is context budget: the quality sentinel adds an estimated 6-16K tokens of overhead per executor task (pre-task scan ~2-5K, Context7 query ~3-8K, post-task diff ~1-3K). The STATE.md blocker note confirms this risk and recommends targeting ~40% context budget (not 50%) when quality gates are active. The protocol sections must encode this discipline explicitly — output caps, targeted queries, and fast-mode escapes are mandatory in the sentinel spec, not optional.

**Primary recommendation:** Implement all three plans sequentially with Plan 02-03 as the final wiring step. Every sentinel gate must read `quality.level` at its entry point — do not defer the config wiring to a later pass.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@upstash/context7-mcp` | `latest` (via `npx -y`) | Provides `resolve-library-id` and `query-docs` MCP tools to the executor | Already used in `gsd-planner.md` and `gsd-phase-researcher.md`; consistent with existing agent tool frontmatter pattern |
| `config-get quality.level` (gsd-tools CLI) | existing | Read quality level at sentinel entry to gate all quality checks | Phase 1 added `quality.level` to config; `cmdConfigGet` with dot-notation is already functional |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `grep` / Bash (Grep tool) | native | Pre-task codebase scan — find existing patterns | Every sentinel pre-task step in standard/strict mode |
| `git diff --staged` (Bash) | native | Post-task diff review before commit | Every sentinel post-task step in standard/strict mode |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `npx -y @upstash/context7-mcp@latest` | Pinned version like `@upstash/context7-mcp@1.4.1` | Pinning avoids surprise breaking changes but requires manual updates. `@latest` matches the pattern used in other project `.mcp.json` files (GymRats, Gymrats2) and reduces maintenance burden. Use `@latest`. |
| Project-scoped `.mcp.json` | User-scoped MCP config in `~/.claude/settings.json` | User-scope means every developer's machine needs manual setup. Project-scoped `.mcp.json` is committed to git and auto-applied by Claude Code for all project collaborators. Use project-scope. |
| Separate quality agent | Inline `<quality_sentinel>` section in executor | Separate agent requires 30-50K token context handoff per task. Inline sentinel operates within the executor's already-loaded context at ~6-16K overhead per task. Inline is the decided architectural pattern. |

**Installation:**

No `npm install` is required. The `.mcp.json` configuration causes Claude Code to start the Context7 server via `npx` on first use. No package.json changes are needed for the GSD framework itself.

```bash
# Context7 MCP server is invoked automatically by Claude Code via .mcp.json
# No developer action required beyond committing the .mcp.json file
```

---

## Architecture Patterns

### Recommended File Structure

Phase 2 modifies exactly two files and creates one new file:

```
agents/
└── gsd-executor.md      # MODIFIED: add mcp__context7__* to tools frontmatter
                         # MODIFIED: add <context7_protocol> section (new)
                         # MODIFIED: add <quality_sentinel> section (new)
                         # MODIFIED: wire quality gates in execute_tasks step

.mcp.json                # NEW: project-scoped Context7 MCP configuration
```

No new CJS files. No new test files. No changes to `gsd-tools.cjs` or any other agent.

### Pattern 1: Tools Frontmatter Extension

**What:** Add `mcp__context7__*` to the `tools:` line in `gsd-executor.md`'s YAML frontmatter.

**Current state:**
```yaml
---
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---
```

**Target state:**
```yaml
---
name: gsd-executor
description: Executes GSD plans with atomic commits, deviation handling, checkpoint protocols, and state management. Spawned by execute-phase orchestrator or execute-plan command.
tools: Read, Write, Edit, Bash, Grep, Glob, mcp__context7__resolve_library_id, mcp__context7__query_docs
color: yellow
---
```

**Precedent:** `gsd-planner.md` uses `mcp__context7__*` wildcard; `gsd-phase-researcher.md` uses the same wildcard. The executor should use the specific tool names (`mcp__context7__resolve_library_id`, `mcp__context7__query_docs`) rather than a wildcard to minimize tool surface area.

**Confidence:** HIGH — direct inspection of `agents/gsd-planner.md` line 4 confirms the pattern.

### Pattern 2: `.mcp.json` File Format

**What:** Create `.mcp.json` in the project root to provide Context7 MCP server configuration that Claude Code picks up automatically.

**Exact format (confirmed from multiple live project files):**
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

**Source:** Direct inspection of `/Users/tmac/Projects/GymRats/.mcp.json` and `/Users/tmac/Projects/Gymrats2/.mcp.json` — both use this exact format with `@upstash/context7-mcp@latest`.

**No API key required** for the free tier. The `DEFAULT_MINIMUM_TOKENS` behavior: previously hardcoded at 10,000 tokens (a known issue per GitHub issue #659), now reduced to 1,000 tokens as of a recent fix. The protocol sections must cap query scope via specific query strings, not rely on token minimums.

**Placement:** Project root (same directory as `package.json`, `README.md`). This is the project-scoped location Claude Code reads automatically.

### Pattern 3: `<quality_sentinel>` Section Structure

**What:** A new named XML section added to `gsd-executor.md` that defines pre-task, during-task, and post-task quality protocols. The section is referenced by the `<execute_tasks>` step.

**Placement in file:** After `</execution_flow>` and before `<deviation_rules>`. This ensures the sentinel is loaded after execution flow context but before deviation handling, which is the natural reading order.

**Structure:**

```xml
<quality_sentinel>

Read quality level at sentinel entry — all gates are conditional on this value:
```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

**If `QUALITY_LEVEL` is `fast`: skip ALL sentinel steps. Proceed directly to task implementation.**

---

## Pre-Task Protocol (runs before each type="auto" task)

**Step 1: Targeted Codebase Scan** (skip if `fast`)

Identify the task's domain from its `<name>` and `<files>` fields. Run targeted grep against files relevant to this domain only — not the full codebase.

```bash
# Example: task involves "validators" → scan src/lib/validators/ and src/utils/
# Cap output: pipe to head -10 to limit results
grep -rn "export.*function\|export const" src/lib/ --include="*.cjs" 2>/dev/null | head -10
```

Rules:
- Scope to directories named in the task's `<files>` field or adjacent utility directories
- Search for existing exported functions that match the task's domain term
- If similar function found: evaluate for reuse before writing new code
- Maximum 10 lines of grep output — truncate with "... N more" if exceeded
- Document reuse decision in commit message: "Reuses X from Y" or "New because X differs in Z way"
- Never scan `node_modules`, `.git`, `.planning/`, or archived phase directories

**Step 2: Context7 Lookup** (see `<context7_protocol>` section — skip if `fast`)

**Step 3: Test Baseline** (skip if `fast`)
```bash
node --test tests/*.test.cjs 2>&1 | tail -3
```
Record: pass count before changes. If baseline is red, document in SUMMARY.md under "Issues Encountered."

---

## Post-Task Protocol (runs before commit, after all files written)

**Step 4: Test Gate** (standard: new logic only; strict: always; fast: skip)

For each file produced by this task:
- If file is `.cjs`, `.js`, or `.ts` AND contains `export` keyword:
  - Check if corresponding test file exists (same name + `.test.` prefix)
  - If test file missing: write it now, before commit
  - Test file must exercise the exported function(s) with at least one success and one edge case
- Files matching `quality.test_exemptions` (`.md`, `.json`, `templates/**`, `.planning/**`) are exempt

**Step 5: Diff Review** (standard and strict; skip if `fast`)
```bash
git diff --staged
```
Self-report any of the following found in staged diff:
- Function or variable names that conflict with existing names in the codebase
- Logic blocks that duplicate code already found in the pre-task scan (Step 1)
- TODO or FIXME comments left in changed lines
- Error paths with no handling

Report findings in SUMMARY.md under "Deviations from Plan → Auto-fixed Issues" or "Issues Encountered." Fix before committing if fix scope is within Rules 1-3. Escalate to Rule 4 if architectural.

</quality_sentinel>
```

**Key constraints encoded in the section:**
- `fast` bypass is the FIRST check — executor exits sentinel immediately, zero overhead
- Output caps are explicit (head -10, tail -3) — prevent context blowout
- Test gate exemptions reference `quality.test_exemptions` — consistent with CFG-03
- Self-report language ("self-report any of the following") — makes diffuse AI instruction concrete

### Pattern 4: `<context7_protocol>` Section Structure

**What:** A distinct section from `<quality_sentinel>` that specifies exactly when and how to call Context7 tools. Referenced from the sentinel's Step 2.

**Placement in file:** After `<quality_sentinel>` and before `<deviation_rules>`.

**Structure:**

```xml
<context7_protocol>

## When to Consult Context7

**Trigger conditions (call Context7 before implementing):**
- Task uses an external library listed in `package.json` that has not been used in the current executor session
- Task references a specific API method you're uncertain about (auth flows, date manipulation, ORM queries, validation schemas, HTTP client methods)
- Task involves a framework pattern where version-specific behavior matters (routing, middleware, hooks)

**Skip conditions (do NOT call Context7):**
- Task modifies only `.md`, `.json`, or template files
- Task uses only Node.js built-in modules (`fs`, `path`, `os`, `node:test`, `node:assert`)
- Library was already consulted in this same executor session (results still in context)
- `quality.level` is `fast`

## How to Call Context7

**Step 1: Resolve library ID**
```
mcp__context7__resolve_library_id(
  libraryName: "{library name from package.json}",
  query: "{specific pattern you need, e.g., 'schema validation with optional fields'}"
)
```

**Step 2: Query specific docs**
```
mcp__context7__query_docs(
  libraryId: "{id from step 1}",
  query: "{the exact method or pattern needed — not the full library overview}"
)
```

## Token Discipline

- Query for the specific method or pattern needed — not the library overview
- One Context7 query per plan execution maximum (if multiple lookups needed, the plan is too broad)
- Extract 3-5 key facts from the response and hold them as working state
- Do not quote more than 200 tokens of Context7 response in your implementation comments
- If Context7 returns more than ~2,000 tokens on a single query, extract only the directly relevant code example

## In `standard` mode:
Call Context7 only when the trigger conditions above are met.

## In `strict` mode:
Call Context7 before implementing any external library usage, regardless of prior session usage. No exceptions.

</context7_protocol>
```

### Pattern 5: Quality Level Config Read (CFG-04 Pattern)

**What:** Every sentinel gate reads `quality.level` before executing. This is the CFG-04 convention established in Phase 1.

**Exact bash pattern (established in Phase 1, used by all gates):**
```bash
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

**Gate behavior matrix** (from ARCHITECTURE.md Pattern 4, confirmed):

| Gate | fast | standard | strict |
|------|------|----------|--------|
| Pre-task codebase scan | Skip | Run | Run |
| Context7 lookup | Skip | Conditional (new deps only) | Always |
| Test baseline record | Skip | Run | Run |
| Test gate (new logic) | Skip | New `.cjs/.js/.ts` with exports | Always |
| Post-task diff review | Skip | Run | Run |

**`execute_tasks` step integration:** The `<execute_tasks>` step's `type="auto"` branch currently reads:
```
- Execute task, apply deviation rules as needed
- Run verification, confirm done criteria
- Commit (see task_commit_protocol)
```

It must be updated to:
```
- **Run quality_sentinel pre-task protocol** (see <quality_sentinel>)
- Execute task, apply deviation rules as needed
- **Run quality_sentinel post-task protocol** (see <quality_sentinel>) before committing
- Commit (see task_commit_protocol)
```

This is a two-line addition to the existing step — do not restructure the step, just insert the quality_sentinel invocations at the correct points.

### Anti-Patterns to Avoid

- **Full codebase scan:** Running `find . -name "*.cjs"` or reading all files is the opposite of targeted. Scan only the directories mentioned in the task's `<files>` field.
- **Deferring config wiring:** All gates must read `quality.level` from the moment they are written. Do not write gates that "always run" and plan to add config wiring later — this is the exact pattern PITFALLS.md Pitfall 7 warns against.
- **Multiple Context7 queries per plan:** One query per plan execution. If a task needs docs for three libraries, that plan is too broad and should be split. Do not call Context7 three times.
- **Missing `fast` bypass:** The first instruction in `<quality_sentinel>` must be the `fast` check. Any gate written before this check means fast-mode users pay quality overhead they opted out of.
- **Wildcard MCP tool in executor:** Use specific tool names (`mcp__context7__resolve_library_id`, `mcp__context7__query_docs`) not `mcp__context7__*` — executor tool surface should be minimal.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Library documentation lookup | Embedding library docs in CLAUDE.md | `mcp__context7__resolve_library_id` + `mcp__context7__query_docs` | Context7 is always current; CLAUDE.md docs go stale and burn permanent context budget |
| Quality level config reading | Hardcoded `if strict_mode` logic | `config-get quality.level` via gsd-tools | Phase 1 already added the config key and `cmdConfigGet` supports dot-notation; don't duplicate |
| Codebase pattern search | Full-file reads of all CJS files | `grep -rn "export.*function" src/ --include="*.cjs" | head -10` | Targeted grep is already available as the Bash tool; reading full files burns 5-50x more context |
| Test file existence checking | Running the full test suite | `[ -f "${task_file%.cjs}.test.cjs" ]` shell check | Suite-level test runs are too slow as a per-gate check; existence check is sufficient for EXEC-03 |

**Key insight:** Phase 2 is entirely additive markdown editing. No new infrastructure needs to be built — the tools exist (`config-get`, `grep`, `git diff --staged`, Context7 MCP). The work is writing precise protocol instructions that use these existing tools correctly.

---

## Common Pitfalls

### Pitfall 1: Context Budget Exhaustion from Quality Gates

**What goes wrong:** Quality sentinel adds ~6-16K tokens per task on top of the 40-75K executor baseline. Plans with 3 tasks at maximum complexity can push the executor past its effective context budget before the final task.

**Why it happens:** Pre-task grep output is not capped. Context7 returns broad docs on a vague query. Both get dumped into context uncapped.

**How to avoid:**
- Grep output hard cap: `| head -10` on all scan commands — non-negotiable
- Context7 query must name the exact method/pattern, not the library
- STATE.md blocker note confirms: target ~40% context budget (not 50%) when gates are active
- Phase 2 plans should be sized for 2 tasks max to leave headroom

**Warning signs:** Plans that previously completed in 2 minutes now stall mid-execution; executor produces "deferred to next task" in SUMMARY.md.

### Pitfall 2: `fast` Bypass Not Being the First Check

**What goes wrong:** The `fast` bypass check is added near the bottom of the sentinel (or per-gate) instead of at the top entry point. Fast-mode executors still run the QUALITY_LEVEL config read and multiple bash commands before discovering they should skip everything.

**Why it happens:** Sections are written gate-by-gate, and the bypass check is added "to each gate" rather than as a unified top-level guard.

**How to avoid:** The very first instruction in `<quality_sentinel>` must be the `fast` check. A single guard at the section entry is preferable to per-gate checks — simpler for the executor to follow and less prone to missing a gate.

**Warning signs:** `fast` mode executors still running `config-get` at sentinel entry (detectable by checking execution time or trace output).

### Pitfall 3: Test Gate False-Positives on Exempt Files

**What goes wrong:** The test gate fires for `.md` template changes or `.json` config updates, demanding test files for files that have no testable logic.

**Why it happens:** The gate checks for any file produced by the task without checking exemptions first.

**How to avoid:** Test gate logic must check `quality.test_exemptions` before requiring a test file. The sentinel spec must explicitly state: "Files matching `.md`, `.json`, `templates/**`, `.planning/**` are exempt — skip test gate for these files." The exemption list is already in the config (`CFG-03` from Phase 1); the sentinel must reference it.

**Warning signs:** Test gate requiring tests for `.planning/` files or `.md` documentation.

### Pitfall 4: `mcp__context7__*` Wildcard in tools Frontmatter

**What goes wrong:** Using `mcp__context7__*` wildcard (like planner/researcher) grants the executor access to any future Context7 tools added to the MCP server. The executor should have minimal tool surface.

**Why it happens:** Copying the planner's frontmatter pattern without considering that the planner is a research agent while the executor is an implementation agent with a tighter scope.

**How to avoid:** Enumerate specific tool names: `mcp__context7__resolve_library_id, mcp__context7__query_docs`. If Context7 adds new tools in the future, the executor doesn't pick them up automatically.

**Warning signs:** Executor using undocumented Context7 tools not mentioned in the protocol.

### Pitfall 5: `.mcp.json` Missing from Project Root

**What goes wrong:** The executor's frontmatter lists Context7 tools, but Claude Code doesn't have an MCP server providing them. Tool calls fail silently or the executor treats them as unavailable.

**Why it happens:** The `.mcp.json` creation is done in Plan 02-01 but gets skipped or placed in the wrong location.

**How to avoid:** `.mcp.json` must be in the project root (same directory as `package.json`). The file must be committed to git so all collaborators pick it up. Plan 02-01 must include a verification step: confirm `cat .mcp.json` outputs the expected `mcpServers.context7` block.

**Warning signs:** `mcp__context7__resolve_library_id` calls returning errors or not appearing in executor tool usage.

---

## Code Examples

Verified patterns from existing project files and direct inspection:

### `.mcp.json` (Project Root)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

Source: Direct inspection of `/Users/tmac/Projects/GymRats/.mcp.json` and `/Users/tmac/Projects/Gymrats2/.mcp.json` — both files use this exact format.

### Quality Level Config Read (CFG-04 Pattern)

```bash
# At sentinel entry point — fast bypass guard
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
```

Source: Established in Phase 1 (see `01-02-SUMMARY.md` patterns-established field) and documented in `ARCHITECTURE.md` Pattern 4.

### Targeted Pre-Task Codebase Scan

```bash
# Scope: directories from task's <files> field only
# Cap: head -10 mandatory
grep -rn "export.*function\|export const" get-shit-done/bin/lib/ --include="*.cjs" 2>/dev/null | head -10
```

Source: ARCHITECTURE.md Pattern 1 implementation sketch, adapted to GSD's CJS structure.

### Test File Existence Check

```bash
# For a new file at path like get-shit-done/bin/lib/quality.cjs
TASK_FILE="get-shit-done/bin/lib/quality.cjs"
TEST_FILE="${TASK_FILE%.cjs}.test.cjs"
[ -f "$TEST_FILE" ] && echo "test exists" || echo "MISSING: write test before commit"
```

Source: ARCHITECTURE.md Pattern 4 gate table; adapted for GSD's `.test.cjs` naming convention (confirmed by `tests/phase.test.cjs`, `tests/init.test.cjs` naming patterns).

### Post-Task Diff Review

```bash
git diff --staged
# Review output for: duplicate logic vs scan results, naming conflicts, TODO/FIXME, unhandled errors
# Self-report in commit message or SUMMARY.md
```

Source: ARCHITECTURE.md quality flow diagram; EXEC-04 requirement specifies "reads own diff, checks for duplication, validates naming consistency."

### Context7 Two-Step Pattern (from existing planner/researcher agents)

The executor will use the same tool call pattern already present in `gsd-planner.md` (line 4 frontmatter) and `gsd-phase-researcher.md` (lines 113-114):

```
Step 1: mcp__context7__resolve_library_id(libraryName, query)
Step 2: mcp__context7__query_docs(libraryId, query)
```

The query in Step 2 must name the exact method/pattern — not the library name. This is the discipline that prevents token bloat (Pitfall 6 in PITFALLS.md).

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| No pre-task scan | Targeted grep scan before each task | Not yet in executor | Phase 2 adds this via `<quality_sentinel>` pre-task protocol |
| Training data for library APIs | Context7 MCP lookup before implementing external libraries | Already in planner/researcher | Phase 2 adds to executor via frontmatter + protocol section |
| No test requirement in executor | Test gate for new `.cjs/.js/.ts` with exports | Not yet in executor | Phase 2 adds via `<quality_sentinel>` post-task Step 4 |
| No diff review before commit | `git diff --staged` self-review | Not yet in executor | Phase 2 adds via `<quality_sentinel>` post-task Step 5 |
| No quality level gating | All gates gated on `quality.level` from config | Config key exists (Phase 1) | Phase 2 wires gates to config reads |

**What has already been done (Phase 1 delivers):**
- `quality.level: "fast"` exists in `config.json` template and hardcoded defaults in `config.cjs`
- `config-get quality.level` works and returns `"fast"` on a fresh project (102 tests pass, confirmed)
- `quality.test_exemptions` array is in config with 4 default entries

**What Phase 2 adds:**
- `mcp__context7__*` tools available to the executor (frontmatter + `.mcp.json`)
- Protocol sections that encode sentinel behavior as executor instructions
- Config wiring that makes `quality.level` determine actual gate execution

---

## Open Questions

1. **Should `execute_tasks` step explicitly name `<quality_sentinel>` invocation points?**
   - What we know: The current `<execute_tasks>` step lists tasks at lines 81-97 of `gsd-executor.md`. The `type="auto"` branch has four bullets (TDD, execute, deviation, commit).
   - What's unclear: Whether to add two new bullets ("run quality_sentinel pre-task", "run quality_sentinel post-task") or restructure the step with a quality sub-block.
   - Recommendation: Add two bullets — do not restructure. Additive only. Keep the step's existing four bullets; insert pre-task bullet before "Execute task" and post-task bullet before "Commit."

2. **Does the executor's `.mcp.json` need to exist at the GSD framework level, or at the user's project level?**
   - What we know: EXEC-07 says "`.mcp.json` includes Context7 MCP server configuration (project-scoped)." The gsdup project is the GSD framework fork itself.
   - What's unclear: Do we create `.mcp.json` in `/Users/tmac/Projects/gsdup/` (the framework repo) so that developers working on the framework get Context7? Or is `.mcp.json` only meant for projects built with GSD?
   - Recommendation: Create `.mcp.json` in the gsdup project root (the framework repo). EXEC-07 is a requirement on this Phase 2 delivery. Users building projects with GSD are separate — they would configure `.mcp.json` separately in their own projects. The GSD framework itself benefits from Context7 during its own development (the executor agents run in the framework repo context).

3. **Token count per Context7 query — is 2,000 a safe cap?**
   - What we know: STATE.md blocker note says "Start at 2,000 token cap per query. Run a test query before setting the cap." GitHub issue #659 confirmed `DEFAULT_MINIMUM_TOKENS` was reduced from 10,000 to 1,000 tokens in a recent fix.
   - What's unclear: The actual runtime token count per query for GSD-relevant libraries (CJS, Node.js). Context7's new minimum is 1,000 tokens; queries can return more based on the query specificity.
   - Recommendation: Set 2,000 as the soft cap in the protocol spec ("Do not quote more than 200 tokens of Context7 response in implementation comments"). The hard cap is enforced by query specificity discipline, not a parameter. Run a test query during Plan 02-01 execution to validate token volume before shipping the protocol section.

---

## Sources

### Primary (HIGH confidence)

- Direct inspection of `/Users/tmac/Projects/gsdup/agents/gsd-executor.md` — current tools frontmatter, `<execute_tasks>` step structure, `<tdd_execution>` section (TDD pattern reference)
- Direct inspection of `/Users/tmac/Projects/gsdup/agents/gsd-planner.md` line 4 — `mcp__context7__*` in tools frontmatter (executor should follow same pattern with specific tool names)
- Direct inspection of `/Users/tmac/Projects/gsdup/agents/gsd-phase-researcher.md` lines 113-114 — two-step Context7 call pattern (`resolve-library-id` then `query-docs`)
- Direct inspection of `/Users/tmac/Projects/GymRats/.mcp.json` and `/Users/tmac/Projects/Gymrats2/.mcp.json` — exact `.mcp.json` format with `@upstash/context7-mcp@latest`
- Direct inspection of `/Users/tmac/Projects/gsdup/.planning/research/ARCHITECTURE.md` — Pattern 1 (Inline Sentinel), Pattern 4 (Config-Gated Quality Levels), Data Flow diagrams
- Direct inspection of `/Users/tmac/Projects/gsdup/.planning/research/PITFALLS.md` — Pitfalls 1, 6, 7 (context budget, Context7 token bloat, config wiring deferral)
- Direct inspection of `/Users/tmac/Projects/gsdup/.planning/research/STACK.md` lines 180-244 — quality level behavior matrix and shell patterns
- Direct inspection of `/Users/tmac/Projects/gsdup/.planning/phases/01-foundation/01-02-SUMMARY.md` — `patterns-established` confirms CFG-04 convention and `config-get quality.level` is operational
- Direct inspection of `/Users/tmac/Projects/gsdup/.planning/STATE.md` — Phase 2 blocker notes (context budget ~40%, Context7 token cap, start at 2,000 tokens)
- Direct inspection of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/config.cjs` lines 46-61 — quality key confirmed in hardcoded defaults with deep-merge pattern
- WebFetch of `https://github.com/upstash/context7` — confirmed `resolve-library-id` and `query-docs` as the two tool names; confirmed project-scoped `.mcp.json` format

### Secondary (MEDIUM confidence)

- WebFetch of `https://github.com/upstash/context7/issues/659` — `DEFAULT_MINIMUM_TOKENS` reduced from 10,000 to 1,000 in recent PR #668 fix
- WebSearch "context7-mcp DEFAULT_MINIMUM_TOKENS 2025" — corroborates issue #659 finding; default now 1,000 tokens

### Tertiary (LOW confidence)

- N/A — all critical claims are verified from primary sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `mcp__context7__*` pattern confirmed from existing agent files; `.mcp.json` format confirmed from live project files
- Architecture: HIGH — sentinel section structure derived from existing ARCHITECTURE.md research (already done for this project); config-gate pattern confirmed from Phase 1 implementation
- Pitfalls: HIGH — all pitfalls derived from existing PITFALLS.md research document and Phase 1 learnings; no speculation
- Open questions: MEDIUM — token count question is unverified at runtime; `.mcp.json` placement question is interpretive

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — markdown editing, JSON config, MCP server config format unlikely to change)
