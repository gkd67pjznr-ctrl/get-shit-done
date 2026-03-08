# Phase 17: Project Registry - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

CLI commands and persistent storage for managing registered GSD projects. Users can add, remove, and list projects from any terminal. Registry persists to `~/.gsd/dashboard.json`. Project names are auto-detected from PROJECT.md. Server, UI, and live monitoring are separate phases (18-21).

</domain>

<decisions>
## Implementation Decisions

### Registry file structure
- Array of objects stored in `~/.gsd/dashboard.json` under a `projects` key
- Projects-only file -- no server config or other state in this file
- Each entry has 4 fields: `name` (slugified), `display_name` (raw from PROJECT.md), `path` (absolute), `added` (ISO 8601 timestamp)
- Project names must be unique -- reject add if slug already exists, user can override with `--name <alias>`

### CLI subcommand design
- Nested subcommand pattern: `gsd dashboard add <path>`, `gsd dashboard remove <name>`, `gsd dashboard list`
- `gsd dashboard add` defaults to current working directory when no path argument given
- `gsd dashboard list` outputs aligned table format: Name, Path, Added columns, with count footer
- `gsd dashboard remove <name>` requires no confirmation -- just removes the registry entry (project data is untouched)
- Remove uses the slugified name (e.g., `gsd dashboard remove gsd-enhanced-fork`)

### Project name detection
- Primary: Parse first H1 heading (`# Title`) from `.planning/PROJECT.md`
- Slugify for registry name (lowercase, hyphenated, CLI-friendly)
- Store raw H1 text as `display_name` for human-readable output
- Fallback: Use directory basename when PROJECT.md is missing or has no H1
- `--name <alias>` flag on add to override auto-detected name
- `.planning/` directory must exist -- reject add if path is not a GSD project

### Path handling and validation
- Always resolve to absolute path using `path.resolve()` at add time
- Resolve symlinks via `fs.realpathSync()` to prevent duplicate registrations of the same project
- Adding an already-registered path is a no-op with informational message (not an error)
- Stale paths (directory no longer exists) are marked with a warning indicator in list output, not auto-removed
- List shows count footer: "N projects (M missing)" when stale paths detected

### Claude's Discretion
- Exact table column widths and alignment implementation
- Slug generation algorithm details (how to handle special characters)
- Internal error message wording
- Whether to add a `gsd dashboard` help/usage subcommand
- Test structure and organization

</decisions>

<specifics>
## Specific Ideas

- Follow the existing `~/.gsd/` global home pattern established in Phase 5 (config.cjs `GSD_HOME` env override for testability)
- CLI routing follows existing `gsd-tools.cjs` case statement pattern -- add `case 'dashboard':` with sub-action parsing
- Implementation in a new `lib/dashboard.cjs` module (consistent with existing lib/config.cjs, lib/commands.cjs pattern)
- `GSD_HOME` env var should override `~/.gsd/` for dashboard.json location too (test isolation)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.cjs` `GSD_HOME` pattern: `process.env.GSD_HOME || path.join(homedir, '.gsd')` -- reuse for dashboard.json location
- `config.cjs` `bootstrapGlobalDefaults()`: pattern for creating `~/.gsd/` directory with `mkdirSync({ recursive: true })`
- `gsd-tools.cjs` CLI router: case-based routing with sub-action parsing (see `case 'init':` for nested sub-commands)

### Established Patterns
- CJS modules with `module.exports` at bottom
- `fs.readFileSync`/`fs.writeFileSync` for JSON persistence (no async)
- `GSD_HOME` env var for test isolation of global state
- `spawnSync` test helpers in `tests/helpers.cjs` for CLI testing

### Integration Points
- `gsd-tools.cjs`: Add `case 'dashboard':` to main switch
- `~/.gsd/`: Dashboard.json lives alongside existing `defaults.json`
- `lib/dashboard.cjs`: New module following existing lib pattern
- Tests: New `tests/dashboard.test.cjs` using existing test helpers

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 17-project-registry*
*Context gathered: 2026-03-08*
