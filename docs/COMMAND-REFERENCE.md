# GSD Command Reference

> Auto-discovery note: this file documents all known commands as of 2026-04-05.
> Run `node get-shit-done/bin/gsd-tools.cjs list-commands` for a live summary.

## Table of Contents

1. [Slash Commands — /gsd: Namespace](#1-slash-commands--gsd-namespace)
2. [Slash Commands — Project-Level](#2-slash-commands--project-level)
3. [Slash Commands — Global (non-gsd/)](#3-slash-commands--global-non-gsd)
4. [Slash Command Subgroups](#4-slash-command-subgroups)
5. [CLI Tool — gsd-tools.cjs](#5-cli-tool--gsd-toolscjs)
6. [Quick Reference Table](#6-quick-reference-table)

---

## 1. Slash Commands — /gsd: Namespace

These commands live in `~/.claude/commands/gsd/` and are invoked as `/gsd:<name>`.

### Project Initialization

**`/gsd:new-project`**
Initialize a new project through the unified flow (questioning → research → requirements → roadmap).

- Arguments: none
- Creates: `.planning/PROJECT.md`, `config.json`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`
- Example: `/gsd:new-project`

**`/gsd:map-codebase`**
Map an existing codebase for brownfield projects before starting GSD.

- Arguments: none
- Creates: `.planning/codebase/` with 7 focused documents (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS)
- Example: `/gsd:map-codebase`

---

### Phase Planning

**`/gsd:discuss-phase <number>`**
Help articulate your vision for a phase before planning begins.

- Arguments: `<number>` — phase number (required)
- Creates: `CONTEXT.md` with your vision, essentials, and boundaries
- Example: `/gsd:discuss-phase 2`

**`/gsd:research-phase <number>`**
Comprehensive ecosystem research for niche or complex domains.

- Arguments: `<number>` — phase number (required)
- Creates: `RESEARCH.md` with expert-level ecosystem knowledge
- Example: `/gsd:research-phase 3`

**`/gsd:list-phase-assumptions <number>`**
Preview Claude's intended approach for a phase before planning starts.

- Arguments: `<number>` — phase number (required)
- Output: conversational only, no files created
- Example: `/gsd:list-phase-assumptions 3`

**`/gsd:plan-phase <number>`**
Create a detailed execution plan for a specific phase.

- Arguments: `<number>` — phase number (required); `--prd path/to/requirements.md` — skip discuss-phase using an existing PRD
- Creates: `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- Example: `/gsd:plan-phase 1`

---

### Execution

**`/gsd:execute-phase <phase-number>`**
Execute all plans in a phase, grouped by wave.

- Arguments: `<phase-number>` — phase number (required)
- Plans within each wave run in parallel; verifies phase goal after completion
- Example: `/gsd:execute-phase 5`

---

### Quick Mode

**`/gsd:quick`**
Execute small ad-hoc tasks with GSD guarantees but skip optional agents.

- Arguments: none (interactive prompt for task description)
- Creates: `.planning/quick/NNN-slug/PLAN.md`, `.planning/quick/NNN-slug/SUMMARY.md`
- Example: `/gsd:quick`

---

### Roadmap Management

**`/gsd:add-phase <description>`**
Add a new phase to the end of the current milestone roadmap.

- Arguments: `<description>` — phase description (required)
- Example: `/gsd:add-phase "Add admin dashboard"`

**`/gsd:insert-phase <after> <description>`**
Insert urgent work as a decimal phase between two existing phases.

- Arguments: `<after>` — phase number to insert after; `<description>` — new phase description
- Creates: decimal phase (e.g., 7.1 between 7 and 8)
- Example: `/gsd:insert-phase 7 "Fix critical auth bug"`

**`/gsd:remove-phase <number>`**
Remove a future phase and renumber all subsequent phases.

- Arguments: `<number>` — phase number (must be unstarted)
- Example: `/gsd:remove-phase 17`

---

### Milestone Management

**`/gsd:new-milestone <name>`**
Start a new milestone through the unified flow (mirrors `/gsd:new-project` for brownfield projects).

- Arguments: `<name>` — milestone name or version
- Example: `/gsd:new-milestone "v2.0 Features"`

**`/gsd:complete-milestone <version>`**
Archive a completed milestone, create git tag, prepare workspace for next version.

- Arguments: `<version>` — version string (e.g., `1.0.0`)
- Example: `/gsd:complete-milestone 1.0.0`

**`/gsd:audit-milestone [version]`**
Audit milestone completion against original requirements and intent.

- Arguments: `[version]` — optional version (defaults to current)
- Creates: `MILESTONE-AUDIT.md` with gaps and tech debt
- Example: `/gsd:audit-milestone`

**`/gsd:plan-milestone-gaps`**
Create phases to close gaps identified by the milestone audit.

- Arguments: none (reads from `MILESTONE-AUDIT.md`)
- Adds gap-closure phases to `ROADMAP.md`
- Example: `/gsd:plan-milestone-gaps`

**`/gsd:multi-milestone`**
Batch-plan multiple milestones in sequence.

- Arguments: interactive prompt for milestone sequence
- Example: `/gsd:multi-milestone`

---

### Progress and Session Management

**`/gsd:progress`**
Check project status and intelligently route to the next action.

- Arguments: none
- Shows visual progress bar, recent work summary, next steps
- Example: `/gsd:progress`

**`/gsd:resume-work`**
Resume work from the previous session with full context restoration.

- Arguments: none
- Reads `STATE.md` and shows current position and recent progress
- Example: `/gsd:resume-work`

**`/gsd:pause-work`**
Create a context handoff when pausing work mid-phase.

- Arguments: none
- Creates `.continue-here` file, updates `STATE.md` session continuity section
- Example: `/gsd:pause-work`

---

### Debugging

**`/gsd:debug [issue description]`**
Systematic debugging with persistent state across context resets.

- Arguments: `[issue description]` — optional; omit to resume active session
- Creates: `.planning/debug/[slug].md`; survives `/clear`
- Example: `/gsd:debug "login button doesn't work"`
- Example (resume): `/gsd:debug`

---

### Todo Management

**`/gsd:add-todo [description]`**
Capture an idea or task as a todo from the current conversation.

- Arguments: `[description]` — optional; infers from conversation if omitted
- Creates: structured todo file in `.planning/todos/pending/`
- Example: `/gsd:add-todo`
- Example: `/gsd:add-todo Add auth token refresh`

**`/gsd:check-todos [area]`**
List pending todos and select one to work on.

- Arguments: `[area]` — optional filter by area name
- Example: `/gsd:check-todos`
- Example: `/gsd:check-todos api`

---

### User Acceptance Testing

**`/gsd:verify-work [phase]`**
Validate built features through conversational UAT.

- Arguments: `[phase]` — phase number (optional)
- Extracts testable deliverables from `SUMMARY.md` files; presents tests one at a time
- Example: `/gsd:verify-work 3`

**`/gsd:validate-phase <number>`**
Validate the structure and completeness of a phase's planning artifacts.

- Arguments: `<number>` — phase number (required)
- Example: `/gsd:validate-phase 4`

---

### Tech Debt Management

**`/gsd:fix-debt`**
Work on tech debt entries tracked in `.planning/DEBT.md`.

- Arguments: none (interactive selection)
- Example: `/gsd:fix-debt`

---

### Learning and Observation

**`/gsd:brainstorm <topic>`**
Run a 3-stage mechanical brainstorming session (Seed → Expand → Converge).

- Arguments: `<topic> [--wild] [--from-corrections] [--from-debt] [--for-milestone]`
- `--wild` — unconstrained ideation mode
- `--from-corrections` — seed from logged agent corrections
- `--from-debt` — seed from tech debt entries
- `--for-milestone` — focus output on milestone planning
- Example: `/gsd:brainstorm "new dashboard features" --wild`

**`/gsd:digest`**
Generate a learning digest from recent session history.

- Arguments: none
- Example: `/gsd:digest`

**`/gsd:teach-phase <number>`**
Orchestrate a teaching session for a roadmap phase (for projects where the user writes all code manually).

- Arguments: `<number>` — phase number (required)
- Replaces discuss/plan/execute for manual-coding workflows
- Example: `/gsd:teach-phase 3`

---

### Configuration

**`/gsd:settings`**
Configure workflow toggles and model profile interactively.

- Arguments: none
- Toggles researcher, plan checker, verifier agents; selects model profile
- Updates `.planning/config.json`
- Example: `/gsd:settings`

**`/gsd:set-profile <profile>`**
Quick-switch model profile for all GSD agents.

- Arguments: `<profile>` — one of `quality`, `balanced`, `budget`
  - `quality` — Opus everywhere except verification
  - `balanced` — Opus for planning, Sonnet for execution (default)
  - `budget` — Sonnet for writing, Haiku for research/verification
- Example: `/gsd:set-profile budget`

**`/gsd:set-quality <level>`**
Set quality enforcement level.

- Arguments: `<level>` — one of `fast`, `standard`, `strict`; `[--global]` — set as default for new projects
  - `fast` — skip all quality gates
  - `standard` — run quality gates, warn on issues
  - `strict` — run quality gates, block on issues
- Example: `/gsd:set-quality strict`
- Example: `/gsd:set-quality --global standard`

---

### Utility Commands

**`/gsd:help`**
Show the full GSD command reference.

- Arguments: none
- Example: `/gsd:help`

**`/gsd:update`**
Update GSD to the latest version with changelog preview.

- Arguments: none
- Shows installed vs latest version, changelog, highlights breaking changes
- Example: `/gsd:update`

**`/gsd:health`**
Check GSD installation health and configuration.

- Arguments: none
- Example: `/gsd:health`

**`/gsd:cleanup`**
Clean stale planning artifacts and optionally archive old phase directories.

- Arguments: none
- Example: `/gsd:cleanup`

**`/gsd:reapply-patches`**
Reapply local patches after a GSD update.

- Arguments: none
- Example: `/gsd:reapply-patches`

**`/gsd:add-tests`**
Add tests for existing code that lacks coverage.

- Arguments: none
- Example: `/gsd:add-tests`

**`/gsd:join-discord`**
Join the GSD Discord community.

- Arguments: none
- Example: `/gsd:join-discord`

---

## 2. Slash Commands — Project-Level

These commands live in `.claude/commands/` within the project and override or supplement global commands.

**`/teach-phase <number>`** (project override of `/gsd:teach-phase`)
Project-specific teach-phase command. Accepts or overrides the global teach-phase workflow.

- File: `.claude/commands/teach-phase.md`
- Same arguments as `/gsd:teach-phase`

**`/refine-skill [skill-name]`**
Accept or dismiss a pending skill suggestion from skill-creator.

- File: `.claude/commands/refine-skill.md`
- Arguments:
  - `[skill-name]` — target skill name (optional)
  - `--id <suggestionId>` — target a specific suggestion by ID
  - `revert <suggestionId>` — revert a previously applied suggestion
- Example: `/refine-skill code-review --id sug-001`
- Example: `/refine-skill revert sug-001`

---

## 3. Slash Commands — Global (non-gsd/)

These commands live in `~/.claude/commands/` at the top level and are available in all projects.

**`/add-to-todos [description]`**
Quick-capture shorthand for adding todos — writes to `.planning/todos/pending/` (GSD-compatible).

- Arguments: `[description]` — optional; infers from conversation if omitted
- Example: `/add-to-todos`
- Example: `/add-to-todos Fix modal z-index`

**`/check-todos`**
List outstanding todos from `.planning/todos/pending/` and select one to work on.

- Arguments: none
- Example: `/check-todos`

**`/debug [issue]`**
Global debug command (standalone, not GSD-specific).

- Arguments: `[issue]` — optional description
- Example: `/debug "API request returns 403"`

**`/whats-next`**
Show what to work on next based on current project state.

- Arguments: none
- Example: `/whats-next`

**`/context-handoff`**
Create a context handoff document for pausing work.

- Arguments: none

**`/decision-framework [topic]`**
Apply a structured decision framework to a problem.

- Arguments: `[topic]` — optional

**`/code-review`**
Run a structured code review on recent changes.

- Arguments: none

**`/api-design`**
Design or review an API surface.

- Arguments: none

**`/beautiful-commits`**
Format and write beautiful, informative git commit messages.

- Arguments: none

**`/env-setup`**
Set up development environment configuration.

- Arguments: none

**`/file-operation-patterns`**
Reference guide for safe file operation patterns.

- Arguments: none

**`/test-generator`**
Generate tests for a given module or function.

- Arguments: none

**`/typescript-patterns`**
Reference guide for TypeScript patterns used in this codebase.

- Arguments: none

---

## 4. Slash Command Subgroups

### /consider: — Mental Models

Invoke structured mental model frameworks for decision-making.

Usage: `/consider:<subcommand> [topic]`

| Subcommand | Mental Model |
|---|---|
| `/consider:first-principles` | Break problem down to fundamental truths |
| `/consider:10-10-10` | How will this decision feel in 10 mins, 10 months, 10 years? |
| `/consider:swot` | Strengths, Weaknesses, Opportunities, Threats analysis |
| `/consider:one-thing` | What is the single most important thing here? |
| `/consider:occams-razor` | Simplest explanation is most likely correct |
| `/consider:5-whys` | Drill down to root cause via 5 iterative "why?" questions |
| `/consider:second-order` | Map second-order consequences of the decision |
| `/consider:eisenhower-matrix` | Urgent/important prioritization matrix |
| `/consider:opportunity-cost` | What are you giving up by choosing this? |
| `/consider:via-negativa` | Improve by subtraction — what should you remove? |
| `/consider:inversion` | Approach goal by avoiding the opposite |
| `/consider:pareto` | Which 20% of effort produces 80% of result? |

### /research: — Research Modes

Invoke focused research agents for a topic.

Usage: `/research:<subcommand> [topic]`

| Subcommand | Research Mode |
|---|---|
| `/research:deep-dive` | Deep comprehensive research on a topic |
| `/research:landscape` | Survey the current ecosystem and players |
| `/research:history` | Historical context and evolution |
| `/research:competitive` | Competitive analysis of approaches or products |
| `/research:options` | Enumerate and evaluate options |
| `/research:technical` | Technical deep-dive with implementation details |
| `/research:feasibility` | Assess technical and practical feasibility |
| `/research:open-source` | Survey open-source tools and libraries |

---

## 5. CLI Tool — gsd-tools.cjs

The underlying CLI engine used by GSD slash commands and CI scripts.

```bash
node get-shit-done/bin/gsd-tools.cjs <command> [args]
```

Global flags:
- `--cwd <path>` or `--cwd=<path>` — override working directory
- `--milestone <version>` or `--milestone=<version>` — target a specific milestone scope
- `--raw` — output raw values without formatting

---

### Atomic Commands

| Command | Description |
|---|---|
| `state load` | Load project config and state |
| `state json` | Output STATE.md frontmatter as JSON |
| `state update <field> <value>` | Update a single STATE.md field |
| `state get [section]` | Get STATE.md content or a named section |
| `state patch --field val ...` | Batch-update multiple STATE.md fields |
| `resolve-model <agent-type>` | Get the configured model for an agent type based on profile |
| `find-phase <phase>` | Find phase directory by number |
| `commit <message> [--files f1 f2]` | Commit planning docs |
| `verify-summary <path>` | Verify a SUMMARY.md file structure |
| `generate-slug <text>` | Convert text to a URL-safe slug |
| `current-timestamp [format]` | Get timestamp — `full`, `date`, or `filename` |
| `list-todos [area]` | Count and enumerate pending todos |
| `verify-path-exists <path>` | Check file or directory existence |
| `config-ensure-section` | Initialize `.planning/config.json` |
| `history-digest` | Aggregate all SUMMARY.md data |
| `summary-extract <path> [--fields]` | Extract structured data from SUMMARY.md |
| `state-snapshot` | Structured parse of STATE.md |
| `phase-plan-index <phase>` | Index plans with waves and status |
| `websearch <query>` | Search web via Brave API; `[--limit N] [--freshness day\|week\|month]` |

---

### Phase Operations

| Command | Description |
|---|---|
| `phase next-decimal <phase>` | Calculate the next decimal phase number |
| `phase add <description>` | Append a new phase to the roadmap and create its directory |
| `phase insert <after> <description>` | Insert a decimal phase after an existing phase |
| `phase remove <phase> [--force]` | Remove a phase and renumber all subsequent phases |
| `phase complete <phase>` | Mark a phase done, update state and roadmap |

---

### Roadmap Operations

| Command | Description |
|---|---|
| `roadmap get-phase <phase>` | Extract a phase section from ROADMAP.md |
| `roadmap analyze` | Full roadmap parse with disk status |
| `roadmap update-plan-progress <N>` | Update progress table row from disk (PLAN vs SUMMARY counts) |

---

### Requirements Operations

| Command | Description |
|---|---|
| `requirements mark-complete <ids>` | Mark requirement IDs as complete in REQUIREMENTS.md (accepts: `REQ-01,REQ-02` or `REQ-01 REQ-02` or `[REQ-01, REQ-02]`) |

---

### Debt Operations

| Command | Description |
|---|---|
| `debt log` | Append a new tech debt entry to `.planning/DEBT.md` |
| `debt list` | List debt entries; `[--status open\|in-progress\|resolved\|deferred]` `[--severity critical\|high\|medium\|low]` `[--type code\|test\|docs\|config\|arch]` |
| `debt resolve` | Transition a debt entry's status; `--id <TD-NNN> --status <status>` |
| `debt impact` | List debt entries ranked by correction count with link_confidence |

`debt log` flags: `--type <code|test|docs|config|arch>`, `--severity <critical|high|medium|low>`, `--component <name>`, `--description <text>`, `--logged-by <name>`, `--source-phase <phase>`, `--source-plan <plan>`

---

### Migration

| Command | Description |
|---|---|
| `migrate --dry-run [--version <v>]` | Preview legacy→milestone-scoped layout conversion |
| `migrate --apply [--version <v>]` | Convert legacy layout to milestone-scoped layout |
| `migrate --cleanup [--dry-run]` | Remove stale flat-pattern duplicates |

---

### Milestone Operations

| Command | Description |
|---|---|
| `milestone complete <version>` | Archive milestone and create MILESTONES.md entry |

`milestone complete` flags: `--name <name>`, `--archive-phases` (moves phase dirs to `milestones/vX.Y-phases/`)

---

### Plan Index

| Command | Description |
|---|---|
| `plan-index --rebuild` | Rebuild `.planning/plan-index.json` from all milestone PLAN.md files |

---

### Validation

| Command | Description |
|---|---|
| `validate consistency` | Check phase numbering and disk/roadmap synchronization |
| `validate health [--repair]` | Check `.planning/` integrity; `--repair` auto-fixes issues |

---

### Progress

| Command | Description |
|---|---|
| `progress [json\|table\|bar]` | Render project progress in various formats |

---

### Todos

| Command | Description |
|---|---|
| `todo complete <filename>` | Move a todo from pending/ to completed/ |

---

### Scaffolding

| Command | Description |
|---|---|
| `scaffold context --phase <N>` | Create a CONTEXT.md template for a phase |
| `scaffold uat --phase <N>` | Create a UAT.md template for a phase |
| `scaffold verification --phase <N>` | Create a VERIFICATION.md template for a phase |
| `scaffold phase-dir --phase <N> --name <name>` | Create a phase directory |

---

### Frontmatter CRUD

| Command | Description |
|---|---|
| `frontmatter get <file> [--field k]` | Extract frontmatter as JSON |
| `frontmatter set <file> --field k --value jsonVal` | Update a single frontmatter field |
| `frontmatter merge <file> --data '{json}'` | Merge JSON object into frontmatter |
| `frontmatter validate <file> --schema plan\|summary\|verification` | Validate required frontmatter fields |

---

### Verification Suite

| Command | Description |
|---|---|
| `verify plan-structure <file>` | Check PLAN.md structure and tasks |
| `verify phase-completeness <phase>` | Check all plans in a phase have summaries |
| `verify references <file>` | Check @-refs and paths resolve |
| `verify commits <h1> [h2] ...` | Batch verify commit hashes |
| `verify artifacts <plan-file>` | Check `must_haves.artifacts` entries |
| `verify key-links <plan-file>` | Check `must_haves.key_links` entries |

---

### Template Fill

| Command | Description |
|---|---|
| `template fill summary --phase N [--plan M] [--name "..."] [--fields '{json}']` | Create a pre-filled SUMMARY.md |
| `template fill plan --phase N [--plan M] [--type execute\|tdd] [--wave N] [--fields '{json}']` | Create a pre-filled PLAN.md |
| `template fill verification --phase N [--fields '{json}']` | Create a pre-filled VERIFICATION.md |

---

### State Progression

| Command | Description |
|---|---|
| `state advance-plan` | Increment the plan counter in STATE.md |
| `state record-metric --phase N --plan M --duration Xmin [--tasks N] [--files N]` | Record execution metrics |
| `state benchmark-plan --phase N --plan M --type <phase_type> --quality-level <level> [--duration Xmin] [--milestone <version>] [--test-count N]` | Write benchmark entry to phase-benchmarks.jsonl |
| `state update-progress` | Recalculate and update the progress bar |
| `state add-decision --summary "..." [--phase N] [--rationale "..."] [--summary-file path] [--rationale-file path]` | Add a decision to STATE.md |
| `state add-blocker --text "..." [--text-file path]` | Add a blocker to STATE.md |
| `state resolve-blocker --text "..."` | Remove a blocker from STATE.md |
| `state record-session --stopped-at "..." [--resume-file path]` | Update session continuity section |

---

### Compound Commands (init)

Bootstrap full context for workflow slash commands. Used internally by slash command implementations.

| Command | Description |
|---|---|
| `init execute-phase <phase>` | All context needed for execute-phase workflow |
| `init plan-phase <phase>` | All context needed for plan-phase workflow |
| `init new-project` | All context needed for new-project workflow |
| `init new-milestone` | All context needed for new-milestone workflow |
| `init quick <description>` | All context needed for quick workflow |
| `init resume` | All context needed for resume-project workflow |
| `init verify-work <phase>` | All context needed for verify-work workflow |
| `init phase-op <phase>` | Generic phase operation context |
| `init todos [area]` | All context needed for todo workflows |
| `init milestone-op` | All context needed for milestone operations |
| `init map-codebase` | All context needed for map-codebase workflow |
| `init progress` | All context needed for progress workflow |

---

### Command Discovery

| Command | Description |
|---|---|
| `list-commands` | Print a structured summary of all slash commands and CLI groups |
| `list-commands --json` | Output as JSON with `slash_commands`, `subgroups`, `cli_groups` arrays |
| `list-commands --count` | Print total count of slash commands, subgroup commands, and CLI groups |

---

## 6. Quick Reference Table

| Command | Type | Purpose | Key Args |
|---|---|---|---|
| `/gsd:new-project` | slash | Initialize new project | none |
| `/gsd:map-codebase` | slash | Map existing codebase | none |
| `/gsd:discuss-phase` | slash | Discuss phase vision | `<number>` |
| `/gsd:research-phase` | slash | Research phase domain | `<number>` |
| `/gsd:list-phase-assumptions` | slash | Preview Claude's planned approach | `<number>` |
| `/gsd:plan-phase` | slash | Create execution plan | `<number> [--prd path]` |
| `/gsd:execute-phase` | slash | Execute all plans in phase | `<phase-number>` |
| `/gsd:quick` | slash | Run small ad-hoc task | none |
| `/gsd:add-phase` | slash | Add phase to roadmap | `<description>` |
| `/gsd:insert-phase` | slash | Insert decimal phase | `<after> <description>` |
| `/gsd:remove-phase` | slash | Remove and renumber phase | `<number>` |
| `/gsd:new-milestone` | slash | Start new milestone | `<name>` |
| `/gsd:complete-milestone` | slash | Archive completed milestone | `<version>` |
| `/gsd:audit-milestone` | slash | Audit milestone completion | `[version]` |
| `/gsd:plan-milestone-gaps` | slash | Create phases for audit gaps | none |
| `/gsd:multi-milestone` | slash | Batch-plan multiple milestones | none |
| `/gsd:progress` | slash | Check project status | none |
| `/gsd:resume-work` | slash | Resume from previous session | none |
| `/gsd:pause-work` | slash | Pause and create handoff | none |
| `/gsd:debug` | slash | Systematic debugging | `[issue description]` |
| `/gsd:add-todo` | slash | Capture idea as todo | `[description]` |
| `/gsd:check-todos` | slash | Review and work on todos | `[area]` |
| `/gsd:verify-work` | slash | UAT validation for phase | `[phase]` |
| `/gsd:validate-phase` | slash | Validate phase structure | `<number>` |
| `/gsd:fix-debt` | slash | Work on tech debt entries | none |
| `/gsd:brainstorm` | slash | 3-stage brainstorming session | `<topic> [--wild] [--from-corrections] [--from-debt] [--for-milestone]` |
| `/gsd:digest` | slash | Generate learning digest | none |
| `/gsd:teach-phase` | slash | Teach phase pattern interactively | `<number>` |
| `/gsd:settings` | slash | Configure workflow toggles | none |
| `/gsd:set-profile` | slash | Quick-switch model profile | `<quality\|balanced\|budget>` |
| `/gsd:set-quality` | slash | Set quality enforcement level | `<fast\|standard\|strict> [--global]` |
| `/gsd:help` | slash | Show command reference | none |
| `/gsd:update` | slash | Update GSD to latest version | none |
| `/gsd:health` | slash | Check GSD installation health | none |
| `/gsd:cleanup` | slash | Clean stale planning artifacts | none |
| `/gsd:reapply-patches` | slash | Reapply patches after update | none |
| `/gsd:add-tests` | slash | Add tests for existing code | none |
| `/gsd:join-discord` | slash | Join GSD Discord community | none |
| `/refine-skill` | project | Accept or dismiss skill suggestion | `[skill-name] [--id id] [revert id]` |
| `/teach-phase` | project | Project-level teach-phase override | `<number>` |
| `/add-to-todos` | global | Quick-capture todo | `[description]` |
| `/check-todos` | global | List and work on todos | none |
| `/consider:<subcommand>` | subgroup | Apply mental model framework | `[topic]` — 12 subcommands |
| `/research:<subcommand>` | subgroup | Run focused research | `[topic]` — 8 subcommands |
| `state` | CLI | Load, read, update STATE.md | `load\|json\|update\|get\|patch\|...` |
| `phase` | CLI | Phase lifecycle operations | `next-decimal\|add\|insert\|remove\|complete` |
| `roadmap` | CLI | Roadmap parsing and updates | `get-phase\|analyze\|update-plan-progress` |
| `requirements` | CLI | Mark requirements complete | `mark-complete <ids>` |
| `debt` | CLI | Tech debt tracking | `log\|list\|resolve\|impact` |
| `migrate` | CLI | Convert legacy layout | `--dry-run\|--apply\|--cleanup` |
| `milestone` | CLI | Milestone lifecycle | `complete <version>` |
| `plan-index` | CLI | Rebuild plan index | `--rebuild` |
| `validate` | CLI | Check consistency and health | `consistency\|health [--repair]` |
| `progress` | CLI | Render progress bar | `[json\|table\|bar]` |
| `todo` | CLI | Complete todo items | `complete <filename>` |
| `scaffold` | CLI | Create planning templates | `context\|uat\|verification\|phase-dir` |
| `frontmatter` | CLI | CRUD for file frontmatter | `get\|set\|merge\|validate` |
| `verify` | CLI | Verify plans, summaries, refs | `plan-structure\|phase-completeness\|references\|commits\|artifacts\|key-links` |
| `template` | CLI | Fill planning templates | `fill summary\|plan\|verification` |
| `init` | CLI | Bootstrap workflow context | `execute-phase\|plan-phase\|new-project\|...` |
| `list-commands` | CLI | Show command listing | `[--json] [--count]` |
