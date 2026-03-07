# Feature Research

**Domain:** Adaptive learning integration for CLI-based AI development framework
**Researched:** 2026-03-07
**Confidence:** HIGH (based on existing implementations in both repos, not speculation)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that make the integration feel like a real merge, not a bolted-on layer. Without these, users would ask "why did you merge them if I still need two installs?"

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single installer** | Two-package install dance is the #1 UX pain point. Users expect `npx get-shit-done-cc --global --claude` to install everything. | MEDIUM | Extend `bin/install.js` to handle skills/, hooks/, teams/ directories. Manifest-driven from skill-creator's `manifest.json` pattern. |
| **Skills ship with GSD** | 16 skills exist and work. Users who had skill-creator expect them to survive the merge. New users expect them out of the box. | LOW | Copy `project-claude/skills/` into gsdup repo. Installer copies to `.claude/skills/`. Auto-activation via Claude Code's native `skills/*/SKILL.md` convention. |
| **Config merge** | Separate `skill-creator.json` is confusing. One project, one config. | LOW | Add `adaptive` section to existing `config.json`. Map: `auto_load_skills`, `observe_sessions`, `phase_transition_hooks`, `token_budget`, `observation.retention_days`, `suggestions.min_occurrences`. |
| **Agent extensions inline** | Fragment injection via markers is fragile. Skill content belongs in the agent files natively. | LOW | Merge `gsd-executor--injected-skills.md` (17 lines) and `gsd-planner--capability-inheritance.md` content directly into `agents/gsd-executor.md` and `agents/gsd-planner.md`. Delete extension system entirely. |
| **Session hooks merged** | Session continuity (snapshot, save/restore work state) already works. Users expect it to keep working. | LOW | Move 7 hook scripts into gsdup's `hooks/` directory. Merge `settings.json` hook registrations into GSD's settings template. |
| **Teams as first-class feature** | 4 team configs exist and are functional. Teams are a Claude Code native feature. | LOW | Copy `teams/` directory into gsdup. Installer handles `.claude/teams/` install. No code changes needed -- teams are pure config (JSON). |
| **Kill wrapper commands** | `/wrap:execute` existing as a separate layer from `/gsd:execute-phase` is confusing. Users expect one command, not two that do almost the same thing. | HIGH | This is the hardest feature. Wrapper logic (skill loading, observation capture, monitoring scan) must be absorbed into the 7 GSD workflow `.md` files. See "Native Observation" below. |

### Differentiators (Competitive Advantage)

Features that make GSD + adaptive learning greater than the sum of parts.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Native observation in workflows** | Every `/gsd:plan-phase`, `/gsd:execute-phase`, `/gsd:verify-work` captures observations without wrappers. Learning happens as a side effect of normal work, not as a separate step. | HIGH | Add observation capture steps to all 7 workflow `.md` files: `execute-phase`, `execute-plan`, `plan-phase`, `verify-phase`, `discuss-phase`, `quick`, `diagnose-issues`. Each workflow appends to `sessions.jsonl` after completion. Must be non-blocking (graceful degradation on failure). |
| **`/gsd:suggest` command** | Surface accumulated patterns as actionable skill proposals. Interactive accept/dismiss/defer loop. Closes the learning loop: observe -> detect -> suggest -> create skill. | MEDIUM | Port `/sc:suggest` logic. Reads `suggestions.json`, filters pending, presents one-at-a-time. Requires observation data to exist first. |
| **`/gsd:digest` command** | Analytics dashboard from session data: commit type distribution, correction rates, phase activity, file hotspots, plan-vs-summary diffs. Turns raw JSONL into insights. | MEDIUM | Port `/sc:digest` logic. Pure read-only analysis of `sessions.jsonl`. Visual bar charts, tables, recommendations engine. |
| **Skill loading in agent context** | Subagents (executor, planner, verifier) automatically receive phase-relevant skills in their context. Learned knowledge persists across the fresh-context boundary. | MEDIUM | Currently done by wrappers reading `ROADMAP.md` for phase domain keywords, matching against skill descriptions, and injecting skill content. In native version, the workflow `.md` file instructs the orchestrator to include matched skills when spawning subagents. |
| **Session start briefing** | `/gsd:start` (renamed from `/sc:start`) gives immediate context: GSD position, pending suggestions, skill budget, work state restoration. Reduces "where was I?" overhead. | LOW | Port `/sc:start`. Reads STATE.md, suggestions.json, budget-history.jsonl. Displays structured briefing. |
| **Bounded learning guardrails** | Max 20% content change per skill refinement, min 3 corrections before proposal, 7-day cooldown, user confirmation required. Prevents runaway self-modification. | LOW | Already codified in `skill-integration` skill's `references/bounded-guardrails.md`. Ships as documentation/skill content. No runtime enforcement code needed -- the skill instructs Claude to follow the rules. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Plugin system for extensions** | "Make GSD extensible so anyone can add features" (Option C from handoff) | Exponential complexity. GSD is a Markdown-specification framework, not a runtime with extension points. Plugin lifecycle, versioning, conflict resolution -- all for a tool used by individuals, not teams. | Ship features natively. Users can add skills (just drop a `SKILL.md`) and teams (just drop a `config.json`). The file system IS the plugin system. |
| **Auto-apply skill suggestions** | "If the pattern is clear enough, just create the skill" | Core safety violation. Self-modifying systems that modify themselves without human approval are dangerous. Every suggestion must have explicit user confirmation (bounded-guardrails constraint). | Interactive `/gsd:suggest` with accept/dismiss/defer. Surface suggestions prominently but never auto-apply. |
| **Real-time observation (every tool call)** | "Capture every Read, Write, Bash call for maximum learning signal" | Context budget destruction. Observation at tool-call granularity would consume the context window logging instead of coding. Also, Claude Code hooks fire on every tool call -- the overhead would be massive. | Observation at workflow-completion granularity. Capture outcomes (commits, files changed, phase status), not individual tool calls. Git history is the source of truth for what happened. |
| **Separate `/wrap:*` command namespace** | "Keep wrappers as an opt-in layer" | Two command sets for the same actions is confusing. Users ask "do I use `/wrap:execute` or `/gsd:execute-phase`?" The whole point of the merge is one tool. | Native observation in GSD workflows. Config toggle (`adaptive.observe_sessions: false`) disables observation for users who want vanilla behavior. |
| **Skill marketplace / sharing** | "Share skills between projects or users" | Skills are project-specific learned patterns. A "TypeScript patterns" skill for project A is wrong for project B. Sharing creates false confidence. | Ship good defaults (the 16 built-in skills). Users can manually copy skills between projects if they choose. |
| **Persistent daemon for observation** | "Background process watching file changes" | Stale processes, port conflicts, resource consumption when idle. Claude Code sessions are ephemeral. | Session hooks (SessionStart/SessionEnd) for lifecycle. Git hooks (post-commit) for commit-time capture. Both are event-driven, not polling. |

## Feature Dependencies

```
[Single Installer]
    requires nothing (extend existing bin/install.js)

[Config Merge]
    requires nothing (extend existing config.json schema)

[Skills Ship with GSD]
    requires [Single Installer] (installer must know about skills/)
    requires [Config Merge] (adaptive.auto_load_skills toggle)

[Agent Extensions Inline]
    requires nothing (one-time content merge into agent .md files)

[Session Hooks Merged]
    requires [Single Installer] (installer must handle hooks/)
    requires [Config Merge] (adaptive.observe_sessions toggle)

[Teams as First-Class]
    requires [Single Installer] (installer must handle teams/)

[Native Observation in Workflows]
    requires [Config Merge] (reads adaptive section for toggles)
    requires [Session Hooks Merged] (save/restore state hooks must work)
    requires [Agent Extensions Inline] (agents must have skill protocol)
    requires [Skills Ship with GSD] (observation references skill loading)

[/gsd:suggest Command]
    requires [Native Observation in Workflows] (needs sessions.jsonl data)

[/gsd:digest Command]
    requires [Native Observation in Workflows] (needs sessions.jsonl data)

[Session Start Briefing]
    requires [Config Merge] (reads adaptive config)
    requires [Skills Ship with GSD] (reports skill budget)

[Skill Loading in Agent Context]
    requires [Agent Extensions Inline] (agents must understand injected skills)
    requires [Skills Ship with GSD] (skills must exist to be loaded)
    requires [Native Observation in Workflows] (orchestrator does the loading)
```

### Dependency Notes

- **Native Observation requires 4 predecessors:** This is the most complex feature and the last to integrate. It touches all 7 workflow files and depends on config, hooks, agents, and skills all being in place first.
- **Suggest and Digest require observation data:** These commands are useless without `sessions.jsonl` populated by native observation. Build them after observation works.
- **Installer is the foundation:** Everything else depends on files being in the right place. Installer goes first.
- **Config merge is low-risk, high-value:** Unblocks every feature that reads config. Do it early alongside the installer.

## MVP Definition

### Launch With (v4.0 Core)

- [x] **Single installer handles everything** -- skills, hooks, teams, agents, commands all installed by `npx get-shit-done-cc`
- [x] **Config merge** -- `adaptive` section in `config.json`, no separate `skill-creator.json`
- [x] **Skills ship with GSD** -- 16 skills installed to `.claude/skills/`
- [x] **Agent extensions inline** -- skill protocol merged into agent `.md` files
- [x] **Session hooks merged** -- all 7 hooks in GSD's `hooks/` directory
- [x] **Teams as first-class** -- 4 team configs in GSD's install set
- [x] **Native observation in workflows** -- observation capture in all 7 GSD workflow files
- [x] **Kill wrapper commands** -- `/wrap:*` namespace eliminated entirely

### Add After Validation (v4.x)

- [ ] **`/gsd:suggest`** -- requires observation data to accumulate first; add once users have sessions.jsonl
- [ ] **`/gsd:digest`** -- analytics from accumulated data; add alongside suggest
- [ ] **`/gsd:start` session briefing** -- nice-to-have, not blocking core workflow
- [ ] **CLAUDE.md template + merge strategy** -- installer currently overwrites CLAUDE.md; needs careful merge logic for existing projects
- [ ] **Deprecation notices for gsd-skill-creator** -- thin re-export package pointing to get-shit-done-cc

### Future Consideration (v5+)

- [ ] **Pattern detection pipeline** -- automated detection of recurring patterns from sessions.jsonl (currently manual via `/sc:observe`)
- [ ] **Skill refinement automation** -- bounded auto-refinement of existing skills based on observation data
- [ ] **Cross-project skill inheritance** -- global skills that apply to all projects (currently project-scoped only)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Single installer | HIGH | MEDIUM | P1 |
| Config merge | HIGH | LOW | P1 |
| Skills ship with GSD | HIGH | LOW | P1 |
| Agent extensions inline | HIGH | LOW | P1 |
| Session hooks merged | HIGH | LOW | P1 |
| Teams as first-class | MEDIUM | LOW | P1 |
| Native observation in workflows | HIGH | HIGH | P1 |
| Kill wrapper commands | HIGH | HIGH | P1 |
| `/gsd:suggest` command | MEDIUM | MEDIUM | P2 |
| `/gsd:digest` command | MEDIUM | MEDIUM | P2 |
| Session start briefing | MEDIUM | LOW | P2 |
| CLAUDE.md merge strategy | MEDIUM | MEDIUM | P2 |
| Deprecate gsd-skill-creator | LOW | LOW | P2 |
| Pattern detection pipeline | MEDIUM | HIGH | P3 |
| Skill refinement automation | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v4.0 launch (the merge is incomplete without these)
- P2: Should have, add in v4.x patches
- P3: Future consideration, requires v4.0 to stabilize first

## Feature Categories (by Integration Domain)

### Category 1: Observation
**Files affected:** 7 workflow `.md` files, `sessions.jsonl` schema
**What it does:** Captures workflow outcomes (commits, files changed, phase status, skills loaded) as JSONL entries after each GSD command completes
**Key constraint:** Non-blocking. Observation failure must never prevent the GSD command from completing. `integration.observe_sessions: false` disables entirely.
**Complexity:** HIGH -- touches every workflow file, requires graceful degradation in each

### Category 2: Skills
**Files affected:** `skills/` directory (16 skills), agent `.md` files (3), installer
**What it does:** Auto-activating knowledge files that augment Claude's behavior based on project context. Phase-relevant skills loaded before execution.
**Key constraint:** Token budget (2-5% of context window max). Skills must not bloat the context.
**Complexity:** LOW for shipping, MEDIUM for phase-relevant loading logic in workflows

### Category 3: Hooks
**Files affected:** `hooks/` directory (7 hook scripts), `settings.json` template
**What it does:** Session lifecycle management (snapshot on end, restore state on start), commit validation, phase boundary detection
**Key constraint:** Hooks run on every session start/end and every tool use. Must be fast (<1s each).
**Complexity:** LOW -- files already exist and work, just moving them

### Category 4: Teams
**Files affected:** `teams/` directory (4 team configs)
**What it does:** Multi-agent team configurations for debugging, research, code review, doc generation
**Key constraint:** Teams are a Claude Code native feature. Config is pure JSON, no code.
**Complexity:** LOW -- copy files, update installer

### Category 5: Installer
**Files affected:** `bin/install.js`, potentially `manifest.json` or equivalent
**What it does:** Single `npx` command installs all GSD + adaptive learning files to `~/.claude/`
**Key constraint:** Must handle upgrades (existing files), multi-runtime support (Claude, Opencode, Gemini, Codex), and CLAUDE.md carefully (don't clobber user edits)
**Complexity:** MEDIUM -- extending existing installer with new file categories

## Competitor Feature Analysis

| Feature | Claude Code Native | Cursor Rules | Windsurf | GSD + Adaptive |
|---------|-------------------|--------------|----------|----------------|
| Auto-loading knowledge files | `.claude/skills/*/SKILL.md` (built-in) | `.cursor/rules/*.mdc` | `.windsurfrules` | Skills system built on Claude Code's native convention |
| Session observation | None | None | None | JSONL-based observation with git history reconstruction |
| Pattern suggestions | None | None | None | Suggestion pipeline from observation data |
| Multi-agent teams | `.claude/teams/` (built-in) | Not supported | Not supported | Team configs shipping as first-class feature |
| Workflow lifecycle | None (raw prompting) | None | None | Full project -> milestone -> phase -> plan lifecycle |
| Session continuity | None (fresh context each session) | None | None | Snapshot/restore hooks bridge session boundary |

**Key insight:** No competitor has observation or adaptive learning. Skills and teams leverage Claude Code's native conventions. The differentiator is the feedback loop: observe -> detect -> suggest -> learn.

## Sources

- `~/gsd-skill-creator/INTEGRATION-HANDOFF.md` -- Integration strategy and overlap analysis (HIGH confidence, primary source document)
- `~/gsd-skill-creator/project-claude/manifest.json` -- Complete file inventory (HIGH confidence, machine-readable source of truth)
- `~/gsd-skill-creator/project-claude/commands/wrap/execute.md` -- Wrapper command implementation (HIGH confidence, actual working code)
- `~/gsd-skill-creator/project-claude/commands/sc/observe.md` -- Observation capture implementation (HIGH confidence)
- `~/gsd-skill-creator/project-claude/commands/sc/suggest.md` -- Suggestion review implementation (HIGH confidence)
- `~/gsd-skill-creator/project-claude/commands/sc/digest.md` -- Learning digest implementation (HIGH confidence)
- `~/gsd-skill-creator/project-claude/skills/skill-integration/SKILL.md` -- Integration protocol and guardrails (HIGH confidence)
- `~/gsd-skill-creator/project-claude/extensions/gsd-executor--injected-skills.md` -- Agent extension pattern (HIGH confidence)
- `~/gsd-skill-creator/project-claude/teams/gsd-debug-team/config.json` -- Team config structure (HIGH confidence)
- `~/Projects/gsdup/get-shit-done/workflows/execute-phase.md` -- Current GSD workflow structure (HIGH confidence)
- `~/Projects/gsdup/.planning/PROJECT.md` -- Project context and v4.0 target features (HIGH confidence)

---
*Feature research for: GSD v4.0 Adaptive Learning Integration*
*Researched: 2026-03-07*
