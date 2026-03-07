# Stack Research: Adaptive Learning Integration (v4.0)

**Domain:** CLI tool extension -- merging adaptive learning layer into existing Node.js CJS framework
**Researched:** 2026-03-07
**Confidence:** HIGH

## Recommended Stack

### Core Technologies (No Changes)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | >=18 | Runtime | Already required by GSD; all hooks and CLI are CJS |
| CJS modules | N/A | Module format | Entire codebase is CJS; installer writes `{"type":"commonjs"}` package.json to prevent ESM inheritance |
| Markdown (YAML frontmatter) | N/A | Skill/agent/command definitions | Claude Code auto-loads `.claude/skills/*/SKILL.md`; this is the Claude Code convention, not a choice |
| JSON | N/A | Config, settings, team definitions | `settings.json` is Claude Code's hook registration format; `config.json` is team config format |

### New Patterns Required (Zero New Dependencies)

| Pattern | Purpose | Implementation |
|---------|---------|----------------|
| JSONL append | Session observation log | `fs.appendFileSync()` -- one JSON object per line, newline-delimited |
| CLAUDE.md merge | Preserve user additions during install | String-based section parsing with marker comments |
| Hook deduplication | Merge 9 skill-creator hooks into GSD's 3 hook slots | Consolidation into fewer JS entry points that dispatch internally |
| Directory copy with manifest | Ship skills/teams alongside commands/agents | Extend existing `copyWithPathReplacement()` + manifest pattern |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs` (built-in) | N/A | File I/O for skills, hooks, teams, JSONL | All file operations -- no external deps needed |
| `path` (built-in) | N/A | Cross-platform path resolution | All path construction |
| `crypto` (built-in) | N/A | File manifest hashing | Already used in installer for modification detection |
| `os` (built-in) | N/A | Home directory resolution | Already used in installer for `$HOME` expansion |

### Development Tools (No Changes)

| Tool | Purpose | Notes |
|------|---------|-------|
| Node.js built-in test runner | `node --test tests/*.test.cjs` | Already in use; extend for new integration tests |
| Vitest | Desktop/TS tests | Not relevant to this milestone (CJS-only changes) |

## What Gets Installed Where

### Current Installer Output (bin/install.js)

```
~/.claude/
  commands/gsd/          # 30+ workflow commands
  agents/                # 11 agent .md files
  hooks/                 # 3 hooks (check-update, context-monitor, statusline)
  get-shit-done/         # Core framework (bin/, templates/, workflows/, references/)
  settings.json          # Hook registrations (SessionStart, PostToolUse)
  package.json           # {"type":"commonjs"}
```

### v4.0 Additions

```
~/.claude/
  skills/                # NEW: 16 auto-loading skills (gsd-workflow, session-awareness, etc.)
    gsd-workflow/SKILL.md
    session-awareness/SKILL.md
    security-hygiene/SKILL.md
    ... (16 total)
  teams/                 # NEW: 4 team configs
    gsd-research-team/config.json
    gsd-debug-team/config.json
    code-review-team/config.json
    doc-generation-team/config.json
  hooks/                 # MERGED: 3 existing + 6 new = consolidated entry points
    gsd-check-update.js       # (existing, unchanged)
    gsd-context-monitor.js    # (existing, unchanged)
    gsd-statusline.js         # (existing, unchanged)
    gsd-session-start.js      # NEW: consolidates restore-work-state + inject-snapshot + session-state
    gsd-session-end.js        # NEW: consolidates save-work-state + snapshot-session
    validate-commit.sh        # NEW: PreToolUse commit validation
    phase-boundary-check.sh   # NEW: PostToolUse boundary check
  settings.json          # EXTENDED: new hook registrations added
```

### Target Project (after /gsd:new-project)

```
project/
  .planning/
    patterns/
      sessions.jsonl     # NEW: observation log (gitignored)
  CLAUDE.md              # NEW: generated from template, merged on reinstall
```

## Integration Points with Existing Installer

### 1. Skills Installation

**Pattern:** Mirror the existing `agents/` copy logic. Skills are directories, not flat files.

```javascript
// Existing agent copy pattern (bin/install.js ~line 1964-2005):
// - mkdirSync(agentsDest, { recursive: true })
// - Remove old gsd-*.md files
// - Copy new agents with path replacement
// - Verify installation

// Skills copy pattern (NEW):
// - mkdirSync(skillsDest, { recursive: true })
// - Remove old gsd-* and known skill-creator directories
// - copyDir for each skill/<name>/ directory
// - No frontmatter conversion needed (skills are Claude-only)
// - Verify installation
```

**Key difference from agents:** Skills are directories containing `SKILL.md` (+ optional `references/`), not single files. Use recursive copy.

**Pruning support:** Users may delete unwanted skills after install. The manifest (`gsd-manifest.json`) tracks installed files. On reinstall, only overwrite files that match the manifest hash -- do not re-add user-deleted skills. This requires a `skills_installed` array in the manifest.

### 2. Teams Installation

**Pattern:** Same as skills -- directory copy.

```javascript
// Teams copy pattern:
// - mkdirSync(teamsDest, { recursive: true })
// - Copy each team/<name>/config.json
// - No path replacement needed (team configs reference agent IDs, not paths)
// - Verify installation
```

### 3. Hook Consolidation Strategy

**Problem:** skill-creator has 9 hooks registered in `.claude/settings.json` across 4 event types. GSD installer registers 2 hooks (SessionStart + PostToolUse). The installed hooks directory has 3 files. Merging naively would put 12 hook entries in settings.json -- messy and slow.

**Solution:** Consolidate by event type into dispatcher scripts.

| Event | Current GSD Hook | skill-creator Hooks | Merged Result |
|-------|-----------------|---------------------|---------------|
| SessionStart | `gsd-check-update.js` | `gsd-restore-work-state.js`, `gsd-inject-snapshot.js`, `session-state.sh` | `gsd-check-update.js` + `gsd-session-start.js` (new, consolidates 3) |
| SessionEnd | (none) | `gsd-save-work-state.js`, `gsd-snapshot-session.js` | `gsd-session-end.js` (new, consolidates 2) |
| PreToolUse (Bash) | (none) | `validate-commit.sh` | `validate-commit.sh` (ship as-is, 38 lines) |
| PostToolUse (Write) | `gsd-context-monitor.js` | `phase-boundary-check.sh` | `gsd-context-monitor.js` + `phase-boundary-check.sh` |

**Result:** 6 hook files, 5 settings.json entries (down from 9 separate registrations). Each consolidated JS hook internally calls the logic of its component hooks sequentially.

### 4. settings.json Hook Registration

**Pattern:** Extend the existing `settings.hooks` merge logic in `finishInstall()`.

```javascript
// Existing pattern (bin/install.js ~line 2146-2190):
// 1. Read or create settings.hooks
// 2. Check if hook already registered (idempotent via string match)
// 3. Push new entry if missing
// 4. Write settings

// Extend for v4.0:
// - Add SessionEnd array (new event type)
// - Add PreToolUse entry for validate-commit.sh (matcher: "Bash")
// - Add PostToolUse entry for phase-boundary-check.sh (matcher: "Write")
// - Keep existing gsd-check-update and gsd-context-monitor unchanged
```

### 5. CLAUDE.md Template + Merge Strategy

**Template:** Ship a `get-shit-done/templates/CLAUDE.md` with GSD-specific sections wrapped in markers:

```markdown
<!-- GSD:BEGIN -->
# Project Name

## Tech Stack
- ...

## Key File Locations
- `.planning/` -- GSD project management
- `.claude/skills/` -- auto-activating skills
- ...

## Commit Convention
- Conventional Commits: `<type>(<scope>): <subject>`
- ...
<!-- GSD:END -->
```

**Merge algorithm:**

```
1. If no CLAUDE.md exists: write template verbatim
2. If CLAUDE.md exists with GSD markers:
   a. Extract content between <!-- GSD:BEGIN --> and <!-- GSD:END -->
   b. Replace that section with updated template
   c. Preserve everything outside markers
3. If CLAUDE.md exists WITHOUT GSD markers:
   a. Prepend GSD section (with markers) above existing content
   b. Separate with blank line
   c. User's original content fully preserved
```

**Edge cases:**
- Multiple GSD marker pairs: only replace the first pair, warn about duplicates
- Marker in code block: regex should match only at line start (`/^<!-- GSD:BEGIN -->$/m`)
- Empty CLAUDE.md: treat as case 1 (no existing content)
- CLAUDE.md is a symlink: follow the symlink, write to target

### 6. JSONL Session Observation

**Pattern:** Append-only log at `.planning/patterns/sessions.jsonl`.

```javascript
// Observation entry format:
{
  "ts": "2026-03-07T12:00:00.000Z",
  "event": "phase_complete",
  "phase": "03",
  "plan": "01",
  "duration_ms": 45000,
  "quality_level": "standard",
  "gates_passed": 4,
  "gates_warned": 1,
  "gates_blocked": 0,
  "files_changed": 12,
  "tests_added": 3
}
```

**Integration point:** GSD workflow commands (`execute-plan`, `verify-phase`, `phase-complete`) emit observations by appending to this file. This is a one-liner per call site:

```javascript
fs.appendFileSync(
  path.join(planningRoot, 'patterns', 'sessions.jsonl'),
  JSON.stringify(observation) + '\n'
);
```

**File creation:** `cmdInitNewProject` creates `.planning/patterns/` directory. The JSONL file is created on first append (fs.appendFileSync creates if missing).

**Gitignore:** `.planning/patterns/` is already in `.gitignore` per CLAUDE.md. Verify this in `cmdInitNewProject`.

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| JSONL for observations | SQLite | Overkill -- append-only log with line-based reads is simpler, no binary dependency, grep-friendly |
| JSONL for observations | JSON array file | Not append-safe (must read-modify-write entire file; concurrent sessions corrupt) |
| Marker-based CLAUDE.md merge | Full YAML frontmatter | CLAUDE.md is freeform markdown, not YAML; markers are simpler and visible |
| Consolidated hook dispatchers | Ship all 9 hooks separately | Too many settings.json entries; hook execution overhead per session start |
| Ship skills as directories | Ship skills as single files | Claude Code requires `skills/<name>/SKILL.md` directory structure |
| Inline observation in workflow | Separate observation daemon | No daemon process; hooks and workflow commands are the natural emit points |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| External dependencies (npm packages) | GSD runs in `~/.claude/` with no node_modules; installer must be self-contained | Node.js built-ins only (fs, path, crypto, os) |
| SQLite/LevelDB for observations | Binary dependency, cross-platform build issues, not grep-friendly | JSONL (plain text, one JSON object per line) |
| TOML for team configs | Claude Code uses JSON for settings and team configs | JSON (config.json per team) |
| Separate installer for skills | Fragmentation; user runs one command | Extend existing `bin/install.js` |
| CLAUDE.md generation via AST parsing | Markdown AST parsers are external deps; overkill for section replacement | Regex-based marker matching (simple, predictable) |

## Stack Patterns by Variant

**If installing for Claude Code (primary target):**
- Skills, teams, hooks all install to `~/.claude/`
- CLAUDE.md merge applies to project root
- settings.json hook registration uses Claude Code format

**If installing for OpenCode:**
- Skills directory NOT supported (OpenCode has no skills auto-loading)
- Teams directory NOT supported (OpenCode has no teams)
- Hooks install to `~/.config/opencode/hooks/`
- CLAUDE.md equivalent: `AGENTS.md` (OpenCode convention) -- defer to future milestone

**If installing for Gemini:**
- Skills NOT supported (Gemini has no skills directory)
- Teams NOT supported (Gemini has no teams)
- Hooks use AfterTool instead of PostToolUse
- CLAUDE.md equivalent: `GEMINI.md` -- defer to future milestone

**If installing for Codex:**
- Skills convert to `skills/<name>/SKILL.md` (already Codex-compatible format)
- Teams NOT supported
- No hooks (Codex has no hook system)
- No CLAUDE.md equivalent

**Implication:** Skills, teams, CLAUDE.md merge, and session observation are Claude Code features. The installer should gate these behind `runtime === 'claude'` checks. Other runtimes get hooks only (where supported).

## Version Compatibility

| Component | Requires | Notes |
|-----------|----------|-------|
| Skills auto-loading | Claude Code with skills support | Available in current Claude Code; `~/.claude/skills/*/SKILL.md` convention |
| Teams | Claude Code with teams support | `~/.claude/teams/*/config.json` convention; requires agent IDs to match installed agents |
| settings.json hooks | Claude Code / Gemini | Hook format: `{hooks: [{type: "command", command: "..."}]}` |
| JSONL append | Node.js fs | `fs.appendFileSync` is atomic for small writes on all platforms |
| CLAUDE.md | Any runtime | Plain markdown file; merge strategy is runtime-agnostic |

## File Size Budget

| Component | Files | Est. Size | Notes |
|-----------|-------|-----------|-------|
| 16 skills | 16 dirs, ~20 files | ~80KB | SKILL.md + optional references/ |
| 4 teams | 4 dirs, 4 files | ~8KB | config.json per team |
| 2 new hooks | 2 JS files | ~3KB | Consolidated dispatchers |
| 2 shell hooks | 2 .sh files | ~1KB | validate-commit + phase-boundary |
| CLAUDE.md template | 1 file | ~1KB | In get-shit-done/templates/ |
| sessions.jsonl | 1 file (grows) | ~50B/entry | Append-only, gitignored |

**Total installer addition:** ~93KB of new content to copy, zero new npm dependencies.

## Sources

- `bin/install.js` (lines 1900-2234) -- existing installer file copy, hook registration, manifest, and settings.json patterns
- `.claude/settings.json` -- current hook registration format (SessionStart, SessionEnd, PreToolUse, PostToolUse)
- `.claude/skills/*/SKILL.md` -- existing skill directory convention (16 skills observed)
- `.claude/hooks/` -- existing skill-creator hooks (9 files, 510 LOC total)
- `.claude/teams/*/config.json` -- existing team config format
- `hooks/dist/` -- GSD's 3 bundled hooks (337 LOC total)
- `.planning/PROJECT.md` -- v4.0 milestone requirements and constraints

---
*Stack research for: GSD v4.0 Adaptive Learning Integration*
*Researched: 2026-03-07*
