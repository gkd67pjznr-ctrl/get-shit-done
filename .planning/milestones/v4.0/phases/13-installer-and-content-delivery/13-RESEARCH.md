# Phase 13: Installer and Content Delivery - Research

**Researched:** 2026-03-08
**Domain:** Node.js installer extension -- file copying, manifest tracking, marker-based merge, hook registration
**Confidence:** HIGH

## Summary

Phase 13 extends the existing `bin/install.js` (2,464 lines) with four new capabilities: (1) copying skills from `skills/` to `~/.claude/skills/`, (2) copying teams from `teams/` to `~/.claude/teams/`, (3) creating/updating CLAUDE.md with marker-based merge, and (4) registering all hook scripts in settings.json with consolidation and orphan cleanup.

The existing installer already has all the infrastructure patterns needed: `generateManifest()` + `writeManifest()` for SHA256-based file tracking, `saveLocalPatches()` for user-modified file backup, `mergeCodexConfig()` for marker-based merge (direct template for CLAUDE.md), `cleanupOrphanedHooks()` for removing stale hook registrations, and `readSettings()`/`writeSettings()` for settings.json I/O. The work is extension of proven patterns, not greenfield.

**Primary recommendation:** Extend `install()` function with three new copy steps (skills, teams, session/validation hooks) and a new `mergeClaudeMd()` function modeled on `mergeCodexConfig()`. Extend `writeManifest()` to track skills and teams. Add manifest-diff logic for deleted-skill detection (INST-05).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- CLAUDE.md merge uses HTML comment markers `<!-- GSD:BEGIN -->` / `<!-- GSD:END -->`
- When CLAUDE.md exists without markers, prepend GSD section at top of file
- On update, if user modified content inside markers: back up modified file (like local-patches), then overwrite marker content with latest template
- Co-Authored-By line respects the runtime's attribution setting via existing `getCommitAttribution()`
- Deleted-skill tracking via manifest diff: if skill/team was in previous manifest but directory is now gone, it was intentionally deleted by user
- First install (no manifest) = install everything
- Applies to both skills and teams -- consistent behavior across content types
- `install --reset-skills` flag clears deletion tracking in manifest, next install treats all as fresh
- At end of install, one summary line: "Skipped N user-removed items: skill-a, team-b"
- Hook consolidation: append GSD hooks, preserve user hooks, never remove entries the installer did not create
- Duplicate detection by command string match -- if same command already in event array, skip it
- One entry per hook in the event array
- Clean up orphaned GSD hooks from previous versions: maintain list of current GSD hook commands, remove any GSD hook in settings.json not in current list
- Identifying GSD hooks for orphan cleanup: match by path containing `.claude/hooks/gsd-` prefix
- Skills are Claude Code-only -- skip for OpenCode, Gemini, Codex
- Teams are Claude Code-only -- skip for other runtimes
- Hooks remain cross-runtime -- shell scripts and Node.js work anywhere
- For non-Claude runtimes, print one-line notice: "Skills and teams are Claude Code features -- skipped for [runtime]."

### Claude's Discretion
- Exact structure of the CLAUDE.md template content within markers
- How to identify GSD-owned hooks vs user hooks for orphan cleanup (suggested: path prefix matching)
- Internal implementation of manifest diff algorithm for deletion detection
- Order of operations within the install flow (when to copy skills vs teams vs register hooks)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INST-01 | Installer copies skills directory to `~/.claude/skills/` | Extend `install()` with skill copy step; use `copyWithPathReplacement()` pattern from agent copy (line 1966-2006); Claude Code-only guard |
| INST-02 | Installer copies teams directory to `~/.claude/teams/` | Same pattern as INST-01; simple directory copy; Claude Code-only guard |
| INST-03 | Installer copies all hook scripts and registers in settings.json | Hooks already copied to `hooks/` (line 2037-2064); registration needs expansion beyond current 2 hooks to include session/validation hooks |
| INST-04 | Installer creates CLAUDE.md using marker-based merge | New `mergeClaudeMd()` function modeled on `mergeCodexConfig()` (line 644-704); three cases: new, with markers, without markers |
| INST-05 | Installer tracks user-deleted skills in manifest so updates don't re-add them | Extend manifest with `deleted_items` key; manifest diff between previous and current install; `--reset-skills` flag |
| HOOK-01 | Session hooks merged -- snapshot, work state, session-state | 6 hooks to register: gsd-inject-snapshot.js, gsd-restore-work-state.js, session-state.sh (SessionStart); gsd-save-work-state.js, gsd-snapshot-session.js (SessionEnd) |
| HOOK-02 | Commit validation hook ships with GSD | validate-commit.sh registered on PreToolUse with matcher "Bash" |
| HOOK-03 | Phase boundary check hook ships with GSD | phase-boundary-check.sh registered on PostToolUse with matcher "Write" |
| HOOK-04 | Hook consolidation by event type -- no duplicate registrations | Expand `cleanupOrphanedHooks()` pattern; duplicate detection by command string; orphan cleanup by `gsd-` path prefix |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | File copy, read, write, mkdir | Already used throughout install.js |
| Node.js crypto | built-in | SHA256 file hashing for manifests | Already used via `fileHash()` |
| Node.js path | built-in | Cross-platform path construction | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js os | built-in | Home directory resolution | Already used for `os.homedir()` |

No new dependencies needed. All work extends the existing `bin/install.js` using Node.js built-ins already imported.

## Architecture Patterns

### Existing Install Flow (to extend)
```
install(isGlobal, runtime) [line 1875]
  1. saveLocalPatches(targetDir)          -- backup user-modified files
  2. cleanupOrphanedFiles(targetDir)      -- remove old version artifacts
  3. Copy commands (runtime-specific)     -- commands/gsd/ or command/ or skills/
  4. Copy get-shit-done skill             -- core GSD library
  5. Copy agents                          -- gsd-*.md agent files
  6. Copy CHANGELOG, VERSION              -- metadata files
  7. Copy hooks from hooks/dist/          -- bundled hook scripts
  8. writeManifest(targetDir, runtime)     -- SHA256 manifest for all files
  9. reportLocalPatches(targetDir)         -- notify user of backed-up files

finishInstall(...)
  10. Configure statusline in settings.json
  11. Write settings.json
```

### Extended Install Flow (Phase 13)
```
install(isGlobal, runtime)
  1. saveLocalPatches(targetDir)
  2. cleanupOrphanedFiles(targetDir)
  3. Copy commands
  4. Copy get-shit-done skill
  5. Copy agents
  6. Copy CHANGELOG, VERSION
  7. Copy hooks from hooks/dist/
  NEW 8.  Copy skills to skills/ (Claude Code-only)       -- INST-01
  NEW 9.  Copy teams to teams/ (Claude Code-only)         -- INST-02
  NEW 10. Merge CLAUDE.md                                  -- INST-04
  11. writeManifest(targetDir, runtime)  -- extended for skills/teams
  12. reportLocalPatches(targetDir)

finishInstall(...)
  13. Configure statusline
  NEW 14. Register all hooks (session + validation)        -- HOOK-01/02/03/04
  15. Write settings.json
```

### Pattern 1: Marker-Based Merge (CLAUDE.md)
**What:** Three-case merge pattern matching existing `mergeCodexConfig()`
**When to use:** INST-04 implementation

```javascript
// Modeled on mergeCodexConfig() at line 644-704
const GSD_CLAUDE_BEGIN = '<!-- GSD:BEGIN -->';
const GSD_CLAUDE_END = '<!-- GSD:END -->';

function mergeClaudeMd(claudeMdPath, gsdContent) {
  // Case 1: No CLAUDE.md -- create fresh with GSD block
  if (!fs.existsSync(claudeMdPath)) {
    fs.writeFileSync(claudeMdPath, gsdContent + '\n');
    return 'created';
  }

  const existing = fs.readFileSync(claudeMdPath, 'utf8');
  const beginIdx = existing.indexOf(GSD_CLAUDE_BEGIN);
  const endIdx = existing.indexOf(GSD_CLAUDE_END);

  // Case 2: Has markers -- replace content between them
  if (beginIdx !== -1 && endIdx !== -1) {
    const before = existing.substring(0, beginIdx);
    const after = existing.substring(endIdx + GSD_CLAUDE_END.length);
    // Check if user modified marker content -- backup if so
    const oldMarkerContent = existing.substring(beginIdx, endIdx + GSD_CLAUDE_END.length);
    if (oldMarkerContent !== gsdContent) {
      // Back up via saveLocalPatches pattern
    }
    fs.writeFileSync(claudeMdPath, before + gsdContent + after);
    return 'updated';
  }

  // Case 3: No markers -- prepend GSD block at top
  fs.writeFileSync(claudeMdPath, gsdContent + '\n\n' + existing);
  return 'prepended';
}
```

### Pattern 2: Manifest-Diff Deletion Detection (INST-05)
**What:** Compare previous manifest's skills/teams entries against filesystem to detect intentional deletions
**When to use:** Before copying skills/teams

```javascript
function getDeletedItems(configDir) {
  const manifestPath = path.join(configDir, MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) return []; // First install

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const deleted = [];

  // Check skills that were in manifest but dir no longer exists
  for (const relPath of Object.keys(manifest.files || {})) {
    if (relPath.startsWith('skills/')) {
      const skillName = relPath.split('/')[1];
      const skillDir = path.join(configDir, 'skills', skillName);
      if (!fs.existsSync(skillDir)) {
        deleted.push('skills/' + skillName);
      }
    }
    // Same for teams/
    if (relPath.startsWith('teams/')) {
      const teamFile = relPath.split('/')[1];
      const teamPath = path.join(configDir, 'teams', teamFile);
      if (!fs.existsSync(teamPath)) {
        deleted.push('teams/' + teamFile);
      }
    }
  }

  return [...new Set(deleted)]; // Deduplicate
}
```

### Pattern 3: Hook Registration with Consolidation (HOOK-04)
**What:** Register all GSD hooks with duplicate prevention and orphan cleanup
**When to use:** In `finishInstall()` or near settings.json write

```javascript
// Complete hook registry -- all GSD hooks and their event types
const GSD_HOOKS = [
  // Session hooks (HOOK-01)
  { event: 'SessionStart', command: 'gsd-restore-work-state.js', type: 'node' },
  { event: 'SessionStart', command: 'gsd-inject-snapshot.js', type: 'node' },
  { event: 'SessionStart', command: 'session-state.sh', type: 'bash' },
  { event: 'SessionEnd', command: 'gsd-save-work-state.js', type: 'node' },
  { event: 'SessionEnd', command: 'gsd-snapshot-session.js', type: 'node' },
  // Validation hooks (HOOK-02, HOOK-03)
  { event: 'PreToolUse', command: 'validate-commit.sh', type: 'bash', matcher: 'Bash' },
  { event: 'PostToolUse', command: 'phase-boundary-check.sh', type: 'bash', matcher: 'Write' },
  // Existing hooks (already registered)
  { event: 'SessionStart', command: 'gsd-check-update.js', type: 'node' },
  { event: 'PostToolUse', command: 'gsd-context-monitor.js', type: 'node' },
];
```

### Anti-Patterns to Avoid
- **Hardcoding hook paths:** Always use `buildHookCommand()` for node hooks, prefix `bash` for shell hooks. Paths must be templated for local vs global installs.
- **Overwriting user hooks:** The existing uninstall logic (line 1436) shows how to filter GSD hooks from user hooks -- use the same pattern in reverse for registration.
- **Adding skills/teams for non-Claude runtimes:** Guard with `if (runtime === 'claude')` -- skills and teams are Claude Code-only features.
- **Registering duplicate hooks:** Always check `settings.hooks[event].some(entry => entry.hooks.some(h => h.command.includes(hookName)))` before adding.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File hashing | Custom hash function | Existing `fileHash()` (line 1727) | Uses crypto.createHash('sha256'), already proven |
| Settings.json I/O | Manual JSON parse/write | Existing `readSettings()`/`writeSettings()` | Handles missing files, proper formatting |
| Marker-based merge | New merge paradigm | Model on `mergeCodexConfig()` (line 644-704) | Same three-case pattern, proven with Codex config |
| Local patch backup | New backup system | Existing `saveLocalPatches()` (line 1807) | Already handles modified file detection and backup |
| Hook command building | Inline path construction | Existing `buildHookCommand()` (line 239) | Handles forward-slash normalization |
| Orphan cleanup | New cleanup logic | Extend `cleanupOrphanedHooks()` (line 1195) | Pattern already handles removing stale hooks |
| Path templating | Runtime-specific paths | Existing `pathPrefix` + `toHomePrefix()` | Already handles global vs local, all runtimes |

**Key insight:** Every capability needed for Phase 13 has a direct analog already in install.js. The work is extending existing patterns to cover new content types (skills, teams, CLAUDE.md), not inventing new infrastructure.

## Common Pitfalls

### Pitfall 1: Hook Source Location Mismatch
**What goes wrong:** Session hooks (.claude/hooks/) are source-of-truth for development but hooks/dist/ is what gets shipped via npm. The installer copies from hooks/dist/, not .claude/hooks/.
**Why it happens:** .claude/hooks/ has .test.ts files and ESM imports; hooks/dist/ has bundled CJS versions.
**How to avoid:** Ensure all 6 session hooks (gsd-inject-snapshot, gsd-restore-work-state, gsd-save-work-state, gsd-snapshot-session, session-state.sh, validate-commit.sh, phase-boundary-check.sh) are built into hooks/dist/ before release. The existing hook copy block (line 2037-2064) copies everything from hooks/dist/.
**Warning signs:** Missing hooks in hooks/dist/ that exist in .claude/hooks/.

### Pitfall 2: Manifest Structure Incompatibility
**What goes wrong:** Adding skills/teams to manifest without matching the existing structure causes manifest diff to break.
**Why it happens:** `writeManifest()` currently tracks files under `get-shit-done/`, `commands/gsd/`, `agents/`, and runtime-specific paths. Skills and teams need the same `files[relPath] = hash` pattern.
**How to avoid:** Follow the exact same pattern as agents (line 1791-1797): iterate directory entries, prefix with `skills/{skillName}/` or `teams/`, hash each file.
**Warning signs:** `saveLocalPatches()` not detecting modified skills.

### Pitfall 3: CLAUDE.md in Wrong Location
**What goes wrong:** CLAUDE.md lives in the project root (working directory), not in `~/.claude/`. The installer must write to `process.cwd()` for local installs or handle global installs differently.
**Why it happens:** CLAUDE.md is a project-level file, unlike settings.json which is in the config directory.
**How to avoid:** For global installs, CLAUDE.md merge is likely a no-op or should be skipped (there's no "global project root"). For local installs, write to `path.join(process.cwd(), 'CLAUDE.md')`.
**Warning signs:** CLAUDE.md appearing in `~/.claude/` instead of project root.

### Pitfall 4: Settings.json Hook Matcher Omission
**What goes wrong:** validate-commit.sh needs `matcher: "Bash"` and phase-boundary-check.sh needs `matcher: "Write"` -- without matchers, these hooks fire on every tool use.
**Why it happens:** SessionStart/SessionEnd hooks don't use matchers, but PreToolUse/PostToolUse do.
**How to avoid:** The hook registry data structure must include matcher info. See the existing settings.json which shows the correct structure with matcher fields.
**Warning signs:** validate-commit.sh firing on non-Bash tool calls.

### Pitfall 5: Existing SessionStart/SessionEnd Hooks Referenced by Name
**What goes wrong:** The session hooks (gsd-inject-snapshot, gsd-restore-work-state, etc.) currently reference `npx skill-creator orchestrator` commands. After integration, these must invoke GSD-native code instead.
**Why it happens:** The hook scripts in .claude/hooks/ were written for the standalone skill-creator package.
**How to avoid:** The hooks in hooks/dist/ should be the bundled, dependency-free versions. Check that hooks/dist/ doesn't contain references to `skill-creator` or `npx skill-creator`.
**Warning signs:** Hooks failing because `skill-creator` is not installed.

### Pitfall 6: --reset-skills Flag Parsing
**What goes wrong:** The `--reset-skills` flag needs to be parsed in the arg handling at the top of install.js (line 36-58) and threaded through to the deletion detection logic.
**Why it happens:** Easy to forget to add new flags to the parser.
**How to avoid:** Add `const hasResetSkills = args.includes('--reset-skills');` alongside other flag definitions, then pass to deletion detection.

## Code Examples

### Hook Registration Structure (from existing settings.json)
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{ "type": "command", "command": "node .claude/hooks/gsd-check-update.js" }]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/validate-commit.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/phase-boundary-check.sh" }]
      }
    ]
  }
}
```

### Skill Copy Pattern (modeled on agent copy, line 1966-2006)
```javascript
// Skills are Claude Code-only
if (runtime === 'claude') {
  const skillsSrc = path.join(src, 'skills');
  if (fs.existsSync(skillsSrc)) {
    const skillsDest = path.join(targetDir, 'skills');
    const deletedItems = getDeletedItems(targetDir);

    for (const skillName of fs.readdirSync(skillsSrc)) {
      if (deletedItems.includes('skills/' + skillName)) continue; // INST-05
      const skillSrcDir = path.join(skillsSrc, skillName);
      const skillDestDir = path.join(skillsDest, skillName);
      if (fs.statSync(skillSrcDir).isDirectory()) {
        copyRecursive(skillSrcDir, skillDestDir);
      }
    }
    console.log(`  ${green}+${reset} Installed skills`);
  }
}
```

### CLAUDE.md Template Content (from CONTEXT.md discussion)
```markdown
<!-- GSD:BEGIN -->
# GSD Framework
## Commit Convention
- Conventional Commits: `<type>(<scope>): <subject>`
- Include `Co-Authored-By: [runtime-specific]`
## Key Paths
- `.planning/` -- GSD project management
- `.claude/skills/` -- auto-loading skills
- `.claude/hooks/` -- deterministic hooks
## Commands
- Build: `[project-specific]`
- Test: `[project-specific]`
- Lint: `[project-specific]`
<!-- GSD:END -->
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate skill-creator install | Unified GSD install | Phase 13 (this phase) | One install step instead of two |
| Manual CLAUDE.md creation | Marker-based auto-generation | Phase 13 (this phase) | Consistent project setup |
| 2 hooks registered (update check, context monitor) | All 9 hooks registered | Phase 13 (this phase) | Full session lifecycle coverage |
| No manifest tracking for skills/teams | SHA256 manifest diff | Phase 13 (this phase) | User deletion preferences respected |

## Open Questions

1. **Hook bundling status**
   - What we know: hooks/dist/ currently has 3 files (gsd-check-update.js, gsd-context-monitor.js, gsd-statusline.js). Session hooks exist in .claude/hooks/ but may not be in hooks/dist/.
   - What's unclear: Are session hooks (gsd-inject-snapshot, gsd-restore-work-state, gsd-save-work-state, gsd-snapshot-session) and validation hooks (validate-commit.sh, phase-boundary-check.sh, session-state.sh) bundled in hooks/dist/ or do they need to be added?
   - Recommendation: Check hooks build process. If not bundled, add a build step or copy shell scripts directly from source. Shell scripts (.sh) can be copied as-is. JS hooks with ESM imports need bundling.

2. **CLAUDE.md for global installs**
   - What we know: CLAUDE.md is a project-level file. Global installs target `~/.claude/` (no project root).
   - What's unclear: Should CLAUDE.md be created on global installs? If so, where?
   - Recommendation: Skip CLAUDE.md merge for global installs. It only makes sense in a project context (local install or when a project directory is detected).

3. **Session hook dependency on skill-creator**
   - What we know: .claude/hooks/ session hooks call `npx skill-creator orchestrator`. This won't work when skill-creator is deprecated.
   - What's unclear: Are the hooks/dist/ versions already dependency-free, or do they still reference skill-creator?
   - Recommendation: Verify hooks/dist/ scripts are self-contained. If they reference skill-creator, they need to be rewritten as GSD-native hooks (likely a separate plan).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | none -- tests invoked via `npm test` which runs vitest for src/ and `node --test` for tests/*.test.cjs |
| Quick run command | `node --test tests/foundation.test.cjs` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INST-01 | Skills copied to ~/.claude/skills/ | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| INST-02 | Teams copied to ~/.claude/teams/ | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| INST-03 | Hooks copied and registered in settings.json | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| INST-04 | CLAUDE.md marker-based merge | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| INST-05 | Deleted skills not re-added on update | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| HOOK-01 | Session hooks registered | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| HOOK-02 | Commit validation hook registered | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| HOOK-03 | Phase boundary hook registered | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |
| HOOK-04 | No duplicate hook entries; orphans cleaned | unit | `node --test tests/installer-content.test.cjs` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/installer-content.test.cjs`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/installer-content.test.cjs` -- covers INST-01 through INST-05, HOOK-01 through HOOK-04
- [ ] Test helpers for temp directory installer simulation (can extend existing `createTempProject()` from `tests/helpers.cjs`)

## Sources

### Primary (HIGH confidence)
- `bin/install.js` -- direct code inspection of all referenced functions (2,464 lines)
- `.claude/hooks/` -- direct inspection of all 12 hook files
- `.claude/settings.json` -- direct inspection of hook registration structure
- `hooks/dist/` -- direct inspection of bundled hooks (3 files currently)
- `package.json` files array -- confirms skills/ and teams/ already included
- `tests/foundation.test.cjs` -- test pattern for Phase 12 requirements

### Secondary (MEDIUM confidence)
- `13-CONTEXT.md` -- user decisions from discussion phase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all Node.js built-ins already in use
- Architecture: HIGH -- every pattern has a direct analog in existing install.js code
- Pitfalls: HIGH -- identified from direct code inspection of source files
- Hook bundling: MEDIUM -- hooks/dist/ may need expansion; unclear build process

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable domain, internal project code)
