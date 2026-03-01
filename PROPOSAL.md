# GSD Enhancement Proposal: Anti-Slop Quality System

**Project:** GSD Framework Upgrade
**Date:** 2026-02-23
**Goal:** Upgrade GSD to eliminate "slop" — duplicate code, shortcuts, low-quality output, broken integrations — while preserving all existing fundamentals.

---

## How GSD Works (and Why It's Good)

### The Core Architecture

GSD is a **context engineering** system that fights Claude's natural drift by imposing structure:

```
PROJECT → MILESTONE → PHASE → PLAN → EXECUTE → VERIFY → TRANSITION
```

**Why it works:**
1. **Plans are prompts** — PLAN.md IS the execution instruction, not a document that becomes one
2. **Goal-backward verification** — Starts from "what must be TRUE" and works backward to tasks
3. **Wave-based parallelism** — Independent plans run simultaneously with dependency tracking
4. **Context budget management** — 2-3 tasks per plan, ~50% context target prevents quality degradation
5. **Atomic commits** — Per-task commits enable git bisect, cherry-pick, and rollback
6. **Lean orchestrators** — Main context stays at ~10-15%, subagents get fresh 200K each
7. **State persistence** — STATE.md + artifact files survive /clear and context resets

### The Agent System (11 Specialized Agents)

| Agent | Role | Quality Gate |
|-------|------|-------------|
| gsd-project-researcher (x4) | Domain ecosystem research | Confidence levels per finding |
| gsd-research-synthesizer | Unify research findings | Cross-reference synthesis |
| gsd-roadmapper | Requirements → phase structure | 100% requirement coverage |
| gsd-phase-researcher | Phase-specific domain research | Source hierarchy (Context7 first) |
| gsd-planner | Decompose phase → executable plans | Task specificity, dependency graphs |
| gsd-plan-checker | Verify plans achieve goal | 8 verification dimensions |
| gsd-executor | Execute tasks, commit per-task | Deviation rules, self-check |
| gsd-verifier | Verify code achieves phase goal | 3-level artifact verification |
| gsd-integration-checker | Cross-phase wiring validation | Orphaned exports, broken flows |
| gsd-codebase-mapper | Analyze existing code | Multi-dimension analysis |
| gsd-debugger | Root cause investigation | Scientific method, hypothesis testing |

---

## What's Currently Missing (The Slop Gaps)

### Gap 1: Zero Code Duplication Detection
**Severity: HIGH**

No agent at any stage checks whether code being written already exists elsewhere in the codebase. The executor creates new functions without scanning for existing utilities. The verifier checks that artifacts exist and are wired, but never checks if they duplicate existing code.

### Gap 2: No Context7 Integration in Executor
**Severity: HIGH**

The phase-researcher uses Context7 heavily (source hierarchy: Context7 > Official Docs > WebSearch). The planner has Context7 in its tool list but barely uses it. **The executor — the agent that actually writes code — has ZERO Context7 integration.** This means the agent writing code has no awareness of current library APIs, best practices, or standard patterns.

### Gap 3: Testing is Optional, Not Enforced
**Severity: MEDIUM-HIGH**

TDD exists but is optional — it's a plan TYPE, not a requirement. Standard plans can ship code with zero tests. The Nyquist Compliance dimension (plan-checker Dimension 8) requires automated `<verify>` commands, but these can be build checks or curl commands — not actual tests. There's no enforcement that new code has corresponding tests.

### Gap 4: No Real-Time Quality Validation During Execution
**Severity: MEDIUM**

Quality checks happen at the wrong time:
- **Plan-checker:** Before execution (validates plans, not code)
- **Verifier:** After execution (discovers problems after context is burned)
- **During execution:** Only task-specific `<verify>` checks — no linting, type checking, or codebase-wide impact analysis

### Gap 5: No "Don't Hand-Roll" Enforcement
**Severity: MEDIUM**

The phase-researcher has a "don't hand-roll" section in RESEARCH.md. But there's no mechanism to enforce this during execution. Claude commonly hand-rolls auth, date parsing, validation, state management — all things with excellent library solutions.

### Gap 6: No Pre-Implementation Codebase Scan
**Severity: MEDIUM**

Before writing any code, the executor should scan the existing codebase for:
- Similar functions/components that could be reused
- Established patterns to follow
- Files that will be affected by the new code
- Potential conflicts with in-progress work from parallel plans

---

## Proposed Changes

### Change 1: Quality Sentinel System (New Executor Instructions)

**What:** Add a mandatory quality protocol to the executor agent that runs BEFORE and DURING each task.

**Where:** `agents/gsd-executor.md` — new `<quality_sentinel>` section

```xml
<quality_sentinel>
## Pre-Task Quality Protocol

Before implementing ANY task:

1. **Scan for Existing Patterns**
   - Grep codebase for similar function names, component names, utility patterns
   - If similar code exists: REUSE or EXTEND, never duplicate
   - Document in commit: "Reuses existing X from Y"

2. **Consult Context7 for Libraries**
   - Before hand-rolling ANY non-trivial logic, check Context7:
     - Authentication → check auth library docs
     - Date handling → check date library docs
     - Validation → check validation library docs
     - State management → check state library docs
   - If standard solution exists: USE IT
   - Document in commit: "Uses X library per Context7 docs"

3. **Analyze Impact Radius**
   - What files import from files I'm modifying?
   - What tests cover the code I'm changing?
   - Run existing tests BEFORE making changes (baseline)

## During-Task Quality Gates

After writing each file:

1. **Run type checker** (if TypeScript/typed language)
2. **Run linter** (if configured)
3. **Run tests that cover modified files**
4. **Verify no circular imports introduced**
5. If ANY gate fails: fix before committing

## Post-Task Quality Check

Before committing:

1. **Diff review** — Read your own diff. Is this elegant?
2. **Duplication check** — Did I create anything that already exists?
3. **Naming quality** — Are names descriptive and consistent with codebase?
4. **Error handling** — Are all failure modes covered?
5. **No shortcuts** — Did I take the best approach, not the fastest?
</quality_sentinel>
```

**Impact:** Directly addresses slop at the source — the executor agent.

### Change 2: Mandatory Test Step in Execution Flow

**What:** Every plan execution includes a test creation/run step, not just TDD plans.

**Where:** `agents/gsd-executor.md` — modify `<execution_flow>` and add to `<task_commit_protocol>`

The change adds a "test gate" after each task's implementation:

```
Current flow:  Task → Verify → Commit
New flow:      Task → Write Tests → Run Tests → Verify → Commit
```

**Rules:**
- If task creates new function/endpoint/component: write at least one test
- If task modifies existing code: run ALL existing tests for that module
- If tests fail: fix before committing (never commit broken tests)
- Test files committed alongside implementation (same commit or dedicated test commit)

**Exceptions:**
- Config-only changes (no logic to test)
- UI-only styling changes (visual, not behavioral)
- Documentation changes

### Change 3: Context7 Integration in Executor

**What:** Give the executor Context7 tools and instructions to use them.

**Where:** `agents/gsd-executor.md` — add `mcp__context7__*` to tools, add `<context7_protocol>`

```xml
<context7_protocol>
## When to Consult Context7

BEFORE implementing any of these, resolve the library and query docs:

- **New dependency usage** — Verify API, check for breaking changes
- **Auth/security patterns** — Never hand-roll; use library patterns
- **Database queries** — Check ORM docs for optimal patterns
- **State management** — Use framework-standard patterns
- **Form handling** — Use library-recommended approach
- **API integration** — Check SDK docs, don't raw-fetch when SDK exists

## How to Use

1. `mcp__context7__resolve-library-id` — Find the library
2. `mcp__context7__query-docs` — Get current API/patterns
3. Apply documented patterns (not training data assumptions)
4. Note in commit: "Per [library] docs via Context7"
</context7_protocol>
```

### Change 4: Pre-Implementation Codebase Scan

**What:** Before each task, executor scans the codebase for relevant existing code.

**Where:** `agents/gsd-executor.md` — add to `<execution_flow>` step execute_tasks

```xml
<pre_implementation_scan>
## Before Writing Code

For each task, BEFORE writing any code:

1. **Find existing patterns:**
   ```bash
   # Search for similar function/component names
   grep -r "similar_name" src/ --include="*.ts" --include="*.tsx" -l

   # Search for similar imports (what libraries are already used?)
   grep -r "import.*from" src/ --include="*.ts" | sort -u
   ```

2. **Check for reusable code:**
   - Utility functions that do what you need
   - Existing components that could be composed
   - Shared types/interfaces that should be reused
   - Existing API clients/services

3. **Establish baseline:**
   ```bash
   # Run existing tests to know what's green
   npm test 2>&1 | tail -5
   ```

4. **Map affected files:**
   - Which files import from files I'll modify?
   - Which tests cover this area?

Document findings in task execution, reference in commit message.
</pre_implementation_scan>
```

### Change 5: Enhanced Verifier with Code Quality Checks

**What:** Add code quality dimensions to the verifier beyond existence/wiring.

**Where:** `agents/gsd-verifier.md` — add new verification steps

New checks:
- **Duplication scan** — Detect similar function bodies across files
- **Dead code detection** — Exports that nothing imports
- **Test coverage check** — New code has corresponding tests
- **Pattern consistency** — New code follows established codebase patterns
- **Dependency hygiene** — No unused imports, no circular dependencies

### Change 6: Planner Quality Directives

**What:** Planner explicitly includes quality instructions in task actions.

**Where:** `agents/gsd-planner.md` — add to `<task_breakdown>` section

Each task's `<action>` must include:
- Which existing code to reference/reuse
- Which library docs to consult (Context7 queries)
- What tests to write
- What patterns to follow from codebase conventions

### Change 7: Config Toggle for Quality Level

**What:** Add quality enforcement level to `config.json`.

**Where:** `get-shit-done/templates/config.json`, workflow config questions

```json
{
  "quality": {
    "level": "strict",
    "enforce_tests": true,
    "enforce_context7": true,
    "enforce_codebase_scan": true,
    "enforce_lint_check": true,
    "max_hand_roll_tolerance": "low"
  }
}
```

Levels:
- **strict** — All quality gates enforced, no shortcuts
- **standard** — Core quality gates, reasonable trade-offs
- **fast** — Minimal quality gates, speed over perfection

---

## What This Preserves (Non-Breaking)

These changes **do NOT modify**:
- The workflow lifecycle (project → milestone → phase → plan → execute → verify)
- The agent orchestration pattern (lean orchestrators, fresh subagent contexts)
- The state management system (STATE.md, ROADMAP.md, REQUIREMENTS.md)
- The commit strategy (per-task atomic commits)
- The wave-based parallelism
- The checkpoint protocol
- The deviation rules (just adds quality gates alongside them)
- The goal-backward verification methodology
- The plan-checker dimensions (adds to them, doesn't change existing)

These changes **extend**:
- Executor agent with quality sentinel, Context7, codebase scanning
- Verifier agent with code quality dimensions
- Planner agent with quality directives in task actions
- Config with quality enforcement toggles
- Plan-checker with additional quality dimensions

---

## Implementation Approach

### Phase 1: Core Quality Sentinel
- Modify `gsd-executor.md` with quality sentinel protocol
- Add Context7 tools to executor
- Add pre-implementation codebase scan
- Add mandatory test step in execution flow

### Phase 2: Enhanced Verification
- Extend `gsd-verifier.md` with code quality checks
- Add duplication detection patterns
- Add test coverage verification
- Add pattern consistency checks

### Phase 3: Planner Quality Directives
- Modify `gsd-planner.md` to include quality instructions in task actions
- Extend plan-checker with quality dimensions
- Add quality config to templates

### Phase 4: Integration Testing
- Test the modified agents on a real project
- Verify quality gates fire correctly
- Verify no false positives blocking valid code
- Verify Context7 integration works in executor context

---

## Expected Outcomes

| Problem | Current State | After Changes |
|---------|--------------|---------------|
| Duplicate code | Never detected | Scanned pre-task, blocked at commit |
| Hand-rolled logic | Silent, common | Context7 consulted, library preferred |
| Missing tests | Optional (TDD only) | Mandatory for new logic |
| Late quality discovery | Post-execution verifier | Real-time during execution |
| Broken existing code | Task-scoped only | Full regression baseline |
| Shortcuts | No enforcement | Quality sentinel + strict mode |
| Inconsistent patterns | No detection | Codebase scan + convention check |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Quality gates slow execution | Config toggle (strict/standard/fast) |
| Context7 adds token cost | Only query for non-trivial logic |
| False positive quality blocks | Clear override mechanism |
| Testing overhead | Smart test detection (skip config/style) |
| Breaking existing GSD flow | All changes are additive, not replacing |

---

## Summary

GSD has **excellent architectural quality control** (goal-backward methodology, dependency graphs, must-haves verification) but **weak execution-time quality enforcement**. The system is architect-level quality but lacks engineer-level rigor at the implementation layer.

These changes add that rigor:
1. **Before coding:** Scan codebase, consult Context7, establish test baseline
2. **During coding:** Lint, type-check, run tests after each file
3. **After coding:** Diff review, duplication check, naming quality, no shortcuts
4. **At verification:** Code quality dimensions alongside existence/wiring checks

The result: Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts.
