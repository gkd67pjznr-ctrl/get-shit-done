# Project Research Summary

**Project:** GSD v4.0 Adaptive Learning Integration
**Domain:** CLI framework integration (merging gsd-skill-creator into GSD core)
**Researched:** 2026-03-07
**Confidence:** HIGH

## Executive Summary

GSD v4.0 merges the standalone gsd-skill-creator package into GSD core, eliminating a two-package install dance and a fragile wrapper command layer. The integration is fundamentally a file-copy and content-merge operation: 16 skills, 4 teams, 7 hooks, and several new commands move into GSD's existing installer pipeline. No new runtime dependencies are required -- the entire integration uses Node.js built-ins (fs, path, crypto, os) and Markdown/JSON conventions already established in both packages. The recommended approach is to extend the existing `bin/install.js` installer with new copy targets (skills/, teams/) and merge hook registrations into a consolidated settings.json, following the patterns already proven in the agents/ and commands/ copy logic.

The primary risk is the wrapper command elimination. The skill-creator's wrapper commands (`/wrap:execute`, `/wrap:verify`, etc.) delegate to GSD commands with post-delegation observation steps, and 4 documented bugs trace directly to this indirection pattern. Claude treats delegation as a suggestion, not a subroutine call, causing it to skip post-delegation steps unpredictably. The fix is to bake observation capture directly into GSD's 7 workflow files as native steps -- no delegation, no wrappers. This is the highest-value and highest-complexity change in v4.0.

Secondary risks include CLAUDE.md overwrite (solved with marker-based merge), skills context budget bloat (solved with core/optional split -- only 4 universally-applicable skills auto-load by default), and settings.json hook registration collisions (solved with a single canonical hook list and normalized path comparison). All risks have clear prevention strategies documented in the research.

## Key Findings

### Recommended Stack

Zero new dependencies. The integration uses only Node.js built-ins and extends existing patterns in `bin/install.js`. Skills are Markdown directories, teams are JSON configs, hooks are JS/shell scripts, observations are JSONL -- all plain-text formats handled by `fs` operations.

**Core technologies (unchanged):**
- Node.js >= 18, CJS modules -- existing runtime, no migration
- Markdown with YAML frontmatter -- Claude Code's native skill/agent format
- JSON -- config, settings, team definitions
- JSONL -- new append-only observation log (~50 bytes/entry, gitignored)

**New patterns (zero deps):**
- JSONL append via `fs.appendFileSync()` for session observations
- Marker-based CLAUDE.md merge (`<!-- GSD:BEGIN -->` / `<!-- GSD:END -->`)
- Hook consolidation: 9 skill-creator hooks + 3 GSD hooks = 6 consolidated entry points
- Directory copy with manifest for skills/teams installation

### Expected Features

**Must have (table stakes -- the merge is incomplete without these):**
- Single installer handles everything (skills, hooks, teams, agents, commands)
- Config merge (`adaptive_learning` section in `config.json`, kill `skill-creator.json`)
- 16 skills ship with GSD, installed to `.claude/skills/`
- Agent extension content merged inline (delete marker/fragment system)
- Session hooks merged (all 7 hooks in GSD's `hooks/` directory)
- Teams as first-class feature (4 team configs installed)
- Native observation in all 7 workflow files (kill wrapper commands entirely)

**Should have (differentiators):**
- `/gsd:suggest` -- surface accumulated patterns as skill proposals
- `/gsd:digest` -- analytics dashboard from session observation data
- Session start briefing with GSD state + pending suggestions
- Skill loading in agent context (phase-relevant skills injected into subagents)

**Defer (v4.x/v5+):**
- `/gsd:suggest` and `/gsd:digest` require observation data to accumulate first
- CLAUDE.md template + merge strategy (careful merge logic needed for existing projects)
- Pattern detection pipeline and skill refinement automation
- Cross-project skill inheritance
- Deprecation notices for gsd-skill-creator npm package

### Architecture Approach

The architecture splits into 7 integration areas with clear dependency chains: (1) Skills directory, (2) Hooks merge, (3) Observation in workflows, (4) Agent extensions, (5) Teams directory, (6) Config merge, (7) CLAUDE.md template. Areas 1, 5, 6, and 7 have no dependencies and can be built first. Area 2 (hooks) and Area 4 (agents) depend on skills existing. Area 3 (observation) depends on config, hooks, agents, and skills -- it is the capstone.

**Major components:**
1. **Installer extension** -- extends `bin/install.js` with skills/, teams/ copy and hook consolidation
2. **Config merge** -- `adaptive_learning` key in `config.json` replaces separate `skill-creator.json`
3. **Workflow observation** -- observation capture baked into 7 workflow .md files as native steps
4. **Hook consolidation** -- 12 hooks consolidated into 6 files with 5 settings.json entries
5. **Agent integration** -- skill-awareness content merged directly into agent .md files, markers deleted

### Critical Pitfalls

1. **Settings.json hook collisions** -- two installers evolved different path formats for the same hooks. Use a single canonical hook list with normalized path comparison. Test install/update/uninstall cycles for zero duplicates and zero orphans.

2. **Wrapper delegation failures** -- the #1 bug source. Claude skips post-delegation steps because wrapper instructions compete with delegated command instructions. Kill wrappers entirely; bake observation into workflow files as native steps.

3. **CLAUDE.md overwrite destroys user customizations** -- skill-creator replaces CLAUDE.md if over 100 lines. Use marker-based section merge: framework content between `GSD:BEGIN`/`GSD:END`, user content preserved outside markers. Never auto-replace.

4. **Skills context budget bloat** -- 16 skills = 16-48KB consumed before user types anything. Ship only 4 core skills by default (gsd-workflow, session-awareness, security-hygiene, skill-integration). Domain skills are opt-in templates.

5. **Agent file merge creates contradictions** -- appending skill-creator content to GSD agent files creates competing instructions. Manually integrate each addition into the correct location. Delete the marker/extension system entirely. One file, one set of instructions.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation (Config + File Structure)
**Rationale:** Config merge and file structure have no dependencies and unblock everything else. Every subsequent phase reads config or copies files.
**Delivers:** `adaptive_learning` config section, skills/ source directory, teams/ source directory, CLAUDE.md template
**Addresses:** Config merge, skills ship with GSD, teams as first-class (file structure only, not installer)
**Avoids:** Config namespace collision (Pitfall 5) by establishing single config source early

### Phase 2: Installer Expansion
**Rationale:** The installer is the delivery mechanism for all new content. Must be expanded before hooks, skills, or teams can reach users.
**Delivers:** Extended `bin/install.js` that copies skills/, teams/, new hooks; manifest tracking; CLAUDE.md merge logic; settings.json hook registration
**Addresses:** Single installer (table stakes), hook registration, CLAUDE.md merge
**Avoids:** Version migration breakage (Pitfall 7) via idempotent install steps and `.gsd-version` tracking; hook collisions (Pitfall 1) via canonical hook list; CLAUDE.md overwrite (Pitfall 3) via marker merge

### Phase 3: Agent and Hook Integration
**Rationale:** Agents and hooks depend on skills existing in the source tree (Phase 1). Agent merge is high-effort manual work that must be done carefully before observation capture.
**Delivers:** Merged agent files (executor, planner, verifier) with skill-awareness built in; consolidated hook files; marker/extension system deleted
**Addresses:** Agent extensions inline, session hooks merged (table stakes)
**Avoids:** Agent contradictory instructions (Pitfall 6) by manual integration with diff review; wrapper delegation failures (Pitfall 2) by not creating any new wrappers

### Phase 4: Native Observation in Workflows
**Rationale:** Depends on config (Phase 1), hooks (Phase 3), agents (Phase 3), and skills (Phase 1). This is the capstone that kills the wrapper layer.
**Delivers:** Observation capture in all 7 workflow .md files; wrapper commands deleted; `/gsd:observe` manual capture command
**Addresses:** Native observation (table stakes), kill wrapper commands (table stakes)
**Avoids:** Wrapper delegation failures (Pitfall 2) by eliminating wrappers entirely; skills context budget (Pitfall 4) by implementing skill loading with core/optional split

### Phase 5: New Commands and Polish
**Rationale:** Suggest and digest commands need observation data to exist. Polish items depend on all features being functional.
**Delivers:** `/gsd:suggest`, `/gsd:digest`, `/gsd:dashboard` commands; updated help; multi-runtime testing; end-to-end installer test
**Addresses:** Suggest, digest, session briefing (differentiators)
**Avoids:** N/A -- this is additive work on stable foundation

### Phase Ordering Rationale

- Config and file structure first because every subsequent phase reads `adaptive_learning` config or references skills/teams source directories
- Installer before agents/hooks because the installer copy logic must be proven before we finalize the content it copies
- Agents and hooks before observation because observation steps in workflows reference skill-loading protocols defined in agent files
- Observation is the capstone: it touches all 7 workflow files, depends on config, hooks, agents, and skills all working, and is the highest-risk change
- New commands last because they consume observation data that only exists after Phase 4

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Installer):** Complex -- settings.json merge logic, manifest tracking, CLAUDE.md marker parsing, idempotent upgrade from v3.x to v4.0. Needs research-phase to audit the existing installer code paths.
- **Phase 3 (Agent Merge):** High-risk manual work -- must diff GSD vs. skill-creator agent versions, identify conflicts, and reconcile. Each agent file needs individual attention.
- **Phase 4 (Observation):** Highest complexity -- touches 7 workflow files, each with different observation types and graceful degradation requirements. Needs research-phase to analyze each workflow's step structure.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Straightforward config schema extension and file copy. Well-documented patterns in existing config.json and installer code.
- **Phase 5 (Commands):** Port existing `/sc:suggest` and `/sc:digest` commands with namespace change. Working implementations exist.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies; all patterns already proven in the existing codebase |
| Features | HIGH | Based on direct analysis of both codebases and 4 documented bugs, not speculation |
| Architecture | HIGH | 7 integration areas with clear boundaries; dependency chain is well-understood |
| Pitfalls | HIGH | 7 pitfalls identified from real bugs, installer source analysis, and codebase diff |

**Overall confidence:** HIGH -- both codebases are fully accessible and well-understood. No external API dependencies, no third-party integration uncertainty. Risk is in execution complexity (especially agent merge and observation integration), not in unknowns.

### Gaps to Address

- **Core vs. optional skill split:** Research identifies the need to split 16 skills into ~4 core (auto-install) and ~12 optional (templates). The exact split needs validation during Phase 1 planning -- which skills are truly universally applicable vs. domain-specific.
- **Hook consolidation architecture:** STACK.md recommends consolidating 9+3 hooks into 6 files, but the exact dispatcher logic (sequential vs. parallel, error handling) needs design during Phase 2 planning.
- **Observation schema completeness:** The JSONL schema is defined but the exact fields captured per workflow type need finalization. Each of the 7 workflows captures different metadata.
- **Multi-runtime gating:** Skills, teams, and CLAUDE.md are Claude Code features. The installer needs `runtime === 'claude'` guards, but the exact feature-to-runtime matrix needs confirmation for OpenCode, Gemini, and Codex.
- **v3.x to v4.0 migration testing:** No existing tests cover major version upgrade paths. Migration logic (config merge, old file cleanup) needs dedicated test coverage.

## Sources

### Primary (HIGH confidence)
- `bin/install.js` (~2400 lines) -- GSD installer source, copy patterns, hook registration, manifest
- `~/gsd-skill-creator/INTEGRATION-HANDOFF.md` -- integration strategy, 4 documented bugs, overlap analysis
- `~/gsd-skill-creator/project-claude/manifest.json` -- complete file inventory (368 lines)
- `~/gsd-skill-creator/project-claude/settings.json` -- hook registration format for all events
- `~/gsd-skill-creator/project-claude/skill-creator.json` -- integration config schema
- `.planning/PROJECT.md` -- project context and v4.0 requirements

### Secondary (HIGH confidence)
- `~/gsd-skill-creator/project-claude/skills/skill-integration/` -- observation protocol and bounded guardrails
- `~/gsd-skill-creator/project-claude/commands/wrap/execute.md` -- wrapper command implementation (being killed)
- `~/gsd-skill-creator/project-claude/commands/sc/suggest.md` -- suggestion review implementation
- `~/gsd-skill-creator/project-claude/commands/sc/digest.md` -- learning digest implementation
- `hooks/dist/` -- GSD's 3 existing bundled hooks (337 LOC)
- `.claude/skills/*/SKILL.md` -- existing skill directory convention (16 skills)
- `.claude/teams/*/config.json` -- existing team config format

---
*Research completed: 2026-03-07*
*Ready for roadmap: yes*
