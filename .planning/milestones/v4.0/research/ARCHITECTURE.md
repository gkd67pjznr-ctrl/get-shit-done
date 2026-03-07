# Architecture Research: Adaptive Learning Integration into GSD

**Domain:** CLI framework integration (merging gsd-skill-creator into GSD core)
**Researched:** 2026-03-07
**Confidence:** HIGH

## System Overview

```
                          INSTALL TIME (bin/install.js)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Source Tree (npm package)              Target (~/.claude/ or ./)    │
│  ┌──────────────┐                      ┌──────────────────────┐     │
│  │ commands/gsd/ │──copy+template──────>│ commands/gsd/        │     │
│  │ agents/       │──copy+template──────>│ agents/              │     │
│  │ hooks/dist/   │──copy+template──────>│ hooks/               │     │
│  │ get-shit-done/│──copy+template──────>│ get-shit-done/       │     │
│  │               │                      │                      │     │
│  │ skills/    NEW│──copy+template──────>│ skills/           NEW│     │
│  │ teams/     NEW│──copy+template──────>│ teams/            NEW│     │
│  │ CLAUDE.md  NEW│──merge+template────->│ CLAUDE.md (project)  │     │
│  └──────────────┘                      └──────────────────────┘     │
│                                                                     │
│  settings.json: merge hook registrations into target settings.json  │
│  config.json:   merge skill-creator block into .planning/config.json│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                         RUNTIME (session lifecycle)
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  SessionStart hooks                                                 │
│  ┌─────────────────┐  ┌────────────────────┐  ┌─────────────────┐  │
│  │ gsd-check-update │  │ gsd-restore-state  │  │ gsd-inject-snap │  │
│  │ (existing)       │  │ (NEW)              │  │ (NEW)           │  │
│  └─────────────────┘  └────────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐                                                │
│  │ session-state.sh │ (NEW -- inject STATE.md snapshot)             │
│  └─────────────────┘                                                │
│                                                                     │
│  PreToolUse hooks                                                   │
│  ┌──────────────────┐                                               │
│  │ validate-commit  │ (NEW -- Conventional Commits enforcement)     │
│  └──────────────────┘                                               │
│                                                                     │
│  PostToolUse hooks                                                  │
│  ┌────────────────────┐  ┌────────────────────────┐                 │
│  │ gsd-context-monitor │  │ phase-boundary-check   │                │
│  │ (existing)          │  │ (NEW)                  │                │
│  └────────────────────┘  └────────────────────────┘                 │
│                                                                     │
│  SessionEnd hooks                                                   │
│  ┌──────────────────┐  ┌─────────────────────┐                      │
│  │ gsd-save-state   │  │ gsd-snapshot-session │                     │
│  │ (NEW)            │  │ (NEW)                │                     │
│  └──────────────────┘  └─────────────────────┘                      │
│                                                                     │
│  Workflows (with observation capture baked in)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │
│  │ execute  │ │ verify   │ │ plan     │ │ discuss  │ ...           │
│  │ +observe │ │ +observe │ │ +observe │ │ +observe │              │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘              │
│                                                                     │
│  Skills (auto-activate based on context)                            │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │ gsd-workflow │ │ skill-integr │ │ session-aware│ ...16+ skills  │
│  └─────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  Observation Pipeline                                               │
│  workflow steps ──> .planning/patterns/sessions.jsonl               │
│  hook captures  ──> .planning/patterns/sessions.jsonl               │
│  /gsd:digest    ──> reads sessions.jsonl ──> pattern analysis       │
│  /gsd:suggest   ──> reads patterns ──> skill creation proposals     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Integration Area 1: Skills Directory (16+ skills)

### Current State
The installer has no `skills/` directory in its source tree. Skills exist only in gsd-skill-creator's `project-claude/skills/`.

### Integration Design

**New source directory:** `skills/` at package root (peer to `agents/`, `commands/`, `hooks/`)

**Files to create (NEW):**

| Source Path | Install Target | Type |
|-------------|---------------|------|
| `skills/gsd-workflow/SKILL.md` | `skills/gsd-workflow/SKILL.md` | Core |
| `skills/gsd-workflow/references/command-routing.md` | same | Core |
| `skills/gsd-workflow/references/phase-behavior.md` | same | Core |
| `skills/gsd-workflow/references/yolo-mode.md` | same | Core |
| `skills/skill-integration/SKILL.md` | `skills/skill-integration/SKILL.md` | Core |
| `skills/skill-integration/references/loading-protocol.md` | same | Core |
| `skills/skill-integration/references/bounded-guardrails.md` | same | Core |
| `skills/skill-integration/references/observation-patterns.md` | same | Core |
| `skills/session-awareness/SKILL.md` | `skills/session-awareness/SKILL.md` | Core |
| `skills/security-hygiene/SKILL.md` | `skills/security-hygiene/SKILL.md` | Core |
| `skills/beautiful-commits/SKILL.md` | same | Bundled |
| `skills/file-operation-patterns/SKILL.md` | same | Bundled |
| `skills/code-review/SKILL.md` | same | Bundled |
| `skills/context-handoff/SKILL.md` | same | Bundled |
| `skills/decision-framework/SKILL.md` | same | Bundled |
| `skills/gsd-preflight/SKILL.md` | same | Bundled |
| `skills/gsd-onboard/SKILL.md` | same | Bundled |
| `skills/gsd-trace/SKILL.md` | same | Bundled |
| `skills/test-generator/SKILL.md` | same | Example |
| `skills/typescript-patterns/SKILL.md` | same | Example |
| `skills/api-design/SKILL.md` | same | Example |
| `skills/env-setup/SKILL.md` | same | Example |

**Installer changes (MODIFY `bin/install.js`):**

Add a new block after the agents copy section (~line 2006) that mirrors the agents copy pattern:

```javascript
// Copy skills directory with path replacement
const skillsSrc = path.join(src, 'skills');
if (fs.existsSync(skillsSrc)) {
  const skillsDest = path.join(targetDir, 'skills');
  copyWithPathReplacement(skillsSrc, skillsDest, pathPrefix, runtime);
  if (verifyInstalled(skillsDest, 'skills')) {
    console.log(`  ${green}✓${reset} Installed skills`);
  } else {
    failures.push('skills');
  }
}
```

`copyWithPathReplacement()` already handles recursive directory copying with path templating and runtime conversion -- no new copy logic needed.

**Codex/OpenCode/Gemini considerations:**
- Claude Code: skills auto-activate from `skills/*/SKILL.md` -- no frontmatter conversion needed
- OpenCode: skills are not a native concept; copy as-is for reference, or skip entirely
- Gemini: skills are not a native concept; skip skill installation
- Codex: skills map to the Codex skill directory; `copyWithPathReplacement` handles this

**User-prunable design:** Users can delete any `skills/X/` directory to opt out. The skill-integration loading protocol already handles missing skills gracefully (scan, match, skip missing).

### Dependencies
None. Skills are self-contained markdown files. Can be implemented first.


## Integration Area 2: Hooks (9 new + 3 existing = 12 total)

### Current State

**Existing hooks in package (source: `hooks/dist/`):**
1. `gsd-statusline.js` -- StatusLine (bundled JS)
2. `gsd-check-update.js` -- SessionStart (bundled JS)
3. `gsd-context-monitor.js` -- PostToolUse (bundled JS)

These are bundled JS files (dependencies inlined). Registered in `settings.json` by the installer.

**New hooks from skill-creator:**
4. `gsd-inject-snapshot.js` -- SessionStart (standalone JS)
5. `gsd-restore-work-state.js` -- SessionStart (standalone JS)
6. `gsd-save-work-state.js` -- SessionEnd (standalone JS)
7. `gsd-snapshot-session.js` -- SessionEnd (standalone JS)
8. `session-state.sh` -- SessionStart (bash)
9. `validate-commit.sh` -- PreToolUse:Bash (bash)
10. `phase-boundary-check.sh` -- PostToolUse:Write (bash)
11. `gsd-statusline.js` -- StatusLine (skill-creator's enhanced version replaces existing)

Plus test files:
- `gsd-inject-snapshot.test.ts`
- `gsd-restore-work-state.test.ts`
- `gsd-save-work-state.test.ts`
- `gsd-snapshot-session.test.ts`

### Integration Design

**Hook source consolidation:**

Move all hooks into `hooks/` at package root. The JS hooks from skill-creator are standalone (no external deps), so they do not need the `hooks/dist/` bundling pipeline.

| Hook File | Event | Matcher | Source |
|-----------|-------|---------|--------|
| `gsd-statusline.js` | StatusLine | -- | REPLACE existing with enhanced version |
| `gsd-check-update.js` | SessionStart | -- | KEEP existing |
| `gsd-context-monitor.js` | PostToolUse | -- | KEEP existing |
| `gsd-inject-snapshot.js` | SessionStart | -- | NEW from skill-creator |
| `gsd-restore-work-state.js` | SessionStart | -- | NEW from skill-creator |
| `gsd-save-work-state.js` | SessionEnd | -- | NEW from skill-creator |
| `gsd-snapshot-session.js` | SessionEnd | -- | NEW from skill-creator |
| `session-state.sh` | SessionStart | -- | NEW from skill-creator |
| `validate-commit.sh` | PreToolUse | Bash | NEW from skill-creator |
| `phase-boundary-check.sh` | PostToolUse | Write | NEW from skill-creator |

**Installer changes (MODIFY `bin/install.js`):**

1. **Copy new hooks:** The existing hook copy block (~line 2037-2064) copies from `hooks/dist/`. Change to also copy non-dist hooks (`.sh` and standalone `.js` files from `hooks/`):

```javascript
// Copy standalone hooks (sh scripts, standalone JS)
const standaloneHooksSrc = path.join(src, 'hooks');
const standaloneHooks = ['session-state.sh', 'validate-commit.sh', 'phase-boundary-check.sh',
  'gsd-inject-snapshot.js', 'gsd-restore-work-state.js',
  'gsd-save-work-state.js', 'gsd-snapshot-session.js'];
for (const hook of standaloneHooks) {
  const srcFile = path.join(standaloneHooksSrc, hook);
  if (fs.existsSync(srcFile)) {
    let content = fs.readFileSync(srcFile, 'utf8');
    // Template paths for runtime
    content = content.replace(/'\.claude'/g, configDirReplacement);
    fs.writeFileSync(path.join(hooksDest, hook), content);
  }
}
```

2. **Register new hooks in settings.json:** Extend the settings.json hook registration block (~line 2146-2191) to include all new hook events:

```javascript
// SessionStart: add restore-work-state, inject-snapshot, session-state
// SessionEnd: add save-work-state, snapshot-session
// PreToolUse: add validate-commit (matcher: Bash)
// PostToolUse: add phase-boundary-check (matcher: Write)
```

**The statusline conflict:** The skill-creator has its own `gsd-statusline.js` that is more feature-rich than the existing one. Resolution: the skill-creator version becomes the canonical one. Move it into `hooks/dist/` (if it needs bundling) or `hooks/` (if standalone), replacing the existing version.

**Test files:** Hook test files (`.test.ts`) should NOT be installed to user machines. Keep them in the repo only. The installer already filters by extension (`.js`, `.sh`), so this is handled.

### Dependencies
Depends on: nothing (can be done independently). But must be done before workflow observation capture (Area 3) because the session hooks provide the state management that observations build on.


## Integration Area 3: Observation Capture in Workflows (7 files)

### Current State

The current GSD workflows in `get-shit-done/workflows/` have no observation capture. The skill-creator achieves observation via wrapper commands (`/wrap:execute`, `/wrap:verify`, `/wrap:plan`) that:
1. Load skills before the GSD command
2. Delegate to the real GSD command
3. Capture observations after completion

**The v4.0 goal:** Kill the wrapper commands. Bake observation capture directly into the 7 GSD workflow files.

### Integration Design

**Files to MODIFY:**

| Workflow | Observation Type | What to Capture |
|----------|-----------------|-----------------|
| `get-shit-done/workflows/execute-plan.md` | `phase_execution` | skills loaded, commits, files changed, phase status |
| `get-shit-done/workflows/verify-phase.md` | `phase_verification` | verification result, issues found, must-have coverage |
| `get-shit-done/workflows/plan-phase.md` | `phase_planning` | plans created, capabilities assigned, skill refs |
| `get-shit-done/workflows/discuss-phase.md` | `phase_discussion` | questions surfaced, assumptions listed |
| `get-shit-done/workflows/quick.md` | `quick_task` | task type, outcome |
| `get-shit-done/workflows/diagnose-issues.md` | `debug_session` | hypotheses, root cause, fix applied |
| `get-shit-done/workflows/execute-phase.md` | `phase_orchestration` | phase-level orchestration metadata |

**Pattern for each workflow modification:**

Add two new steps to each workflow file:

```xml
<step name="load_skills" priority="early">
Read config.json for `adaptive_learning.auto_load_skills` setting.
If enabled (default: true):
1. Extract phase domain from ROADMAP.md context
2. Scan skills/ for matching SKILL.md files by description keywords
3. Load matched skills into context
4. Display loaded skills list

If disabled or error: proceed without skills. Never block workflow.
</step>

<!-- ... existing workflow steps ... -->

<step name="capture_observation" priority="last">
If config.json `adaptive_learning.observe_sessions` is true (default):
1. Build observation JSON entry with type, timestamp, source, context
2. mkdir -p .planning/patterns
3. Append to .planning/patterns/sessions.jsonl
If error: log and continue. Never block workflow completion.
</step>
```

**Data flow:**

```
Workflow Step                    Observation
────────────                    ───────────
load_skills        ──────>      skills_loaded: ["skill1", "skill2"]
(existing steps)   ──────>      execution metadata (commits, files, etc.)
capture_observation ─────>      .planning/patterns/sessions.jsonl
```

**Observation JSONL schema** (from skill-creator, no changes needed):

```json
{
  "timestamp": "ISO-8601",
  "session_id": "string",
  "type": "phase_execution|phase_verification|phase_planning|...",
  "signal_strength": "highest|high|medium|low",
  "context": {
    "phase": "phase number",
    "task": "task description",
    "gsd_command": "/gsd:command-name"
  },
  "observation": "what was observed",
  "correction_from": "optional",
  "correction_to": "optional"
}
```

### Files to DELETE (wrapper commands killed):
- `commands/wrap/execute.md` -- replaced by inline observation in workflow
- `commands/wrap/verify.md` -- replaced by inline observation in workflow
- `commands/wrap/plan.md` -- replaced by inline observation in workflow
- `commands/wrap/phase.md` -- replaced by inline observation in workflow
- `commands/sc/wrap.md` -- meta-command for wrappers

### Dependencies
Depends on: Skills directory (Area 1) for skill loading, Hooks (Area 2) for session state.


## Integration Area 4: Agent Extension Fragments (merged inline)

### Current State

The skill-creator uses an extension system with marker-delimited fragments:
```html
<!-- PROJECT:gsd-skill-creator:injected-skills START -->
<injected_skills_protocol>
...content...
</injected_skills_protocol>
<!-- PROJECT:gsd-skill-creator:injected-skills END -->
```

These fragments are injected into agent files at install time. Two extensions exist:
1. `gsd-executor--injected-skills.md` -> into `agents/gsd-executor.md`
2. `gsd-planner--capability-inheritance.md` -> into `agents/gsd-planner.md`

### Integration Design

**Merge, don't inject.** Since GSD now owns the full agent files, the extension content should be written directly into the agent markdown. No marker system needed.

**Files to MODIFY:**

| Agent File | Extension Content | Merge Location |
|-----------|-------------------|----------------|
| `agents/gsd-executor.md` | Injected skills protocol (how to consume `<injected_skills>` sections) | Add as new section before execution steps |
| `agents/gsd-planner.md` | Capability inheritance (propagate ROADMAP capabilities into plan frontmatter) | Add as new section in planning protocol |
| `agents/gsd-verifier.md` | Skill-aware verification (check skill compliance in verification) | Add as new section in verification checklist |

Additional agent files from skill-creator that become NEW files in `agents/`:

| New Agent File | Purpose |
|---------------|---------|
| `agents/gsd-orchestrator.md` | Master routing agent (if not already present) |
| `agents/observer.md` | Passive session observer for pattern detection |
| `agents/codebase-navigator.md` | Example: codebase navigation agent |
| `agents/changelog-generator.md` | Example: changelog generation agent |
| `agents/doc-linter.md` | Example: documentation linting agent |

**The orchestrator overlap:** Both GSD and skill-creator define a `gsd-orchestrator.md`. The skill-creator version likely has skill-awareness additions. Resolution: merge skill-awareness content from skill-creator's version into GSD's existing orchestrator file. Do not maintain two files.

### Dependencies
Depends on: Skills directory (Area 1) -- agent extensions reference skill loading protocol.


## Integration Area 5: Teams Directory (NEW)

### Current State
GSD has no teams concept. The skill-creator defines 4 team configs:

| Team | Purpose | Topology |
|------|---------|----------|
| `gsd-debug-team` | Adversarial debugging with 3 investigators | leader-worker |
| `gsd-research-team` | Parallel research with multiple researchers | leader-worker |
| `code-review-team` | Code review team (example) | -- |
| `doc-generation-team` | Documentation generation team (example) | -- |

### Integration Design

**New source directory:** `teams/` at package root (peer to `agents/`, `skills/`)

```
teams/
├── gsd-debug-team/
│   └── config.json
├── gsd-research-team/
│   └── config.json
├── code-review-team/
│   └── config.json
└── doc-generation-team/
    └── config.json
```

**Installer changes (MODIFY `bin/install.js`):**

Add a new block for teams copy. Teams are JSON config files, not markdown, so path replacement is simpler:

```javascript
// Copy teams directory
const teamsSrc = path.join(src, 'teams');
if (fs.existsSync(teamsSrc)) {
  const teamsDest = path.join(targetDir, 'teams');
  copyWithPathReplacement(teamsSrc, teamsDest, pathPrefix, runtime);
  if (verifyInstalled(teamsDest, 'teams')) {
    console.log(`  ${green}✓${reset} Installed teams`);
  } else {
    failures.push('teams');
  }
}
```

**Runtime considerations:**
- Claude Code: teams are a Claude Code concept (`teams/*/config.json`); install as-is
- OpenCode: no teams concept; skip
- Gemini: no teams concept; skip
- Codex: multi-agent via config.toml, not team configs; skip or convert

**Note:** `copyWithPathReplacement` only templates `.md` files. Team configs are `.json`, so the function needs a small extension to also template `.json` files, OR team configs should use relative paths that do not need templating.

### Dependencies
None. Teams are standalone config files.


## Integration Area 6: Config Merge (skill-creator.json -> config.json)

### Current State

**GSD config.json** (in `.planning/`):
```json
{
  "project_name": "...",
  "concurrent": true,
  "quality": {
    "level": "standard",
    "context7_tokens": 8000
  }
}
```

**Skill-creator config** (`.planning/skill-creator.json`):
```json
{
  "integration": {
    "auto_load_skills": true,
    "observe_sessions": true,
    "phase_transition_hooks": true,
    "suggest_on_session_start": true,
    "install_git_hooks": true,
    "wrapper_commands": true
  },
  "token_budget": { "max_percent": 5, "warn_at_percent": 4 },
  "observation": { "retention_days": 90, "max_entries": 1000, "capture_corrections": true },
  "suggestions": { "min_occurrences": 3, "cooldown_days": 7, "auto_dismiss_after_days": 30 }
}
```

### Integration Design

**Merge into config.json under `adaptive_learning` key:**

```json
{
  "project_name": "...",
  "concurrent": true,
  "quality": { "level": "standard", "context7_tokens": 8000 },
  "adaptive_learning": {
    "auto_load_skills": true,
    "observe_sessions": true,
    "phase_transition_hooks": true,
    "suggest_on_session_start": true,
    "token_budget": { "max_percent": 5, "warn_at_percent": 4 },
    "observation": { "retention_days": 90, "max_entries": 1000, "capture_corrections": true },
    "suggestions": { "min_occurrences": 3, "cooldown_days": 7, "auto_dismiss_after_days": 30 }
  }
}
```

**Dropped keys:**
- `integration.wrapper_commands` -- wrappers killed; no toggle needed
- `integration.install_git_hooks` -- GSD installer handles hooks natively now

**Renamed for clarity:**
- `integration.*` flattened to `adaptive_learning.*` (removes nesting indirection)

**Implementation changes:**

1. **MODIFY `get-shit-done/bin/lib/init.cjs`:** Add `adaptive_learning` defaults to the config template used by `cmdInitNewProject`:
```javascript
adaptive_learning: {
  auto_load_skills: true,
  observe_sessions: true,
  phase_transition_hooks: true,
  suggest_on_session_start: true,
  token_budget: { max_percent: 5, warn_at_percent: 4 },
  observation: { retention_days: 90, max_entries: 1000, capture_corrections: true },
  suggestions: { min_occurrences: 3, cooldown_days: 7, auto_dismiss_after_days: 30 }
}
```

2. **MODIFY `get-shit-done/bin/lib/core.cjs`:** `loadConfig()` should handle the new `adaptive_learning` section (or it already returns the full JSON, in which case no change needed).

3. **MODIFY `get-shit-done/bin/lib/state.cjs`:** Config validation should warn on missing `adaptive_learning` section for projects created with v4.0+.

4. **NEW migration path:** For existing v3.x projects, the `adaptive_learning` key will simply be absent. All workflow code must default gracefully when the key is missing (same pattern as `quality.level` defaulting to `fast`).

### Dependencies
Must be done before workflow observation capture (Area 3), since workflows read these config values.


## Integration Area 7: CLAUDE.md Template + Merge in Installer

### Current State

The GSD installer does not manage CLAUDE.md. The skill-creator's `project-claude/install.cjs` has a CLAUDE.md install step with a `legacyThreshold` concept -- if the existing CLAUDE.md is over 100 lines, it is considered a legacy monolithic version and gets replaced.

GSD's CLAUDE.md template (~40 lines) covers:
- Tech stack
- Key file locations
- Commit convention
- Quick reference

### Integration Design

**New source file:** `CLAUDE.md.template` at package root (or `templates/CLAUDE.md`)

**Template content:** A slim (<80 line) CLAUDE.md that covers:
- Project tech stack (placeholder for user to fill)
- GSD file locations (`.planning/`, skills, agents, commands, hooks)
- Commit convention (Conventional Commits with Co-Authored-By)
- Quick reference (check state, GSD commands)
- Skill-creator integration notes (skills auto-load, observation capture)

**Installer changes (MODIFY `bin/install.js`):**

Add a CLAUDE.md management block. This is the most sensitive integration point because CLAUDE.md is user-owned content.

```javascript
// CLAUDE.md template management
const claudeTemplateSrc = path.join(src, 'templates', 'CLAUDE.md');
const claudeMdDest = isGlobal
  ? null  // Global installs do not write CLAUDE.md (it is project-specific)
  : path.join(process.cwd(), 'CLAUDE.md');

if (claudeMdDest && !isGlobal) {
  if (!fs.existsSync(claudeMdDest)) {
    // No CLAUDE.md exists: write template
    fs.copyFileSync(claudeTemplateSrc, claudeMdDest);
    console.log(`  ${green}✓${reset} Created CLAUDE.md template`);
  } else {
    // CLAUDE.md exists: do NOT overwrite
    // Show a message about updating manually
    console.log(`  ${dim}Existing CLAUDE.md found — skipping (review template at templates/CLAUDE.md)${reset}`);
  }
}
```

**Critical rule:** NEVER overwrite an existing CLAUDE.md. Users customize this file heavily. The installer can:
1. Create it if missing
2. Show a diff/suggestion if the template has changed
3. Never auto-replace

**For the `/gsd:new-project` command:** The project initialization workflow already creates planning files. Add CLAUDE.md template generation to that workflow (the `new-project.md` command), which creates the initial CLAUDE.md from the template with project-specific values filled in.

### Dependencies
None. Can be implemented independently.


## New Commands (from skill-creator)

### Commands to ADD to `commands/gsd/`:

| New Command | Source | Purpose |
|-------------|--------|---------|
| `suggest.md` | `commands/sc/suggest.md` | Analyze patterns, suggest skill creation |
| `digest.md` | `commands/sc/digest.md` | Digest observation data into insights |
| `observe.md` | `commands/sc/observe.md` | Manual observation capture |
| `dashboard.md` | `commands/gsd-dashboard.md` | Project dashboard generation |

### Commands to DELETE (wrapper system killed):

| Deleted Command | Reason |
|----------------|--------|
| `commands/wrap/execute.md` | Observation baked into workflow |
| `commands/wrap/verify.md` | Observation baked into workflow |
| `commands/wrap/plan.md` | Observation baked into workflow |
| `commands/wrap/phase.md` | Observation baked into workflow |
| `commands/sc/wrap.md` | Wrapper meta-command |
| `commands/sc/start.md` | Folded into GSD session hooks |
| `commands/sc/status.md` | Folded into `/gsd:progress` |

### Commands to KEEP as-is:

Skill-related commands (`beautiful-commits.md`, `file-operation-patterns.md`, etc.) that map to skills -- these become `/gsd:skill-name` commands. Move from `commands/` root into `commands/gsd/` namespace.


## Data Flow: Observation System

```
┌─────────────────────────────────────────────────────────────┐
│                    Observation Sources                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Workflows   │  Hooks       │  Manual      │  User          │
│  (7 files)   │  (session)   │  /gsd:observe│  corrections   │
│  execute     │  save-state  │              │  (auto-detect) │
│  verify      │  snapshot    │              │                │
│  plan...     │              │              │                │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────┘
       │              │              │                │
       v              v              v                v
┌─────────────────────────────────────────────────────────────┐
│            .planning/patterns/sessions.jsonl                 │
│            (append-only, one JSON per line)                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              v                         v
┌────────────────────┐    ┌────────────────────┐
│  /gsd:digest       │    │  /gsd:suggest      │
│  Pattern analysis  │    │  Skill proposals   │
│  Trend detection   │    │  From 3+ patterns  │
└────────────────────┘    └────────────────────┘
```

**Storage location:** `.planning/patterns/` -- this directory should be in `.gitignore` for shared repos (privacy concern with session observations).

**Retention:** Controlled by `adaptive_learning.observation.retention_days` (default: 90) and `max_entries` (default: 1000).


## Recommended Build Order

The integration has clear dependency chains. Build in this order:

```
Phase 1: Foundation (no dependencies)
├── Area 6: Config merge (config.json adaptive_learning block)
├── Area 1: Skills directory + installer copy logic
├── Area 5: Teams directory + installer copy logic
└── Area 7: CLAUDE.md template + installer logic

Phase 2: Infrastructure (depends on Phase 1)
├── Area 2: Hooks merge + settings.json registration
└── Area 4: Agent extensions merged inline

Phase 3: Behavior (depends on Phase 1 + 2)
├── Area 3: Observation capture baked into 7 workflows
├── New commands: suggest, digest, observe, dashboard
└── Kill wrapper commands (delete wrap/* and sc/* commands)

Phase 4: Polish
├── Update /gsd:help to list new commands
├── Update /gsd:progress to show skill/observation status
├── Multi-runtime testing (OpenCode, Gemini, Codex)
└── Installer end-to-end test
```

**Rationale:**
- Phase 1 items are all independent file-copy operations with no behavioral changes
- Phase 2 hooks and agent changes depend on skills existing (referenced in agent protocols)
- Phase 3 observation capture depends on config (where to read settings) and hooks (session state for context)
- Phase 4 is UX polish that depends on all features being functional


## Anti-Patterns

### Anti-Pattern 1: Fragment Injection at Install Time

**What people do:** Maintain extension fragments with marker comments, inject them into files during installation.
**Why it's wrong:** Creates two sources of truth (the fragment and the target file). Merge conflicts when either changes. Users see marker comments they do not understand.
**Do this instead:** Merge content directly into the canonical agent files. One file, one source of truth.

### Anti-Pattern 2: Wrapper Commands Instead of Native Integration

**What people do:** Create wrapper commands (`/wrap:execute`) that pre/post-process around existing commands.
**Why it's wrong:** Users must remember to use `/wrap:execute` instead of `/gsd:execute-phase`. Two code paths for the same operation. Wrapper can drift from the real command.
**Do this instead:** Add the skill-loading and observation-capture steps directly into the workflow files. One command, one path.

### Anti-Pattern 3: Separate Config Files

**What people do:** Keep `skill-creator.json` separate from `config.json`.
**Why it's wrong:** Two config files to manage, read, validate. Users do not know which file controls what. Tools must read both.
**Do this instead:** Merge into `config.json` under a namespaced key (`adaptive_learning`). One config file for all GSD settings.

### Anti-Pattern 4: Overwriting User CLAUDE.md

**What people do:** Auto-replace CLAUDE.md during installation.
**Why it's wrong:** CLAUDE.md is the most user-customized file. Overwriting destroys project-specific instructions, tech stack details, and team conventions.
**Do this instead:** Create only if missing. Show a diff/suggestion otherwise. Let the user merge manually.


## Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Installer -> Skills | File copy | One-way; installer writes, skills are passive markdown |
| Installer -> Hooks | File copy + settings.json | Hooks registered via settings.json entries |
| Workflows -> Config | `loadConfig()` read | Workflows read `adaptive_learning` settings at step start |
| Workflows -> Observations | File append | Append-only to `sessions.jsonl`; never read during workflow |
| Commands -> Observations | File read | `/gsd:digest` and `/gsd:suggest` read `sessions.jsonl` |
| Skills -> Context | Auto-activation | Claude Code loads matching `SKILL.md` files by description |
| Agents -> Skills | Reference in protocol | Agent markdown references skill loading protocol |
| Teams -> Agents | Config references | Team `config.json` references agent IDs |

## Sources

- `bin/install.js` -- GSD installer source (2464 lines), multi-runtime with path templating
- `~/gsd-skill-creator/project-claude/manifest.json` -- Skill-creator file manifest (368 lines)
- `~/gsd-skill-creator/project-claude/settings.json` -- Hook registrations for all events
- `~/gsd-skill-creator/project-claude/skill-creator.json` -- Integration config schema
- `~/gsd-skill-creator/project-claude/skills/skill-integration/` -- Observation protocol reference
- `~/gsd-skill-creator/project-claude/commands/wrap/execute.md` -- Wrapper command (being killed)
- `.planning/PROJECT.md` -- Project context and v4.0 requirements

---
*Architecture research for: GSD v4.0 Adaptive Learning Integration*
*Researched: 2026-03-07*
