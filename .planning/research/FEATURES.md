# Feature Research

**Domain:** AI Coding Agent Framework — Quality Enforcement Layer (Claude Code / GSD fork)
**Researched:** 2026-02-23
**Confidence:** HIGH (executor/verifier/planner read directly; patterns corroborated by multiple external sources)

---

## Context: What GSD Already Has (Baseline)

Before mapping the feature landscape, understand what GSD provides today, because everything in this
fork must be additive — not replacing existing behavior:

| Existing Feature | Where | Quality Relevance |
|-----------------|-------|-------------------|
| Goal-backward verification | gsd-verifier | Checks outcomes, not tasks. Post-execution only. |
| TDD flag on tasks | gsd-executor, gsd-planner | Optional. No enforcement, purely plan-controlled. |
| Stub/anti-pattern detection | gsd-verifier Step 7 | Post-execution. Discovers slop after context burned. |
| Codebase mapper (`/gsd:map-codebase`) | gsd-codebase-mapper | Batch command, not inline with execution. |
| Deviation rules (Rules 1-4) | gsd-executor | Bug fixing only. No pre-scan, no doc lookup. |
| Project skills (``.agents/skills/``) | gsd-planner, gsd-executor | Available if project has set them up. |
| CLAUDE.md project instructions | gsd-executor | Read at start. Advisory only. |

**The gap:** Quality checks happen after execution (verifier finds stubs) or are optional (TDD flag). Nothing enforces quality during execution before or while code is written.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features a quality-focused GSD fork must have. Missing these = "this is just regular GSD with
a new name."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pre-implementation codebase scan | Senior engineers always check before writing. Industry pattern: "AI performs best in healthy code; agents get confused by the same patterns as humans" (CodeScene, 2025). Qodo's state of AI code quality report finds context-miss is the #1 complaint (54% without automated context → 16% with it). | MEDIUM | Targeted scan (find existing patterns, utilities, test baseline) not exhaustive crawl. Context budget constraint: must be fast and specific, not greedy. |
| Library documentation lookup before implementing | Hand-rolling is the #1 AI slop pattern. Security research confirms: "Never roll your own auth — always use established libraries." Context7 MCP resolves this: 3-5 min manual lookup → 10-15 sec automated. Version-specific docs eliminate hallucinated APIs. | MEDIUM | Context7 MCP already in gsd-planner. Needs to be added to gsd-executor tool list and invoked proactively before implementation. |
| Mandatory test step for new logic | PDCA framework for AI code generation mandates "failing tests before any code changes." Qodo report: developers using AI for testing show 61% confidence in test suite vs 27% for non-users. Without mandate, tests are optional → executor skips when time-pressured. | MEDIUM | GSD has TDD infrastructure. Issue is that `tdd="true"` is opt-in per plan. Quality enforcement makes it default for new business logic unless explicitly opted out. |
| Post-task diff review before commit | Industry standard: PostToolUse hooks run quality checks. Claude Code hooks (released early 2026) enable deterministic enforcement post-edit. "Without hooks, CLAUDE.md rules are advisory. With hooks, they become enforced gates." | MEDIUM | Executor already commits per-task. Adding a diff review step before each commit catches slop at the tightest possible scope — before it persists. |
| Enhanced verifier: duplication detection | Qodo report: "AI-generated code produces 1.7x more issues related to logical and correctness bugs." AI coding agents generate new instead of reusing, causing code bloat. The verifier already scans for anti-patterns — adding duplication detection is an incremental enhancement. | MEDIUM | Pattern: grep for copy-paste indicators, identical function signatures in different files, util re-implementations that match existing helpers. |
| Configurable quality levels (strict/standard/fast) | Aegis framework uses lite/standard/full/forensic modes. Redmonk 2025 survey: "professional AI developers want fine-grained permissions for what agents can and cannot do autonomously." One-size quality gates kill productivity for quick experiments. | LOW | Config-driven: `quality_level` in config.json or per-run flag. Strict = all gates. Standard = essential gates. Fast = no pre-scan, minimal review. |

### Differentiators (Competitive Advantage)

Features that distinguish this fork from vanilla GSD and from generic quality overlays. These are the
"GSD but with an engineer who actually reads the code" experience.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Quality Sentinel: inline executor guardian | The OpenObserve pattern: a dedicated Sentinel agent that "audits generated code for framework violations, anti-patterns, and blocks the pipeline if critical problems found." For GSD, this is a behavior layer within the executor (not a separate agent — separate agent burns context on handoff). The Sentinel mindset changes how the executor approaches every task. | HIGH | This is the core differentiator. The executor gains a mental model shift: before implementing, ask "does this already exist?"; while implementing, ask "am I using the right library?"; after implementing, ask "did I introduce slop?". |
| Context7 library lookup integrated into executor flow | gsd-planner already has Context7 tools. gsd-executor does NOT. Adding Context7 to executor tools + making it a quality gate before hand-rolling means the executor resolves APIs in real-time during coding, not just during planning. This closes the gap between "we know what library to use" (plan) and "we used the right API from that library" (execution). | MEDIUM | Requires adding `mcp__context7__resolve-library-id` and `mcp__context7__query-docs` to executor tool list. Behavior: before writing code that uses an external library, executor calls Context7 to verify API signature. |
| Planner quality directives in task actions | The PDCA framework requires task actions to explicitly include: "search codebase for existing implementations," "check Context7 docs for [library]," "write tests for this behavior before implementation." Today, GSD planner produces task `<action>` blocks that describe what to build. Adding quality directives means task actions also specify what to check before building. | MEDIUM | Planner enhancement: `<action>` blocks gain a `<quality_scan>` section listing: existing code to check, docs to consult, tests to write. Executor honors these directives as first-class steps. |
| Test baseline capture at phase start | Before executing a phase, run existing test suite and capture baseline. Any subsequent deviation fails unless a deviation rule triggered (bug fix). This catches the silent test regression problem: executor "fixes" something that breaks existing tests without noticing. PDCA framework mandates this. | MEDIUM | Executor step before first task: `npm test` (or project equivalent) + record count. After each commit, re-run subset. At phase end, compare totals. Diff in SUMMARY.md. |
| Strict mode: pre-commit quality gate blocking | Claude Code hooks (PostToolUse) can block commits if quality checks fail. In strict mode, every commit attempt first passes a quality check script. This is the "hard gate" pattern from OpenObserve: "that hard gate forced us to improve our patterns. The friction created long-term quality." | HIGH | Depends on hook infrastructure. Implementation: post-edit hook runs linter + type checker + grep for known anti-patterns. Block commit if fails. Only in strict mode to avoid slowing fast mode. |
| Dead code / orphan detection in verifier | GSD verifier already checks wiring (exists, substantive, wired). Adding orphan detection catches a specific class of AI slop: utilities created but never imported, components built but not rendered. Extends the existing three-level verification to a fourth check. | LOW | Already has the grep infrastructure in verifier. Add: "grep for artifact imports across codebase. If artifact exists but no import found → ORPHANED → flag in report." |

### Anti-Features (Things to Deliberately NOT Build)

Features that seem appealing but break GSD fundamentals or create more problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Separate Quality Agent (separate sub-agent context) | "Specialization over generalization" sounds like it needs its own agent. OpenObserve uses a Sentinel agent. | In GSD's architecture, each agent gets a fresh 200K context window. A separate quality agent means: (1) executor finishes, (2) quality agent spawned, (3) quality agent re-reads all the files the executor just processed. This is massive context waste. GSD's constraint: "Quality Sentinel in executor, not separate agent — separate agent burns context on handoff." | Quality Sentinel as a behavioral layer within the executor. Same context, same files already read, zero overhead. |
| Exhaustive pre-scan (whole codebase before every task) | "AI should know everything before coding" sounds right. | Context budget: a full codebase scan for a 50-file project can consume 20-30% of context before a single line of code is written. GSD's 50% context budget for execution gets violated immediately. The CodeScene research says "pre-implementation AI-readiness assessment" — not "read every file." | Targeted scan: executor searches for patterns RELEVANT to the current task. "Find existing authentication utilities" not "map entire codebase." Use Grep+Glob, not Read on everything. |
| Continuous test running during implementation | Running tests after every file edit sounds like TDD discipline. | Claude Code hooks for PostToolUse can trigger test runs, but slow tests (>10s) "interrupt workflow" (per hooks best practices). For a large test suite, this makes execution grind to a halt. | Run tests at task boundaries (after each task is complete), not after each file edit. Test runs at commit time, not edit time. |
| Blocking quality gates in fast mode | "Quality should always be enforced" sounds right. | Fast mode exists for a reason: quick experiments, prototypes, hotfixes. Forcing strict quality gates in fast mode makes the framework unusable for those cases. GSD's constraint: "Not all projects need strict mode; quick experiments need speed." | Quality levels: strict/standard/fast. Fast mode reduces gates to the minimum (no pre-scan, no doc lookup, basic post-task review). User opts in to strictness. |
| Rewriting existing GSD workflows | "Starting fresh would be cleaner" when adding features. | GSD has 8.5k+ stars because the existing lifecycle (project → milestone → phase → plan → execute → verify) works. Any rewrite risks breaking the existing pattern that users depend on. GSD PROJECT.md: "Out of scope: rewriting GSD from scratch." | Additive only: extend existing agents, add behavior to existing steps, never replace existing behavior. |
| Automated quality score / vanity metrics | "Show a quality percentage" for each phase is appealing for dashboards. | CodeScene research: "Coverage becomes an effective safeguard when used as a regression signal rather than a vanity metric." A quality score without action path is noise. Users game scores, not real quality. | Quality gates that BLOCK or WARN with specific actionable items. Binary: passes gate / fails gate with what to fix. No abstract score. |
| Auto-fix quality issues without disclosure | "Executor should silently improve code quality as it goes" sounds like a feature. | GSD's deviation rules require explicit documentation of every auto-fix. Silent quality "improvements" that aren't in the plan create state drift: SUMMARY.md doesn't reflect what was actually done, verifier can't trace what changed. | All quality-driven changes must be tracked as deviations (Rule 1/2 auto-fix, documented in SUMMARY). Nothing silent. |

---

## Feature Dependencies

```
[Pre-implementation Codebase Scan]
    └──enables──> [Quality Sentinel behavior] (sentinel has data to enforce against)
    └──enables──> [Planner quality directives] (planner knows what scan should find)

[Context7 in Executor]
    └──requires──> [Context7 MCP tools added to executor tool list]
    └──enables──> [Library documentation lookup during coding]
    └──enables──> [No hand-rolling enforcement] (executor can verify API before writing)

[Mandatory test step]
    └──requires──> [Test baseline capture at phase start] (baseline needed to track regression)
    └──requires──> [TDD infrastructure] (already exists in GSD — this is a dependency already met)
    └──enhances──> [Post-task diff review] (diff includes test changes)

[Configurable quality levels]
    └──gates──> [Strict mode pre-commit blocking] (only active in strict mode)
    └──gates──> [Pre-implementation codebase scan] (skipped in fast mode)
    └──gates──> [Context7 library lookup] (skipped in fast mode, required in standard/strict)

[Post-task diff review]
    └──requires──> [Test baseline capture] (diff includes test count delta)
    └──feeds──> [Enhanced verifier duplication detection] (verifier gets diff to analyze)

[Strict mode pre-commit blocking]
    └──requires──> [Configurable quality levels] (only activates in strict mode)
    └──requires──> [Claude Code hooks infrastructure] (PostToolUse hook for commit interception)

[Enhanced verifier duplication detection]
    └──enhances──> [Dead code / orphan detection] (same infrastructure, different check)
    └──depends on──> [Pre-implementation codebase scan] (scan establishes baseline for comparison)
```

### Dependency Notes

- **Context7 in executor requires tool list change:** This is a config/agent-file change, not a logic change. LOW complexity, HIGH leverage. The executor agent file needs `mcp__context7__resolve-library-id` and `mcp__context7__query-docs` added to its `tools:` header.
- **Test baseline requires knowing the test command:** Executor must determine test command from project context (package.json scripts, CLAUDE.md, codebase mapper TESTING.md). If no test command exists, baseline is "0 tests" and mandatory test step creates the first tests.
- **Strict mode pre-commit blocking depends on Claude Code hooks:** This is the most infrastructure-heavy feature. Hooks require `~/.claude/settings.json` PostToolUse configuration. If hooks are not configured in the user's environment, strict mode falls back to advisory warnings.
- **Planner quality directives and executor Quality Sentinel are independent:** Executor can scan even if planner didn't specify what to scan. But planner-specified directives make the scan more targeted and efficient.
- **Configurable quality levels gate most features:** This must be implemented first (or simultaneously) with other features. Without it, features have no way to check their own activation state.

---

## MVP Definition

### Launch With (v1 — This Milestone)

These features deliver the core value proposition ("Claude writes code like a senior engineer") without
requiring new infrastructure beyond editing existing agent files.

- [x] **Pre-implementation codebase scan** — Targeted grep for existing patterns, utilities, test baseline. Added as a named step in executor `<execution_flow>`. No context budget violation: uses focused Grep/Glob queries on task-relevant paths.
- [x] **Context7 library lookup in executor** — Add Context7 MCP tools to executor tool list. Add behavior: before implementing code using an external library, call resolve-library-id + query-docs. Document findings in task action log.
- [x] **Mandatory test step for new logic** — Amend executor's `<execute_tasks>` step: any task creating new functions/modules runs existing tests after implementation. New business logic gets test coverage before commit. SUMMARY records test delta.
- [x] **Configurable quality levels** — `quality_level: strict|standard|fast` in config.json. Executor reads at start. Gates which quality features activate. Infrastructure for all other features.
- [x] **Planner quality directives** — Planner's `<action>` block gains `<quality_scan>` section with: code paths to search, docs to consult, tests to write. Executor honors these as first-class pre-implementation steps.
- [x] **Enhanced verifier: duplication + orphan detection** — Extend verifier Step 7 (anti-pattern scan) with: duplicate function detection, orphaned artifact detection (exists but never imported). Builds on existing grep infrastructure.

### Add After Validation (v1.x)

Features requiring infrastructure beyond agent edits, or needing real-world feedback first.

- [ ] **Strict mode pre-commit blocking via Claude Code hooks** — Requires PostToolUse hook configuration. Dependency on user's Claude Code hooks setup. Add after confirming v1 quality gates are working and the hook infrastructure is stable. Trigger: users report that advisory warnings in standard mode aren't enough.
- [ ] **Test baseline delta in SUMMARY** — Extends mandatory test step. Adds test count before/after to every plan SUMMARY. Trigger: after mandatory test step is stable and consistently running.

### Future Consideration (v2+)

Features that are valuable but require significant design work or external dependencies.

- [ ] **Automated pattern learning from codebase history** — Build a pattern library from SUMMARY.md files over time, teaching the executor what patterns this project prefers. Complex: requires structured extraction from summaries and persistent storage. Trigger: multiple milestones completed, pattern library would be meaningful.
- [ ] **Quality trend reporting across milestones** — Track quality metrics (test coverage delta, anti-patterns found, deviations per phase) over time. Trigger: enough history to make trends meaningful.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pre-implementation codebase scan | HIGH — directly prevents duplicate code | MEDIUM — new executor step, targeted queries | P1 |
| Context7 in executor | HIGH — eliminates hand-rolling, fixes API hallucinations | LOW — tool list change + behavioral instruction | P1 |
| Configurable quality levels | HIGH — makes framework usable for all project types | LOW — config.json key + conditional logic | P1 |
| Mandatory test step | HIGH — 34-point confidence gap (61% vs 27%) for teams using AI testing | MEDIUM — executor flow change, test command detection | P1 |
| Planner quality directives | MEDIUM — makes scan targeted and efficient | MEDIUM — planner task format change | P2 |
| Enhanced verifier (duplication + orphan) | MEDIUM — catches slop class that current verifier misses | LOW — extends existing grep infrastructure | P2 |
| Strict mode pre-commit blocking | HIGH when active — "hard gate creates long-term quality" | HIGH — requires hook infrastructure | P2 |
| Test baseline delta in SUMMARY | LOW — informational, not blocking | LOW — extension of mandatory test step | P3 |

**Priority key:**
- P1: Must have for this milestone to deliver value
- P2: Should have, adds meaningful quality signal
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

The "competitors" here are other approaches users could take instead of this fork:

| Feature | Vanilla GSD | Raw Claude Code (no framework) | This Fork |
|---------|-------------|-------------------------------|-----------|
| Pre-implementation scan | Manual (user must prompt) | None | Automatic per task |
| Library doc lookup | Planner only (before coding starts) | None | Executor inline (during coding) |
| Test generation | Optional TDD flag | None | Mandatory for new logic |
| Post-task quality review | Post-execution only (verifier) | None | Pre-commit, every task |
| Duplicate detection | Verifier (post-execution) | None | Verifier + pre-scan context |
| Configurable quality | None | None | strict/standard/fast |
| Context budget discipline | Preserved | N/A | Preserved (targeted, not exhaustive) |

---

## Sources

- [CodeScene — Agentic AI Coding: Best Practice Patterns for Speed with Quality](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality) — HIGH confidence (primary source for pre-implementation health assessment pattern)
- [Qodo — State of AI Code Quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/) — HIGH confidence (developer survey data: 609 devs, context-miss statistics, test confidence gap)
- [OpenObserve — How AI Agents Automated Our QA: 700+ Test Coverage](https://openobserve.ai/blog/autonomous-qa-testing-ai-agents-claude-code/) — MEDIUM confidence (case study, single source, but specific and detailed on Sentinel pattern)
- [IntelliJ IDEA Blog — Coding Guidelines for Your AI Agents](https://blog.jetbrains.com/idea/2025/05/coding-guidelines-for-your-ai-agents/) — MEDIUM confidence (JetBrains official, but Junie-specific; pattern generalizes)
- [InfoQ — A Plan-Do-Check-Act Framework for AI Code Generation](https://www.infoq.com/articles/PDCA-AI-code-generation/) — MEDIUM confidence (prescriptive PDCA, TDD-first, atomic commits, pre-scan mandate)
- [Claude Code Docs — Automate workflows with hooks](https://code.claude.com/docs/en/hooks-guide) — HIGH confidence (official Anthropic docs for hooks infrastructure)
- [Claude Code Docs — Create custom subagents](https://code.claude.com/docs/en/sub-agents) — HIGH confidence (official Anthropic docs)
- [Context7 GitHub — upstash/context7](https://github.com/upstash/context7) — HIGH confidence (primary source for Context7 capability claims)
- [PubNub — Best practices for Claude Code sub-agents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/) — MEDIUM confidence (community best practices, multi-step pre-implementation validation pattern)
- [Letanure Dev — Claude Code Part 8: Hooks for Automated Quality Checks](https://www.letanure.dev/blog/2025-08-06--claude-code-part-8-hooks-automated-quality-checks) — MEDIUM confidence (practical hooks examples, fast hooks best practices)
- Internal: `/Users/tmac/Projects/gsdup/agents/gsd-executor.md` — HIGH confidence (direct read, source of truth for current executor behavior)
- Internal: `/Users/tmac/Projects/gsdup/agents/gsd-verifier.md` — HIGH confidence (direct read, source of truth for current verifier behavior)
- Internal: `/Users/tmac/Projects/gsdup/agents/gsd-planner.md` — HIGH confidence (direct read, source of truth for current planner behavior)

---

*Feature research for: AI Coding Agent Framework — Quality Enforcement Layer (GSD Enhanced Fork)*
*Researched: 2026-02-23*
