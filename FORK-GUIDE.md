# FORK-GUIDE.md — GSD Enhanced Fork

## 1. Overview

This is a forked version of GSD (Get Shit Done) that adds quality enforcement, concurrent milestone workspaces, and structured tech debt tracking on top of the vanilla framework. It is designed for solo developers using Claude Code who want stronger guarantees about code quality beyond what vanilla GSD provides. All additions are additive and config-gated — the default quality level (`fast`) produces zero behavioral change from upstream GSD.

See [UPGRADES.md](UPGRADES.md) for the full milestone-by-milestone documentation of what was built and why.

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

This installs the fork's agent files to `~/.claude/get-shit-done/`, replacing your current GSD install (vanilla or previous version of this fork).

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

**Files modified vs vanilla GSD:**
- `get-shit-done/agents/gsd-executor.md` — Quality Sentinel gates added (pre/post task)
- `get-shit-done/agents/gsd-verifier.md` — Step 7b quality dimension checks added
- `get-shit-done/agents/gsd-planner.md` — Quality directive fields added to task actions
- `get-shit-done/bin/gsd-tools.cjs` — CLI entry point extended with new commands
- All 7 workflow files — `--milestone` flag support added

**New files:**
- `get-shit-done/bin/lib/debt.cjs` — Tech debt CRUD module
- `get-shit-done/bin/lib/migrate.cjs` — Planning layout migration module
- `get-shit-done/commands/gsd/set-quality.md` — `/gsd:set-quality` command
- `get-shit-done/commands/gsd/fix-debt.md` — `/gsd:fix-debt` command

**Key new commands:**
- `/gsd:set-quality [fast|standard|strict]` — switch quality levels
- `/gsd:fix-debt TD-NNN` — resolve a tracked debt entry
- `gsd-tools debt log/list/resolve` — manage tech debt entries
- `gsd-tools migrate` — upgrade planning layouts to new schema
- `gsd-tools milestone manifest-check` — detect file conflicts across concurrent milestones

---

## 4. Enabling Quality Enforcement

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

## 5. Enabling Concurrent Milestones

Concurrent milestones let you run multiple work streams in parallel, each with an isolated `.planning/milestones/<version>/` workspace.

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

This creates `.planning/milestones/v2.0/` with its own `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, and `phases/` directory.

**Step 3:** Work within the milestone using the `--milestone` flag:

```
/gsd:execute-phase --milestone v2.0
```

See [UPGRADES.md](UPGRADES.md#milestone-v20--concurrent-milestones-shipped-2026-02-25) for the full architecture details.

---

## 6. Using Tech Debt Tracking

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

## 7. Updating: Keeping Fork Changes When GSD Updates

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

The `/gsd:reapply-patches` workflow automates this: it reads the repo, identifies what changed versus the upstream baseline, and re-applies the fork-specific modifications on top of whatever upstream version is currently installed.

**Recommended approach:** Before any GSD update, check upstream's changelog. After updating, deploy from this repo and run tests. The fork is structured to minimize merge conflicts — all additions are in separate files or clearly delimited sections.

---

## 8. Customizing for Your Needs

- **Quality level** is per-project in `.planning/config.json`. Choose your tradeoff between speed and rigor.
- **Tech debt auto-logging** is automatic at `standard` and `strict` quality levels. In `fast` mode, no debt entries are auto-created.
- **Concurrent milestones** are opt-in via `concurrent: true` in config. Single-milestone projects work identically to vanilla GSD.
- **Agent files** live at `~/.claude/get-shit-done/` after deployment. This repo is the source of truth — `DEPLOY.md` syncs changes to the installed location.

---

## 9. Running Tests

```bash
node --test tests/*.test.cjs
```

298 tests across 14 suites. Uses Node.js built-in test runner — no test framework dependencies required.

**Expected output:** All 298 tests passing. If you see failures, check that you have Node.js 18+ installed and that `npm install` has been run.

---

## 10. Project Structure

```
get-shit-done/
  bin/
    gsd-tools.cjs          CLI entry point
    lib/
      core.cjs             Shared utilities
      phase.cjs            Phase lifecycle management
      roadmap.cjs          ROADMAP.md parsing and updates
      milestone.cjs        Milestone workspace management
      debt.cjs             Tech debt CRUD
      migrate.cjs          Planning layout migration
      state.cjs            STATE.md management
      init.cjs             Project initialization
      (6 more modules)
  agents/                  Executor, planner, verifier, researcher agents
  commands/gsd/            Slash command definitions
  workflows/               7 workflow orchestrators

tests/                     14 test suites (298 tests)

.planning/                 This project's own planning documents
  PROJECT.md               Project context and decisions
  DEBT.md                  Open tech debt entries
  STATE.md                 Coordinator state (milestone-scoped layout)
  milestones/              Per-milestone workspaces

UPGRADES.md                Full milestone-by-milestone documentation
DEPLOY.md                  Deployment instructions
```

---

## Links

- Upstream GSD repo: https://github.com/gsd-build/get-shit-done
- This fork: https://github.com/gkd67pjznr-ctrl/get-shit-done
- Full upgrade history: [UPGRADES.md](UPGRADES.md)
- Deployment steps: [DEPLOY.md](DEPLOY.md)
