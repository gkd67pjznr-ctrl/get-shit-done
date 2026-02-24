# Feature Research

**Domain:** AI Coding Agent Framework — Concurrent Milestone Execution (GSD v2.0)
**Researched:** 2026-02-24
**Confidence:** HIGH (official Claude Code docs read directly; git worktree docs confirmed; agent teams docs read directly; monorepo patterns corroborated by multiple sources)

---

## Context: What GSD Already Has (Baseline for This Milestone)

Before mapping the feature landscape, understand what already exists so nothing in this milestone
duplicates completed work. All features in this milestone must be additive.

| Existing Feature | Where | Concurrency Relevance |
|-----------------|-------|----------------------|
| Sequential milestone execution | All workflows | The fundamental constraint being removed. One milestone runs at a time in the root `.planning/` folder. |
| Global phase numbering | phase.cjs, all workflows | Phases numbered globally (phase-01 through phase-67+). Concurrent milestones require per-milestone numbering. |
| `.planning/` root layout | File system | ROADMAP.md, STATE.md, REQUIREMENTS.md, research/, phases/ all at root. Must coexist with new per-milestone folders. |
| `complete-milestone` archival | gsd-tools.cjs | Archives to `.planning/completed-milestones/vX.Y/`. Needs updating for per-milestone workspace structure. |
| gsd-tools.cjs commands | Node.js CJS | `init`, `commit`, `config-set`, `phase-complete`, etc. All assume single-milestone context. |
| GSD routing workflows | execute-plan.md, etc. | All route using global phase numbers and root `.planning/` paths. |
| Quality enforcement system | v1.0/v1.1 | Independent of concurrency — carries forward unchanged to concurrent milestones. |
| `/gsd:progress`, `/gsd:set-quality`, `/gsd:help` | slash commands | Progress must be updated to show all concurrent milestones. set-quality stays unchanged. |

**The gap:** GSD assumes exactly one milestone is active at any time. All state files, phase numbering, routing logic, and commands are designed for single-milestone sequential execution. Users who want to work on feature B while feature A is still in progress have no mechanism for it — they must wait, creating bottlenecks on multi-track projects.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that concurrent milestone execution must have. Missing any of these means "this isn't
really concurrent execution — it's just a workaround."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Milestone-scoped workspace isolation | Users expect concurrent milestones to not collide on the same files. Every concurrent execution system (CI/CD parallel jobs, git worktrees, Verdent 1.5, monorepo task runners) isolates workspaces by default. Without this, two Claude sessions editing `STATE.md` simultaneously corrupt each other's state. | MEDIUM | Each milestone gets its own folder under `.planning/milestones/v{version}/`. Root `.planning/` files become global-only (MILESTONES.md, PROJECT.md, config.json). Milestone-owned files (ROADMAP.md, STATE.md, REQUIREMENTS.md, phases/) move inside the milestone folder. |
| Central milestone status dashboard | Users running concurrent milestones need to see all of them at a glance. CI/CD pipelines all have a dashboard view. GitHub Actions, Turborepo, and Nx all surface parallel job status in one place. `/gsd:progress` must aggregate across active milestones, not just show the "current" one. | MEDIUM | Implemented as a lock-free read-only pattern: each milestone writes its own `STATUS.md` inside its workspace folder. Dashboard reads all STATUS.md files and renders a summary. No file locking needed — dashboard is read-only, each milestone owns its own STATUS.md exclusively. |
| Milestone-scoped phase numbering | When two milestones run concurrently, their phases cannot share a global sequence. v1.2's phase-01 and v1.3's phase-01 must coexist without collision. This is expected by analogy to any parallel execution system — GitHub Actions jobs each have their own step numbering. | MEDIUM | Phase numbering scoped to milestone: `v1.2/phase-01`, `v1.3/phase-01`. The `phase-complete` command, ROADMAP.md references, and routing logic all switch from global sequential numbers to `{milestone}/{phase}` identifiers. Existing projects with global phase numbers remain valid — compatibility layer handles them. |
| Conflict manifest (file ownership declaration) | Users expect a mechanism to prevent two milestones from touching the same source files uncoordinated. Monorepo tools (Turborepo `--affected`, Nx project graph) provide dependency and ownership information as table stakes. Without conflict detection, concurrent milestones silently create merge conflicts that surface only at commit time — too late. | HIGH | Each milestone declares `files_touched` in its REQUIREMENTS.md or a dedicated `MANIFEST.md`. When a new milestone is initialized, GSD checks for overlap with active milestones and warns. This is NOT automatic locking (lock-free design) — it's declarative coordination. The user decides how to resolve; GSD surfaces the conflict. |
| Compatibility layer for existing projects | Users with existing GSD projects (root-level `.planning/` layout, global phase numbers) expect the upgrade to not break them. Every successful version transition in developer tooling (Nx 16→17, Turborepo 1.x→2.x, Node.js LTS upgrades) provides a compatibility layer that auto-detects old structure and continues to work. | MEDIUM | Auto-detection: if `.planning/ROADMAP.md` exists at root but `.planning/milestones/` does not, GSD treats the project as old-style and uses root-level layout. If `.planning/milestones/` exists, GSD uses the new per-milestone layout. No migration step required — both coexist. Existing projects opt in by creating their first milestone folder. |
| Updated GSD routing for concurrent model | Workflows, commands, and tools that route phase operations (plan-phase, execute-phase, phase-complete) must correctly resolve the active milestone context. Users expect routing to "just work" in both old-style and new-style layouts. If routing breaks, the entire framework stalls. | HIGH | Every routing function checks: is this old-style (root `.planning/ROADMAP.md` exists, no `milestones/` dir) or new-style (milestone folder exists)? Route accordingly. The `gsd-tools.cjs` commands receive a `--milestone` flag or infer the active milestone from the current working context. |

### Differentiators (Competitive Advantage)

Features that distinguish GSD's concurrent execution from ad-hoc "just open two Claude windows."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Lock-free dashboard pattern | Other tools use file locks or database state for concurrent status — fragile under network filesystem or process kill. GSD's lock-free pattern (each milestone owns its own STATUS.md, dashboard is read-only aggregator) is both simpler and more resilient. A killed Claude session cannot corrupt the dashboard by holding a stale lock. | LOW | Each milestone workspace contains `STATUS.md` with: milestone name, current phase, last activity timestamp, active plan name, and a one-line progress summary. Dashboard script reads all `STATUS.md` files in `milestones/*/STATUS.md`. Zero race conditions — each file has exactly one writer (the milestone's Claude session). |
| Conflict manifest with overlap detection at init time | Detecting conflicts at milestone initialization (not at execution time) is the differentiator. Monorepo tools detect affected packages at build time (after changes exist). GSD can detect potential conflicts before any code is written — at the `/gsd:new-milestone` step when the manifest is declared. This means "these two milestones will conflict" is surfaced before either starts, not after hours of work. | MEDIUM | `MANIFEST.md` contains `files_touched: [list of source files this milestone will modify]`. `gsd-tools.cjs manifest-check` reads all active milestone manifests and reports overlaps. Called automatically during `/gsd:new-milestone` flow. Reports: "WARNING: v2.0 and v2.1 both declare src/lib/router.js — coordinate before executing concurrently." |
| Agent Teams integration research | Claude Code Agent Teams (experimental, enabled via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) provide a natural mechanism for milestone coordination: each milestone could be a teammate in an Agent Team, with a lead coordinating conflict resolution and status. This is a higher-order integration that GSD is positioned to exploit because it already uses the Claude Code agentic architecture. | HIGH | Research verdict: Agent Teams are best suited for intra-milestone parallelism (parallel phases within one milestone) rather than inter-milestone coordination. Agent Teams use a shared task list in `~/.claude/tasks/{team-name}/` and require active session coordination. GSD's concurrent milestones model (separate Claude Code sessions, possibly days apart) is better served by the file-based coordination model. Agent Teams should be documented as an option for "parallel phases" use case, not the primary coordination mechanism for concurrent milestones. |
| Per-milestone quality config inheritance | When a new concurrent milestone is initialized, it inherits the project's global quality config but can override per-milestone. This means a hotfix milestone can run at `quality.level: fast` while a feature milestone runs at `quality.level: strict` — simultaneously. | LOW | Milestone `config.json` in the milestone folder overrides the root `config.json` for that milestone's sessions. Existing quality config inheritance chain: global `~/.gsd/defaults.json` → root `.planning/config.json` → milestone `.planning/milestones/vX.Y/config.json`. |
| Graceful degrade to sequential for single-milestone projects | Projects that only ever have one active milestone should experience zero difference from v1.x behavior. The concurrent model should not add visible overhead for the common case. | LOW | Detection: if exactly one milestone folder exists (or old-style root layout), GSD skips all concurrent-coordination logic. Dashboard shows only one milestone. Manifest check is a no-op. STATUS.md is written but `/gsd:progress` just shows it inline (no aggregation needed). |

### Anti-Features (Things to Deliberately NOT Build)

Features that seem like natural additions but break GSD's fundamental design principles or create more
problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| File locking for concurrent writes | "Two Claude sessions editing the same file will corrupt it" sounds like it needs a lock. | File locking on a local filesystem breaks silently when processes are killed. Stale locks block all sessions indefinitely. Claude sessions can be interrupted at any time (user kills terminal, context limit hit, rate limit pause). A stale lock with no recovery mechanism is worse than no lock. Claude Code + git worktrees already provides isolation at the OS level — separate working directories mean no concurrent write collisions on workspace files. | Workspace isolation (separate milestone folders) eliminates write collisions on state files. Conflict manifest (declarative ownership) surfaces source file conflicts before execution. No lock needed. |
| Automatic conflict resolution | "GSD should merge the conflicting changes automatically when two milestones touch the same file" seems like a nice feature. | Automatic merge of concurrent code changes requires semantic understanding of what the changes do and whether they're compatible. Git's textual merge can produce syntactically valid but semantically broken code. Claude Code cannot evaluate whether two concurrent milestones' changes to `router.js` are compatible without reading both changes and understanding the intent of each. Silently wrong > detectably wrong. | Surface the conflict clearly (manifest overlap warning + clear diff at commit time). Leave resolution to the human. Provide tooling to inspect what each milestone changed (`manifest-diff` command), not to merge it automatically. |
| Centralized lock file for "active milestone" | "Track which milestone is currently active in a central `active-milestone.json`" seems like an obvious coordination mechanism. | A centralized state file for "active" status in a concurrent system requires that all writers agree on when they've released the "active" status and all readers agree on when it's valid. Claude sessions can be interrupted, leaving the file pointing to a milestone that is no longer actually executing. This creates a "split-brain" where GSD thinks milestone A is active but the user is actually running milestone B. | Lock-free model: every milestone is potentially "active" at any time. Routing infers context from the milestone folder the user invokes commands from (or from an explicit `--milestone vX.Y` flag). No central "active" state. |
| Automatic milestone dependency ordering | "If milestone B depends on milestone A's changes, GSD should prevent B from starting until A is complete" seems like CI/CD-inspired orchestration. | Milestone dependencies in GSD span days or weeks of work, not minutes. The value of concurrent execution is precisely that loosely-coupled milestones can proceed in parallel without waiting. Adding mandatory dependency gates reintroduces the sequential bottleneck that concurrent execution is meant to remove. Tight dependencies (B requires A's shipped code) indicate the milestones should be sequential anyway. | Conflict manifest surfaces file-level overlap (a proxy for dependency). If user declares B depends on A in REQUIREMENTS.md, that's documentation — not an enforced gate. Sequential execution remains the right model for tightly-coupled milestones. |
| Multi-session real-time status sync | "Claude sessions should broadcast status updates to each other in real-time as they execute" sounds like agent team coordination. | This requires a running coordination process (or polling loop) separate from the executing Claude sessions. Claude Code sessions are not long-running server processes — they execute and terminate. Inter-session real-time sync via IPC or websockets would require an always-on daemon that GSD has no infrastructure for. | File-based STATUS.md polling is the right model: each session writes its status at natural checkpoints (plan start, task complete, phase complete). Dashboard reads STATUS.md files on-demand. Eventual consistency (seconds-stale status) is fine for milestones that take hours to days. |
| Rewriting milestone/phase lifecycle | "Concurrent milestones need a new lifecycle model" sounds reasonable. | GSD's project → milestone → phase → plan → execute → verify lifecycle works. Concurrency is a property of the execution context (multiple sessions running separate milestones), not of the lifecycle itself. Rewriting the lifecycle would break existing users and introduce novel failure modes. PROJECT.md is explicit: "Out of scope: changing the core workflow lifecycle." | Add concurrency support as an orthogonal dimension: the lifecycle stays the same, but the workspace folder and phase numbering become milestone-scoped. Routing functions add a "which milestone am I in?" resolution step, but the lifecycle steps themselves are unchanged. |
| Nested concurrent milestones (milestones within milestones) | "A milestone could spawn sub-milestones for parallel sub-features" extends the concurrent model further. | Claude Code Agent Teams documentation explicitly states "No nested teams: teammates cannot spawn their own teams." The same constraint applies here — nested concurrency creates coordination complexity that grows exponentially (who resolves conflicts between sub-milestones? what happens if a parent milestone is cancelled?). | For intra-milestone parallelism, use Agent Teams (research finding: best fit for parallel phases within one milestone). For inter-milestone parallelism, use the concurrent milestone model. No nesting. |

---

## Feature Dependencies

```
[Milestone-scoped workspace isolation]
    └──required by──> [Milestone-scoped phase numbering]
         (phase numbers are inside the workspace, can't scope them without isolated folders)
    └──required by──> [Lock-free dashboard pattern]
         (dashboard reads per-milestone STATUS.md files; without isolation, there's nothing to aggregate)
    └──required by──> [Updated GSD routing]
         (routing must resolve milestone folder path; requires the folder to exist and be scoped)
    └──required by──> [Per-milestone quality config inheritance]
         (milestone config.json lives inside the milestone workspace folder)

[Compatibility layer for existing projects]
    └──required by──> [Updated GSD routing]
         (routing must handle both old-style root layout AND new-style milestone folders)
    └──gates──> [All other new features]
         (new features apply only to new-style milestone layout; old-style uses legacy routing)

[Conflict manifest (file ownership declaration)]
    └──requires──> [Milestone-scoped workspace isolation]
         (manifests live in milestone workspace folders; requires workspace isolation first)
    └──enhances──> [Lock-free dashboard pattern]
         (dashboard can show conflict warnings alongside status for overlapping milestones)
    └──informs──> [Updated GSD routing]
         (routing commands can check manifest before allowing execution in conflicted milestones)

[Lock-free dashboard pattern]
    └──requires──> [Milestone-scoped workspace isolation]
         (must have per-milestone STATUS.md files to aggregate)
    └──enhances──> [/gsd:progress command]
         (progress command becomes a dashboard renderer, not a single-milestone status report)

[Agent Teams integration research]
    └──informs──> [Lock-free dashboard pattern]
         (Agent Teams show that shared task lists are coordination overkill for milestone-level parallelism)
    └──informs──> [Conflict manifest]
         (Agent Teams' file-locking for task claiming establishes the reference pattern for ownership declaration)
    └──independent of──> [All structural features]
         (Agent Teams integration, if pursued, is a separate optional capability layer on top)

[Per-milestone quality config inheritance]
    └──requires──> [Milestone-scoped workspace isolation]
         (milestone config.json lives in the milestone workspace)
    └──requires──> [Existing quality config system (v1.0/v1.1)]
         (already built — this feature extends the inheritance chain, not replaces it)

[Updated GSD routing]
    └──requires──> [Milestone-scoped workspace isolation]
    └──requires──> [Compatibility layer for existing projects]
    └──required by──> [Test coverage for new routing and isolation logic]
         (tests verify routing resolution logic for both layout styles)
```

### Dependency Notes

- **Workspace isolation is the root dependency:** Everything else (dashboard, phase numbering, routing, config inheritance, manifest) requires workspace isolation to exist first. Implement workspace isolation in Phase 1.

- **Compatibility layer gates adoption:** Without the compatibility layer, existing GSD users (v1.0/v1.1 projects) cannot upgrade without a manual migration. Compatibility layer must be part of Phase 1 alongside workspace isolation.

- **Routing is the most load-bearing change:** Every workflow, command, and tool touches routing. Routing must resolve the correct milestone context or the entire framework produces wrong outputs. Updated routing with both old-style and new-style support is the critical path for all user-facing behavior.

- **Conflict manifest is independent of execution correctness:** If the manifest is missing, GSD still works — milestones run without conflict detection. Manifest is a safety feature, not a structural one. Can be implemented after the structural features (isolation, numbering, routing, compatibility) are complete and stable.

- **Agent Teams are research-resolved:** Research confirms Agent Teams are not the right coordination mechanism for concurrent milestones (different use case: intra-session vs inter-session parallelism). Document as "use Agent Teams for parallel phases, file-based coordination for concurrent milestones." No code integration needed for the v2.0 milestone.

- **Test coverage depends on routing:** Tests for new routing and isolation logic can only be written after the routing logic is implemented. Test phase is last.

---

## MVP Definition

### Launch With (v2.0 — This Milestone)

Minimum viable concurrent execution — what's needed to validate that two milestones can actually run
without corrupting each other.

- [ ] **Milestone-scoped workspace isolation** — Per-milestone folder at `.planning/milestones/vX.Y/` containing ROADMAP.md, STATE.md, REQUIREMENTS.md, and phases/. Root `.planning/` retains only global files (PROJECT.md, MILESTONES.md, config.json, research/). Without this, nothing else is possible. Depends on: nothing (pure structural addition).

- [ ] **Compatibility layer (old-style auto-detection)** — Auto-detect root-level `.planning/ROADMAP.md` as old-style layout; route using legacy logic. Auto-detect `.planning/milestones/` as new-style layout; route using milestone-scoped logic. Existing projects work unchanged. Depends on: workspace isolation (new-style detection requires the milestone folder to exist).

- [ ] **Milestone-scoped phase numbering** — Phase references become `{milestone}/{phase}` (e.g., `v1.2/phase-01`) in ROADMAP.md, commands, and routing. The `phase-complete` command accepts `--milestone` flag. Depends on: workspace isolation (phases live inside milestone folder).

- [ ] **Updated GSD routing** — All workflows (plan-phase, execute-phase, discuss-phase), all commands (phase-complete, commit), and all agents that reference phase paths updated to resolve milestone-scoped paths. Detect old-style vs new-style and route accordingly. Depends on: workspace isolation, compatibility layer.

- [ ] **Lock-free dashboard** — Each milestone writes `STATUS.md` in its workspace folder at natural checkpoints (plan start, plan complete, phase complete). `/gsd:progress` reads all `STATUS.md` files and renders a multi-milestone summary table. Old-style projects continue to show single-milestone progress. Depends on: workspace isolation, updated routing.

- [ ] **Conflict manifest** — `MANIFEST.md` in each milestone workspace declares `files_touched: []`. `gsd-tools.cjs manifest-check` detects overlaps across active milestones. Called automatically during `/gsd:new-milestone` flow. Does NOT block execution — reports warnings only. Depends on: workspace isolation.

- [ ] **Test coverage for new routing and isolation logic** — Tests verify: old-style layout routed correctly, new-style layout routed correctly, milestone-scoped phase numbers resolve correctly, manifest overlap detection fires, compatibility layer does not break existing behavior. Depends on: all above features implemented.

### Add After Validation (v2.x)

Features to add once the concurrent model is validated in real projects.

- [ ] **Agent Teams integration for parallel phases** — Document and possibly provide a scaffold for using Claude Code Agent Teams within a single milestone to parallelize phases. Trigger: user reports that sequential phases within a milestone are a bottleneck. Evidence from research: Agent Teams are best for intra-milestone parallelism (parallel code review, competing hypotheses). The mechanism already exists; GSD would provide a workflow scaffold, not new infrastructure.

- [ ] **Conflict manifest enforcement (optional gate)** — Add an opt-in mode where overlapping manifest conflicts block milestone execution (not just warn). Trigger: user requests hard enforcement after experiencing a merge conflict from concurrent milestones. Keep as opt-in — default is warn-only (additive principle).

- [ ] **Dashboard live refresh** — `/gsd:progress --watch` polls `STATUS.md` files and refreshes the display. Trigger: user runs two milestones simultaneously and wants real-time status without re-running the command. Implementation: standard polling loop with configurable interval.

### Future Consideration (v2.x+)

Features that require significantly more design work or external dependencies.

- [ ] **Cross-milestone dependency tracking** — Milestone A can declare a dependency on milestone B's completion. GSD warns if A's execution would be blocked. Complexity: requires a dependency graph data structure and a way to express "milestone A ships before milestone B can start." Trigger: product-market fit confirmed, users request formalized dependency management.

- [ ] **Milestone workspace git worktree integration** — Each milestone could automatically create a git worktree (`claude --worktree`) for true OS-level file isolation on source files (not just .planning/ state files). Complexity: requires knowledge of whether the project uses git; must not interfere with the project's own git workflow. Trigger: users report source file conflicts (manifest check wasn't enough) and request stronger isolation.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Milestone-scoped workspace isolation | HIGH — without it, concurrent execution is impossible | MEDIUM — folder structure change + path updates | P1 |
| Compatibility layer (old-style auto-detection) | HIGH — zero-breakage upgrade is table stakes | MEDIUM — detection logic + routing fork | P1 |
| Updated GSD routing | HIGH — broken routing = broken framework | HIGH — touches all workflows, commands, agents | P1 |
| Milestone-scoped phase numbering | HIGH — phases must be addressable per-milestone | MEDIUM — numbering scheme + command updates | P1 |
| Lock-free dashboard | MEDIUM — status visibility improves UX, not correctness | LOW — read-only STATUS.md aggregation | P2 |
| Conflict manifest | MEDIUM — prevents user mistakes, not framework failures | MEDIUM — manifest format + overlap detection | P2 |
| Test coverage | HIGH — unverified routing = latent bugs | MEDIUM — test cases for both layout styles | P1 |
| Agent Teams research documentation | LOW — informational, no code | LOW — document findings, no implementation | P3 |

**Priority key:**
- P1: Must have for v2.0 to be a valid concurrent execution system
- P2: Should have, meaningfully improves safety and UX
- P3: Nice to have, informational value only

---

## Competitor / Reference System Analysis

How similar tools handle the same problems — patterns GSD should follow or learn from:

| Feature | Git Worktrees (Claude Code built-in) | Turborepo / Nx (monorepo) | GitHub Actions (parallel jobs) | Claude Agent Teams | GSD v2.0 Approach |
|---------|--------------------------------------|--------------------------|-------------------------------|-------------------|-------------------|
| Workspace isolation | Per-worktree directory at `.claude/worktrees/{name}/`; each has its own branch and files | Per-package directory; each package is isolated by default | Per-job environment; job runners are independent | Per-teammate context window; teammates don't share files | Per-milestone folder at `.planning/milestones/vX.Y/` |
| Conflict detection | None (relies on git branch divergence at merge time) | Project graph (`--affected`) detects which packages are impacted | `needs:` keyword for job dependencies; no file-level detection | File locking via task JSON for task claiming; no source file detection | Declarative manifest at milestone init time; overlap detection before execution starts |
| Status dashboard | None built-in (user checks each worktree manually) | `turbo run --dry` shows task graph; live output for parallel tasks | GitHub Actions UI shows all job statuses in parallel | Lead session shows teammate status in terminal; Shift+Down to cycle | Lock-free STATUS.md aggregation; `/gsd:progress` renders all milestone statuses |
| Compatibility | Old sessions use old branch; no auto-migration | Each version is independent; package.json manages transitions | Workflow files are versioned independently | N/A (experimental feature with no backwards compatibility concerns yet) | Auto-detect old-style root layout; route to legacy code path without migration |
| Phase/step numbering | Per-worktree (worktree name is the namespace) | Per-package task (package name + task name) | Per-job step (job name + step number) | Per-task in shared task list (task ID is unique across team) | Per-milestone phase (`vX.Y/phase-NN`) |
| Lock mechanism | OS-level file isolation (different directories) | No file locking (separate packages don't share files by design) | Job isolation (jobs run in separate environments) | JSON file locking for task claiming via file atomics | No file locking; workspace isolation + manifest declaration |

**Key lessons from reference systems:**

1. **Git worktrees (Claude Code's own pattern):** The `--worktree` flag creates isolated directories. GSD's milestone folder approach is the planning-layer equivalent — isolated state directories, not locked files. (Source: official Claude Code docs, HIGH confidence)

2. **Turborepo `--affected`:** Detects which packages changed and only runs affected tasks. GSD's conflict manifest is analogous — declare which files a milestone "affects" and detect overlap. Turborepo detects after changes exist; GSD detects before changes start. (Source: Turborepo 2.1 docs, MEDIUM confidence)

3. **Agent Teams task claiming:** Uses file-based locking (`~/.claude/tasks/{team-name}/`) to prevent two teammates from claiming the same task. GSD's manifest approach is softer (warn, not lock) which is intentional — milestone execution is asynchronous across days/sessions, not synchronous within a team session. (Source: official Claude Code Agent Teams docs, HIGH confidence)

4. **Agent Teams NOT the right model for inter-milestone coordination:** Agent Teams require all teammates to be active simultaneously in a shared session. GSD's concurrent milestones are independent Claude Code sessions that may run days apart. File-based coordination (STATUS.md, MANIFEST.md) is the correct pattern for asynchronous multi-session work. (Source: official Agent Teams docs + limitations section, HIGH confidence)

---

## Sources

- [Claude Code Docs — Orchestrate teams of Claude Code sessions](https://code.claude.com/docs/en/agent-teams) — HIGH confidence (official Anthropic docs; read directly; covers architecture, task list, file locking pattern, limitations)
- [Claude Code Docs — Run parallel Claude Code sessions with Git worktrees](https://code.claude.com/docs/en/common-workflows#run-parallel-claude-code-sessions-with-git-worktrees) — HIGH confidence (official Anthropic docs; `--worktree` flag; `.claude/worktrees/` path; subagent `isolation: worktree` frontmatter; read directly)
- [Claude Code Swarm Orchestration Skill gist (kieranklaassen)](https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea) — MEDIUM confidence (community pattern; corroborates agent teams task claiming and file-based coordination patterns)
- [Verdent 1.5.0 Blog — Workspace Isolation and Multi-Agent Execution](https://www.verdent.ai/blog/introducing-verdent-1-5-0) — MEDIUM confidence (comparable AI coding tool; confirms "changes for one task never silently leak into another" as user expectation; manual curation of merge-back is the pattern)
- [Turborepo Guide (Strapi)](https://strapi.io/blog/turborepo-guide) — MEDIUM confidence (describes `--affected` flag, parallel task execution, dependency graph; establishes monorepo patterns as reference)
- [Turborepo, Nx, and Lerna 2026 (DEV Community)](https://dev.to/dataformathub/turborepo-nx-and-lerna-the-truth-about-monorepo-tooling-in-2026-71) — MEDIUM confidence (ecosystem survey; confirms parallel execution and affected-file detection as standard patterns)
- [Claude Code Agent Teams Complete Guide (claudefa.st)](https://claudefa.st/blog/guide/agents/agent-teams) — MEDIUM confidence (community guide; corroborates official docs)
- [Superpowers Issue #469 — Leverage Agent Teams for parallel plan execution](https://github.com/obra/superpowers/issues/469) — LOW confidence (single GitHub issue; useful as evidence others are thinking about this space but not an authoritative source)
- Internal: `.planning/PROJECT.md` — HIGH confidence (direct read; defines v2.0 target features explicitly)
- Internal: `.planning/STATE.md` — HIGH confidence (direct read; current milestone state)
- Internal: `.planning/MILESTONES.md` — HIGH confidence (direct read; v1.0/v1.1 capabilities baseline)
- Internal: `.planning/research/ARCHITECTURE.md` — HIGH confidence (direct read; existing routing and layout patterns)

---

*Feature research for: GSD v2.0 Concurrent Milestones — concurrent execution, workspace isolation, conflict awareness*
*Researched: 2026-02-24*
