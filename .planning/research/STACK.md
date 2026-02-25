# Stack Research

**Domain:** Quality enforcement layers for AI coding agent frameworks (Claude Code / GSD)
**Researched:** 2026-02-23
**Confidence:** HIGH (Context7 tools unavailable due to quota; verified via official Claude Code docs, GitHub, and multiple corroborating sources)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Hooks | Current (2026) | Intercept agent lifecycle events to enforce quality gates | The only mechanism that enforces behavior regardless of Claude's in-context reasoning. `PreToolUse` can block file writes; `PostToolUse` runs linting/type checks after edits. Hooks survive context compression — rules don't. |
| Context7 MCP (`@upstash/context7-mcp`) | Latest (`npx -y @upstash/context7-mcp`) | Library documentation lookup during code generation | Provides two tools (`resolve-library-id`, `query-docs`) that inject version-specific, up-to-date docs directly into agent context. Prevents Claude from hallucinating outdated APIs. Free tier available; no API key required for basic use. |
| jscpd | `^4.x` | Copy-paste / duplication detection | Supports 150+ languages including TypeScript/JavaScript, implements Rabin-Karp algorithm, configurable thresholds (exit with error on exceed), generates SARIF output. Purpose-built for the duplicate-detection use case vs. ESLint which catches only trivial duplication. |
| Node.js built-in test runner | Node 18+ | Lightweight test enforcement for framework scripts | The GSD framework itself is a Node.js CJS package with no external test dependencies (`node --test tests/*.test.cjs` in package.json). Adding Vitest would introduce a dependency on a framework that writes agent instructions — adding complexity for no gain. The built-in runner is zero-dependency, sufficient for this scope. |

### Supporting Libraries / Tools

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `agentlint` | Latest (pip) | Pre-built Claude Code quality rules (42 rules across 7 packs) | Use the Quality Pack (conventional commits, error-handling removal detection, unused imports) as baseline rules; skip Security Pack (overkill for a framework tool). Installs via `pip install agentlint && agentlint setup`. Integrates via Claude Code hooks automatically. |
| ESLint + TypeScript ESLint | ESLint 9.x, `@typescript-eslint` 8.x | Static analysis and style enforcement for any generated TypeScript/JavaScript projects | PostToolUse hook: runs after every Edit/Write. Only needed if the target project uses TypeScript. The GSD framework itself is CJS/plain JS — no TypeScript build required. |
| Ripgrep (`rg`) / Grep (built-in) | Built-in to Claude Code tools | Pre-implementation codebase scanning for existing patterns | Claude Code's native `Grep` tool wraps ripgrep. Use it in executor pre-task scan step — no additional installation. Targeted searches (`grep -r "functionName" src/`) are faster and cheaper than AST tools for the "does this exist?" question. |
| `jq` | System package (pre-installed on macOS/Linux) | Parse hook JSON input in shell scripts | Hooks receive JSON via stdin. `jq` is the standard tool for extracting `tool_input.command`, `tool_name`, etc. from hook payloads. Required for any non-trivial hook script. |

### Development Tools (GSD Framework Itself)

| Tool | Purpose | Notes |
|------|---------|-------|
| `esbuild` (already in devDependencies) | Bundles hooks/dist | Already present in the project. Use for hook compilation if hooks need bundling. |
| `node --test` (Node 18+ built-in) | Framework test runner | Already used (`package.json` scripts.test). Keep as-is — no additional test infrastructure. |
| Claude Code `settings.json` hooks configuration | Quality gate enforcement entry point | Project-level: `.claude/settings.json` (shared via git). User-level: `~/.claude/settings.json`. Local overrides: `.claude/settings.local.json`. |

---

## Integration Patterns

### Context7 MCP Integration

Context7 is added to agent frontmatter via the `tools` field using MCP syntax. For the executor agent that writes code:

**Installation (project-scoped, shared with team):**
```bash
claude mcp add --transport stdio --scope project context7 -- npx -y @upstash/context7-mcp
```

This writes to `.mcp.json` at project root (commit to version control).

**Agent frontmatter change:**
```yaml
# Before (gsd-executor.md):
tools: Read, Write, Edit, Bash, Grep, Glob

# After:
tools: Read, Write, Edit, Bash, Grep, Glob, mcp__context7__resolve-library-id, mcp__context7__query-docs
```

**Usage pattern in executor instructions:**
```
Before implementing [feature that uses library X]:
1. mcp__context7__resolve-library-id(libraryName: "X", query: "what I need to do")
2. mcp__context7__query-docs(libraryId: [resolved ID], query: "specific API question")
3. Implement using verified docs, not training data
```

Context7 returns version-specific documentation and code examples from official sources. The two-step resolve-then-query pattern is mandatory — IDs cannot be guessed.

**Constraint:** Context7 requires internet connectivity. For offline environments, this tool silently degrades (no docs injected). This is acceptable — the fallback is training data, which is the current baseline.

### Claude Code Hooks for Quality Gates

Hooks are configured in `.claude/settings.json`. The three relevant lifecycle events:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/get-shit-done/hooks/quality-sentinel-pre.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/get-shit-done/hooks/quality-sentinel-post.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/get-shit-done/hooks/quality-sentinel-stop.sh"
          }
        ]
      }
    ]
  }
}
```

Hook scripts receive JSON via stdin. Exit code 2 blocks the operation and feeds stderr back to Claude. Exit code 0 allows it. This is the only mechanism that enforces behavior regardless of context state.

**The critical insight:** CLAUDE.md rules are behavioral guidance Claude evaluates in-context. Hooks are deterministic enforcement that runs regardless of what Claude "thinks". Quality gates that must always run belong in hooks, not agent instructions.

### jscpd Duplication Detection

jscpd scans for copy-pasted code blocks using token-level comparison. Suitable as a PostToolUse hook or as a pre-commit check.

**Installation:**
```bash
npm install -D jscpd
```

**Configuration (`.jscpd.json` at project root):**
```json
{
  "threshold": 10,
  "reporters": ["console"],
  "ignore": ["**/*.test.*", "**/node_modules/**", "**/*.md"],
  "languages": ["javascript", "typescript"]
}
```

**Hook integration:**
```bash
# PostToolUse hook after Edit/Write
FILEPATH=$(echo "$INPUT" | jq -r '.tool_result.filePath // empty')
if [ -n "$FILEPATH" ]; then
  npx jscpd "$FILEPATH" --threshold 15 --silent
  if [ $? -ne 0 ]; then
    echo "Duplication detected above threshold. Refactor before proceeding." >&2
    exit 2
  fi
fi
```

**Constraint:** jscpd per-file is fast; whole-project scans are slow. Use file-scoped checks in hooks, whole-project scan only in the verifier step.

### Pre-Implementation Codebase Scanning

No additional tooling needed. Claude Code's native `Grep` tool (which wraps ripgrep) is sufficient for the targeted "does this already exist?" scan pattern:

```
# Executor pre-task protocol (in agent instructions):
Before implementing [task]:
1. Grep for existing implementations of [key function/class names]
2. Grep for similar patterns in the codebase
3. Read any matches found
4. If existing implementation found: reuse it, don't reinvent
5. If partial implementation found: extend it, don't duplicate
```

This is a behavioral instruction enforced by the executor agent's system prompt, not a hook. The scan happens at task start, before code is written. Context budget: 3-5 targeted grep calls use ~500-1000 tokens — acceptable.

**For AST-level pattern detection** (finding structurally similar code regardless of naming): `ast-grep` or `semgrep` are the right tools, but they add significant complexity and installation requirements. Reserve for projects with high duplication risk, not as a default GSD enforcement layer.

### Mandatory Testing Enforcement

The existing GSD executor already supports TDD via `tdd="true"` in plan tasks. The gap is making testing non-optional for new logic.

**Enforcement approach (no new tooling):**
1. Executor agent instructions: "For any new function/class, write tests before or alongside implementation"
2. PostToolUse hook: After `Write`/`Edit` on non-test files, check if corresponding test file exists
3. Stop hook: Before completing, run `npm test` or `node --test` and verify exit code 0

**Shell pattern for test existence check:**
```bash
# PostToolUse hook
FILEPATH=$(echo "$INPUT" | jq -r '.tool_result.filePath // empty')
if [[ "$FILEPATH" == *.js || "$FILEPATH" == *.ts ]] && [[ "$FILEPATH" != *.test.* ]]; then
  TESTFILE="${FILEPATH%.*}.test.${FILEPATH##*.}"
  if [ ! -f "$TESTFILE" ]; then
    echo "Warning: No test file found for $FILEPATH. Add tests before completing this task." >&2
    # exit 2 in strict mode; warning only in standard mode
  fi
fi
```

**The quality level toggle** (`strict/standard/fast`) controls whether missing tests block execution (exit 2) or emit warnings (exit 0 with stderr message).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Claude Code Hooks (`settings.json`) | Separate quality-check agent | When you need sophisticated multi-file analysis that a hook script can't do. Not recommended here: adds context burn on handoff and doesn't block inline. |
| Context7 MCP (Upstash) | Embedding docs in CLAUDE.md | When Context7 lacks a library. Manual doc embedding works but goes stale. Context7 is always current. |
| jscpd for duplication | ESLint `no-duplicate-code` plugin | ESLint detects simpler copy-paste; jscpd catches structural duplication across larger blocks. Both can coexist. |
| Node built-in test runner | Vitest | Vitest is 10-20x faster and has better TypeScript support, but adds a production dependency to a framework that writes agent instructions. The GSD framework's test suite is small — speed gain doesn't justify the dependency. |
| Grep (native Claude Code tool) | Semgrep / ast-grep | Semgrep and ast-grep find structurally similar code regardless of naming. Powerful but requires installation and adds latency. Use only when text-based grep is insufficient. |
| agentlint Quality Pack rules | Writing all hook scripts from scratch | agentlint provides 42 pre-built rules via pip. Start with agentlint; write custom hooks only for GSD-specific needs. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| CodeRabbit / Codacy / CodeScene as primary gate | These are PR-level review platforms — they catch issues after code is committed, not during agent execution. Wrong layer for inline quality enforcement. | Claude Code Hooks (enforce at write time, before commit) |
| Stryker mutation testing in the executor loop | Stryker runs a mutation test suite (minutes per run) — far too slow to run as an inline quality gate during agent execution. | Use Stryker only as a one-off audit tool run by a human, not in the agent loop. |
| TypeScript strict mode changes in GSD framework | The GSD framework is CJS JavaScript, not TypeScript. Adding TypeScript would require build steps and changes the developer experience for framework contributors. | Keep GSD in CJS JavaScript; TypeScript rules apply to projects GSD builds, not GSD itself. |
| `git add -A` or `git add .` in hook scripts | Risk of staging sensitive files (.env, credentials) accidentally. GSD executor already enforces individual file staging. | Maintain existing per-file staging discipline; hooks should not do their own git staging. |
| CLAUDE.md-only quality rules (no hooks) | CLAUDE.md rules are behavioral guidance evaluated in-context. They degrade as context fills and can be overridden by context pressure. Critical quality gates need hook enforcement. | Put must-always-run checks in hooks; use CLAUDE.md for nuanced guidance. |
| Full-project jscpd scans on every file edit | Full project scans are slow (seconds to minutes on large codebases). As a hook, this would make every file edit feel sluggish. | File-scoped jscpd in hooks; full project scan in verifier step only. |

---

## Stack Patterns by Quality Level

**If `strict` quality level:**
- All hooks run, exit code 2 blocks on: missing tests, duplication above threshold, lint errors, type errors
- Context7 lookup is mandatory before any library usage (instruction-enforced)
- Pre-task codebase scan runs on every task
- Full test suite runs at Stop hook

**If `standard` quality level (recommended default):**
- PostToolUse hooks emit warnings (exit 0 with stderr) for missing tests and duplication
- Context7 lookup recommended but not blocking
- Pre-task codebase scan runs on tasks that involve new utilities/functions
- Test suite run at Stop hook; failures are warnings, not blocks

**If `fast` quality level:**
- Hooks disabled or reduced to critical-only (secret detection, destructive git commands)
- No mandatory Context7 lookups
- No mandatory pre-task scan
- Tests optional

The quality level toggle should live in GSD config (e.g., `gsd config set quality.level strict`) and be read by hook scripts at runtime.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@upstash/context7-mcp` (any) | Claude Code with MCP support (all current versions) | Requires Node 18+. Uses `npx -y` for automatic version management. |
| `agentlint` (pip) | Claude Code hooks system (PostToolUse/PreToolUse/Stop) | Python-based. Requires Python 3.8+ on developer machine. |
| `jscpd` ^4.x | Node 16+ | Works with the existing `engines.node: ">=16.7.0"` constraint in GSD package.json. |
| Claude Code Hooks | Claude Code ≥ current (hooks released early 2026) | `PreToolUse` is the blocking hook; requires current Claude Code version. Verify with `claude --version`. |

---

## Installation

```bash
# Context7 MCP (project-scoped — creates .mcp.json, commit to git)
claude mcp add --transport stdio --scope project context7 -- npx -y @upstash/context7-mcp

# Duplication detection (dev dependency on projects using GSD)
npm install -D jscpd

# AgentLint quality rules (on developer machine)
pip install agentlint && agentlint setup

# jq for hook scripts (system package, usually pre-installed)
# macOS: brew install jq
# Linux: apt-get install jq / yum install jq
```

No changes to GSD's `package.json` dependencies are required. The framework itself needs no new runtime dependencies — all tools are either:
- System tools (`jq`, `grep`)
- MCP servers invoked via `npx` at runtime
- Dev dependencies on the projects GSD builds (not GSD itself)
- External pip tools on the developer machine (`agentlint`)

---

## Sources

- [Claude Code MCP Official Docs](https://code.claude.com/docs/en/mcp) — MCP scopes, installation syntax, `.mcp.json` format (HIGH confidence, official docs, verified 2026-02-23)
- [Claude Code Subagents Official Docs](https://code.claude.com/docs/en/sub-agents) — Subagent frontmatter, tools field, mcpServers field (HIGH confidence, official docs, verified 2026-02-23)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) — Hook events, exit codes, settings.json format (HIGH confidence, official docs)
- [Context7 GitHub (upstash/context7)](https://github.com/upstash/context7) — Tool interface, two-step resolve+query pattern, connection types (HIGH confidence, official GitHub)
- [jscpd npm](https://www.npmjs.com/package/jscpd) — Language support, configuration, threshold behavior (HIGH confidence, official npm)
- [agentlint GitHub (mauhpr/agentlint)](https://github.com/mauhpr/agentlint) — Rule packs, hook integration, 42 rules overview (MEDIUM confidence, GitHub README, active project)
- [CodeScene: Agentic AI Coding Best Practices](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality) — Multi-level safeguard patterns, AGENTS.md executable guidance pattern (MEDIUM confidence, verified vendor blog)
- [Claude Code Enforcers (rungie.com)](https://rungie.com/blog/claude-code-enforcers/) — PostToolUse lint hook patterns, mutation testing with Stryker, TypeScript plugin pattern (MEDIUM confidence, practitioner blog)
- [Claude Code Hooks Production Patterns (pixelmojo.io)](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns) — Hook types (command/prompt/agent), 12 lifecycle events, PreToolUse blocking behavior (MEDIUM confidence, corroborated by official docs)
- [Context7 MCP for Claude Code (claudelog.com)](https://claudelog.com/claude-code-mcps/context7-mcp/) — Integration configuration JSON, five-step workflow, limitations (MEDIUM confidence, community docs corroborating official behavior)
- Context7 MCP API quota exceeded during research — could not verify docs content at runtime. Pattern knowledge from training data corroborated by multiple secondary sources. (LOW confidence for Context7 docs query behavior specifically)

---

*Stack research for: GSD Enhanced Fork — quality enforcement layer*
*Researched: 2026-02-23*

---

---

# Stack Research — v2.0 Concurrent Milestones

**Domain:** Concurrent milestone execution, workspace isolation, lock-free file coordination
**Researched:** 2026-02-24
**Confidence:** HIGH for Claude Code worktrees/agent-teams (official docs verified); HIGH for write-file-atomic (GitHub verified); MEDIUM for lock-free dashboard pattern (no single authoritative source, but pattern is well-established in Node.js ecosystem)

---

## What This Section Covers

Stack additions needed for v2.0: concurrent milestone execution across separate Claude Code sessions. The existing GSD stack (CJS, Node.js built-in test runner, Context7, hooks) stays intact. This section covers only what's NEW.

**Key constraint:** GSD's `package.json` has `"engines": { "node": ">=16.7.0" }` and zero runtime dependencies. Any new library must either ship zero-dependency inline, or use a tool already available in the Node.js ecosystem.

---

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `write-file-atomic` | 7.0.0 | Atomic dashboard writes from concurrent milestone sessions | Writes temp file → renames atomically, serializes concurrent writes to same file via Promises. Used by npm itself. CJS-compatible (`require('write-file-atomic')`). Zero ambiguity about partial writes corrupting dashboard state. |
| Claude Code `--worktree` flag | Current (2026) | Filesystem isolation per milestone session | Built into Claude Code CLI. Creates isolated worktree at `.claude/worktrees/<name>/` on a separate branch. No extra tooling. Sessions cannot clobber each other's working files. Best supported isolation mechanism. |
| Claude Code Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) | Current (2026, experimental) | Optional: coordinate milestone sessions as a team with shared task list and messaging | Enables inter-session communication, shared task list with file-lock-based claim mechanism. Experimental — has known limitations (no session resumption, task status lag). Research only; evaluate before adopting. |
| `fs.rename()` / `fs.renameSync()` (Node.js built-in) | Node 16+ | Atomic file publish step for dashboard updates without new dependencies | On Unix/macOS, `fs.rename()` within the same filesystem is atomic. Write to `.planning/DASHBOARD.md.tmp`, rename to `.planning/DASHBOARD.md`. Works with existing Node.js baseline. Use `write-file-atomic` if cross-process concurrent writes are needed; use raw `rename` if only one writer exists per file. |

### Supporting Patterns (No Additional Libraries)

| Pattern | Mechanism | Purpose | When to Use |
|---------|-----------|---------|-------------|
| Conflict manifest file | Plain Markdown/JSON in `.planning/milestones/<v>/MANIFEST.md` | Declare which source files each milestone will touch; detect conflicts before execution starts | Always — lightweight static analysis, no runtime overhead |
| Milestone-scoped workspace | `.planning/milestones/<version>/` directory structure | Isolate milestone STATE.md, ROADMAP.md, phases/ from other concurrent milestones | Always — pure directory convention, zero tooling |
| Lock-free dashboard reads | `fs.readFileSync()` (non-blocking readers) + atomic writes from single writer per milestone | Multiple sessions read dashboard without locks; only one session writes its own milestone row | Suitable when each milestone owns exactly one dashboard row — no cross-milestone write conflicts |
| Advisory lock file | `.planning/DASHBOARD.lock` (create/delete sentinel file) | Coordinate writes when multiple milestones update the shared dashboard simultaneously | Only needed if lock-free single-writer-per-row pattern is insufficient |

---

## Decision: Lock-Free vs Lock-Based for Dashboard

The dashboard (`DASHBOARD.md` or equivalent) tracks all milestone status. Two approaches:

**Option A — Lock-free (recommended):** Each milestone owns exactly one row in the dashboard. Each session only ever writes its own row. Readers never lock. Writers use `write-file-atomic` to serialize same-file writes atomically. No inter-process locking needed because no two sessions compete to write the same row.

**Option B — Advisory lock (fallback):** Use `proper-lockfile` for cross-process mutex when the dashboard structure requires full-file rewrites. More robust but adds a dependency and stale-lock risk.

**Recommendation: Option A.** Design the dashboard so each milestone session writes only its own status segment. This eliminates inter-process write conflicts entirely and keeps the stack dependency-free.

---

## Claude Code Agent Teams: What to Know

Agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) are **experimental** (as of 2026-02-24). Key facts verified from official docs:

**Architecture:**
- Team config: `~/.claude/teams/{team-name}/config.json` (members array with name, agent ID, type)
- Task list: `~/.claude/tasks/{team-name}/` (file-lock-based task claiming)
- Mailbox: messaging system for inter-agent communication (automatic delivery, no polling)
- Each teammate has its own context window; shares CLAUDE.md and MCP servers from lead

**What it provides for GSD:**
- Shared task list where milestone-executor agents claim work without double-claiming
- Direct messaging between milestone sessions (e.g., "milestone A is touching auth.js — do you conflict?")
- `TeammateIdle` and `TaskCompleted` hooks for quality enforcement at team level

**Limitations that matter for GSD:**
- No session resumption for in-process teammates (`/resume` and `/rewind` don't restore teammates)
- Task status can lag — teammates sometimes fail to mark tasks complete, blocking dependent tasks
- One team per session — a lead can only manage one team at a time
- Experimental: behavior may change without notice

**Verdict:** Do NOT build GSD's concurrent milestone model on top of agent teams as a required dependency. Agent teams are experimental and have known reliability gaps. Instead, design GSD's workspace isolation using filesystem primitives (directory isolation + atomic writes) that work without agent teams, and provide an optional integration layer that uses agent teams when enabled.

---

## Claude Code Worktrees: The Primary Isolation Mechanism

Worktrees are stable (not experimental) and the right tool for filesystem isolation.

**How it works (verified from official docs, 2026-02-24):**
```bash
# Each milestone gets its own worktree
claude --worktree milestone-v2-auth
# Creates: <repo>/.claude/worktrees/milestone-v2-auth/
# Branch: worktree-milestone-v2-auth
```

**Subagent worktree isolation (in agent frontmatter):**
```yaml
---
name: milestone-executor
isolation: worktree
---
```
Each subagent spawned by a milestone gets its own auto-cleaned worktree. No two subagents touch the same working directory.

**What worktrees isolate:** Working tree files (source code changes). What they do NOT isolate: shared `.planning/` state files (DASHBOARD.md, MILESTONES.md). This is why the lock-free dashboard pattern is needed separately.

**Cleanup:** No changes → auto-removed. Changes → prompt to keep or remove.

---

## What NOT to Add for v2.0

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `proper-lockfile` as a runtime dependency | Adds external dependency to a zero-dependency framework. Advisory locks can stale and require TTL maintenance. The lock-free single-writer-per-row dashboard design eliminates the need. | Lock-free dashboard (Option A above) + `write-file-atomic` for same-file serialization |
| `chokidar` for file watching | v4.0.3 supports CJS; v5 is ESM-only. For a dashboard poller, polling `fs.readFileSync` on a short interval is simpler and adds no dependency. Chokidar shines for large directory trees — overkill for watching one status file. | Native `fs.watch()` or timed polling in agent instructions (agents don't need real-time watch — they read on demand) |
| Redis or any external store for coordination | Adds infrastructure dependency, violates "runs anywhere Claude Code runs" principle | Filesystem as coordination medium — files are the existing GSD state model |
| Full agent teams as required infrastructure | Experimental, known reliability gaps, requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Cannot be a required dependency for a stable feature. | Filesystem isolation (worktrees + scoped directories) as primary; agent teams as optional enhancement |
| `async-lock` in-process mutex | Only works within a single Node.js process. GSD milestone sessions are separate processes — in-process locks are useless across them. | `write-file-atomic` (serializes concurrent writes in same process via Promises) or filesystem advisory lock if cross-process coordination is genuinely needed |
| SQLite for state | Overkill for what are essentially markdown state files. Adds a native module dependency, complicates install. | Existing ROADMAP.md / STATE.md pattern, extended with milestone-scoped directories |

---

## Integration Patterns for v2.0

### Milestone Workspace Structure (No New Libraries)

```
.planning/
  DASHBOARD.md              # Central lock-free status (one row per milestone)
  milestones/
    v2.0-concurrent/
      STATE.md              # Milestone-scoped state
      ROADMAP.md            # Milestone-scoped roadmap
      MANIFEST.md           # Conflict declaration (which files this milestone touches)
      phase-01/             # Milestone-scoped phases
        PLAN.md
        SUMMARY.md
    v2.1-future/
      STATE.md
      ...
  phases/                   # Legacy: old-style projects still use root phases/
```

Each milestone session reads/writes only its own subdirectory except for DASHBOARD.md updates.

### Atomic Dashboard Write Pattern (CJS, zero new dependencies)

```javascript
// gsd-tools.cjs — new cmdDashboardUpdate function
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function atomicWrite(filePath, content) {
  // temp file in same directory = same filesystem = rename is atomic on Unix/macOS
  const tmpPath = filePath + '.' + process.pid + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
  try {
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, filePath);  // atomic on Unix/macOS same-filesystem
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}
```

This is what `write-file-atomic` does internally. Implement inline in `gsd-tools.cjs` to stay dependency-free, OR add `write-file-atomic` as a dev dependency for the battle-tested version.

**Recommendation:** Implement the atomic write inline in `gsd-tools.cjs` for the dashboard update command. The implementation is 15 lines. This keeps the zero-dependency constraint satisfied.

### write-file-atomic (if dependency is acceptable)

```bash
npm install write-file-atomic  # adds to dependencies, not devDependencies
```

```javascript
const writeFileAtomic = require('write-file-atomic');
// Async with Promise
await writeFileAtomic('.planning/DASHBOARD.md', newContent, { encoding: 'utf-8' });
// Sync
writeFileAtomic.sync('.planning/DASHBOARD.md', newContent);
```

**Node.js requirement:** `^20.17.0 || >=22.9.0` — this is MORE restrictive than GSD's current `>=16.7.0` engine requirement. Adding this as a dependency would implicitly raise the Node.js floor. Check your target user base before adding.

**If write-file-atomic is needed:** Add it, but update `engines.node` in `package.json` to match.

### Conflict Detection Pattern (Pure Markdown)

```markdown
# MANIFEST.md (in each milestone workspace)
## Files This Milestone Will Modify
- bin/gsd-tools.cjs
- get-shit-done/bin/gsd-tools.cjs
- agents/gsd-executor.md

## Files This Milestone Will Create
- .planning/milestones/v2.0-concurrent/
```

The `/gsd:new-milestone` command reads all existing MANIFEST.md files and checks for overlapping file lists before starting. No library needed — pure string matching in gsd-tools.cjs.

---

## Version Compatibility

| Package / Feature | Compatible With | Notes |
|-------------------|-----------------|-------|
| `write-file-atomic` 7.0.0 | Node.js `^20.17.0 \|\| >=22.9.0` | Raises GSD's Node.js floor from 16 to 20 if added as dependency |
| `fs.rename()` atomic write (built-in) | Node.js >=16 (all versions) | Atomic on Unix/macOS same-filesystem; not guaranteed on Windows cross-drive |
| Claude Code `--worktree` flag | Current Claude Code (2026) | Stable, not experimental. Worktree location: `.claude/worktrees/<name>/` |
| Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) | Current Claude Code (2026) | Experimental — verify still available before building on it |
| Subagent `isolation: worktree` frontmatter | Current Claude Code (2026) | Stable — same underlying worktree mechanism |
| `chokidar` 4.0.3 | Node.js >=14, CJS + ESM | v5 (Nov 2025) is ESM-only; stay on 4.x if CJS required |

---

## Installation (v2.0 Additions Only)

```bash
# Option A: Zero new dependencies (recommended)
# Implement atomicWrite() inline in gsd-tools.cjs (15 lines, no install needed)
# Uses: fs.writeFileSync + fs.renameSync (Node.js built-ins)

# Option B: Add write-file-atomic (if inline implementation is not preferred)
# WARNING: requires Node.js >=20.17.0 — check engine constraint before adding
npm install write-file-atomic

# No other new dependencies needed for v2.0
```

---

## Sources

- [Claude Code Agent Teams Official Docs](https://code.claude.com/docs/en/agent-teams) — Architecture, task list location, mailbox system, limitations, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var, team config path `~/.claude/teams/{name}/config.json` (HIGH confidence, official docs, verified 2026-02-24)
- [Claude Code Common Workflows — Worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) — `--worktree` flag, worktree location `.claude/worktrees/<name>/`, cleanup behavior, subagent `isolation: worktree` frontmatter (HIGH confidence, official docs, verified 2026-02-24)
- [write-file-atomic GitHub (npm/write-file-atomic)](https://github.com/npm/write-file-atomic) — Version 7.0.0, Node.js engine `^20.17.0 || >=22.9.0`, CJS API, atomic temp+rename mechanism (HIGH confidence, official GitHub, verified 2026-02-24)
- [write-file-atomic npm page](https://www.npmjs.com/package/write-file-atomic) — Download stats, latest version confirmation (HIGH confidence)
- [Node.js fs documentation](https://nodejs.org/api/fs.html) — `fs.rename()`, `fs.writeFileSync()`, atomicity notes (HIGH confidence, official docs)
- [proper-lockfile npm](https://www.npmjs.com/package/proper-lockfile) — mkdir-based lock strategy, stale threshold mechanism (MEDIUM confidence — researched but not recommended for this use case)
- [chokidar GitHub (paulmillr/chokidar)](https://github.com/paulmillr/chokidar) — v4.0.3 CJS+ESM, v5 ESM-only, Node.js >=20 for v5 (MEDIUM confidence, GitHub)
- [Claude Code Threads announcement — built-in worktree support](https://www.threads.com/@boris_cherny/post/DVAAnexgRUj/) — Confirmed built-in worktree support in CLI (MEDIUM confidence, official Anthropic engineer post)
- [Node.js concurrent file write patterns — LogRocket](https://blog.logrocket.com/understanding-node-js-file-locking/) — File locking overview, patterns (MEDIUM confidence, practitioner blog)

---

*Stack research for: GSD v2.0 — Concurrent Milestone Execution*
*Researched: 2026-02-24*

---

---

# Stack Research — v3.0 Tech Debt System

**Domain:** Tech debt tracking hub, CLI debt logging, agent wiring, debugger-driven debt resolution skill, project migration tool
**Researched:** 2026-02-25
**Confidence:** HIGH for Claude Code Skills/Subagents (official docs verified live 2026-02-25); HIGH for Node.js built-in fs patterns; MEDIUM for DEBT.md format conventions (no single standard, derived from project patterns)

---

## What This Section Covers

Stack additions needed for v3.0: systematic tech debt tracking and resolution, plus a project migration tool for existing `.planning/` structures. The existing GSD stack (CJS, Node.js built-in test runner, Context7, hooks, atomic writes, workspace isolation) stays intact. This section covers only what's NEW.

**Key constraint:** GSD has zero runtime npm dependencies. All additions must be pure Node.js built-ins, inline implementations, or Claude Code platform features (skills/subagents) that require no install.

---

## Recommended Stack Additions

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Claude Code Skills (`.claude/skills/<name>/SKILL.md`) | Current (2026) | `/gsd:fix-debt` on-demand debugger-driven debt resolution | Skills are the correct Claude Code mechanism for user-invocable slash commands that run in the main conversation context. A skill is a Markdown file with YAML frontmatter — no tooling, no install, no npm package. Skills support `$ARGUMENTS` substitution for passing debt IDs. The existing GSD command pattern already uses `.claude/commands/` files which are functionally identical to skills. Verified from official docs 2026-02-25. |
| Node.js `fs` module (built-in) | Node 16+ | DEBT.md read/write/append for CLI debt logging command | The debt log command (`debt log`) appends structured entries to `.planning/DEBT.md`. Node's `fs.appendFileSync()` for simple append, `fs.readFileSync()` + regex for idempotent entry updates. No external library needed — the existing gsd-tools.cjs modules (state.cjs, milestone.cjs) all use raw `fs` directly. |
| Node.js `path` + `fs` (built-in) | Node 16+ | Project migration tool for `.planning/` reorganization | Directory traversal, file moves (`fs.renameSync()`), and directory creation (`fs.mkdirSync({ recursive: true })`) are all built-in. Cross-filesystem moves require `fs.copyFileSync()` + `fs.unlinkSync()` as fallback. The migration tool is 100-200 lines of CJS — no library needed. |

### Supporting Patterns (No Additional Libraries)

| Pattern | Mechanism | Purpose | When to Use |
|---------|-----------|---------|-------------|
| DEBT.md structured Markdown | Plain Markdown with frontmatter-style metadata per entry | Central debt hub readable by both humans and agent `Read` tool | Always — agents parse DEBT.md via text scanning (Grep + Read), not a database |
| Debt entry slug IDs | Kebab-case IDs derived from description (`DEBT-001`, `DEBT-002`) | Stable addressable debt identifiers for CLI `debt log --id` and `/gsd:fix-debt <id>` | Always — sequential numeric IDs are simplest, collision-free, and match existing GSD convention (REQ-01, etc.) |
| Executor/verifier inline wiring | Agent instruction additions to existing gsd-executor.md and gsd-verifier.md | Auto-log discovered debt during plan execution and phase verification | No new agent, no new file — extend existing agent markdown specs with debt-logging instructions |
| `fs.renameSync()` for migration moves | Node.js built-in atomic rename | Moving files within same filesystem during migration | Same-filesystem moves; use `fs.copyFileSync()` + `fs.unlinkSync()` for cross-device |

---

## DEBT.md File Format

The central debt hub is a structured Markdown file. Format derived from GSD's existing file conventions (REQUIREMENTS.md, STATE.md) — consistent with what agents already parse.

```markdown
# DEBT.md — Tech Debt Tracker

**Project:** [name]
**Last updated:** [ISO date]

## Active Debt

### DEBT-001: [Short description]

| Field | Value |
|-------|-------|
| **ID** | DEBT-001 |
| **Severity** | high / medium / low |
| **Phase** | [phase where discovered, e.g., "03"] |
| **Discovered** | [ISO date] |
| **Source** | executor / verifier / manual |
| **Status** | open / in-progress / resolved |

**Description:** [What the debt is]

**Impact:** [What breaks or degrades without fixing]

**Resolution hint:** [Optional: what a fix looks like]

---

### DEBT-002: [Short description]
...

## Resolved Debt

### DEBT-NNN: [Short description]
...
**Resolved:** [ISO date]
**Resolution:** [What was done]
```

This format:
- Agents read it with `Read` tool, search it with `Grep` — no parser needed
- CLI `debt log` appends new entries with `fs.appendFileSync()`
- CLI `debt resolve <id>` moves entries from Active to Resolved section with regex replace
- `/gsd:fix-debt DEBT-001` uses the ID to grep for the entry and load context

---

## `/gsd:fix-debt` Skill Design

The skill lives at `.claude/skills/fix-debt/SKILL.md` (project-level) or `~/.claude/get-shit-done/commands/gsd/fix-debt.md` following the existing GSD command pattern.

**Verified frontmatter fields (from official docs 2026-02-25):**

```yaml
---
name: fix-debt
description: Resolve a specific tech debt entry from DEBT.md. Use proactively when asked to fix debt or resolve a DEBT-NNN item.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---
```

`disable-model-invocation: true` — prevents Claude from auto-triggering debt resolution. Debt resolution is destructive and should only run when the user explicitly invokes `/gsd:fix-debt DEBT-001`.

`$ARGUMENTS` — the debt ID (e.g., `DEBT-001`) passed to the skill. The skill body uses `$ARGUMENTS` to grep DEBT.md for the specific entry.

**Key design insight from official docs:** GSD's existing `.claude/commands/gsd/fix-debt.md` pattern works identically to `.claude/skills/fix-debt/SKILL.md`. The `commands/` directory is fully equivalent to the `skills/` directory — skills are the newer, recommended format but both work. Since GSD already uses `commands/gsd/`, keep the new skill there for consistency with the existing 30+ commands.

**Skill body pattern:**
```markdown
You are resolving tech debt entry $ARGUMENTS from this project's DEBT.md.

1. Read `.planning/DEBT.md` and find the entry for $ARGUMENTS
2. Read the files referenced in the debt description
3. Apply the smallest fix that resolves the stated problem
4. Update DEBT.md: move $ARGUMENTS from "Active Debt" to "Resolved Debt"
5. Run tests to confirm nothing regressed
6. Commit the fix with message: `fix(debt): resolve $ARGUMENTS — [short description]`
```

---

## CLI `debt` Command Design

Add a new top-level `debt` command to `gsd-tools.cjs` with subcommands mirroring the existing pattern (e.g., `milestone`, `phase`, `roadmap`).

**New lib file:** `get-shit-done/bin/lib/debt.cjs`

**Subcommands:**
```
debt log --id DEBT-NNN --severity high --description "..." --phase 03 --source executor
debt resolve <id> [--resolution "..."]
debt list [--status open|resolved]
debt get <id>
```

**CJS implementation pattern** (consistent with existing lib files):
```javascript
// debt.cjs
const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

function cmdDebtLog(cwd, options, raw) {
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  // Ensure DEBT.md exists (create scaffold if absent)
  // Append new entry using fs.appendFileSync or full-file rewrite
  // Assign next sequential ID if --id not provided
}

function cmdDebtResolve(cwd, id, options, raw) {
  // Read DEBT.md
  // Find entry by ID
  // Move from Active to Resolved section (regex replace)
  // Write back
}

module.exports = { cmdDebtLog, cmdDebtResolve, cmdDebtList, cmdDebtGet };
```

**Router addition in `gsd-tools.cjs`:**
```javascript
case 'debt': {
  const subcommand = args[1];
  if (subcommand === 'log') {
    const idIdx = args.indexOf('--id');
    const severityIdx = args.indexOf('--severity');
    const descIdx = args.indexOf('--description');
    const phaseIdx = args.indexOf('--phase');
    const sourceIdx = args.indexOf('--source');
    debt.cmdDebtLog(cwd, {
      id: idIdx !== -1 ? args[idIdx + 1] : null,
      severity: severityIdx !== -1 ? args[severityIdx + 1] : 'medium',
      description: descIdx !== -1 ? args[descIdx + 1] : null,
      phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
      source: sourceIdx !== -1 ? args[sourceIdx + 1] : 'manual',
    }, raw);
  } else if (subcommand === 'resolve') {
    debt.cmdDebtResolve(cwd, args[2], { resolution: args[args.indexOf('--resolution') + 1] }, raw);
  } else if (subcommand === 'list') {
    debt.cmdDebtList(cwd, { status: args[args.indexOf('--status') + 1] || 'open' }, raw);
  } else if (subcommand === 'get') {
    debt.cmdDebtGet(cwd, args[2], raw);
  } else {
    error('Unknown debt subcommand. Available: log, resolve, list, get');
  }
  break;
}
```

---

## Executor/Verifier Wiring

No new agents or files. Extend existing agent Markdown specifications with inline debt-logging instructions.

**gsd-executor.md additions:**
- In the quality sentinel or post-task step: if a task reveals a known issue that cannot be fixed in scope (time box, dependency, blocked), log it as debt via CLI
- Pattern: `node ~/.claude/get-shit-done/bin/gsd-tools.cjs debt log --id DEBT-NNN --severity medium --description "..." --phase ${PHASE} --source executor`

**gsd-verifier.md additions:**
- After gap detection: if a gap is documented but deferred (not fixable in this verification pass), log it as debt
- Pattern: same CLI call with `--source verifier`

**Why inline, not a new agent:**
- Keeps executor context consumption low (agent instructions are in-context already)
- Avoids subagent handoff overhead (50-100K tokens for a fresh context vs a Bash call)
- Consistent with the existing Quality Sentinel pattern (inline enforcement, not separate agent)

---

## Project Migration Tool Design

The migration tool reorganizes legacy `.planning/` folders to the current v2.0+ milestone-scoped layout. It is a CLI command, not a Claude Code skill — migration requires deterministic file operations, not AI reasoning.

**New subcommand:** `migrate project [--dry-run] [--milestone <version>]`

**Implementation:** New function `cmdMigrateProject()` in existing `milestone.cjs` or new `migrate.cjs`.

**Migration operations (pure Node.js built-ins):**
```javascript
// 1. Detect current layout (detectLayoutStyle already exists in core.cjs)
// 2. If legacy layout:
//    a. Create .planning/milestones/<version>/ workspace
//    b. Copy STATE.md, ROADMAP.md, REQUIREMENTS.md to milestone workspace
//    c. Move phase directories to milestone workspace (fs.renameSync or copy+delete)
//    d. Update config.json: set concurrent: true, add milestone entry
//    e. Preserve original files as backup (.planning/*.legacy.md)
// 3. Validate result with existing validate.cmdValidateHealth()
// 4. Report: files moved, config updated, validation result
```

**Dry-run mode:** Print what would be moved without writing. Essential for safety — migration is destructive.

**Key Node.js behavior to handle:**
- `fs.renameSync()` across filesystem partitions throws EXDEV — need `fs.copyFileSync()` + `fs.unlinkSync()` fallback
- `fs.mkdirSync({ recursive: true })` creates intermediate directories — use this, not step-by-step mkdir

---

## INTEGRATION-3 and INTEGRATION-4 Fix Design

These are pure CJS code fixes in existing files, no new technologies needed.

**INTEGRATION-3 (`cmdInitPlanPhase`):**
- Replace 3 hardcoded string paths with `path.relative(cwd, path.join(root, 'FILE.md'))` calls
- Already uses `planningRoot()` — fix is 3-line change

**INTEGRATION-4 (`cmdRoadmapGetPhase`, `cmdRoadmapAnalyze`):**
- Add `milestoneScope` parameter to both functions
- Import `planningRoot` from `core.cjs` (already used in other lib files)
- Update CLI router to thread `milestoneScope`
- Fix is ~10 lines across 2 files

---

## What NOT to Add for v3.0

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| SQLite or any database for DEBT.md | Adds native module dependency, breaks zero-dependency constraint, overkill for a file that will have <100 entries in typical projects | Plain Markdown file with structured sections — agents parse with Grep/Read, CLI manipulates with regex |
| Separate `gsd-debt-resolver` subagent | Would burn 50-100K tokens for a fresh context on every debt resolution. The debugger pattern (gsd-debugger.md) already covers systematic bug/debt investigation. | Use `/gsd:fix-debt` skill that runs in main conversation context OR spawn gsd-debugger for complex cases |
| External diff/patch library (e.g., `diff`, `patch`) | Not needed for migration — we're moving whole files, not patching content | `fs.renameSync()` + `fs.copyFileSync()` built-ins |
| `glob` npm package for file discovery | The GSD framework already uses Claude Code's `Glob` tool for agent-driven discovery; for CLI scripts, `fs.readdirSync()` with manual filtering is sufficient for the limited `.planning/` structure | `fs.readdirSync()` + filter in CJS |
| `commander` or `yargs` for CLI argument parsing | GSD's existing `gsd-tools.cjs` uses raw `process.argv.slice(2)` with manual index lookup. Adding an argument parsing library would require refactoring all 30+ existing commands for consistency. New commands must follow the existing pattern. | Manual `args.indexOf('--flag')` pattern already used throughout |
| Separate `/gsd:log-debt` command | Debt logging from agents uses the CLI directly (`node gsd-tools.cjs debt log ...`). A separate slash command for logging adds no value — agents don't use slash commands, they use Bash. | CLI `debt log` subcommand only |
| `inquirer` or interactive prompts in migration CLI | Migration should be scriptable and non-interactive for CI/pipeline use. Safety comes from `--dry-run`, not prompts. | `--dry-run` flag + explicit `--confirm` flag for destructive operations |

---

## Integration Points

### DEBT.md and Milestone Scope

DEBT.md is project-global, not milestone-scoped. Rationale: tech debt spans milestones and should be visible across the full project history. Location: `.planning/DEBT.md` (root level, same as STATE.md and MILESTONES.md).

For milestone-scoped projects, the CLI `debt log` command reads `planningRoot(cwd, milestoneScope)` to find the CWD but always writes to `.planning/DEBT.md` at the repo root. This matches how MILESTONES.md works.

### Skill Location Consistency

The `/gsd:fix-debt` command goes in `commands/gsd/fix-debt.md` — consistent with all 30+ existing GSD commands in `commands/gsd/`. The Claude Code Skills system treats `commands/` files identically to `skills/` files (official docs confirmed). No migration of existing command files is needed.

### Test Coverage

New `debt.cjs` module gets a new `tests/debt.test.cjs` file following the exact pattern of existing test files (`tests/state.test.cjs`, `tests/milestone.test.cjs`, etc.):
- Uses Node.js built-in `node:test` and `node:assert`
- Uses `helpers.cjs` `createTempDir()` and `teardown()` utilities
- Tests: `cmdDebtLog` creates DEBT.md if absent, appends entries, assigns sequential IDs
- Tests: `cmdDebtResolve` moves entry between sections
- Tests: `cmdDebtList` filters by status
- Tests: Migration `--dry-run` reports without writing
- Target: 20-30 new tests to bring total from 232 to ~255+

---

## Version Compatibility

| Component | Node.js Requirement | Notes |
|-----------|---------------------|-------|
| `fs.appendFileSync()` | Node 16+ | Available since Node 0.x. Zero concern. |
| `fs.renameSync()` | Node 16+ | Cross-filesystem throws EXDEV — handle with copy+delete fallback |
| `fs.mkdirSync({ recursive: true })` | Node 10.12+ | Safe for the `>=16.7.0` engine constraint |
| `fs.copyFileSync()` | Node 8.5+ | Safe. Used as migration cross-filesystem fallback |
| Claude Code Skills `commands/` format | Current Claude Code (2026) | Existing GSD command files work unchanged; `disable-model-invocation` field verified in official docs |
| Claude Code Skills `skills/` format | Current Claude Code (2026) | Alternative location; functionally identical to `commands/`. Official docs confirmed both work. |
| `$ARGUMENTS` substitution in skills | Current Claude Code (2026) | Verified in official docs — replaces placeholder with user-provided arguments |

---

## Installation (v3.0 Additions Only)

```bash
# No new npm packages required.
# All new capability is:
# 1. New CJS module: get-shit-done/bin/lib/debt.cjs (no install)
# 2. New CLI command: case 'debt' in gsd-tools.cjs router (no install)
# 3. New skill file: commands/gsd/fix-debt.md (no install)
# 4. Wiring additions to agents/gsd-executor.md and agents/gsd-verifier.md (no install)
# 5. Bug fixes to get-shit-done/bin/lib/init.cjs and roadmap.cjs (no install)
# 6. New test file: tests/debt.test.cjs (no install)
```

Zero new dependencies. Zero changes to `package.json`.

---

## Sources

- [Claude Code Skills Official Docs](https://code.claude.com/docs/en/skills) — SKILL.md format, frontmatter fields (`name`, `description`, `disable-model-invocation`, `allowed-tools`, `$ARGUMENTS`), `commands/` vs `skills/` equivalence, location priority table (HIGH confidence, official docs, verified 2026-02-25)
- [Claude Code Subagents Official Docs](https://code.claude.com/docs/en/sub-agents) — Subagent vs skill distinction, `context: fork` field, `skills` preload field, `memory` field (HIGH confidence, official docs, verified 2026-02-25)
- [Node.js fs documentation](https://nodejs.org/api/fs.html) — `appendFileSync`, `renameSync`, `copyFileSync`, `mkdirSync`, EXDEV error behavior (HIGH confidence, official docs)
- Existing GSD codebase analysis — `gsd-tools.cjs` CLI router pattern, `milestone.cjs`/`state.cjs`/`phase.cjs` module pattern, `tests/*.test.cjs` test pattern, `commands/gsd/` command format (HIGH confidence, direct code inspection 2026-02-25)
- [GSD PROJECT.md](/.planning/PROJECT.md) — v3.0 target features, existing constraints, zero-dependency requirement (HIGH confidence, project source of truth)

---

*Stack research for: GSD v3.0 — Tech Debt System, Migration Tool, Fix-Debt Skill*
*Researched: 2026-02-25*
