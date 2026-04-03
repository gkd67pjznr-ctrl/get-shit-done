# Gate Enforcement Decision

**Date:** 2026-04-02
**Requirement:** GATE-02
**Status:** Decided and implemented in Phase 35, Plan 35-01

---

## Decision

Quality gates are enforced via Claude's **PostToolUse hook mechanism** — specifically, a new hook script (`gsd-run-gates.cjs`) that fires automatically on `Bash` and `Write` tool calls without any cooperation from the executor agent.

---

## Rationale

Hooks are the only mechanism in Claude's execution environment that fires **deterministically without executor cooperation**. An executor agent running under instructions can choose (or fail) to follow gate steps. Hooks cannot be bypassed by agent behavior — they are invoked by the Claude runtime itself.

This means:
- Gates fire every time a test command runs (`npm test`, `vitest`, `node --test`, `npx vitest`)
- Gates fire every time a code file is written (`.ts`, `.tsx`, `.js`, `.cjs`, `.mjs`)
- The executor agent does not need to "remember" to run gates
- Gate execution records accumulate in `gate-executions.jsonl` regardless of agent behavior

---

## Alternatives Rejected

### 1. Orchestrator wrapper
A script called before each task block that runs all applicable gates. **Rejected** because it still requires the executor to call the wrapper — the fundamental dependency on executor cooperation remains.

### 2. Simplified protocol (advisory steps)
Gate instructions embedded in executor agent system prompt as "steps to follow." **Rejected** because this is the current broken state — `gate-attribution.jsonl` shows all gates at `passed:0, warned:0, blocked:0, skipped:0`, confirming advisory gates are never followed.

### 3. Pure agent instructions
Identical to the simplified protocol. **Rejected** for the same reason.

---

## Gate-to-Hook Mapping

| Gate | Hook Type | Trigger Pattern | Quality Behavior |
|------|-----------|-----------------|-----------------|
| `test_gate` | PostToolUse[Bash] | command matches `npm test`, `vitest`, `node --test`, or `npx vitest` | fast=skip, standard=warn-only on non-zero exit, strict=block on non-zero exit |
| `test_baseline` | PostToolUse[Bash] | same as test_gate; fires when no prior test run in session | fast=skip, standard=warn, strict=block |
| `diff_review` | PostToolUse[Write] | Write tool call on `.ts`, `.tsx`, `.js`, `.cjs`, `.mjs` files | fast=skip, standard=warn on file count >10, strict=block |
| `codebase_scan` | PostToolUse[Bash] | Glob/Grep command (heuristic: command contains `grep` or `find`) | fast=skip, standard=warn if no search detected in session, strict=block |
| `context7_lookup` | PostToolUse[Bash] | Bash command indicates library usage (heuristic: package names in command) | fast=skip, standard=warn, strict=block |

---

## Implementation Scope for Phase 35

**Implemented in Plan 35-01:**
- `test_gate` — detected on Bash PostToolUse when command matches test run patterns
- `diff_review` — detected on Write PostToolUse when file path ends in a code extension

**Deferred to future work (Phase 36 or later):**
- `test_baseline` — requires session-level state tracking (no prior test run detection)
- `codebase_scan` — requires session-level state tracking (search command detection across session)
- `context7_lookup` — requires session-level state tracking (library usage heuristics)

---

## Quality Level Behavior

| Quality Level | Gate Fires | Outcome on Test Failure | Blocks Execution |
|---------------|------------|------------------------|-----------------|
| `fast` | No (skipped) | N/A | No |
| `standard` | Yes | `warned` (downgraded from `blocked`) | No |
| `strict` | Yes | `blocked` | No (not yet — current behavior records `blocked` outcome but does not exit non-zero) |

**Note:** True blocking behavior (hook exits non-zero to block the tool call) is not implemented in Phase 35. Current behavior always exits 0, recording the outcome correctly in `gate-executions.jsonl`. Blocking is deferred until Phase 36 validates real data flows.

---

## Files Created / Modified

| File | Action | Purpose |
|------|--------|---------|
| `.claude/hooks/lib/gate-runner.cjs` | Created | Shared library: gate detection, quality-level filtering, entry building |
| `.claude/hooks/gsd-run-gates.cjs` | Created | PostToolUse hook script: reads stdin, delegates to gate-runner, writes entry |
| `.claude/settings.json` | Modified | Added `Write|Bash` PostToolUse entry for `gsd-run-gates.cjs` (timeout 10s) |
