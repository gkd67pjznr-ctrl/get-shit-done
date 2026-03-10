# FORK-GUIDE.md — GSD Enhanced Fork

## 1. Overview

This is a forked version of GSD (Get Shit Done) that adds quality enforcement, concurrent milestone workspaces, structured tech debt tracking, an adaptive learning layer (skills, agents, hooks, correction capture, preference tracking), and a device-wide project dashboard. It is designed for solo developers using Claude Code who want stronger guarantees about code quality and an AI assistant that improves over time by learning from corrections.

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

**v4.0 Adaptive Learning Integration (2026-03-09):** Skills system (`.claude/skills/` — 17 skills), hooks system (`.claude/hooks/` — 13 hook files), native observation, correction capture, GSD dashboard command, adaptive agents.

**v6.0 Adaptive Observation & Learning Loop (in progress):** Correction capture pipeline, preference tracking and promotion.

**Current file counts:**
- 35 workflow files (`get-shit-done/workflows/`)
- 15 lib modules (`get-shit-done/bin/lib/`)
- 35 test files, 958 tests across 195 suites

---

## 4. Concurrent Milestones

This is the single biggest architectural departure from vanilla GSD, and as far as we know, no other Claude Code project management framework has anything like it.

Vanilla GSD is linear. One milestone at a time. One set of planning docs. One `STATE.md`, one `ROADMAP.md`, one `phases/` directory. If you're working on v2.0 and an urgent v1.1 hotfix comes in, you're stuck — you either shelve your v2.0 work manually, or you try to juggle both in the same planning directory and hope nothing collides. For solo developers running multiple work streams (a new feature release, a bugfix branch, an experimental prototype), this is a real bottleneck.

Concurrent milestones blow that limitation wide open. Every milestone gets its own fully isolated workspace under `.planning/milestones/<version>/`, each with its own `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, and `phases/` directory. You can have v1.1, v2.0, and v3.0-experimental all active simultaneously, each with independent phase tracking, independent state, and zero cross-contamination. The `--milestone` flag threads through every GSD command — planning, execution, verification, debt tracking, all of it — so you always know exactly which work stream you're operating in.

This isn't a shallow feature bolted on top. The entire core was rearchitected for it: `planningRoot()` dynamically resolves to the correct milestone workspace, `resolveActiveMilestone()` auto-detects active milestone directories, and every function in `phase.cjs`, `roadmap.cjs`, `state.cjs`, and `milestone.cjs` is milestone-aware. The `migrate.cjs` module handles upgrading existing flat-layout projects to the milestone-scoped layout non-destructively (`migrate --dry-run` to preview, `migrate --apply --version vX.Y` to execute). There's even a `manifest-check` command that validates milestone workspace integrity.

The result: you work on whatever you want, whenever you want, and each work stream maintains its own complete, consistent planning state. Switch between milestones freely. Run phases in one while planning another. The framework handles the routing.

**Enabling concurrent milestones:**

Set `concurrent: true` in `.planning/config.json`:

```json
{
  "concurrent": true
}
```

Create a milestone workspace:

```
/gsd:new-milestone v2.0
```

This creates `.planning/milestones/v2.0/` with its own complete planning directory structure.

Work within the milestone using the `--milestone` flag:

```
/gsd:execute-phase --milestone v2.0
/gsd:plan-phase --milestone v2.0
/gsd:progress --milestone v2.0
```

See [UPGRADES.md](UPGRADES.md#milestone-v20--concurrent-milestones-shipped-2026-02-25) for the full architecture details.

---

## 5. Device-Wide Dashboard

No other Claude Code framework gives you a live, real-time dashboard across every project on your machine. This is the first of its kind.

When you're running multiple GSD projects — and especially multiple concurrent milestones across those projects — keeping track of what's happening where becomes its own cognitive overhead. Which project is mid-phase? Which milestone just shipped? How much has this sprint cost? What sessions are running? The dashboard answers all of that from a single browser tab.

The dashboard is a full web application served locally. It discovers every GSD project registered on your machine, aggregates their planning state in real time via Server-Sent Events, and renders a unified view of your entire development operation. The overview page shows every project with its milestone status, accumulated cost, session duration, and lines changed. Click into any project and you get per-phase progress bars, milestone breakdowns, and the full state of that project's planning docs — all live-updating as work happens.

But it goes further than status displays. The dashboard has embedded terminal sessions backed by tmux integration — you can monitor and interact with running Claude Code sessions directly from the dashboard UI. It detects untagged tmux sessions that aren't associated with any project and surfaces them so nothing falls through the cracks. There's a pattern library that aggregates corrections across all your projects, showing you the learning signals your adaptive layer is accumulating over time.

The whole thing runs on a lightweight Node.js server (`server.cjs`) with a vanilla JS frontend — no framework dependencies, no build step for the dashboard itself. Components are modular (sidebar, project cards, project detail, terminal modal, pattern page, progress bars) and the CSS is clean and purposeful. It starts on port 3141 by default and stays out of your way until you need it.

**Starting the dashboard:**

```bash
gsd dashboard serve
```

**Features:**
- Project overview with milestone status, cost, and duration
- Per-project detail with phase progress, live-updating via SSE
- Embedded terminal sessions (tmux integration) — monitor and interact with running sessions
- Pattern library from accumulated corrections across all projects
- Untagged tmux session detection — nothing gets lost
- Lightweight, zero-dependency frontend — no build step required

**Commands:**
- gsd dashboard serve | starts dashboard, default port 3141
- gsd dashboard list | shows all projects registered to dashboard
- gsd dashboard add | adds current directory to dashboard
- gsd dashboard remove | removes current directory from dashboard

**Dashboard files:** `dashboard/` directory contains the UI (HTML, CSS, JS components).

---

## 6. Enabling Quality Enforcement

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

**Quality levels:**

| Level | Codebase Scan | Context7 Lookup | Test Gate | Diff Review | Debt Auto-Log |
|-------|--------------|-----------------|-----------|-------------|---------------|
| `fast` | Skip | Skip | Skip | Skip | None |
| `standard` | Run | New deps only | New exports | Run | Critical + high |
| `strict` | Run | Always | Always | Run | All severities |

**Recommendation:** Use `standard` for most projects. It adds meaningful enforcement without slowing execution significantly. Use `strict` when you need maximum coverage and are willing to accept longer execution times.

To set a global default for new projects:

```
/gsd:set-quality standard --global
```

---

## 7. Using Tech Debt Tracking

Tech debt is tracked in `.planning/DEBT.md` with structured TD-NNN entries. At `standard` or `strict` quality levels, the executor auto-logs high-severity issues discovered during execution.

**Log a debt entry manually:**

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

**Fix debt with the skill:**

```
/gsd:fix-debt TD-001
```

This spawns the GSD executor to fix the issue, runs tests to verify, and marks the entry resolved.

---

## 8. Adaptive Learning Layer

**Skills** live in `.claude/skills/`. Each skill is a `SKILL.md` that auto-activates based on context. The fork ships 17 skills covering: GSD workflow routing, session awareness, beautiful commits, code review, context handoff, security hygiene, test generation, TypeScript patterns, API design, skill integration, correction capture, and others.

**Hooks** live in `.claude/hooks/`. 13 hook files handle: commit validation (`validate-commit.sh`), session state (`session-state.sh`), phase boundary checks (`phase-boundary-check.sh`), work state save/restore, session snapshots, correction capture, and statusline.

**Correction capture** (v6.0, in progress): When you correct Claude's output, the correction is captured as a learning signal. Repeated corrections become preferences that are auto-promoted to skill rules.

Skills and hooks are installed to `~/.claude/` via the standard deploy process (Section 2).

---

## 9. Updating: Keeping Fork Changes When GSD Updates

Vanilla GSD updates via `npx get-shit-done-cc@latest`, which overwrites `~/.claude/get-shit-done/` with the upstream version. This removes this fork's changes.

**To reapply after an upstream update:**

1. Pull the latest upstream into this fork repo (optional — if you want upstream changes):
   ```bash
   git fetch origin
   git merge origin/main
   ```

2. Deploy the fork again using the 3-step process from Section 2:
   ```bash
   npm install -g .
   node scripts/build-hooks.js
   get-shit-done-cc --claude --global
   ```

3. Verify with `/gsd:help` in Claude Code.

4. Run the test suite to confirm nothing broke:
   ```bash
   node --test tests/*.test.cjs
   ```

**Recommended approach:** Before any GSD update, check upstream's changelog. After updating, deploy from this repo and run tests. The fork is structured to minimize merge conflicts — all additions are in separate files or clearly delimited sections.

---

## 10. Customizing for Your Needs

- **Quality level** is per-project in `.planning/config.json`. Choose your tradeoff between speed and rigor.
- **Tech debt auto-logging** is automatic at `standard` and `strict` quality levels. In `fast` mode, no debt entries are auto-created.
- **Concurrent milestones** are opt-in via `concurrent: true` in config. Single-milestone projects work identically to vanilla GSD.
- **Skills and hooks** live in `.claude/skills/` and `.claude/hooks/` after deployment.

---

## 11. Running Tests

```bash
node --test tests/*.test.cjs
```

958 tests across 195 suites (35 test files). Uses Node.js built-in test runner — no test framework dependencies required.

**Expected output:** All 958 tests passing. If you see failures, check that you have Node.js 18+ installed and that `npm install` has been run.

---

## 12. Project Structure

```
get-shit-done/
  bin/
    gsd-tools.cjs            CLI entry point
    lib/
      core.cjs               Shared utilities
      phase.cjs              Phase lifecycle management
      roadmap.cjs            ROADMAP.md parsing and updates
      milestone.cjs          Milestone workspace management
      debt.cjs               Tech debt CRUD
      migrate.cjs            Planning layout migration
      state.cjs              STATE.md management
      init.cjs               Project initialization
      dashboard.cjs          Dashboard aggregation
      server.cjs             Dashboard HTTP server
      config.cjs             Config management
      commands.cjs           Command dispatch
      frontmatter.cjs        Frontmatter parsing
      template.cjs           Template generation
      verify.cjs             Phase verification
  workflows/                 35 workflow orchestrators (slash command definitions)

dashboard/
  js/
    app.js                   Dashboard app entry point
    components/              UI components (sidebar, project-card, project-detail,
                             terminal-modal, pattern-page, progress-bar, etc.)
    lib/                     API client, router, state, SSE
  css/                       Dashboard styles

.claude/
  hooks/                     13 hook files (commit validation, session state,
                             phase boundary, work state, correction capture, statusline)
  skills/                    17 skills (gsd-workflow, session-awareness,
                             beautiful-commits, correction-capture, and others)

tests/                       35 test suites (958 tests)

.planning/                   This project's own planning documents
  STATE.md                   Coordinator state
  milestones/                Per-milestone workspaces (v1.0 through v6.0)
    <version>/
      STATE.md
      ROADMAP.md
      REQUIREMENTS.md
      phases/

scripts/
  build-hooks.js             Builds hook files before deployment

UPGRADES.md                  Full milestone-by-milestone documentation
DEPLOY.md                    Deployment instructions
```

---

## Links

- Upstream GSD repo: https://github.com/gsd-build/get-shit-done
- This fork: https://github.com/gkd67pjznr-ctrl/get-shit-done
- Full upgrade history: [UPGRADES.md](UPGRADES.md)
- Deployment steps: [DEPLOY.md](DEPLOY.md)
