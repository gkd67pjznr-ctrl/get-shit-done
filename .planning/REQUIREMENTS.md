# Requirements: GSD Enhanced Fork

**Defined:** 2026-02-23
**Core Value:** Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Bug Fixes

- [ ] **BUG-01**: `cmdPhaseComplete` in `phase.cjs` determines `is_last_phase` by parsing ROADMAP.md phase headers instead of scanning filesystem directories
- [ ] **BUG-02**: `execute-plan.md` offer_next step uses ROADMAP.md phase count for routing instead of independent filesystem directory scan
- [ ] **BUG-03**: Both bug fixes are atomic — applied in the same plan with before/after test fixtures validating JSON output

### Config Foundation

- [ ] **CFG-01**: `config.json` template includes `quality.level` key with values `strict`, `standard`, or `fast`
- [ ] **CFG-02**: `quality.level: fast` preserves existing GSD behavior exactly — zero quality gates fire
- [ ] **CFG-03**: `config.json` includes `quality.test_exemptions` array listing file patterns exempt from test requirements (`.md`, `.json`, `templates/**`, `.planning/**`)
- [ ] **CFG-04**: Every quality gate reads `quality_level` at its entry point before executing any checks

### Executor Quality

- [ ] **EXEC-01**: Executor performs targeted codebase scan before each task — grep for existing patterns, utilities, and test baseline relevant to the task
- [ ] **EXEC-02**: Executor has Context7 MCP tools (`resolve-library-id`, `query-docs`) in its tools frontmatter and calls them before implementing code using external libraries
- [ ] **EXEC-03**: Executor runs mandatory test step for new logic — any task creating new `.cjs/.js/.ts` files with exported functions gets test coverage before commit
- [ ] **EXEC-04**: Executor performs post-task diff review before each commit — reads own diff, checks for duplication, validates naming consistency
- [ ] **EXEC-05**: Quality Sentinel protocol is documented as `<quality_sentinel>` section in `gsd-executor.md` with pre-task, during-task, and post-task gates
- [ ] **EXEC-06**: Context7 usage protocol is documented as `<context7_protocol>` section in `gsd-executor.md` specifying when and how to consult library docs
- [ ] **EXEC-07**: `.mcp.json` includes Context7 MCP server configuration (project-scoped)
- [ ] **EXEC-08**: Quality gates are skipped entirely when `quality.level` is `fast`; reduced gates for `standard`; all gates for `strict`

### Verifier Quality

- [ ] **VRFY-01**: Verifier includes Step 7b after existing Step 7 that checks for code duplication across phase files
- [ ] **VRFY-02**: Verifier Step 7b detects dead code and orphaned exports (artifacts that exist but are never imported)
- [ ] **VRFY-03**: Verifier Step 7b checks that new `.cjs/.js/.ts` logic files have corresponding test files
- [ ] **VRFY-04**: Verifier quality findings appear in VERIFICATION.md with severity gated by `quality.level` — warnings in `standard`, blockers in `strict`, skipped in `fast`

### Planner Quality

- [ ] **PLAN-01**: Planner task `<action>` blocks include a `<quality_scan>` subsection specifying existing code to reuse, library docs to consult, and tests to write
- [ ] **PLAN-02**: Planner self-check verifies each task action has quality directives populated before returning the plan

### Plan-Checker

- [ ] **PCHK-01**: Plan-checker includes Dimension 9 that validates task actions contain quality directives (code to reuse, docs to consult, tests to write)
- [ ] **PCHK-02**: Dimension 9 is non-blocking in `standard` mode and blocking in `strict` mode

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Hooks Infrastructure

- **HOOK-01**: PreToolUse hook blocks writes that fail quality pre-conditions in strict mode
- **HOOK-02**: PostToolUse hook runs lint, type-check, and duplication detection after file edits in strict mode
- **HOOK-03**: Stop hook runs full test suite before session end
- **HOOK-04**: agentlint Quality Pack integrated as baseline rule set for hooks

### Quality Reporting

- **REPT-01**: Test baseline delta (before/after test count) appears in every plan SUMMARY.md
- **REPT-02**: Quality trend reporting across milestones tracks test coverage, anti-patterns found, deviations per phase

### Advanced

- **ADVN-01**: Automated pattern learning from SUMMARY.md files builds project-specific pattern library over time

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Separate quality agent | Burns 50-100K tokens on context handoff vs. inline sentinel at 6-16K |
| Exhaustive pre-scan (whole codebase) | Violates 50% context budget before first line of code |
| Continuous test running on every file edit | Kills execution flow; tests run at task boundaries instead |
| Automated quality score / vanity metrics | Leads to gaming; use binary pass/fail gates with actionable messages |
| Silent quality improvements | All quality-driven changes must be tracked as deviations in SUMMARY |
| Blocking quality gates in fast mode | Fast mode exists for quick experiments and prototypes |
| Rewriting GSD workflows | Additive only — extend, never replace existing behavior |
| Supporting non-Claude Code runtimes | Fork is Claude Code specific |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | — | Pending |
| BUG-02 | — | Pending |
| BUG-03 | — | Pending |
| CFG-01 | — | Pending |
| CFG-02 | — | Pending |
| CFG-03 | — | Pending |
| CFG-04 | — | Pending |
| EXEC-01 | — | Pending |
| EXEC-02 | — | Pending |
| EXEC-03 | — | Pending |
| EXEC-04 | — | Pending |
| EXEC-05 | — | Pending |
| EXEC-06 | — | Pending |
| EXEC-07 | — | Pending |
| EXEC-08 | — | Pending |
| VRFY-01 | — | Pending |
| VRFY-02 | — | Pending |
| VRFY-03 | — | Pending |
| VRFY-04 | — | Pending |
| PLAN-01 | — | Pending |
| PLAN-02 | — | Pending |
| PCHK-01 | — | Pending |
| PCHK-02 | — | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 (pending roadmap creation)

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 after initial definition*
