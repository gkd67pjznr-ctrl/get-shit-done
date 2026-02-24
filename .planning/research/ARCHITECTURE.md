# Architecture Research

**Domain:** Concurrent milestone execution — GSD framework extension
**Researched:** 2026-02-24
**Confidence:** HIGH — based on direct source analysis of all lib/*.cjs modules, workflow files, and existing .planning/ layout

---

## Standard Architecture

### System Overview

The current GSD architecture is a single-session, sequential state machine. One Claude Code session owns `.planning/` at a time. Everything — phase discovery, path resolution, dashboard state, commits — assumes exclusive write access to a single `.planning/` root.

The v2.0 concurrent milestone architecture adds a **milestone-scoped layer** between the project root and the existing phase/state structure. Each milestone gets an isolated workspace under `.planning/milestones/<version>/`. A central read-mostly dashboard (`MILESTONES.md`) tracks cross-milestone status and is updated by each session when it transitions state.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROJECT ROOT (.planning/)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    CENTRAL DASHBOARD                              │    │
│  │  MILESTONES.md   — cross-milestone status, conflict manifest     │    │
│  │  PROJECT.md      — unchanged (project-wide context)              │    │
│  │  config.json     — unchanged (project-wide settings)             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────────┐  ┌─────────────────────┐                       │
│  │  MILESTONE WORKSPACE │  │  MILESTONE WORKSPACE │  (one per milestone) │
│  │  milestones/v2.0/   │  │  milestones/v2.1/   │                       │
│  │  ├── STATE.md       │  │  ├── STATE.md        │                       │
│  │  ├── ROADMAP.md     │  │  ├── ROADMAP.md      │                       │
│  │  ├── REQUIREMENTS.md│  │  ├── REQUIREMENTS.md │                       │
│  │  ├── conflict.json  │  │  ├── conflict.json   │                       │
│  │  ├── research/      │  │  ├── research/        │                       │
│  │  └── phases/        │  │  └── phases/          │                       │
│  │      ├── 01-name/   │  │      ├── 01-name/     │                       │
│  │      └── 02-name/   │  │      └── 02-name/     │                       │
│  └─────────────────────┘  └─────────────────────┘                       │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │             COMPATIBILITY BRIDGE (old-style projects)             │    │
│  │  phases/      — still present for legacy projects                │    │
│  │  STATE.md     — root-level for legacy projects                   │    │
│  │  ROADMAP.md   — root-level for legacy projects                   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Current Responsibility | v2.0 Change | Confidence |
|-----------|----------------------|-------------|------------|
| `gsd-tools.cjs` CLI | Path resolution via hardcoded `.planning/` prefix | Add `--milestone <version>` flag; all path-generating functions accept optional milestone scope | HIGH |
| `core.cjs: loadConfig` | Reads `.planning/config.json` | No change — config is project-scoped, not milestone-scoped | HIGH |
| `core.cjs: findPhaseInternal` | Searches `.planning/phases/`, then `.planning/milestones/<v>-phases/` | Extend search to include `.planning/milestones/<v>/phases/` in new layout | HIGH |
| `phase.cjs` | All paths hardcoded to `.planning/phases/` | Accept milestone-scoped phases dir as parameter | HIGH |
| `milestone.cjs: cmdMilestoneComplete` | Archives to `.planning/milestones/` | No structural change; archives milestone workspace subfolder | MEDIUM |
| `init.cjs` init commands | Return `.planning/` relative paths as strings | Return milestone-scoped paths when `--milestone` provided | HIGH |
| `MILESTONES.md` | Append-only record of shipped milestones | Becomes live dashboard tracking active + archived milestones | HIGH |
| `STATE.md` | Single file at `.planning/STATE.md` | Moved into milestone workspace: `.planning/milestones/v2.0/STATE.md` | HIGH |
| `ROADMAP.md` | Single file at `.planning/ROADMAP.md` | Moved into milestone workspace: `.planning/milestones/v2.0/ROADMAP.md` | HIGH |
| `conflict.json` | Does not exist | New file per milestone: declares files each milestone will touch | HIGH |
| Workflow files (`new-milestone.md`, `plan-phase.md`, `execute-phase.md`) | Reference `.planning/` paths via init JSON | Receive milestone-scoped paths from init; no path strings hardcoded in workflows | MEDIUM |
| Agent spec files (`gsd-executor.md`, etc.) | Receive paths via `<files_to_read>` from orchestrator | No change to agents — orchestrators pass correct paths | HIGH |

---

## Recommended Project Structure

**Decision: `.planning/milestones/<version>/` as workspace root**

Use `.planning/milestones/v2.0/` (not `.planning/v2.0/`). Rationale:

1. The `.planning/milestones/` directory already exists — `cmdMilestoneComplete` creates it for archives (`v1.0-phases`, `v1.1-phases`). The new layout extends the same directory for active workspaces.
2. `.planning/v2.0/` puts milestone folders directly in `.planning/` root, mixing milestone workspaces with project-wide files (`PROJECT.md`, `config.json`, `MILESTONES.md`). This creates ambiguity — tooling must distinguish `v2.0/` (milestone) from `phases/` (legacy) and `research/` (project-wide).
3. `.planning/milestones/v2.0/` is unambiguous: anything under `milestones/` is milestone-scoped.

```
.planning/
├── PROJECT.md                      # project-wide, unchanged
├── config.json                     # project-wide settings, unchanged
├── MILESTONES.md                   # REPURPOSED: live dashboard (was append-only log)
│
├── milestones/
│   ├── v2.0/                       # ACTIVE milestone workspace (new)
│   │   ├── STATE.md                # milestone-scoped state
│   │   ├── ROADMAP.md              # milestone-scoped roadmap
│   │   ├── REQUIREMENTS.md         # milestone-scoped requirements
│   │   ├── conflict.json           # files this milestone will touch
│   │   ├── research/               # milestone-scoped research
│   │   │   ├── SUMMARY.md
│   │   │   └── ARCHITECTURE.md
│   │   └── phases/                 # milestone-scoped phases (numbered from 01)
│   │       ├── 01-workspace-isolation/
│   │       │   ├── 01-01-PLAN.md
│   │       │   ├── 01-01-SUMMARY.md
│   │       │   └── 01-RESEARCH.md
│   │       └── 02-dashboard/
│   │
│   ├── v1.1-phases/                # EXISTING archive (unchanged)
│   │   ├── 05-config-foundation/
│   │   └── 06-commands-and-ux/
│   └── v1.0-phases/                # EXISTING archive (unchanged)
│       └── 01-foundation/
│
├── phases/                         # LEGACY: present only in old-style projects
├── STATE.md                        # LEGACY: root-level only in old-style projects
├── ROADMAP.md                      # LEGACY: root-level only in old-style projects
└── REQUIREMENTS.md                 # LEGACY: root-level only in old-style projects
```

### Structure Rationale

- **`milestones/<version>/` per workspace:** Each active milestone is fully self-contained. One session reads/writes its workspace; other sessions are in different directories. No file-level conflicts between concurrent milestones.
- **`phases/` starts at `01-` per milestone:** Phase numbers are milestone-scoped. v2.0 has phases 01, 02, 03. v2.1 has phases 01, 02. No global phase counter. Rationale: the old global sequential scheme (`v1.0` ended at phase 4 → `v1.1` started at phase 5) only worked because milestones were sequential. Concurrent milestones cannot share a global counter.
- **`conflict.json` per milestone:** Declares which source files a milestone intends to modify. Written at milestone-start by `new-milestone` workflow. Read by a conflict-detection step in `execute-phase` (warn if another active milestone declared the same file). Lock-free: no coordination required to read, no exclusive access needed to write (written once at milestone creation, then read-only).
- **`MILESTONES.md` as live dashboard:** The existing file is append-only (shipped milestones only). Repurpose it as a structured dashboard tracking active milestones with their status, phase, and conflict manifest summary. The `milestone complete` command moves an entry from active to archived. This is the single file concurrent sessions may write — addressed in Git Coordination below.

---

## Architectural Patterns

### Pattern 1: `--milestone` Flag for Milestone-Scoped Path Resolution

**What:** Add a `--milestone <version>` global flag to `gsd-tools.cjs`. When present, all path-generating functions prepend `.planning/milestones/<version>/` instead of `.planning/`.

**When to use:** All commands invoked within a milestone-scoped workflow (`plan-phase`, `execute-phase`, `verify-phase`, `transition`, etc.) pass `--milestone v2.0`.

**Why not environment variable or config key:** An `--env` variable would require the session to `export MILESTONE=v2.0` and persist that across subshell calls — fragile in Claude Code's stateless bash environment. A config key would require reading config before every path operation. A CLI flag is explicit, composable, and visible in every bash call in workflow files — making the scope obvious when reading workflow logs.

**Implementation sketch (core.cjs):**

```javascript
// In gsd-tools.cjs main():
const msIdx = args.indexOf('--milestone');
let milestoneScope = null;
if (msIdx !== -1) {
  milestoneScope = args[msIdx + 1];
  args.splice(msIdx, 2);
}

// Threading milestone scope into path-generating functions:
function planningRoot(cwd, milestoneScope) {
  if (milestoneScope) {
    return path.join(cwd, '.planning', 'milestones', milestoneScope);
  }
  return path.join(cwd, '.planning');
}

// All functions that currently hardcode `.planning/` call planningRoot() instead:
// const phasesDir = path.join(cwd, '.planning', 'phases');
// becomes:
// const phasesDir = path.join(planningRoot(cwd, milestoneScope), 'phases');
```

**Trade-offs:**
- All workflow files must pass `--milestone $MILESTONE_VERSION` in every tool call
- Adds one CLI flag to every bash command in workflows
- No runtime surprises — scope is always explicit in the bash log

**What does NOT need the flag:** `config-get`, `config-set`, `commit`, `resolve-model`, `websearch` — these are project-wide operations, not milestone-scoped.

---

### Pattern 2: Compatibility Detection via Sentinel Files

**What:** Detect old-style vs. new-style projects by checking for the presence of sentinel structures.

**Detection logic:**

```javascript
function detectLayoutStyle(cwd) {
  const hasOldPhases = fs.existsSync(path.join(cwd, '.planning', 'phases'));
  const hasMilestoneWorkspaces = (() => {
    const msDir = path.join(cwd, '.planning', 'milestones');
    if (!fs.existsSync(msDir)) return false;
    // Check for at least one active workspace (has STATE.md inside)
    const entries = fs.readdirSync(msDir, { withFileTypes: true });
    return entries.some(e => {
      if (!e.isDirectory()) return false;
      // Active workspace has STATE.md; archive dirs (v1.0-phases) do not
      return fs.existsSync(path.join(msDir, e.name, 'STATE.md'));
    });
  })();

  if (hasMilestoneWorkspaces) return 'milestone-scoped';
  if (hasOldPhases) return 'legacy';
  return 'uninitialized';
}
```

**Compatibility rules:**
- `legacy` style: all tools use root `.planning/` layout (current behavior, unchanged)
- `milestone-scoped` style: tools require `--milestone <version>` for phase/state operations
- `uninitialized`: `new-project` workflow handles setup

**Where this runs:** In `cmdInitNewMilestone` and `cmdInitPlanPhase` — the two places where the workflow needs to know what layout it's working in. The result goes into the init JSON so workflows can branch on it.

**Critical constraint:** The gsdup project itself is currently `legacy` style (has `.planning/phases/` — though phases were archived). Migrating to `milestone-scoped` is a deliberate choice, not automatic. The compatibility layer ensures v1.x projects continue working unchanged.

---

### Pattern 3: Lock-Free Dashboard via Structured MILESTONES.md

**What:** `MILESTONES.md` becomes the central dashboard. Concurrent sessions write to it only on milestone state transitions (start, phase complete, milestone complete). Format uses a structured section per milestone that can be pattern-replaced atomically.

**Why lock-free:** Claude Code sessions cannot coordinate via advisory file locks — there is no shared lock server. The solution is to minimize write frequency (transitions only, not every plan) and use last-write-wins semantics acceptable for this use case. Two sessions updating their own milestone sections simultaneously would produce a merge conflict in git — handled by rebase strategy.

**Dashboard format:**

```markdown
# GSD Milestones

## Active

### v2.0 Concurrent Milestones
**Status:** Phase 02 / 04 — executing
**Session:** [session-id or hostname, optional]
**Started:** 2026-02-24
**Files declared:** bin/gsd-tools.cjs, bin/lib/core.cjs, bin/lib/phase.cjs (see conflict.json)
**Last updated:** 2026-02-24

### v2.1 Agent Teams
**Status:** Phase 01 / 03 — planning
**Started:** 2026-02-24
**Files declared:** agents/gsd-executor.md, agents/gsd-planner.md
**Last updated:** 2026-02-24

## Shipped

### v1.1 Quality UX (Shipped: 2026-02-24)
**Phases completed:** 3 phases, 5 plans, 12 tasks
...
```

**Update protocol:**
1. At milestone start: append new `### v2.0` section under `## Active`
2. At phase complete: pattern-replace the `**Status:**` line for that milestone section
3. At milestone complete: move section from `## Active` to `## Shipped`, update format

**Merge conflict resolution:** If two sessions update MILESTONES.md simultaneously, git will flag a conflict on the `**Status:**` lines. The resolution is simple: accept both updates (each session's section is independent). The `gsd-tools.cjs commit` function already handles `nothing_to_commit` gracefully. Recommendation: rebase strategy for the planning branch, not merge.

---

### Pattern 4: Conflict Manifest (conflict.json)

**What:** At milestone creation, the `new-milestone` workflow prompts the user (or infers from requirements) which source files the milestone will touch. This is written to `.planning/milestones/<version>/conflict.json`.

**Format:**

```json
{
  "version": "v2.0",
  "declared": [
    "bin/gsd-tools.cjs",
    "bin/lib/core.cjs",
    "bin/lib/phase.cjs",
    "bin/lib/init.cjs",
    "bin/lib/milestone.cjs"
  ],
  "declared_at": "2026-02-24",
  "note": "All gsd-tools modules — concurrent milestone path resolution"
}
```

**Conflict detection in execute-phase:**

```bash
# At execute-phase start, check for conflicts with other active milestones
OTHER_MILESTONES=$(ls .planning/milestones/ | grep -E "^v[0-9]" | grep -v "$(cat .planning/milestones/$MILESTONE/current-version.txt)" | grep -v ".*-phases$")

for other in $OTHER_MILESTONES; do
  # Skip if no conflict.json (old-style archive)
  [ ! -f ".planning/milestones/$other/conflict.json" ] && continue

  CONFLICTS=$(node gsd-tools.cjs conflict-check \
    --a ".planning/milestones/$MILESTONE/conflict.json" \
    --b ".planning/milestones/$other/conflict.json")

  if [ -n "$CONFLICTS" ]; then
    echo "WARNING: Overlapping files with milestone $other: $CONFLICTS"
    echo "Consider sequencing these milestones or splitting the conflicting work."
  fi
done
```

**Conflict response is advisory, not blocking.** Two milestones touching the same file is allowed — both owners know about the overlap and can coordinate manually. GSD is a human-assisted system, not an automated CI pipeline.

---

### Pattern 5: Phase Numbering Reset per Milestone

**What:** Phase directories inside a milestone workspace start at `01-` regardless of global phase history. No cross-milestone phase counter.

**Why:** The current global counter (v1.0 ends at 4, v1.1 starts at 5) only worked because milestones executed sequentially. With concurrent milestones, there is no meaningful global sequence. Phase numbers are only meaningful within a milestone (`v2.0/phases/01-` is not the same as `v1.0/phases/01-`).

**Phase reference format:** When a workflow or commit message references a phase, it should be `v2.0/01` or `v2.0/phase-01` — not bare `01`. The phase directory path already provides this context since it lives under `milestones/v2.0/phases/`.

**Impact on `phase complete` and `cmdPhaseComplete`:** The function currently finds "next phase" by scanning `.planning/phases/`. In milestone-scoped mode, it scans `.planning/milestones/<version>/phases/`. Phase completion updates the milestone-scoped `STATE.md` and `ROADMAP.md`, not the root files.

**Impact on `findPhaseInternal`:** The archive search loop (`v[\d.]+-phases` directories) already exists. Add a parallel search for active milestone workspaces: look in `milestones/*/phases/` for directories matching `STATE.md` present (active) vs. absent (archived via old format).

---

## Data Flow

### Milestone-Scoped Request Flow

```
User invokes: /gsd:plan-phase 01 --milestone v2.0
    ↓
Orchestrator (plan-phase.md):
  INIT=$(node gsd-tools.cjs init plan-phase 01 --milestone v2.0)
  # Returns milestone-scoped paths:
  # phase_dir: ".planning/milestones/v2.0/phases/01-workspace-isolation"
  # state_path: ".planning/milestones/v2.0/STATE.md"
  # roadmap_path: ".planning/milestones/v2.0/ROADMAP.md"
    ↓
Orchestrator passes scoped paths to subagents via <files_to_read>
    ↓
Subagents (planner, researcher) read from milestone workspace
    ↓
Subagents write to milestone workspace (via paths from init)
    ↓
Commit touches only .planning/milestones/v2.0/ files (isolated)
```

### Compatibility Detection Flow

```
User invokes: /gsd:plan-phase 5
    ↓
gsd-tools.cjs init plan-phase 5  (no --milestone flag)
    ↓
detectLayoutStyle(cwd):
  → checks .planning/phases/ exists AND no active milestone workspaces
  → returns 'legacy'
    ↓
init plan-phase returns legacy paths:
  phase_dir: ".planning/phases/05-config-foundation"
  state_path: ".planning/STATE.md"
  roadmap_path: ".planning/ROADMAP.md"
    ↓
Orchestrator proceeds with existing behavior (zero change)
```

### Conflict Detection Flow

```
Session A starts execute-phase for v2.0:
  reads .planning/milestones/v2.0/conflict.json → ["bin/gsd-tools.cjs", ...]
  reads all other active milestone conflict.jsons
  cross-references → finds v2.1 also declared "agents/gsd-executor.md"
  WARN: "v2.1 also touches agents/gsd-executor.md — coordinate before merging"
  Execution continues (advisory only)
    ↓
Session A commits to git
    ↓
Session B (v2.1) later merges → git conflict on gsd-executor.md
  Developer resolves manually
  Conflict.json warned about this in advance
```

### Dashboard Update Flow

```
Session A completes phase 01 of v2.0:
  node gsd-tools.cjs milestone-dashboard update \
    --milestone v2.0 --status "Phase 02 / 04 — planning"
    ↓
  Reads MILESTONES.md
  Pattern-replaces **Status:** line for v2.0 section
  Writes MILESTONES.md
  node gsd-tools.cjs commit "docs(v2.0): phase 01 complete" \
    --files .planning/MILESTONES.md .planning/milestones/v2.0/STATE.md
```

---

## Integration Points

### New vs. Modified Components

| Component | New or Modified | What Changes |
|-----------|----------------|--------------|
| `core.cjs: planningRoot()` | NEW helper function | Central function returning `.planning/` or `.planning/milestones/<v>/` based on milestone scope |
| `core.cjs: detectLayoutStyle()` | NEW helper function | Returns `legacy`, `milestone-scoped`, or `uninitialized` |
| `core.cjs: findPhaseInternal()` | MODIFIED | Add search in active milestone workspaces (`milestones/*/phases/` with STATE.md) |
| `core.cjs: getArchivedPhaseDirs()` | MODIFIED | Existing `v*-phases` pattern unchanged; also include active workspaces in appropriate contexts |
| `core.cjs: getMilestoneInfo()` | MODIFIED | Read from milestone-scoped ROADMAP.md when milestone scope provided |
| `phase.cjs: all functions` | MODIFIED | Accept `phasesDir` param instead of computing it internally; callers pass `planningRoot/phases` |
| `milestone.cjs: cmdMilestoneComplete()` | MODIFIED | Archive entire milestone workspace folder; update MILESTONES.md dashboard section |
| `init.cjs: all cmdInit* functions` | MODIFIED | Accept milestone scope; return milestone-scoped paths |
| `commands.cjs: cmdCommit()` | NO CHANGE | Commit is project-wide (operates on git root, not .planning) |
| `commands.cjs: new cmdConflictCheck()` | NEW | Compare two conflict.json files, return overlapping file paths |
| `commands.cjs: new cmdMilestoneDashboard()` | NEW | Update MILESTONES.md structured section for a milestone |
| `config.cjs` | NO CHANGE | Config is project-wide, milestone-agnostic |
| `roadmap.cjs` | MODIFIED | Path resolution via planningRoot; milestone-scoped ROADMAP.md |
| `state.cjs` | MODIFIED | Path resolution via planningRoot; milestone-scoped STATE.md |
| `gsd-tools.cjs` (CLI router) | MODIFIED | Parse `--milestone` global flag; thread scope into all command calls |
| `MILESTONES.md` template | MODIFIED | Structured dashboard format replacing append-only log |
| `new-milestone.md` workflow | MODIFIED | Create milestone workspace dir; write conflict.json; update MILESTONES.md dashboard |
| `plan-phase.md` workflow | MODIFIED | Pass `--milestone` to all tool calls; detect layout style from init |
| `execute-phase.md` workflow | MODIFIED | Conflict check at start; pass `--milestone` to all tool calls |
| Agent specs (`gsd-executor.md`, etc.) | NO CHANGE | Agents receive paths from orchestrators; no hardcoded `.planning/` references |

### Build Order (Dependency-Ordered)

Build phases for v2.0 should follow this dependency order:

**Phase 1: Core path resolution (unblocks everything)**

Add `planningRoot()` helper and `--milestone` flag parsing to `gsd-tools.cjs` and `core.cjs`. Refactor all path-computing functions in `phase.cjs`, `state.cjs`, `roadmap.cjs` to call `planningRoot()`. No behavior change when `--milestone` not provided (backward compatible by design).

Deliverable: `gsd-tools.cjs init plan-phase 1 --milestone v2.0` returns milestone-scoped paths.

**Phase 2: Milestone workspace initialization (depends on Phase 1)**

Modify `new-milestone.md` workflow and `cmdMilestoneComplete` to create workspace directories, write `conflict.json`, initialize `MILESTONES.md` dashboard format. Add `cmdConflictCheck` to commands.cjs.

Deliverable: `/gsd:new-milestone` creates `.planning/milestones/v2.0/` with correct structure.

**Phase 3: Dashboard and conflict detection (depends on Phase 2)**

Add `cmdMilestoneDashboard` command. Update `execute-phase.md` with conflict check step. Write MILESTONES.md dashboard read/write logic. Test concurrent dashboard updates.

Deliverable: Two active milestone workspaces show correctly in `/gsd:progress`; conflict warning fires when manifests overlap.

**Phase 4: Compatibility layer and legacy detection (depends on Phase 1)**

Add `detectLayoutStyle()` to core.cjs. Update `init` commands to return `layout_style` field. Update workflows to branch on `layout_style`. Test: existing projects (legacy layout) get zero behavior change.

Deliverable: Running `/gsd:plan-phase 5` on the gsdup project (which has archived phases in `milestones/v1.1-phases/`) still works unchanged.

**Phase 5: Routing updates — all commands and workflows (depends on Phases 1-4)**

Audit every workflow file and command for hardcoded `.planning/` path strings. Replace with milestone-scoped equivalents where needed. Update `progress.md`, `complete-milestone.md`, `health.md`, `resume-project.md`.

Deliverable: All existing `/gsd:*` commands work with `--milestone` flag.

**Phase 6: Test coverage (depends on Phases 1-5)**

Add test cases for: milestone-scoped path resolution, compatibility detection, conflict check, phase numbering within milestone workspace, MILESTONES.md dashboard update. Target: 90%+ branch coverage of new functions in core.cjs and commands.cjs.

---

## Anti-Patterns

### Anti-Pattern 1: Global Phase Counter for Concurrent Milestones

**What people do:** Continue the global sequential phase number (v1.1 ended at 7, v2.0 starts at 8, v2.1 starts at 11, etc.) across concurrent milestones.

**Why it's wrong:** Concurrent milestones have no determined start order. If v2.0 starts at 8 and v2.1 starts at 11, what happens when v2.1 finishes first? Global renumbering breaks cross-references. Phase numbers become meaningless as global identifiers.

**Do this instead:** Phase numbers are milestone-local, starting at `01`. Reference phases as `v2.0/01` in cross-milestone contexts. The `phases/` directory path provides unambiguous location.

---

### Anti-Pattern 2: Shared STATE.md for Concurrent Milestones

**What people do:** Keep STATE.md at `.planning/STATE.md` and add a "current milestone" field to multiplex milestones through it.

**Why it's wrong:** `STATE.md` tracks current phase, current plan, last activity, and blockers. These are all session-specific. Two sessions writing to the same STATE.md will produce interleaved, incoherent state. The current `cmdPhaseComplete` writes to STATE.md to advance the current phase pointer — two sessions doing this concurrently will corrupt the "current phase" field.

**Do this instead:** Each milestone workspace owns its STATE.md. The root `MILESTONES.md` provides the cross-session view (which milestone is at which phase), but it is written only on phase transitions (low frequency), not on every plan execution.

---

### Anti-Pattern 3: File Locking for Dashboard Updates

**What people do:** Implement an advisory lock file (`.planning/.lock`) before writing MILESTONES.md to prevent concurrent writes.

**Why it's wrong:** Claude Code sessions have no reliable way to enforce file lock cleanup. If a session crashes or is interrupted while holding a lock, the lock file remains and blocks all other sessions. Lock files also require polling, which adds latency.

**Do this instead:** Design MILESTONES.md so concurrent writes produce git conflicts that are trivially resolvable (each milestone's section is independent). Dashboard writes are infrequent (phase transitions only). Conflict probability is low. When it does occur, `git rebase` resolves it in seconds because each session only updates its own section.

---

### Anti-Pattern 4: Agent Specs with Hardcoded Paths

**What people do:** Add `.planning/milestones/v2.0/` path references directly into agent spec files (`gsd-executor.md`, `gsd-planner.md`).

**Why it's wrong:** Agent specs are global files in `~/.claude/get-shit-done/`. Hardcoding a milestone version in an agent spec means the spec is only correct for that version. The next milestone breaks it.

**Do this instead:** Agent specs never contain filesystem paths. All paths flow through orchestrators via `<files_to_read>` blocks. Orchestrators get paths from `init` commands. `init` commands compute milestone-scoped paths. Agents are path-agnostic — they receive files, not paths.

---

### Anti-Pattern 5: Migrating Existing Projects Automatically

**What people do:** When a project has `.planning/phases/` (legacy), automatically restructure it into `.planning/milestones/<current-version>/phases/`.

**Why it's wrong:** Automatic migration changes on-disk structure without explicit user intent. It invalidates hardcoded path strings in any notes, scripts, or external references. It is irreversible (unless git reverted).

**Do this instead:** Legacy projects continue working as-is indefinitely. The compatibility layer means "old-style" is a permanent valid mode, not a transitional state. Migration to milestone-scoped layout is optional and user-initiated (run `/gsd:new-milestone` which creates the workspace structure and the user can choose to migrate or not).

---

## Scaling Considerations

This is a local filesystem orchestration system, not a web application. "Scaling" means: what happens as the number of concurrent milestones grows?

| Scale | Architecture Behavior |
|-------|-----------------------|
| 1 active milestone | No concurrent writes; MILESTONES.md update is serial; no conflict risk |
| 2-3 concurrent milestones | Low conflict probability; dashboard updates may collide once per milestone; git rebase resolves |
| 4+ concurrent milestones | MILESTONES.md becomes a merge hotspot; conflict.json cross-checks grow O(n²); consider splitting into separate repos |

**Realistic target:** 2-3 concurrent milestones is the practical maximum for a single developer using Claude Code. The architecture supports it cleanly. 4+ milestones in one project suggests the project should be decomposed into separate repos, each with their own GSD instance.

**First bottleneck:** MILESTONES.md concurrent writes. Mitigation: write only on phase transitions (not every plan). At 2-3 concurrent milestones, this is a rare event.

**Second bottleneck:** Conflict manifest cross-checks. With `n` active milestones, `execute-phase` reads `n-1` conflict manifests. For `n=3`, this is 2 JSON file reads — negligible.

---

## Sources

- Direct analysis of `bin/lib/core.cjs` — `findPhaseInternal`, `getArchivedPhaseDirs`, `loadConfig`, path resolution patterns (HIGH confidence)
- Direct analysis of `bin/lib/phase.cjs` — `cmdPhasesList`, `cmdPhaseComplete`, `cmdPhaseAdd` — all hardcode `.planning/phases/` (HIGH confidence)
- Direct analysis of `bin/lib/init.cjs` — all `cmdInit*` functions return `.planning/` relative paths as strings (HIGH confidence)
- Direct analysis of `bin/lib/milestone.cjs` — `cmdMilestoneComplete` creates `milestones/` dir, archives phases to `milestones/v1.0-phases/` (HIGH confidence)
- Direct analysis of `workflows/new-milestone.md` — research, requirements, roadmap flow; all paths resolved through init (HIGH confidence)
- Direct analysis of `workflows/plan-phase.md` — `--cwd`, `--milestone` patterns; paths from init JSON (HIGH confidence)
- Direct analysis of `.planning/config.json` — project-scoped, not milestone-scoped (HIGH confidence)
- Direct analysis of `.planning/milestones/` directory — existing `v1.0-phases/`, `v1.1-phases/` archive structure (HIGH confidence)
- Direct analysis of `.planning/PROJECT.md` — v2.0 target features, constraints, compatibility requirement (HIGH confidence)

---

*Architecture research for: GSD v2.0 concurrent milestone integration*
*Researched: 2026-02-24*
