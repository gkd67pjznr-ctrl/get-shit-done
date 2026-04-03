# FORK-GUIDE.md — GSD Enhanced Fork

## 1. Overview

This is a forked version of GSD (Get Shit Done) that adds quality enforcement, concurrent milestone workspaces, structured tech debt tracking, an adaptive learning layer (skills, agents, hooks, correction capture, preference tracking, skill refinement), a device-wide project dashboard, and deterministic quality gate enforcement via hooks. It is designed for solo developers using Claude Code who want stronger guarantees about code quality and an AI assistant that improves over time by learning from its mistakes.

All additions are additive and config-gated — the default quality level (`fast`) produces zero behavioral change from upstream GSD.

---

## 2. Installation

**Step 1: Clone this repo**

```bash
git clone https://github.com/gkd67pjznr-ctrl/get-shit-done.git gsdup
cd gsdup
```

**Step 2: Deploy to your global Claude Code install**

See [DEPLOY.md](DEPLOY.md) for the 3-step process. In short:

```bash
npm install -g .
node scripts/build-hooks.js
get-shit-done-cc --claude --global
```

This installs the fork's files to `~/.claude/get-shit-done/`, replacing your current GSD install (vanilla or previous version of this fork). Skills and hooks are installed to `~/.claude/` as part of this process.

**Step 3: Verify**

In Claude Code, run:

```
/gsd:help
```

You should see all standard GSD commands listed. If you also see `/gsd:set-quality` and `/gsd:fix-debt` in the output, the fork-specific commands are installed correctly.

**Note:** This replaces your vanilla GSD install at the global level. Your `.planning/` directories in individual projects are unaffected — they continue working as before.

---

## 3. What Changed from Vanilla GSD

All changes are additive. Existing projects with no `quality` key in `config.json` default to `fast` mode, which is identical to vanilla GSD behavior.

**v2.0 Concurrent Milestones (2026-02-25):** Milestone-scoped layout, `--milestone` flag across all commands, `gsd-tools milestone manifest-check`.

**v5.0 Device-Wide Dashboard (2026-03-09):** `dashboard/` UI (components, CSS, terminal modal), project registry, aggregation server (`dashboard.cjs`, `server.cjs`), tmux monitoring, embedded terminals, pattern system.

**v1.0 MVP (2026-02-24):** Quality levels (fast/standard/strict), Quality Sentinel gates in executor/verifier/planner.

**v1.1 Quality UX (2026-02-24):** `/gsd:set-quality`, user-facing quality configuration.

**v3.0 Tech Debt System (2026-02-26):** `debt.cjs`, `migrate.cjs`, `/gsd:fix-debt`, `gsd-tools debt log/list/resolve`.

**v3.1 Legacy Strip & README (2026-03-05):** Cleanup pass, README overhaul.

**v4.0 Adaptive Learning Integration (2026-03-09):** Skills system (`.claude/skills/` — 17 skills), hooks system (`.claude/hooks/` — 12 hook files), native observation, correction capture, GSD dashboard command, adaptive agents.

**v6.0 Adaptive Observation & Learning Loop (2026-03-11):** Correction capture pipeline, preference tracking and promotion, live recall injection, observer agent with suggestion pipeline, bounded learning guardrails.

**v7.0 Quality Enforcement Observability (2026-03-11):** Gate execution persistence to JSONL, correction quality context, Context7 call logging, dashboard Gate Health page, gate-to-correction attribution.

**v8.0 Close the Loop (2026-04-03):** Skill feedback loop wired end-to-end (analysis auto-triggers, suggestions surfaced at session start, `/gsd:refine-skill` accepts/dismisses into SKILL.md). Quality gates moved from agent instructions to deterministic PostToolUse hooks that fire without executor cooperation.

**Current file counts:**
- 35 workflow files (`get-shit-done/workflows/`)
- 15 lib modules (`get-shit-done/bin/lib/`)
- 36 test files, 982 tests across 200 suites

---

## 4. Concurrent Milestones

> **First of its kind.** No other Claude Code project management framework supports parallel milestone workspaces. This is the single biggest architectural departure from vanilla GSD.

### The problem with vanilla GSD

Vanilla GSD is linear. One milestone at a time. One set of planning docs. One `STATE.md`, one `ROADMAP.md`, one `phases/` directory.

If you're working on v2.0 and an urgent v1.1 hotfix comes in, you're stuck — you either shelve your v2.0 work manually, or you try to juggle both in the same planning directory and hope nothing collides. For solo developers running multiple work streams (a new feature release, a bugfix branch, an experimental prototype), this is a real bottleneck.

### How concurrent milestones change everything

Concurrent milestones blow that limitation wide open. Every milestone gets its own **fully isolated workspace** under `.planning/milestones/<version>/`:

```
.planning/milestones/
  v1.1/
    STATE.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
  v2.0/
    STATE.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
  v3.0-experimental/
    STATE.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
```

You can have v1.1, v2.0, and v3.0-experimental **all active simultaneously** — each with independent phase tracking, independent state, and zero cross-contamination.

### Deep integration, not a bolt-on

This isn't a shallow feature layered on top. The entire core was rearchitected:

| Component | What changed |
|-----------|-------------|
| `planningRoot()` | Dynamically resolves to the correct milestone workspace |
| `resolveActiveMilestone()` | Auto-detects active milestone directories |
| `phase.cjs` | Every function is milestone-aware |
| `roadmap.cjs` | Reads/writes to the correct milestone's `ROADMAP.md` |
| `state.cjs` | Scoped state per milestone |
| `milestone.cjs` | Workspace creation, validation, manifest checks |
| `migrate.cjs` | Non-destructive upgrade from flat to milestone-scoped layout |

The `migrate.cjs` module handles upgrading existing flat-layout projects to milestone-scoped layout safely:

```bash
gsd-tools migrate --dry-run           # Preview what would change
gsd-tools migrate --apply --version v2.0  # Execute the migration
```

There's even a `manifest-check` command that validates milestone workspace integrity.

### The result

You work on whatever you want, whenever you want, and each work stream maintains its own complete, consistent planning state. Switch between milestones freely. Run phases in one while planning another. The framework handles the routing.

### Getting started

**Step 1:** Set `concurrent: true` in `.planning/config.json`:

```json
{
  "concurrent": true
}
```

**Step 2:** Create a milestone workspace:

```
/gsd:new-milestone v2.0
```

This creates `.planning/milestones/v2.0/` with its own complete planning directory structure.

**Step 3:** Just work. No additional flags needed.

Milestone scope is hardwired into all base GSD workflow commands. GSD auto-detects whether the project is milestone-scoped and routes to the correct workspace automatically.

See [UPGRADES.md](UPGRADES.md#milestone-v20--concurrent-milestones-shipped-2026-02-25) for the full architecture details.

---

## 5. Device-Wide Dashboard

> **First of its kind.** No other Claude Code framework gives you a live, real-time dashboard across every project on your machine.

### Why this matters

When you're running multiple GSD projects — and especially multiple concurrent milestones across those projects — keeping track of what's happening where becomes its own cognitive overhead.

Which project is mid-phase? Which milestone just shipped? How much has this sprint cost? What sessions are running? The dashboard answers all of that from **a single browser tab**.

### What you get

The dashboard is a full web application served locally. It discovers every GSD project registered on your machine, aggregates their planning state in real time via **Server-Sent Events**, and renders a unified view of your entire development operation.

**Overview page:**
- Every project with milestone status, accumulated cost, session duration, and lines changed
- Live-updating as work happens — no refresh needed

**Project detail page:**
- Per-phase progress bars and milestone breakdowns
- Full state of that project's planning docs
- All live-updating via SSE

**Embedded terminals:**
- Monitor and interact with running Claude Code sessions directly from the dashboard UI
- Backed by tmux integration — real terminal sessions, not read-only logs

**Session awareness:**
- Detects untagged tmux sessions not associated with any project
- Surfaces them in the sidebar so nothing falls through the cracks

**Pattern library:**
- Aggregates corrections across all your projects
- Shows the learning signals your adaptive layer is accumulating over time

### Under the hood

The whole thing runs on a lightweight Node.js server (`server.cjs`) with a vanilla JS frontend — no framework dependencies, no build step for the dashboard itself. Components are modular and the CSS is clean and purposeful:

| Component | Purpose |
|-----------|---------|
| `sidebar.js` | Project list, session indicators |
| `project-card.js` | Overview tiles with status summaries |
| `project-detail.js` | Deep-dive per-project view |
| `terminal-modal.js` | Embedded tmux terminal sessions |
| `pattern-page.js` | Correction pattern library |
| `progress-bar.js` | Phase and milestone progress |
| `empty-state.js` | Zero-state guidance |

### Getting started

**Start the dashboard:**

```bash
gsd dashboard serve
```

Starts on port 3141 by default. Open `http://localhost:3141` in your browser.

**Manage projects:**

| Command | Description |
|---------|-------------|
| `gsd dashboard serve` | Start the dashboard server |
| `gsd dashboard list` | Show all registered projects |
| `gsd dashboard add` | Register the current directory |
| `gsd dashboard remove` | Unregister the current directory |

**Dashboard files:** `dashboard/` directory contains the full UI (HTML, CSS, JS components).

---

## 6. Quality Enforcement

Quality enforcement is off by default. Enable it per-project:

```
/gsd:set-quality standard
```

Or edit `.planning/config.json` directly:

```json
{
  "quality": {
    "level": "standard"
  }
}
```

### Quality levels

| Level | Codebase Scan | Context7 Lookup | Test Gate | Diff Review | Debt Auto-Log |
|-------|:------------:|:---------------:|:---------:|:-----------:|:-------------:|
| `fast` | Skip | Skip | Skip | Skip | None |
| `standard` | Run | New deps only | New exports | Run | Critical + high |
| `strict` | Run | Always | Always | Run | All severities |

> **Recommendation:** Use `standard` for most projects. It adds meaningful enforcement without slowing execution significantly. Use `strict` when you need maximum coverage and are willing to accept longer execution times.

**Set a global default for new projects:**

```
/gsd:set-quality standard --global
```

---

## 7. Tech Debt Tracking

Tech debt is tracked in `.planning/DEBT.md` with structured `TD-NNN` entries. At `standard` or `strict` quality levels, the executor auto-logs high-severity issues discovered during execution.

### Manual debt management

**Log an entry:**

```bash
gsd-tools debt log \
  --type bug \
  --severity high \
  --component get-shit-done/bin/lib/milestone.cjs \
  --description "phasesDir hardcoded — broken for milestone-scoped layouts"
```

**List open entries:**

```bash
gsd-tools debt list
gsd-tools debt list --status open
gsd-tools debt list --severity critical
```

**Resolve an entry:**

```bash
gsd-tools debt resolve --id TD-001 --status resolved
```

### Automated fix workflow

```
/gsd:fix-debt TD-001
```

This spawns the GSD executor to fix the issue, runs tests to verify, and marks the entry resolved — all in one command.

---

## 8. Adaptive Learning Layer

### Skills

Skills live in `.claude/skills/`. Each skill is a `SKILL.md` that **auto-activates based on context** — no manual invocation needed.

The fork ships **17 skills** covering:

| Category | Skills |
|----------|--------|
| **Workflow** | GSD workflow routing, session awareness, skill integration |
| **Code quality** | Beautiful commits, code review, test generation, TypeScript patterns |
| **Knowledge** | API design, context handoff, security hygiene |
| **Learning** | Correction capture, preference tracking |

### Hooks

Hooks live in `.claude/hooks/`. **12 hook files** handle:

| Hook | Purpose |
|------|---------|
| `validate-commit.sh` | Enforces Conventional Commits format |
| `session-state.sh` | Saves/restores session state |
| `phase-boundary-check.sh` | Guards phase transitions |
| `gsd-analyze-patterns.cjs` | SessionEnd: runs pattern analysis, populates scan-state.json |
| `gsd-recall-corrections.cjs` | SessionStart: surfaces corrections, preferences, and pending skill suggestions |
| `gsd-run-gates.cjs` | PostToolUse: fires quality gates on Bash test commands and Write code files |
| Work state hooks | Save/restore across context resets |
| Statusline hooks | Update terminal status display |

### Correction Capture & Skill Refinement (v6.0 + v8.0)

When you correct Claude's output, the correction is captured as a structured learning signal with a 14-category taxonomy. The full pipeline:

1. **Capture** — PostToolUse hook detects edits and reverts, writes to `corrections.jsonl`
2. **Analysis** — `analyze-patterns.cjs` runs at session end, detects repeated patterns
3. **Suggestion** — Patterns crossing threshold generate skill improvement suggestions
4. **Surfacing** — Pending suggestions presented at next session start
5. **Refinement** — `/gsd:refine-skill` accepts (modifies SKILL.md, commits) or dismisses
6. **Loading** — Updated skill auto-loads in all future sessions

Repeated corrections (3+) auto-promote to durable preferences with confidence scoring and scope tagging (file/filetype/phase/project/global). Preferences appearing in 3+ projects promote to `~/.gsd/preferences.json` for cross-project inheritance.

### Quality Gate Enforcement (v8.0)

Quality gates fire **deterministically via PostToolUse hooks** — not as agent instructions that can be skipped:

| Gate | Trigger | What It Does |
|------|---------|--------------|
| `test_gate` | Bash commands containing `npm test`, `vitest`, `node --test` | Checks test output for failures |
| `diff_review` | Write to `.ts/.tsx/.js/.cjs/.mjs` files | Reviews code changes for quality issues |

Gate behavior by quality level:
- **fast** — Skip entirely (zero overhead)
- **standard** — Record outcomes as `passed` or `warned`
- **strict** — Block on failures

All gate executions persist to `gate-executions.jsonl` and flow to the dashboard Gate Health page.

> Skills and hooks are installed to `~/.claude/` via the standard deploy process (Section 2).

---

## 9. Updating After Upstream GSD Changes

Vanilla GSD updates via `npx get-shit-done-cc@latest`, which overwrites `~/.claude/get-shit-done/` with the upstream version. This removes this fork's changes.

### Reapply after an upstream update

**1. Pull upstream** *(optional — if you want upstream changes):*

```bash
git fetch origin
git merge origin/main
```

**2. Redeploy the fork:**

```bash
npm install -g .
node scripts/build-hooks.js
get-shit-done-cc --claude --global
```

**3. Verify:**

```
/gsd:help
```

**4. Run tests:**

```bash
node --test tests/*.test.cjs
```

> **Tip:** Before any GSD update, check upstream's changelog. The fork is structured to minimize merge conflicts — all additions are in separate files or clearly delimited sections.

---

## 10. Customizing for Your Needs

| Feature | Configuration | Default |
|---------|--------------|---------|
| **Quality level** | `quality.level` in `.planning/config.json` | `fast` (vanilla behavior) |
| **Quality gates** | PostToolUse hooks (automatic) | Respect quality level |
| **Tech debt auto-logging** | Automatic at `standard`/`strict` | Off at `fast` |
| **Concurrent milestones** | `concurrent: true` in config | Off (single-milestone) |
| **Skill suggestions** | `suggest_on_session_start` in config | `true` |
| **Skills and hooks** | `.claude/skills/` and `.claude/hooks/` | Installed via deploy |

---

## 11. Running Tests

```bash
node --test tests/*.test.cjs
```

**982 tests** across **200 suites** (36 test files). Uses Node.js built-in test runner — no test framework dependencies required.

> **Expected:** 979/982 tests passing (3 pre-existing failures in config, foundation, tmux-server tests — unrelated to fork changes). Requires Node.js 18+ and `npm install`.

---

## 12. Project Structure

```
get-shit-done/
  bin/
    gsd-tools.cjs              CLI entry point
    lib/
      core.cjs                 Shared utilities
      phase.cjs                Phase lifecycle management
      roadmap.cjs              ROADMAP.md parsing and updates
      milestone.cjs            Milestone workspace management
      debt.cjs                 Tech debt CRUD
      state.cjs                STATE.md management
      init.cjs                 Project initialization
      dashboard.cjs            Dashboard aggregation
      server.cjs               Dashboard HTTP server
      config.cjs               Config management
      commands.cjs             Command dispatch
      frontmatter.cjs          Frontmatter parsing
      template.cjs             Template generation
      verify.cjs               Phase verification
  workflows/                   35 workflow orchestrators (slash command definitions)

dashboard/
  js/
    app.js                     Dashboard app entry point
    components/                UI components (sidebar, project-card, project-detail,
                               terminal-modal, pattern-page, gate-health-page,
                               progress-bar, etc.)
    lib/                       API client, router, state, SSE
  css/                         Dashboard styles

.claude/
  hooks/                       12 hook files (commit validation, session state,
                               phase boundary, work state, correction capture,
                               pattern analysis, recall injection, gate enforcement)
  skills/                      17 skills (gsd-workflow, session-awareness,
                               beautiful-commits, correction-capture, and others)

tests/                         36 test suites (982 tests)

.planning/                     This project's own planning documents
  STATE.md                     Coordinator state
  observations/                Gate executions, corrections, context7 calls (JSONL)
  milestones/                  Per-milestone workspaces (v1.0 through v8.0)
    <version>/
      STATE.md
      ROADMAP.md
      REQUIREMENTS.md
      phases/

scripts/
  build-hooks.js               Builds hook files before deployment

UPGRADES.md                    Full milestone-by-milestone documentation
DEPLOY.md                      Deployment instructions
```

---

## Links

- **Upstream GSD:** https://github.com/gsd-build/get-shit-done
- **This fork:** https://github.com/gkd67pjznr-ctrl/get-shit-done
- **Upgrade history:** [UPGRADES.md](UPGRADES.md)
- **Deployment steps:** [DEPLOY.md](DEPLOY.md)
