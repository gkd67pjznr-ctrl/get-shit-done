# Phase 12: Foundation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

All source material exists in the gsdup repo and config is unified -- skills, teams, patterns directory, and adaptive_learning config are in place before any installer or integration work begins. This phase delivers the file structure and config schema that every subsequent phase depends on.

Requirements: CFG-01, CFG-02, SKILL-01, SKILL-02, TEAM-01, TEAM-02, INST-06

</domain>

<decisions>
## Implementation Decisions

### Skills Source Layout
- Top-level `skills/` directory in gsdup repo root (not under `get-shit-done/` or `src/`)
- Flat organization -- all 16 skills at the same level (no core/domain grouping)
- Ship all 16 skills -- no core vs optional tiering, no `auto_activate` split
- Source files copied from `~/gsd-skill-creator/project-claude/skills/` (canonical source repo)
- Each skill is a directory containing `SKILL.md` (mirrors install target `~/.claude/skills/`)

### Config Merge Strategy
- `adaptive_learning` key added to `config.json` -- mirrors existing `skill-creator.json` schema exactly
- Sub-keys: `integration`, `token_budget`, `observation`, `suggestions` (same nesting as current)
- Migration: auto-merge standalone `skill-creator.json` into `config.json` during install, keep `.bak` backup
- Migration runs during `bin/install.js` (not a standalone command)
- Migration must be idempotent -- re-running install (via `/gsd:update`) must not break merged configs or re-create deleted files
- `/gsd:update` and `/gsd:reapply-patches` compatibility must be verified -- new `adaptive_learning` key must not cause conflicts

### Teams Source Layout
- Top-level `teams/` directory in gsdup repo root (consistent with `skills/` placement)
- 4 JSON config files: `code-review.json`, `doc-generation.json`, `gsd-debug.json`, `gsd-research.json`
- Agent IDs in team configs verified against canonical GSD agent filenames (`get-shit-done/agents/*.md`) during this phase

### Patterns Directory
- `.planning/patterns/` gitignored entirely (add to `.gitignore`)
- Created in both locations: gsdup repo (with `.gitkeep` as reference) AND by installer in target projects
- Pre-create known files: `sessions.jsonl`, `scan-state.json`, `README.md`

### Claude's Discretion
- README.md content for `.planning/patterns/` -- explain directory purpose and file formats
- Exact `scan-state.json` initial structure (empty object or minimal schema)
- `sessions.jsonl` can start empty (zero bytes)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `bin/install.js` (~2400 lines): Existing installer handles agents/, commands/, hooks/ copy. Skills/ and teams/ follow the same pattern -- extend with new copy targets
- `get-shit-done/bin/lib/core.cjs`: `planningRoot()` and `detectLayoutStyle()` for path resolution
- `.planning/config.json`: Existing config schema with `concurrent`, `mode`, `quality`, `workflow`, `granularity` keys

### Established Patterns
- Installer uses `fs` built-ins (readFileSync, writeFileSync, mkdirSync) for all file operations
- Config is JSON with nested objects -- `adaptive_learning` follows the same convention
- Skills are Markdown directories with YAML frontmatter -- no new format needed
- Teams are JSON configs -- no new format needed

### Integration Points
- `bin/install.js`: Add skills/ and teams/ copy targets, add config migration step
- `.gitignore`: Add `.planning/patterns/` entry
- `config.json` schema: Add `adaptive_learning` key (read by future phases)

</code_context>

<specifics>
## Specific Ideas

- Installer path: skills/ and teams/ are at repo root, so installer resolves `../skills/` and `../teams/` relative to `bin/install.js` (different from `get-shit-done/agents/` pattern)
- Config migration preserves `.bak` file so users can verify the merge happened correctly before cleanup
- The `wrapper_commands` key in `adaptive_learning.integration` will eventually be removed (Phase 16 kills wrappers), but it stays in the schema for now as a toggle

</specifics>

<deferred>
## Deferred Ideas

- Core vs optional skill auto-activate split -- decided against tiering for now, but could revisit if context budget becomes a real problem (v4.x)
- Standalone `gsd migrate-config` CLI command -- installer handles it, but could add later for debugging
- `/gsd:update` and `/gsd:reapply-patches` testing with new config structure -- verify during Phase 13 (Installer)

</deferred>

---

*Phase: 12-foundation*
*Context gathered: 2026-03-07*
