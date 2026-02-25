# Feature Research

**Domain:** Tech Debt Tracking Hub + Project Migration Tool + Debugger-Driven Debt Resolution (GSD v3.0)
**Researched:** 2026-02-25
**Confidence:** HIGH (internal codebase analysis direct; tech debt register patterns confirmed by multiple authoritative sources; migration tool safety patterns verified against established tools like Flyway/Liquibase; Debug2Fix framework from peer-reviewed arxiv paper)

---

## Context: What GSD Already Has (Baseline for This Milestone)

The v3.0 feature set layers ON TOP of the existing v1.x/v2.x system. Nothing below duplicates completed work.

| Existing Feature | Where | v3.0 Relevance |
|-----------------|-------|----------------|
| Quality Sentinel (pre-task scan, Context7, mandatory tests, diff review) | executor agent | Sentinel is the detection side — v3.0 adds the tracking and resolution side |
| Quality dimensions in verifier (duplication, orphaned exports, missing tests) | verifier agent | Verifier finds debt-generating patterns — v3.0 gives executor/verifier a place to log what they find |
| Planner quality directives (code to reuse, docs to consult, tests to write) | planner agent | Planner can check DEBT.md during planning to avoid re-introducing known debt |
| Config quality levels (fast/standard/strict) | config.json | Debt logging can be gated on quality level (strict logs everything; fast skips) |
| Concurrent milestone workspaces with isolation | v2.0 | DEBT.md is global (project-level), not per-milestone — debt transcends milestones |
| TO-DOS.md for manual todo tracking | .planning/ | Tech debt ≠ todos: todos are tasks to complete; debt is deliberate shortcuts or discovered quality issues with structured metadata |
| `/gsd:progress`, `/gsd:set-quality`, `/gsd:help` | slash commands | New `/gsd:fix-debt` command joins this set |
| `list-todos` command in gsd-tools.cjs | CLI | New `debt-log` and `debt-list` commands join this set |

**The gap:** GSD's Quality Sentinel can detect problems (pattern violations, missing tests, API workarounds) but has no structured place to record them. Discovered debt is currently either silently dropped, left as a TODO comment in code, or placed in TO-DOS.md as an unstructured note. Neither gives the information needed to prioritize, assign, or systematically resolve debt later. No on-demand "go fix specific debt item" workflow exists — users must manually read DEBT.md and construct the fix themselves.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a tech debt tracking system must have. Missing any of these means the system is incomplete for its stated purpose.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Structured debt entry format (DEBT.md hub) | Every mature debt register (Jira, GitHub Issues, arc42, agile teams) uses structured entries with: ID, type, severity, component, description, date, status. An unstructured file is a junk drawer — you can't sort, filter, or assign from it. Industry consensus on these fields is strong (otherCode.io, Scrum.org, CMU SEI all agree). | LOW | Fields: `id` (TD-NNN), `type` (code/test/architecture/integration), `severity` (critical/high/medium/low), `component` (file or module path), `description`, `date_logged`, `logged_by` (agent or milestone ref), `status` (open/in-progress/resolved/deferred), `resolution_plan` (optional). Markdown table or frontmatter-style entries. Already have precedent in TO-DOS.md format. |
| CLI command for agents to log debt (`debt-log`) | The Quality Sentinel runs inside executor agents. Agents can't edit DEBT.md directly without risk of clobbering concurrent writes. They need a `gsd-tools.cjs debt-log` command — just like `state update` and `todo complete` — that safely appends an entry. This is exactly how `list-todos` and `state update` work for their respective domains. | LOW | `node gsd-tools.cjs debt-log --type code --severity medium --component "lib/init.cjs:138" --description "..."` — appends to `.planning/DEBT.md` atomically. Returns new entry ID. Must be safe to call concurrently from parallel plan subagents (append-only, no read-modify-write). |
| Debt status lifecycle (open → in-progress → resolved/deferred) | Every tech debt register in industry uses status tracking. Without status, DEBT.md becomes append-only noise — items are never marked resolved, so the file grows forever and becomes unusable. Scrum.org and otherCode.io both identify status as a required field. | LOW | Status transitions: `open` (default) → `in-progress` (when fix-debt picks it up) → `resolved` (when verifier confirms fix) or `deferred` (explicitly postponed). CLI command to update: `gsd-tools.cjs debt-status TD-001 resolved`. |
| List/query debt entries (`debt-list`) | A debt register that can't be queried is a write-only system. Agents and humans need to look up debt by status, type, severity, or component. Analogous to `list-todos` which already exists. | LOW | `node gsd-tools.cjs debt-list [--status open] [--type code] [--severity critical]` — returns JSON array of matching entries. Used by `/gsd:fix-debt` to pick the next item to address. |
| Executor/verifier auto-log wiring | The value of structured debt tracking is automatic capture — not requiring engineers to manually document every shortcut. The Quality Sentinel already detects issues (workarounds, missing tests, pattern violations). Without wiring its findings to DEBT.md, detection has no persistent record. This is the "write" side of the system; `debt-log` is the "write API" the agents call. | MEDIUM | In executor agent: when Quality Sentinel flags a known issue that can't be fixed in this plan (out of scope, too risky), call `gsd-tools.cjs debt-log` before moving on. In verifier agent: when quality dimensions find duplication or orphaned exports not addressed by the plan, call `debt-log` with those findings. Gate on quality level — `strict` logs all findings; `standard` logs only unresolved critical/high; `fast` skips all debt logging. |
| Project migration tool (`.planning/` restructure) | Projects on old layouts (pre-v2.0) have `.planning/` structures that differ from current spec. A tool that can inspect, report gaps, and apply safe structural updates is expected in any mature framework. Database migration tools (Flyway, Liquibase) established the bar: dry-run first, idempotent apply, never lose data. This is the project equivalent. | MEDIUM | `node gsd-tools.cjs migrate [--dry-run] [--from vX.Y]` — inspects current `.planning/` layout, identifies what's missing vs current spec (e.g., missing `config.json` sections, missing `DEBT.md`, wrong folder structure), reports what would change, then applies with `--apply`. Never destructive — no file deletion, only additions and moves with backup. |
| INTEGRATION-3 and INTEGRATION-4 bug fixes | These are known gaps documented in TO-DOS.md. INTEGRATION-3: `cmdInitPlanPhase` uses hardcoded paths instead of `planningRoot()`. INTEGRATION-4: roadmap commands ignore `--milestone` flag. These are not "new features" — they are correctness bugs in v2.0 shipping code that affect milestone-scoped projects. Fixing them is prerequisite plumbing for v3.0 stability. | LOW | Direct code fixes: INTEGRATION-3 in `bin/lib/init.cjs` lines 138-140; INTEGRATION-4 in `bin/lib/roadmap.cjs` + CLI router in `gsd-tools.cjs` lines 436-438. Pattern: match `cmdInitExecutePhase` which already does this correctly. |

### Differentiators (Competitive Advantage)

Features that distinguish GSD's debt system from "just a TODO list" or manual Jira tagging.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `/gsd:fix-debt` skill (debugger-driven resolution) | Other debt systems track and report — they don't *fix*. GSD can use a structured debt entry as the input to a targeted resolution workflow: read the debt entry, read the affected component, diagnose the root cause using the Debug2Fix pattern (inspect runtime state, not just static analysis), implement the fix, run tests, verify, mark resolved. This closes the loop: discover → log → fix → verify — entirely within the agent framework. | HIGH | Slash command that: (1) reads DEBT.md, picks an entry (by ID or by priority), (2) spawns an executor subagent with the debt entry as context, (3) subagent implements the fix using the standard execute-plan flow, (4) verifier confirms fix, (5) `debt-status` updates entry to resolved. The Debug2Fix approach (step through runtime state, not just static analysis) is the key differentiator — it finds root causes, not just surface manifestations. |
| Quality-level-gated debt logging | Debt logging that is always-on would create noise in fast-mode projects. The existing quality level config (fast/standard/strict) gates whether debt is logged at all, and at what threshold. `fast` = no auto-logging (zero overhead for experiment projects); `standard` = log critical/high severity only; `strict` = log everything including medium severity. This aligns with the existing principle that quality enforcement is configurable, not forced. | LOW | Config-driven behavior using existing `quality.level` from `config.json`. No new config keys needed — piggybacks on the established gating pattern. Already have precedent in how executor quality gates are gated. |
| Debt linked to its originating phase/plan | A debt entry logged during phase-03 plan-02 carries that provenance. When `/gsd:fix-debt` picks up the entry, it knows *exactly* where the debt was introduced — the plan that created it, the milestone it belongs to. This makes root-cause analysis O(1) instead of requiring a git blame + code archaeology session. | LOW | Add `source_phase` and `source_plan` fields to debt entry. Executor agent passes these when calling `debt-log` (already has phase/plan context from its PLAN.md). |
| Debt metrics in `/gsd:progress` | Progress output currently shows phase completion, plan completion, and quality gate activity. Adding debt counts (open/resolved this milestone) makes tech debt visible at the same glance as phase progress — not buried in a separate file. Visibility drives resolution. | LOW | `progress` command already queries multiple sources (STATE.md, ROADMAP.md, STATUS.md). Add `debt-list --status open --format count` to the progress render. Show: "Tech debt: 3 open (1 critical, 2 medium)". |
| Migration tool dry-run with diff report | Most migration tools only tell you what they're about to do. GSD's migration tool should show a structured diff: "Would add: DEBT.md, would update config.json (add `debt` section), would rename: phases/phase-01 → phases/phase-01 (no change)." This is the Flyway dry-run pattern applied to filesystem structure. Users can review before applying. | LOW | `--dry-run` flag produces a markdown-formatted "what would change" report. `--apply` flag performs the actual changes. Idempotent — running `--apply` twice is safe. |

### Anti-Features (Things to Deliberately NOT Build)

Features that seem like natural additions but violate GSD's design principles or create more problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Automatic debt prioritization / scoring | "Score each debt entry 1-100 based on severity + age + component churn" sounds like it adds intelligence to prioritization. | Prioritization requires business context that an automated scorer cannot have. A high-severity debt item in a component scheduled for deletion next sprint is lower priority than a medium item in a critical shared utility. Auto-scoring creates false confidence and anchors decision-making on a number that ignores business reality. | Surface the raw fields (severity, age, component) in `debt-list` output. Let the engineer sort and filter. Decision stays with the human. |
| Real-time debt dashboard / web UI | "Show a live dashboard of all open debt" sounds like useful visibility. | GSD is a file-based, Claude Code-embedded framework. Adding a web UI or a server process violates the architectural constraint: zero daemon processes, no always-on services. An HTTP server for debt visualization would require port management, startup scripts, and would break the "open Claude Code, run GSD" simplicity. | `/gsd:progress` shows debt counts inline. `debt-list --format table` renders markdown tables that Claude Code can display. Zero server required. |
| Debt estimation and burndown tracking | "Estimate hours for each debt item, track burndown over time" sounds like complete project management. | Effort estimation for tech debt is famously unreliable. Debt items regularly take 10x the estimated time because root causes are only discovered during the fix. Building estimation infrastructure creates bureaucratic overhead for data that is mostly wrong. The existing GSD pattern: PLAN.md has task estimates for planned work; debt resolution is unplanned by nature. | Debt items have `resolution_plan` (a text field describing the approach). Engineers estimate as needed. Don't track burndown in GSD — that's what project management tools are for. |
| Automatic debt resolution without human review | "If severity is low and the fix is obvious, just auto-fix it" seems like a useful optimization. | Autonomous code changes without human review accumulate their own debt. A "low severity" fix that restructures an import tree can break downstream consumers in ways the agent can't detect without full codebase awareness. The existing GSD constraint: all code changes go through plan→execute→verify with a human in the loop. | `/gsd:fix-debt` creates a standard plan and executes it — the human reviews the plan before execution and reviews the SUMMARY.md after. No unreviewed automated fixes. |
| Debt assigned to external systems (Jira, Linear) | "Sync DEBT.md entries to Jira tickets automatically" sounds like integration value. | GSD is a Claude Code framework embedded in a `.planning/` folder. External API calls to project management tools add: authentication secrets, network dependencies, rate limits, and bidirectional sync conflicts. DEBT.md is a plain Markdown file in the repo — it's already in the version-controlled, discoverable, searchable location. | DEBT.md entries are Markdown. If a team wants to create a Jira ticket from a debt entry, they copy-paste. No sync infrastructure needed. |
| Per-milestone DEBT.md isolation | "Each milestone should have its own debt register" sounds like a natural extension of milestone isolation. | Tech debt is a project-level concern, not a milestone concern. A debt item discovered in v2.0 might be fixed in v3.0 or v4.0. Isolating debt per-milestone breaks the continuous tracking: debt discovered in v2.0 would disappear from view when v2.0 is archived. The existing milestone isolation (STATE.md, ROADMAP.md) applies to *execution state*, not to cross-cutting concerns like debt. | DEBT.md lives at `.planning/DEBT.md` — the same level as PROJECT.md and TO-DOS.md. It is global to the project. Entries carry `source_phase` and `source_plan` to link back to their milestone of origin. |
| Destructive migration (delete old files) | "Clean up old structure by removing deprecated files" seems like good hygiene. | A migration tool that deletes files has no safe undo. The downside risk (data loss, broken project) is catastrophic and irreversible. Flyway and Liquibase never delete data in migrations — they add columns, create tables, move rows. Deletion is a separate, explicit, human-driven step. | Migration tool is additive only: creates missing files, adds missing config sections, moves files with a backup copy. The old file stays in place until the human explicitly deletes it after verifying the migration worked. |

---

## Feature Dependencies

```
[INTEGRATION-3 + INTEGRATION-4 bug fixes]
    └──prerequisite for──> [All v3.0 features]
         (milestone-scoped projects are broken without these fixes; debt logging from milestone-scoped
          executors would read/write wrong paths)

[DEBT.md hub (structured entry format)]
    └──required by──> [CLI debt-log command]
         (the file must exist and have a defined format before agents can write to it)
    └──required by──> [debt-list command]
         (list command reads and parses DEBT.md)
    └──required by──> [Executor/verifier auto-log wiring]
         (wiring calls debt-log, which writes to DEBT.md)
    └──required by──> [/gsd:fix-debt skill]
         (fix-debt reads DEBT.md to pick an entry to resolve)
    └──required by──> [Debt metrics in /gsd:progress]
         (progress command queries DEBT.md for counts)

[CLI debt-log command]
    └──required by──> [Executor/verifier auto-log wiring]
         (wiring calls this CLI command; wiring cannot exist without the command)
    └──required by──> [/gsd:fix-debt skill (status updates)]
         (fix-debt calls debt-log or debt-status to mark resolved)

[debt-list command]
    └──required by──> [/gsd:fix-debt skill (entry selection)]
         (fix-debt calls debt-list to find the next open entry to resolve)
    └──required by──> [Debt metrics in /gsd:progress]
         (progress command calls debt-list --format count)

[Executor/verifier auto-log wiring]
    └──requires──> [CLI debt-log command]
    └──requires──> [DEBT.md hub]
    └──enhances──> [/gsd:fix-debt skill]
         (fix-debt is most valuable when there's a backlog of real debt to resolve;
          auto-logging fills that backlog automatically)

[/gsd:fix-debt skill]
    └──requires──> [DEBT.md hub]
    └──requires──> [debt-list command]
    └──requires──> [CLI debt-log command] (for status updates)
    └──requires──> [Executor/verifier auto-log wiring] (to have meaningful debt to fix)
    └──independent of──> [Project migration tool]

[Project migration tool]
    └──independent of──> [DEBT.md hub, debt-log, fix-debt]
         (migration is a structural concern; debt system is a content/tracking concern)
    └──can create──> [DEBT.md hub] (as part of migration — add missing files)
    └──can fix──> [INTEGRATION-3/INTEGRATION-4 outcomes]
         (migration can rewrite config.json to add missing sections cleanly)

[Quality-level-gated debt logging]
    └──requires──> [CLI debt-log command]
    └──requires──> [Existing quality.level config (v1.x)]
         (already built — piggybacks on existing gating infrastructure)

[Debt linked to phase/plan provenance]
    └──requires──> [DEBT.md hub] (fields must be defined)
    └──requires──> [CLI debt-log command] (fields passed as args)
    └──enhances──> [/gsd:fix-debt skill] (makes root-cause analysis faster)
```

### Dependency Notes

- **Bug fixes are the root prerequisite.** INTEGRATION-3 and INTEGRATION-4 must be fixed before any other v3.0 feature is built. Milestone-scoped path resolution is broken without these fixes; debt logging from within a milestone-scoped executor would read and write from the wrong `.planning/` root.

- **DEBT.md format locks in before CLI.** The entry format (field names, status values, ID scheme) must be decided before the `debt-log` command is implemented. Changing the format after CLI is built requires schema migration.

- **debt-log before wiring.** The executor/verifier wiring just calls `debt-log` — it cannot be built until that command exists. The wiring itself is the lightest part of the feature; it's the command that has substance.

- **debt-list before fix-debt.** `/gsd:fix-debt` needs to query for open entries before it can pick one to fix. `debt-list` must be implemented and tested first.

- **Migration tool is fully independent.** It addresses structural concerns (`.planning/` folder layout, config.json completeness) that are orthogonal to the debt tracking features. Can be built in any order relative to DEBT.md features.

- **fix-debt is the highest complexity feature.** It is a new workflow that orchestrates: read → select → plan → execute → verify → status-update. It depends on every other feature in the debt system being stable first. Build it last.

---

## MVP Definition

### Launch With (v3.0 — This Milestone)

Minimum viable tech debt system — what's needed to get structured, persistent, queryable debt tracking into GSD.

- [ ] **INTEGRATION-3 + INTEGRATION-4 fixes** — prerequisite correctness; milestone-scoped projects must work before any debt logging from them is meaningful.

- [ ] **DEBT.md hub with defined entry format** — the file and format are the foundation. Without a stable schema, everything built on top must be rebuilt. Field set: id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan.

- [ ] **`gsd-tools.cjs debt-log` command** — agents call this to record debt atomically. Append-only, safe for concurrent callers, returns new entry ID. The write API for the debt system.

- [ ] **`gsd-tools.cjs debt-list` command** — query debt by status/type/severity. JSON output for agent consumption. The read API for the debt system.

- [ ] **`gsd-tools.cjs debt-status` command** — update a debt entry's status. Enables the resolved/deferred lifecycle transitions.

- [ ] **Executor/verifier auto-log wiring** — the point where debt tracking becomes automatic rather than manual. Quality Sentinel and verifier quality dimensions call `debt-log` when they find issues that can't be fixed in the current plan. Gated on quality level.

- [ ] **`/gsd:fix-debt` skill** — on-demand debt resolution workflow. Reads DEBT.md, selects an entry, runs a targeted executor subagent to fix it, verifier confirms, status updated to resolved.

- [ ] **Project migration tool** — `gsd-tools.cjs migrate [--dry-run] [--apply]`. Inspects `.planning/` against current spec, reports gaps, applies additive changes. Idempotent, never destructive.

### Add After Validation (v3.x)

Features to add once the debt system is in active use and generating real debt entries.

- [ ] **Debt metrics in `/gsd:progress`** — show open/resolved debt counts in progress output. Trigger: DEBT.md is accumulating real entries from auto-logging and the counts are meaningful enough to surface.

- [ ] **Debt pruning command (`debt-archive`)** — move resolved/deferred entries older than N days to `DEBT-ARCHIVE.md` to keep DEBT.md scannable. Trigger: DEBT.md grows past ~20 entries and readability degrades.

- [ ] **Planner integration: check DEBT.md before planning** — planner reads DEBT.md for open items related to the phase's components before writing tasks. Trigger: users report that planners re-introduce known debt that's already logged.

### Future Consideration (v3.x+)

Features that require more design work or ecosystem maturity.

- [ ] **Debt-to-PLAN.md conversion** — generate a full PLAN.md from a debt entry for when `/gsd:fix-debt` is overkill and a more formal phased fix is needed. Requires PLAN.md template system integration.

- [ ] **Debt age / SLA warnings** — flag debt entries that have been open longer than a configurable threshold (e.g., 30 days). Requires tracking `date_logged` meaningfully and a reporting mechanism. Trigger: teams want accountability for old debt.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| INTEGRATION-3 + INTEGRATION-4 fixes | HIGH — correctness prerequisite | LOW — known exact fix location | P1 |
| DEBT.md hub (entry format definition) | HIGH — foundation for all debt features | LOW — format design + file creation | P1 |
| `debt-log` CLI command | HIGH — write API; executors need this | LOW — append-only, ~80 LOC | P1 |
| `debt-list` CLI command | HIGH — read API; fix-debt + progress need this | LOW — filter/format, ~60 LOC | P1 |
| `debt-status` CLI command | MEDIUM — lifecycle management | LOW — single-field update, ~40 LOC | P1 |
| Executor/verifier auto-log wiring | HIGH — makes tracking automatic | MEDIUM — executor agent edits + quality gate integration | P1 |
| `/gsd:fix-debt` skill | HIGH — closes the detect→fix loop | HIGH — new workflow orchestration | P1 |
| Project migration tool | MEDIUM — eases onboarding for existing projects | MEDIUM — inspection logic + additive apply | P1 |
| Debt metrics in `/gsd:progress` | LOW-MEDIUM — visibility improvement | LOW — one `debt-list` call in progress render | P2 |
| Debt-linked provenance (source_phase/source_plan) | MEDIUM — accelerates root-cause in fix-debt | LOW — fields in debt-log args, no new command | P1 (include in debt-log design) |
| Quality-level-gated logging | MEDIUM — prevents fast-mode overhead | LOW — one `if quality.level !== 'fast'` gate | P1 (include in wiring) |

**Priority key:**
- P1: Must have for v3.0 to deliver its stated goal (structured debt tracking + migration tool)
- P2: Should have, meaningfully improves UX; add when P1 is stable
- P3: Nice to have, future consideration

---

## Reference System Analysis

How existing tech debt systems and migration tools handle the same problems — patterns GSD should follow:

| Feature | Tech Debt Master (tdm) | Technical Debt Register (Scrum.org pattern) | Flyway / Liquibase (migration tools) | GSD v3.0 Approach |
|---------|------------------------|---------------------------------------------|--------------------------------------|-------------------|
| Entry structure | AI-generated, file-level severity + context | 10 fields: description, reason, impact, location, priority, owner, date, effort, plan, status | Migration scripts versioned with checksum | DEBT.md with 10 structured fields; markdown table or frontmatter; ID scheme TD-NNN |
| Discovery | Continuous scanning + LLM analysis | Manual entry by team members | N/A (database schema-driven) | Auto-logging by Quality Sentinel + verifier; manual via `debt-log` for agents |
| Status tracking | Interactive CLI triage | Open / In Progress / Resolved | Applied / Pending / Failed | open / in-progress / resolved / deferred |
| Fix workflow | Expose via MCP server for coding agent consumption | Manual fix + mark resolved | Forward-fix new migration (never rollback in prod) | `/gsd:fix-debt` skill: read entry → plan → execute → verify → mark resolved |
| Prioritization | Business impact + remediation effort | Component proximity to upcoming work | Migration order by version number | `debt-list --severity critical` — filter, don't auto-score |
| Idempotency | N/A | N/A | Checksum table prevents re-application | Migration tool: check what already exists, skip if present, never overwrite |
| Dry run | N/A | N/A | `--dry-run` flag standard | `migrate --dry-run` shows diff report before `--apply` |

**Key lessons:**

1. **Ten-field entry structure is industry consensus.** The otherCode.io Technical Debt Records format, the CMU SEI documentation pattern, and Scrum.org's register template all converge on the same ~10 fields. GSD should use this established set rather than inventing a novel schema. (Sources: otherCode.io article, Scrum.org blog — HIGH confidence)

2. **Status = open/in-progress/resolved/deferred.** These four states cover the full lifecycle. "Deferred" (explicit postponement) is important — it distinguishes "we know about this and chose not to fix it now" from "open, nobody's looked at it yet." Without deferred, items languish in open state indefinitely. (Sources: multiple tech debt register templates — HIGH confidence)

3. **Forward-fix, never rollback.** Flyway and Liquibase's core principle for production migrations: if a migration has a problem, create a new migration that fixes it — never reverse-apply the old one. GSD's migration tool should follow this: if a project has an odd existing structure, add what's needed without touching what exists. (Sources: Flyway docs, Liquibase docs — MEDIUM confidence via WebSearch)

4. **Debug2Fix subagent pattern for fix workflows.** The arxiv.org Debug2Fix paper (Feb 2025) establishes that a dedicated debugging subagent — focused solely on inspecting runtime state, not implementing fixes — improves fix quality by >20% vs. static analysis alone. `/gsd:fix-debt` should use this pattern: a diagnostic subagent first, then an implementation subagent. (Source: arxiv.org/html/2602.18571 — MEDIUM confidence, peer-reviewed research)

5. **Append-only writes for concurrent safety.** The `debt-log` command can be called from parallel plan subagents. Append-only file writes are safe without locks — each write adds a new entry with a new ID, never modifying existing entries. Only `debt-status` modifies existing entries, and it should use the existing `atomicWrite()` pattern (temp file + rename). (Pattern established in v2.0 lock-free dashboard design — HIGH confidence)

---

## Sources

- [otherCode.io — Technical Debt Records: 10 fields, status lifecycle, format options](https://othercode.io/blog/technical-debt-records) — HIGH confidence (direct fetch, primary source for entry schema)
- [Scrum.org — Using a Technical Debt Register in Scrum](https://www.scrum.org/resources/blog/using-technical-debt-register-scrum) — HIGH confidence (official Scrum framework guidance, status field values)
- [markheath.net — How Should You Track Technical Debt?](https://markheath.net/post/technical-debt-register) — MEDIUM confidence (practitioner article; categories and field set corroborate otherCode.io)
- [Debug2Fix: Supercharging Coding Agents with Interactive Debugging Capabilities](https://arxiv.org/html/2602.18571) — MEDIUM confidence (peer-reviewed arxiv paper, Feb 2025; subagent pattern + >20% improvement on Java benchmarks)
- [ChatPRD — How to Systematically Reduce Technical Debt Using AI Agents](https://www.chatprd.ai/how-i-ai/workflows/how-to-systematically-reduce-technical-debt-using-ai-agents) — MEDIUM confidence (practitioner workflow; 5-phase identify→analyze→task→assign→review pattern)
- [Technical Debt Master (N+1 Blog) — AI-Powered Code Analysis with Local LLMs](https://nikiforovall.blog/ai/2025/08/09/tech-debt-master.html) — MEDIUM confidence (comparable tool; 3-phase discover→triage→resolve pattern via MCP)
- [Flyway — Migration Command Dry Runs](https://documentation.red-gate.com/fd/migration-command-dry-runs-275218517.html) — MEDIUM confidence (authoritative migration tool docs; dry-run pattern)
- [Nick Janetakis — CLI Tools That Support Previews, Dry Runs or Non-Destructive Actions](https://nickjanetakis.com/blog/cli-tools-that-support-previews-dry-runs-or-non-destructive-actions) — MEDIUM confidence (CLI UX best practices for migration-style tools)
- [CMU SEI — Experiences Documenting and Remediating Enterprise Technical Debt](https://www.sei.cmu.edu/blog/experiences-documenting-and-remediating-enterprise-technical-debt/) — MEDIUM confidence (academic/enterprise practitioner experience)
- Internal: `.planning/PROJECT.md` v3.0 target features — HIGH confidence (direct read, canonical requirements)
- Internal: `.planning/TO-DOS.md` INTEGRATION-3/INTEGRATION-4 — HIGH confidence (direct read, exact file/line locations)
- Internal: `get-shit-done/bin/gsd-tools.cjs` command list — HIGH confidence (direct read, existing command surface for extension)
- Internal: `get-shit-done/workflows/execute-phase.md` — HIGH confidence (direct read, executor agent context for wiring design)
- Internal: `.planning/research/FEATURES.md` (v2.0) — HIGH confidence (direct read, baseline for what already exists)

---

*Feature research for: GSD v3.0 Tech Debt System — structured debt tracking, CLI debt commands, executor/verifier wiring, fix-debt skill, project migration tool*
*Researched: 2026-02-25*
