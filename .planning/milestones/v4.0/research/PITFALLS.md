# Pitfalls Research

**Domain:** Merging two Claude Code tool packages (gsd-skill-creator into GSD core)
**Researched:** 2026-03-07
**Confidence:** HIGH (based on direct analysis of both codebases and 4 documented bugs from the wrapper pattern)

## Critical Pitfalls

### Pitfall 1: Settings.json Hook Registration Collisions

**What goes wrong:**
Both GSD (`bin/install.js`) and skill-creator (`project-claude/install.cjs`) independently write to `.claude/settings.json`. GSD registers `PostToolUse` hooks (statusline, context-monitor, check-update). Skill-creator registers `SessionStart` (inject-snapshot, restore-work-state, session-state), `SessionEnd` (save-work-state, snapshot-session), `PreToolUse` (validate-commit), and `PostToolUse` (phase-boundary-check). When merged into one installer, the merged hook registration logic must handle:
1. **Duplicate detection by command string** -- skill-creator checks `h.command === sourceCmd`, but GSD uses different path formats (relative for local, absolute with `$HOME` for global). Same hook, different command strings = duplicate registrations.
2. **Event array ordering** -- hooks within the same event run sequentially. If statusline runs before phase-boundary-check, a slow statusline delays boundary detection.
3. **Orphan cleanup mismatch** -- GSD has `cleanupOrphanedHooks()` that removes hooks matching patterns. If skill-creator hooks don't match those patterns, they survive uninstall. If they do match, they get cleaned up during GSD updates.

**Why it happens:**
Two independent installers evolved different conventions for the same settings.json target. Neither was designed to coordinate with the other.

**How to avoid:**
- Use a single hook registration function with a canonical command format. Normalize all hook commands to the same path style before comparison.
- Define hook ordering explicitly: statusline last (cosmetic), validation hooks first (blocking).
- Maintain a single `GSD_HOOKS` constant array listing all managed hook filenames. `cleanupOrphanedHooks()` uses this list for both install and uninstall.
- Test: install, upgrade, uninstall, re-install cycle. Verify zero duplicate hooks and zero orphan hooks at each step.

**Warning signs:**
- `settings.json` grows with each install (duplicate hook entries)
- Hooks fire twice (visible in stderr output)
- Uninstall leaves behind skill-creator hooks

**Phase to address:**
Phase handling hook merging (session hooks + installer expansion). This is foundational -- must be solved before any hooks are registered.

---

### Pitfall 2: Wrapper Indirection Causes Delegation Failures

**What goes wrong:**
The 4 bugs found in the skill-creator session are all symptoms of one root cause: wrapper commands that delegate to GSD commands lose control of the execution flow. Specifically:
1. **Observation not firing** -- Claude ad-libs reasons to skip post-delegation steps ("patterns directory not required") because the wrapper's post-delegation instructions are weak relative to the delegated command's completion signal.
2. **AskUserQuestion missing** -- wrapper commands need `allowed-tools` that include tools used by the delegated command, but the wrapper author didn't know all tools the delegate uses.
3. **CONTEXT.md skipped** -- when `discuss-phase` runs inside `wrap:discuss`, Claude sees the wrapper's Step 4 (observation) as "next" and skips the delegate's remaining steps (write CONTEXT.md, commit, update state).
4. **skill-creator.json missing** -- wrapper commands assume config exists, but GSD's installer doesn't create it.

**Why it happens:**
Wrappers are an indirection layer. Claude Code treats command delegation as a suggestion, not a subroutine call. The delegated command's instructions compete with the wrapper's instructions for Claude's attention. Claude resolves ambiguity by skipping whichever steps seem optional.

**How to avoid:**
This is the entire motivation for v4.0. Kill wrappers entirely. Bake observation capture directly into GSD workflow commands (plan, execute, verify, discuss, quick, debug, fix-debt). Each workflow command gains:
- A skill-loading preamble (before delegation to agent)
- An observation capture step (after agent completes, before summary)
- These are native steps in the workflow, not delegated to another command.

Do NOT create new wrapper commands. Do NOT create commands that delegate to other commands with post-delegation steps. If a step must happen after an agent runs, it goes in the workflow file that invokes the agent.

**Warning signs:**
- Any command file that contains "delegate to /gsd:" followed by post-delegation steps
- Any observation step that says "No" without a specific error message
- Any workflow where Claude skips writing a required file

**Phase to address:**
The phase that merges observation into workflow commands. This is the highest-value change in v4.0 -- it eliminates the entire wrapper layer.

---

### Pitfall 3: CLAUDE.md Overwrite Destroys User Customizations

**What goes wrong:**
Skill-creator's `installClaudeMd()` replaces CLAUDE.md with a "slim" version if the existing one exceeds 100 lines. It backs up to `CLAUDE.md.legacy`, but:
1. Users who customized CLAUDE.md lose their changes on next install/update.
2. The backup is a one-time operation -- if CLAUDE.md.legacy already exists, subsequent updates silently overwrite without backup.
3. GSD core doesn't manage CLAUDE.md at all currently, so merging introduces a new overwrite risk.

**Why it happens:**
The original skill-creator CLAUDE.md was designed to replace a monolithic 500+ line file with a slim version. That's a valid one-time migration, not a repeatable install step.

**How to avoid:**
Use a section-based merge strategy with markers:
```
<!-- GSD:BEGIN - Do not edit this section -->
[Framework-managed content: tech stack, key locations, commit convention]
<!-- GSD:END -->

[User content below - preserved across updates]
```
- Installer only touches content between `GSD:BEGIN` and `GSD:END` markers.
- On first install (no markers), append the managed section at the top of existing content.
- Never delete user content outside markers.
- Never create CLAUDE.md.legacy -- if users want to archive, they can do it themselves.

**Warning signs:**
- CLAUDE.md.legacy exists in a project
- CLAUDE.md is shorter than expected after an update
- User's custom instructions disappeared

**Phase to address:**
Installer expansion phase. The CLAUDE.md merge strategy must be implemented before the merged installer ships.

---

### Pitfall 4: Skills Auto-Loading Consumes AI Context Budget Silently

**What goes wrong:**
16 skills install into `.claude/skills/*/SKILL.md`. Claude Code auto-loads ALL matching skills into every conversation context. Each skill is ~1-3KB of markdown. 16 skills = 16-48KB of context consumed before the user types anything. This:
1. Reduces available context for actual work (code, docs, conversation).
2. Competes with GSD workflow instructions for Claude's attention.
3. Skills designed for specific domains (typescript-patterns, api-design) load even in Python projects.
4. The `token_budget.max_percent: 5` config in skill-creator.json is advisory -- Claude Code has no mechanism to enforce it.

**Why it happens:**
Claude Code's skill auto-loading is all-or-nothing per skill directory. There's no conditional loading based on project type, current command, or context budget.

**How to avoid:**
- Ship only core skills by default: `gsd-workflow`, `session-awareness`, `security-hygiene`, `skill-integration`. These are universally applicable.
- Ship domain skills (typescript-patterns, api-design, test-generator, etc.) as opt-in templates, not auto-installed.
- Provide a `/gsd:skills` command to list available skills and install/remove them per project.
- Keep each core skill under 2KB. Move reference material to `references/` subdirectories that are only read on demand (not auto-loaded).
- Document the context cost: "Core skills: ~8KB. Each optional skill: ~2KB."

**Warning signs:**
- Claude forgets instructions from earlier in the conversation (context pressure)
- Skills reference technologies not used in the project
- `/sc:status` shows high token budget usage

**Phase to address:**
The phase that moves skills into GSD. Must decide the core vs. optional split before installation logic is written.

---

### Pitfall 5: Config Namespace Collision Between GSD and Skill-Creator Settings

**What goes wrong:**
GSD uses `.planning/config.json` with sections: `quality`, `context7`, `project`. Skill-creator uses `.planning/skill-creator.json` with sections: `integration`, `token_budget`, `observation`, `suggestions`. Merging into a single `config.json` risks:
1. **Key collisions** -- if both systems ever use the same key name for different purposes.
2. **Migration failures** -- existing projects have separate files. The merged installer must read `skill-creator.json`, migrate its contents into `config.json`, and stop creating the separate file.
3. **Partial migration** -- if the installer migrates some settings but not others, commands that read `skill-creator.json` directly will fail silently (file exists but is stale) or loudly (file doesn't exist).

**Why it happens:**
Two independent config files is a natural consequence of two independent packages. Merging them requires explicit migration logic.

**How to avoid:**
- Add an `adaptive` top-level key to `config.json` that contains all former skill-creator.json content.
- On install: if `skill-creator.json` exists, read it, merge into `config.json.adaptive`, delete (or rename to `.skill-creator.json.migrated`).
- All commands that previously read `skill-creator.json` must read `config.json` instead. Search for every `skill-creator.json` reference in command/workflow files.
- Add a config version field. Current GSD config has no version -- add one now to support future migrations.

**Warning signs:**
- `skill-creator.json` and `config.json` both exist in a project (partial migration)
- Commands log "No skill-creator.json found" after merge (stale code path)
- Config values are ignored (reading from wrong file)

**Phase to address:**
Config merge phase. Must happen early because all subsequent phases depend on reading config from the right location.

---

### Pitfall 6: Agent File Merge Creates Contradictory Instructions

**What goes wrong:**
Skill-creator ships its own versions of `gsd-executor.md`, `gsd-planner.md`, and `gsd-verifier.md` that override GSD's versions. It also ships extension fragments (`gsd-executor--injected-skills.md`) that inject content via markers. When merging:
1. The skill-creator agent files may be based on an older version of GSD's agent files (the fork point).
2. Content added to GSD agents post-fork (v3.0-v3.1 changes) may conflict with skill-creator's additions.
3. Marker-delimited injection is fragile -- if GSD agent file structure changes, markers end up in wrong locations.
4. Two sets of instructions for the same agent create ambiguity. Claude resolves ambiguity unpredictably.

**Why it happens:**
The extension/marker system was designed as a non-invasive overlay, but both base and overlay evolved independently.

**How to avoid:**
- Do NOT merge by appending skill-creator content to GSD agent files. Instead, manually integrate each addition into the correct location within the GSD agent file.
- Diff GSD's current agent files against skill-creator's versions to identify: (a) skill-creator additions to preserve, (b) GSD changes that skill-creator is missing, (c) contradictory instructions.
- Delete the extension/marker system entirely. No `<!-- PROJECT:gsd-skill-creator:injected-skills -->` markers in the merged version.
- Each agent file should have ONE set of instructions. No "also do X" appendages.
- Test: run each agent workflow and verify it follows the merged instructions without skipping steps.

**Warning signs:**
- Agent files contain `<!-- PROJECT:` markers
- Agent files have duplicate sections (e.g., two "Pre-Task" sections)
- Claude ignores some instructions in agent files (too many competing directives)

**Phase to address:**
Agent merge phase. This is high-effort, high-risk work that requires careful manual review of each agent file.

---

### Pitfall 7: Installer Version Migration Breaks Existing Projects

**What goes wrong:**
When users update from GSD v3.x (no skills) to v4.0 (with skills), the installer must:
1. Create new directories (`.claude/skills/`, `.claude/teams/`, `.planning/patterns/`)
2. Register new hooks in `settings.json`
3. Merge config
4. Potentially modify CLAUDE.md
If any step fails silently, the project is in a half-migrated state. Subsequent GSD commands may assume skills exist when they don't, or vice versa.

**Why it happens:**
npm package updates run the installer automatically. The installer has no concept of "upgrading from version X" -- it only knows "install from scratch or update files."

**How to avoid:**
- Add a `.gsd-version` field to `config.json` that tracks the installed GSD version.
- On install: compare `.gsd-version` against package version. If upgrading across major versions, run migration steps.
- Make every install step idempotent: creating a directory that exists is fine, registering a hook that's already registered is fine, merging config that's already merged is fine.
- Log migration actions clearly: "Migrating from v3.x to v4.0: adding skills directory, registering 7 new hooks, merging skill config."
- Test: install v3.1, then install v4.0 over it. Verify clean state. Then install v4.0 again. Verify no changes (idempotent).

**Warning signs:**
- `npm update` produces errors or warnings from the installer
- Some skills/hooks exist but not others (partial install)
- Config has old format alongside new format

**Phase to address:**
Installer expansion phase (final phase). All other content must be finalized before the installer is updated, because the installer needs to know the complete file manifest.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Append skill content to agent files without restructuring | Fast merge, minimal diff | Contradictory instructions, Claude skips steps | Never -- manual integration is required |
| Install all 16 skills by default | Simple install logic, no opt-in flow | Context budget bloat, irrelevant skills loaded | Never -- core/optional split is required |
| Keep `skill-creator.json` as separate file | No migration code needed | Two config files, commands must check both | Only during a transitional phase, with explicit removal deadline |
| Copy wrapper commands as-is (just rename `/wrap:` to `/gsd:`) | Preserves tested behavior | Wrapper delegation bugs persist | Never -- the whole point is eliminating wrappers |
| Skip CLAUDE.md merge strategy (just overwrite) | No marker-parsing code needed | User customizations destroyed on every update | Never -- users will lose trust |
| Use sha256 comparison for "needs update" on agent files | Simple, already implemented in both installers | After manual user edits, every update overwrites | Acceptable for skills/hooks (framework-owned files), not for agent files or CLAUDE.md |

## Integration Gotchas

Common mistakes when connecting the two package ecosystems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Hook event types | Using `PostToolUse` for hooks that should be `PreToolUse` (or vice versa) | Map each hook to its correct event: validate-commit = PreToolUse (blocking), statusline = PostToolUse (cosmetic), session-state = SessionStart |
| Agent allowed-tools | Forgetting to add tools that the delegated agent needs (AskUserQuestion bug) | Audit every agent's allowed-tools list. If an agent delegates to another, it needs the union of both tool sets |
| Observation capture timing | Capturing observation before the workflow completes all its steps (CONTEXT.md bug) | Observation must be the LAST step in the workflow, after all file writes, commits, and state updates |
| Config reading | Hardcoding `skill-creator.json` path in command files | Use `loadConfig()` from core.cjs which knows the canonical config location |
| Command namespacing | Putting new commands in `/sc:` or `/wrap:` namespaces | All commands under `/gsd:` namespace. Kill `/sc:` and `/wrap:` entirely |
| Skill references/ loading | Assuming `references/` subdirectories auto-load with the skill | Only `SKILL.md` auto-loads. References must be explicitly read by the skill's instructions |

## Performance Traps

Patterns that work at small scale but fail as context grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all skills on every command | Slow response, context exhaustion | Core skills only by default; command-specific skill loading for optional skills | At 10+ skills (~20KB+ context consumed before first prompt) |
| Observation capture writing to JSONL on every command | Disk I/O on every GSD command, large files | Write observations only when `observe_sessions` is true in config | At 1000+ observations (JSONL file grows unbounded) |
| Session snapshot on every SessionEnd | Generates snapshot even for trivial sessions | Only snapshot if session had GSD activity (check state file for changes) | When user runs many short sessions (snapshot overhead > session work) |
| Reading all agent files to check for markers | File I/O scales with agent count | Eliminate markers entirely; no runtime scanning needed | At 12+ agent files with marker checks |

## Security Mistakes

Domain-specific security issues for a self-modifying AI tool framework.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Skills that instruct Claude to modify `.claude/settings.json` | Malicious or buggy skill could disable security hooks | Skills must never modify settings.json. Only the installer writes settings |
| Observation data containing secrets | `.planning/patterns/sessions.jsonl` could capture API keys from session context | Observation capture must strip environment variables and anything matching secret patterns |
| CLAUDE.md injection via user content section | User content section could contain instructions that override framework behavior | Framework section (between markers) loads first; user section treated as lower-priority context |
| Installer running with --force in CI/CD | Overwrites user customizations silently | Never use --force in automated environments. Default to --dry-run in CI |

## UX Pitfalls

Common user experience mistakes when merging tool packages.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent behavior changes after update | User's workflow breaks without explanation | Log all behavioral changes during install: "NEW: observation capture added to /gsd:execute-phase" |
| Requiring manual migration steps | Users don't read release notes, skip steps, get broken state | Fully automatic migration with idempotent installer |
| New commands that conflict with user aliases | User had custom `/gsd:suggest` or `/gsd:digest` | Check for existing command files before installing; warn on conflict, don't overwrite |
| Skills loading in projects where GSD isn't initialized | Skills reference `.planning/` files that don't exist | Skills must check for `.planning/config.json` before activating; degrade gracefully |
| Two packages installed (old + new) | Duplicate hooks, competing agent files, confusing behavior | Merged installer checks for `skill-creator.json` and warns: "gsd-skill-creator is now included in GSD. Run `npx get-shit-done-cc --uninstall-legacy` to clean up" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Hook registration:** Hooks registered in settings.json but hook JS files not installed -- verify both file existence AND settings entry
- [ ] **Skill directories:** `skills/gsd-workflow/` directory exists but `references/` subdirectory missing -- verify full directory tree, not just SKILL.md
- [ ] **Config migration:** `config.json` has `adaptive` section but `skill-creator.json` still exists -- verify old file removed
- [ ] **Agent merge:** Agent file has skill-awareness content but still has `<!-- PROJECT:` markers -- verify markers fully removed
- [ ] **Observation capture:** Workflow command has observation step but `.planning/patterns/` directory doesn't exist -- verify directory creation in installer
- [ ] **Command cleanup:** New `/gsd:suggest` command works but old `/sc:suggest` command still installed -- verify old namespace commands removed
- [ ] **Uninstall coverage:** `--uninstall` removes GSD files but leaves skill-creator files behind -- verify uninstall manifest includes ALL merged files
- [ ] **CLAUDE.md markers:** Framework section has `GSD:BEGIN`/`GSD:END` markers but user content is inside them -- verify marker placement preserves user content
- [ ] **Hook test files:** `.test.ts` files from skill-creator manifest are installed into `.claude/hooks/` -- these should NOT be installed in production, only in dev

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Duplicate hook registrations | LOW | Run installer with `--force` to regenerate settings.json from scratch |
| CLAUDE.md overwritten | MEDIUM | Check git history for previous version; restore user sections manually |
| Half-migrated config | LOW | Delete `skill-creator.json`, run installer again (idempotent) |
| Agent file with contradictory instructions | HIGH | Diff against both source versions, manually reconcile, test each workflow |
| Context budget exhausted by skills | LOW | Remove optional skills from `.claude/skills/`, keep only core 4 |
| Wrapper commands still exist alongside native | LOW | Delete `.claude/commands/wrap/` and `.claude/commands/sc/` directories |
| Observation not firing after merge | MEDIUM | Check workflow file for observation step placement; must be after all agent steps, before summary |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Settings.json hook collisions | Hook merge phase | Install/update/uninstall cycle test with zero duplicates and zero orphans |
| Wrapper delegation failures | Observation integration phase (kill wrappers) | Each workflow command captures observation without delegation |
| CLAUDE.md overwrite | Installer expansion phase | Install over existing CLAUDE.md with custom content; verify custom content preserved |
| Skills context budget | Skills merge phase | Measure context size of core skills (<10KB total) |
| Config namespace collision | Config merge phase (early) | No `skill-creator.json` references in any command/workflow file |
| Agent contradictory instructions | Agent merge phase | Run each agent workflow end-to-end; verify no skipped steps |
| Version migration | Installer expansion phase (final) | Install v3.1, upgrade to v4.0, verify clean state; re-run installer, verify idempotent |

## Sources

- Direct analysis of `~/Projects/gsdup/bin/install.js` (GSD installer, ~2400 lines)
- Direct analysis of `~/gsd-skill-creator/project-claude/install.cjs` (skill-creator installer, ~500 lines)
- Direct analysis of `~/gsd-skill-creator/project-claude/manifest.json` (file inventory)
- `~/gsd-skill-creator/INTEGRATION-HANDOFF.md` (4 documented bugs and integration strategy)
- `~/Projects/gsdup/.planning/PROJECT.md` (project context, v4.0 scope)
- Skill-creator session debugging (wrapper pattern bugs: observation skip, AskUserQuestion missing, CONTEXT.md skipped, config missing)

---
*Pitfalls research for: Adaptive learning integration (gsd-skill-creator merge into GSD core)*
*Researched: 2026-03-07*
