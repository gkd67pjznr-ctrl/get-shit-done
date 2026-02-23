# Project Research Summary

**Project:** GSD Enhanced Fork — Quality Enforcement Layer
**Domain:** AI coding agent framework quality enforcement (Claude Code / GSD)
**Researched:** 2026-02-23
**Confidence:** HIGH

## Executive Summary

This project is a fork of the GSD (Get Shit Done) AI coding agent framework that adds quality enforcement layers to close the gap between "Claude writes code" and "Claude writes code like a senior engineer." The existing GSD pipeline (project → milestone → phase → plan → execute → verify) already has the scaffolding — TDD flags, a verifier agent, codebase mapper — but all quality checks are either post-execution (verifier finds stubs after context is burned) or optional (TDD flag is plan-controlled). The recommended approach is to layer quality gates directly into the executor agent as an inline sentinel, extend the verifier with additive quality dimensions, and embed quality directives into the planner's task actions. All changes must be additive — no existing behavior is replaced.

The recommended stack relies entirely on tools already available or trivially installed: Claude Code hooks (PreToolUse/PostToolUse/Stop) for deterministic enforcement, Context7 MCP for live library documentation lookup, jscpd for duplication detection, and agentlint for pre-built quality rules. No new runtime dependencies are added to the GSD framework itself. The critical design choice is to implement quality gates as an inline sentinel within the executor rather than as a separate quality agent — a separate agent would burn 50–100K tokens on context handoff per task, while the inline sentinel adds only 6–16K tokens using already-loaded context.

The top risks are context budget exhaustion (quality gates consuming 40–60% of executor context before any code is written), a confirmed `is_last_phase` bug in `phase.cjs` that routes users to "milestone complete" prematurely on multi-phase projects, and config wiring that must be built upfront — not deferred. All three are avoidable with disciplined design: targeted scans with output caps, fixing the bug before layering quality enforcement on top, and wiring `quality_level` config checks into every gate at the time each gate is written.

## Key Findings

### Recommended Stack

The GSD quality enforcement layer requires no new runtime dependencies. Claude Code hooks (PreToolUse/PostToolUse/Stop) are the only mechanism that enforces behavior regardless of Claude's in-context reasoning — CLAUDE.md rules are advisory and degrade as context fills, but hooks are deterministic. Context7 MCP (`@upstash/context7-mcp`) is added project-scoped to provide version-specific library documentation during executor runs, closing the "hallucinated API" failure mode. jscpd handles duplication detection at file scope in PostToolUse hooks and at project scope in the verifier. agentlint's Quality Pack provides 42 pre-built rules as a baseline, avoiding the need to write all hooks from scratch.

**Core technologies:**
- **Claude Code Hooks** (`settings.json` PreToolUse/PostToolUse/Stop): Deterministic quality gate enforcement — the only layer that survives context compression and cannot be overridden by in-context reasoning. Exit code 2 blocks; exit code 0 allows.
- **Context7 MCP** (`@upstash/context7-mcp`): Live library doc lookup via two-step resolve-then-query pattern. Added to executor tool list (not just planner). Prevents hand-rolled implementations using stale or hallucinated APIs.
- **jscpd** (`^4.x`): Token-level duplication detection. File-scoped in PostToolUse hooks; full project scan in verifier Step 7b only.
- **Node.js built-in test runner** (`node --test`): Framework self-tests. No new dependency needed — already in `package.json`.
- **agentlint** (pip): 42 pre-built quality rules covering conventional commits, error-handling removal detection, unused imports. Start here; write custom hooks only for GSD-specific needs.
- **jq** (system): Parses hook JSON payloads — required for any non-trivial hook script.

**Critical version note:** Claude Code hooks require current Claude Code version (released early 2026). Verify with `claude --version` before implementation.

### Expected Features

The MVP for this milestone delivers six features that close the core quality gap without requiring new infrastructure beyond editing existing agent files. Two features (strict-mode pre-commit blocking via hooks, test baseline delta in SUMMARY) are deferred to v1.x pending real-world feedback. Automated pattern learning and quality trend reporting are v2+.

**Must have (table stakes) — v1:**
- **Pre-implementation codebase scan** — targeted grep for existing patterns before writing; prevents the #1 AI slop pattern of reinventing utilities that already exist (54% context-miss rate without automated context per Qodo 2025)
- **Context7 library lookup in executor** — inline doc verification before implementing any external library; currently in planner only, missing from executor where code is actually written
- **Mandatory test step for new logic** — default-on for `.cjs/.js/.ts` files with exported functions; GSD already has TDD infrastructure but `tdd="true"` is opt-in per plan
- **Configurable quality levels** (`strict/standard/fast`) — infrastructure that gates all other features; must be implemented first; fast mode preserves existing GSD behavior exactly
- **Planner quality directives** — `<quality_scan>` subsection in task `<action>` blocks pre-loading executor with "what to reuse, what docs to consult, what tests to write"
- **Enhanced verifier** (duplication + orphan detection) — extends existing verifier Step 7 anti-pattern scan with duplication detection and dead export checking; uses existing grep infrastructure

**Should have (differentiators) — v1.x:**
- **Strict mode pre-commit blocking** via Claude Code hooks — requires PostToolUse hook infrastructure; add after v1 quality gates are validated
- **Test baseline delta in SUMMARY** — extends mandatory test step with before/after test counts; add when mandatory test step is stable

**Defer (v2+):**
- Automated pattern learning from codebase history
- Quality trend reporting across milestones

**Anti-features (deliberately excluded):**
- Separate quality agent (burns 50–100K tokens on context handoff vs. inline sentinel at 6–16K)
- Exhaustive pre-scan (whole codebase violates 50% context budget before first line of code)
- Continuous test running on every file edit (kills execution flow; run at task boundaries instead)
- Automated quality score / vanity metrics (leads to gaming; use binary pass/fail gates with actionable messages)
- Silent quality improvements (all quality-driven changes must be tracked as deviations in SUMMARY)

### Architecture Approach

The quality enforcement layer inserts into the existing GSD pipeline at three natural points without replacing any existing behavior. The executor agent receives the largest changes (inline quality sentinel with pre/during/post-task protocols, Context7 tools added to frontmatter). The verifier receives additive quality dimensions as a new Step 7b after existing Step 7. The planner receives a quality directive format for task `<action>` blocks. Config gates all quality features via `quality.level` in `config.json`.

**Major components and their changes:**
1. **`config.json` template** — add `quality` key with `level` (strict/standard/fast), `enforce_tests`, `enforce_context7`, `enforce_codebase_scan`, `enforce_lint_check`; everything else reads this; must be implemented first
2. **`gsd-executor.md`** — primary target: add `mcp__context7__*` to tools frontmatter, add `<quality_sentinel>` section (pre-task scan + Context7 lookup + test baseline), add during-task gates (tsc/lint), add post-task review (diff read + duplication check + test gate)
3. **`gsd-verifier.md`** — secondary target: add Step 7b (duplication detection, dead code/orphan exports, test file existence check, pattern consistency) after existing Step 7 anti-pattern scan
4. **`gsd-planner.md`** — tertiary target: quality directive format in task `<action>` blocks specifying code to reuse, docs to consult, tests to write
5. **`gsd-plan-checker.md`** — Dimension 9: verify task actions include quality directives; non-blocking in standard mode, blocking in strict mode
6. **Claude Code hooks** (`~/.claude/settings.json` or `.claude/settings.json`) — PreToolUse, PostToolUse, Stop hooks for deterministic enforcement outside of agent reasoning
7. **`.mcp.json`** — Context7 MCP server configuration (project-scoped, committed to git)

**Key patterns:**
- **Inline Sentinel** (not separate agent): Quality gates run inside executor context at ~6–16K tokens overhead per task vs. ~50–100K for a separate agent context handoff
- **Cascading Quality Directives**: Planner embeds scan results in task actions so executor doesn't re-discover patterns from scratch
- **Additive Verification Dimensions**: New verifier checks are Step 7b additions, not a separate verification pass
- **Config-Gated Quality Levels**: Every gate reads `quality_level` at its entry point; fast mode = zero behavior change from vanilla GSD

**Build order is strictly enforced by dependencies:**
Phase 1 (config) → Phase 2 (executor sentinel) → Phase 3 (verifier quality dims) → Phase 4 (planner directives) → Phase 5 (plan-checker Dimension 9)

### Critical Pitfalls

1. **Context budget exhaustion from quality gates** — Quality gate additions compound: pre-task scan + Context7 + sentinel prompting can consume 40–60% of context before any code is written. Prevention: cap all grep output (`| head -10`), scope Context7 queries to exact method/pattern needed (not full library overview), cap total quality gate overhead to 15% of context window. Measure executor context before and after sentinel implementation — must stay under 50% budget.

2. **`is_last_phase` bug causing premature milestone completion** — Confirmed bug in `phase.cjs` lines 786–802: scans filesystem for phase directories, finds none for unplanned future phases, sets `is_last_phase = true`, routes to "milestone complete." Fix: parse phase numbers from ROADMAP.md (authoritative source). Two-location fix required — `phase.cjs` AND `execute-plan.md` offer_next step must be updated atomically.

3. **Config wiring deferred as "phase 2" kills fast mode** — Quality gate code gets written with hardcoded "always run" logic; `quality_level: fast` config key exists but has no behavioral effect. Prevention: every gate function reads `quality_level` at its entry point, always, from day one. Never defer config wiring.

4. **Testing enforcement blocking config and styling changes** — A "write tests for all changes" gate false-positives on `.md`, `.json`, and template file modifications, which have no meaningful unit tests. Prevention: enumerate file-type exemptions explicitly in config (`quality.test_exemptions: ["*.md", "*.json", "templates/**", ".planning/**"]`); test gate fires only on `.cjs/.js/.ts` files with exported functions.

5. **Roadmap routing inconsistency after `is_last_phase` fix** — Fixing `phase.cjs` but not `execute-plan.md` creates split-brain: CLI tool says "next phase" but workflow says "milestone done." Both locations must be fixed in the same plan.

## Implications for Roadmap

The research is unambiguous about build order. A confirmed bug must be fixed before quality enforcement is layered on top. Config infrastructure must precede gate implementation. Executor changes (where code is written) deliver more value than verifier changes (backstop). Planner changes are upstream signaling that reduce executor scan overhead but the executor can work without them.

### Phase 1: Bug Fixes — Restore Multi-Phase Milestone Routing

**Rationale:** The `is_last_phase` bug makes the framework unusable for multi-phase milestones. Any quality enforcement built on top of a broken routing system will produce confusing results and mislead users into thinking milestones are complete. This must be the first phase — not a parallel track, not deferred.

**Delivers:** Correct phase routing after phase completion on multi-phase projects; stable CLI output contract for all downstream callers.

**Files:** `get-shit-done/bin/lib/phase.cjs` (cmdPhaseComplete function), `get-shit-done/workflows/execute-plan.md` (offer_next step)

**Avoids:** Pitfall 2 (premature milestone completion), Pitfall 3 (CLI output field compatibility), Pitfall 8 (routing inconsistency across callers)

**Implementation notes:** Fix is atomic — both locations in the same plan. Parse ROADMAP.md for phase count (not filesystem directory scan). Preserve all existing output fields (`is_last_phase`, `next_phase`, `next_phase_name`, etc.). Write before/after test fixtures capturing exact JSON output before touching code.

**Research flag:** Standard patterns — no deeper research needed. Direct source analysis confirms the fix strategy.

### Phase 2: Config Foundation — Quality Level Infrastructure

**Rationale:** Every quality gate reads config. Without the `quality.level` key in config.json and the pattern for reading it, gates cannot be conditionally enabled or disabled. This is the lowest-risk, highest-leverage change — one file, no agent logic — but it unblocks every subsequent phase.

**Delivers:** `quality_level: strict|standard|fast` in config.json; fast mode that preserves existing GSD behavior exactly; the infrastructure all subsequent gates use to check their activation state.

**Files:** `get-shit-done/templates/config.json`

**Avoids:** Pitfall 7 (enforcement levels not wired), technical debt of retroactively threading config through already-written gates

**Implementation notes:** Define the complete behavior matrix upfront (what each gate does in each mode) before writing any gate code. Add `quality.test_exemptions` array alongside `quality.level`.

**Research flag:** Standard patterns — well-understood config pattern. No deeper research needed.

### Phase 3: Executor Quality Sentinel — Inline Quality Gates at Write Time

**Rationale:** The executor is where code is written and where slop originates. Fixing quality at the source (executor) is cheaper than fixing it in verification. This is the highest-value change in the entire milestone and the core differentiator of this fork.

**Delivers:** Pre-task codebase scan (targeted grep for existing patterns), Context7 library lookup before implementing external libraries, during-task lint/type checks after each file write, post-task diff review before commit, mandatory test step for new `.cjs/.js/.ts` logic.

**Uses:** Context7 MCP (mcp__context7__resolve-library-id + mcp__context7__query-docs), Node built-in test runner, config quality level gate

**Addresses features:** Pre-implementation codebase scan (P1), Context7 in executor (P1), Mandatory test step (P1), Quality Sentinel behavior (core differentiator)

**Avoids:** Pitfall 1 (context budget exhaustion — cap grep output, cap Context7 queries, target scans), Pitfall 4 (test enforcement blocking config changes — use file-type exemptions), Pitfall 5 (codebase scan noise — scope to task-relevant directories from PLAN frontmatter), Pitfall 6 (Context7 token explosion — one query per plan, exact method not full library)

**Files:** `agents/gsd-executor.md` (tools frontmatter, `<quality_sentinel>` section, `<context7_protocol>` section, `<execute_tasks>` step modifications, `<task_commit_protocol>` test gate), `.mcp.json` (Context7 server config)

**Context budget warning:** Quality sentinel adds 17–38K tokens overhead per task on top of current 40–75K baseline. Complex tasks may approach 200K limit. Plans must target ~40% context (not 50%) when quality gates are active. This is the primary technical risk of this phase.

**Research flag:** Needs deeper research during planning — Context7 token budget management, specific grep patterns for GSD's CJS codebase, test file detection heuristics for the CJS framework format.

### Phase 4: Verifier Quality Dimensions — Post-Execution Backstop

**Rationale:** The verifier is the backstop — it catches what the executor's inline gates miss. It operates on complete phase output, so it is meaningfully useful only after Phase 3 has been teaching the executor to write tests. Without Phase 3 first, every Phase 4 verification would fail on test coverage because existing plans don't have tests.

**Delivers:** Step 7b quality dimensions: duplication detection on phase files, dead code/orphaned export detection, test file existence check, pattern consistency check against CONVENTIONS.md. Quality findings appear in VERIFICATION.md `gaps_found` section with severity gated by config level.

**Uses:** Existing grep infrastructure (no new tooling), jscpd for duplication detection, config quality level gate

**Addresses features:** Enhanced verifier duplication + orphan detection (P2)

**Avoids:** Pitfall anti-pattern of making Step 7b findings hard-block in all modes (in `standard`: warnings; in `strict`: blockers; in `fast`: Step 7b skipped entirely)

**Files:** `agents/gsd-verifier.md` (Step 7b addition, Step 9 status update to include quality findings, VERIFICATION.md output template)

**Research flag:** Standard patterns — verifier architecture is well-understood from direct source analysis. No deeper research needed.

### Phase 5: Planner Quality Directives — Upstream Scan Optimization

**Rationale:** Planner quality directives pre-load the executor with scan results, reducing executor scan cost. The executor can work without them (quality sentinel runs its own scan), but directives make scans more targeted and efficient. Building planner changes after Phases 3–4 means the executor contract is stable before we change how plans are created.

**Delivers:** Quality directive format in task `<action>` blocks specifying (a) existing code to reuse, (b) library docs to consult, (c) tests to write. Planner self-check verifies each task action has quality directives populated before returning the plan.

**Addresses features:** Planner quality directives (P2)

**Files:** `agents/gsd-planner.md` (task_breakdown section, self-check instruction)

**Research flag:** Standard patterns — follows the cascading directives architectural pattern documented in ARCHITECTURE.md. No deeper research needed.

### Phase 6: Plan-Checker Dimension 9 — Pre-Execution Plan Validation

**Rationale:** Plan-checker Dimension 9 enforces that planners follow the Phase 5 changes. The executor's inline sentinel catches gaps regardless, so this is the least critical change — it provides pre-execution validation as a convenience, not a safety net. Build last, after the planner changes are stable.

**Delivers:** Dimension 9 quality directive completeness check: verifies task actions reference codebase patterns to reuse, library docs to consult, and tests to write. Non-blocking in standard mode, blocking in strict mode.

**Addresses features:** Plan quality directives enforcement

**Files:** `agents/gsd-plan-checker.md` (Dimension 9 addition)

**Research flag:** Standard patterns — follows the existing 8-dimension plan-checker structure. No deeper research needed.

### Phase 7: Claude Code Hooks — Deterministic Enforcement Layer

**Rationale:** Claude Code hooks provide enforcement that survives context compression and cannot be overridden by in-context reasoning. This is the "hard gate" pattern — hooks run regardless of what Claude "thinks." Deferred to v1.x because it requires infrastructure setup (hook scripts, settings.json configuration) beyond agent file edits, and v1 quality gates should be validated before adding the infrastructure complexity.

**Delivers:** PreToolUse hook (quality-sentinel-pre.sh) blocking writes that fail pre-conditions; PostToolUse hook (quality-sentinel-post.sh) running lint/type/duplication checks; Stop hook (quality-sentinel-stop.sh) running full test suite before session end. agentlint Quality Pack as baseline rule set.

**Uses:** Claude Code hooks system, agentlint, jscpd, jq for JSON parsing

**Addresses features:** Strict mode pre-commit blocking (P2, deferred to v1.x)

**Avoids:** Common mistake of putting must-enforce quality gates only in CLAUDE.md (advisory only, not deterministic)

**Files:** `~/.claude/settings.json` or `.claude/settings.json`, new hook scripts in `get-shit-done/hooks/`

**Research flag:** Needs deeper research during planning — hook script implementation details, agentlint rule configuration, interaction between hooks and existing executor commit protocol.

### Phase Ordering Rationale

- **Bug fix first:** The `is_last_phase` bug is confirmed, breaks multi-phase milestones, and is independent of quality features. Fixing it first provides a stable foundation.
- **Config before gates:** Every gate reads config; config must exist before gates are written, not retrofitted.
- **Executor before verifier:** Fixing quality at source (executor) is cheaper than backstop verification. Verifier quality checks are only meaningful after the executor is writing tests.
- **Planner before plan-checker:** No point validating quality directives in plans before the planner knows how to write them.
- **Hooks last (v1.x):** Infrastructure complexity deferred until agent-level quality gates are validated and the hook contract is stable.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Executor Quality Sentinel):** Context7 token budget management is the primary technical risk. Need to determine: maximum token cap for Context7 responses, specific grep patterns for GSD's CJS codebase structure, test file detection heuristics for `.test.cjs` format, exact hook stdin JSON schema for PostToolUse events.
- **Phase 7 (Claude Code Hooks):** Hook script implementation is environment-dependent. Need to verify: exact settings.json hook configuration format for current Claude Code version, agentlint rule pack configuration, interaction between PostToolUse hooks and executor's atomic commit protocol (avoid double-committing).

Phases with standard patterns (can skip `/gsd:research-phase`):
- **Phase 1 (Bug Fixes):** Direct source analysis confirms fix location and strategy. ROADMAP.md parsing already exists in `roadmap.cjs`.
- **Phase 2 (Config Foundation):** One-file change following existing config.json patterns.
- **Phase 4 (Verifier Quality Dims):** Follows existing verifier step structure. Grep patterns are well-understood.
- **Phase 5 (Planner Directives):** Follows existing task `<action>` format with additive subsection.
- **Phase 6 (Plan-Checker Dim 9):** Follows existing 8-dimension plan-checker structure exactly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Claude Code docs, Context7 GitHub, jscpd npm — all primary sources. agentlint is MEDIUM (GitHub README only, active project). Context7 runtime behavior is LOW (quota exceeded during research, pattern from training data corroborated by multiple secondary sources). |
| Features | HIGH | Executor, verifier, and planner agent files read directly. Qodo survey data (609 devs), CodeScene patterns, and PDCA framework corroborate feature prioritization. |
| Architecture | HIGH | All 11 agent source files, PROJECT.md, and PROPOSAL.md read directly. Architecture is derived from first-party analysis, not inference. |
| Pitfalls | HIGH | `is_last_phase` bug confirmed in first-party source (`phase.cjs` lines 786–802). `execute-plan.md` independent filesystem routing confirmed. Context budget numbers from PROJECT.md constraints directly. |

**Overall confidence: HIGH**

### Gaps to Address

- **Context7 runtime token volume:** Research confirmed the two-step resolve+query pattern but could not verify exact token counts for Context7 responses at runtime (quota exceeded). During Phase 3 planning, run a test Context7 query against a real library and measure token output before setting the cap. Recommendation: start with 2,000 token cap per query (per PITFALLS.md), adjust based on observed behavior.

- **agentlint rule pack details:** agentlint's 42 rules were described at category level (Quality Pack, Security Pack) but not inspected individually. During Phase 7 planning, run `agentlint setup` in a test environment and enumerate the specific Quality Pack rules to determine which align with GSD's enforcement goals and which to disable.

- **Hook interaction with executor atomic commits:** The executor already has a per-task commit protocol. PostToolUse hooks fire after every Write/Edit, not just at commit time. Need to confirm during Phase 7 planning that hook-level gates don't interfere with the executor's staged commit sequence.

- **ROADMAP.md phase number format:** PITFALLS.md notes ROADMAP.md uses unpadded phase numbers in headers (`Phase 1:` not `Phase 01:`). Confirm this is consistent across all existing projects before writing the parser in Phase 1.

## Sources

### Primary (HIGH confidence)
- Claude Code Hooks Guide (`code.claude.com/docs/en/hooks-guide`) — hook events, exit codes, settings.json format
- Claude Code MCP Docs (`code.claude.com/docs/en/mcp`) — MCP scopes, `.mcp.json` format, project-scoped installation
- Claude Code Subagents Docs (`code.claude.com/docs/en/sub-agents`) — subagent frontmatter, tools field
- Context7 GitHub (`github.com/upstash/context7`) — tool interface, two-step resolve+query pattern
- jscpd npm (`npmjs.com/package/jscpd`) — language support, configuration, threshold behavior
- Internal: `agents/gsd-executor.md` — current executor behavior, tool list, deviation rules
- Internal: `agents/gsd-verifier.md` — 3-level verification, anti-pattern scan, step structure
- Internal: `agents/gsd-planner.md` — task anatomy, context budget rules, quality degradation curve
- Internal: `agents/gsd-plan-checker.md` — 8 verification dimensions, Nyquist section
- Internal: `get-shit-done/bin/lib/phase.cjs` (lines 786–802) — is_last_phase bug confirmed
- Internal: `get-shit-done/workflows/execute-plan.md` — offer_next step routing logic
- Internal: `.planning/PROJECT.md` — constraints, out-of-scope items, known bugs

### Secondary (MEDIUM confidence)
- Qodo State of AI Code Quality 2025 (`qodo.ai/reports/state-of-ai-code-quality/`) — context-miss statistics, test confidence gap (609-dev survey)
- CodeScene Agentic AI Coding Patterns (`codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality`) — pre-implementation health assessment, multi-level safeguards
- OpenObserve QA Agent Case Study (`openobserve.ai/blog/autonomous-qa-testing-ai-agents-claude-code/`) — Sentinel pattern, hard gate impact
- InfoQ PDCA Framework (`infoq.com/articles/PDCA-AI-code-generation/`) — TDD-first, atomic commits, pre-scan mandate
- agentlint GitHub (`github.com/mauhpr/agentlint`) — rule packs, hook integration
- Claude Code Enforcers (`rungie.com/blog/claude-code-enforcers/`) — PostToolUse lint hook patterns
- Claude Code Hooks Production Patterns (`pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns`) — 12 lifecycle events, PreToolUse blocking behavior

### Tertiary (LOW confidence)
- Context7 MCP runtime behavior — Context7 API quota exceeded during research; token volume and response format inferred from training data, corroborated by secondary sources. Validate during Phase 3 planning with a live test query.

---
*Research completed: 2026-02-23*
*Ready for roadmap: yes*
