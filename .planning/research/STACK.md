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
