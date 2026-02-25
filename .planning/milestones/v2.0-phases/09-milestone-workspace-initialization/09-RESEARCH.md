# Phase 9: Milestone Workspace Initialization - Research

**Researched:** 2026-02-24
**Domain:** Node.js filesystem scaffolding, JSON manifest authoring, CLI command extension (internal CJS)
**Confidence:** HIGH — all findings from direct source reads of the repo; no external library research required

## Summary

Phase 9 adds one new CLI command (`milestone new-workspace`) and one new init subcommand (`init new-milestone-workspace`) to `gsd-tools.cjs`, plus updates the existing `new-milestone` workflow to invoke them. The core work is: (1) create a function `cmdMilestoneNewWorkspace(cwd, version, options, raw)` in `milestone.cjs` that scaffolds `.planning/milestones/<version>/` with all required files, and (2) create a `conflict.json` manifest in that same workspace whose `files_touched` array the `manifest-check` command (Phase 11) will later read.

The requirements split cleanly into two sub-problems. WKSP-01/02 define the directory layout; WKSP-03 says `new-milestone` must trigger workspace creation; WKSP-04 says `complete-milestone` marks the workspace done and updates MILESTONES.md. CNFL-01 says the conflict manifest lives in the workspace. All of these are pure filesystem writes using patterns already established in `milestone.cjs` and `commands.cjs` — no new dependencies.

The key design insight from STATE.md: "Workspace isolation is directory-based — no file locking (stale locks from killed sessions)." This means Phase 9 creates directories and JSON files using `fs.mkdirSync` + `fs.writeFileSync`, exactly as `cmdMilestoneComplete` already does for the archive directory. The global `.planning/` root retains only project-wide files; each milestone workspace is fully self-contained. The `complete-milestone` path (WKSP-04) is a lightweight extension of the existing `cmdMilestoneComplete` function in `milestone.cjs` — it needs to write a `completed_at` field into the workspace's `conflict.json` and append to MILESTONES.md, which it already does via the existing archive pattern.

**Primary recommendation:** Add `cmdMilestoneNewWorkspace` to `milestone.cjs`, route it through `gsd-tools.cjs` as `milestone new-workspace <version>`, update `cmdInitNewMilestone` to detect layout style and return workspace-readiness fields, and update the `new-milestone` workflow to call the new command. Keep `cmdMilestoneComplete` mostly intact — extend it to also write a `completed_at` timestamp into `conflict.json` when operating on a milestone-scoped workspace.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WKSP-01 | Each milestone creates its own folder at `.planning/milestones/<version>/` containing STATE.md, ROADMAP.md, REQUIREMENTS.md, phases/, and research/ | `fs.mkdirSync({ recursive: true })` pattern confirmed from `cmdMilestoneComplete`; exact subdirectories listed in REQUIREMENTS.md |
| WKSP-02 | Global `.planning/` root retains only project-wide files: PROJECT.md, config.json, MILESTONES.md | No structural change required — existing root files stay in place; workspace creation does not move them |
| WKSP-03 | `new-milestone` workflow creates milestone workspace with all required scaffold files | `cmdInitNewMilestone` in `init.cjs` is the init hook; workflow is `get-shit-done/workflows/new-milestone.md`; new CLI command `milestone new-workspace <version>` must be added to `milestone.cjs` and routed in `gsd-tools.cjs` |
| WKSP-04 | `complete-milestone` marks milestone workspace as complete and updates MILESTONES.md | `cmdMilestoneComplete` in `milestone.cjs` already creates/appends MILESTONES.md; needs to also write `completed_at` to workspace `conflict.json` when workspace exists |
| CNFL-01 | Each milestone workspace contains conflict.json declaring files_touched (source files the milestone intends to modify) | New JSON file written by `cmdMilestoneNewWorkspace`; schema defined here; `files_touched` starts as empty array, updated by workflow as planning progresses |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fs` (Node built-in) | >=16.7.0 | Directory creation, file writes | Already used in every lib file; `fs.mkdirSync`, `fs.writeFileSync`, `fs.existsSync` are the complete API needed |
| `path` (Node built-in) | >=16.7.0 | Path construction | Already used everywhere; `path.join(cwd, '.planning', 'milestones', version, ...)` is the pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:test` + `node:assert` | built-in | Test framework | Already used in all test files; tests go in `tests/milestone.test.cjs` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `fs.writeFileSync` for scaffold files | Template files from `get-shit-done/templates/` | Templates are for AI-editable markdown; JSON scaffold and minimal markdown stubs don't need templates — keep it inline like `cmdMilestoneComplete` does |
| Writing `conflict.json` from Node.js | Having the workflow write it via `cat`/heredoc | Node.js is the right place — ensures valid JSON, consistent schema, tested in isolation |

**Installation:** No new packages. Zero new dependencies.

## Architecture Patterns

### Recommended Project Structure

No new files except in `tests/`. All implementation changes land in:

```
get-shit-done/bin/
└── lib/
    ├── milestone.cjs       # Add cmdMilestoneNewWorkspace(); extend cmdMilestoneComplete()
    └── init.cjs            # Update cmdInitNewMilestone() to return workspace context
get-shit-done/bin/
    └── gsd-tools.cjs       # Route 'milestone new-workspace' subcommand
tests/
    └── milestone.test.cjs  # Add tests for workspace creation + conflict.json
```

### Pattern 1: Workspace Scaffold Creation

**What:** `cmdMilestoneNewWorkspace(cwd, version, options, raw)` creates the full workspace directory tree.

**When to use:** Called by `new-milestone` workflow immediately after the user confirms the version number.

**What it creates:**
```
.planning/milestones/<version>/
├── STATE.md            # Minimal bootstrap stub
├── ROADMAP.md          # Empty header stub
├── REQUIREMENTS.md     # Empty header stub
├── phases/             # Directory for milestone-scoped phases
├── research/           # Directory for milestone-scoped research
└── conflict.json       # Conflict manifest (CNFL-01)
```

**Example:**
```javascript
// Source: direct read of milestone.cjs + requirements
function cmdMilestoneNewWorkspace(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone new-workspace (e.g., v2.0)');
  }

  const workspaceDir = path.join(cwd, '.planning', 'milestones', version);
  const today = new Date().toISOString().split('T')[0];

  // Create workspace directory + subdirectories
  fs.mkdirSync(path.join(workspaceDir, 'phases'), { recursive: true });
  fs.mkdirSync(path.join(workspaceDir, 'research'), { recursive: true });

  // Write scaffold files (only if they don't already exist)
  const stateFile = path.join(workspaceDir, 'STATE.md');
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile,
      `# Project State — Milestone ${version}\n\n**Created:** ${today}\n**Status:** Initializing\n`,
      'utf-8'
    );
  }

  const roadmapFile = path.join(workspaceDir, 'ROADMAP.md');
  if (!fs.existsSync(roadmapFile)) {
    fs.writeFileSync(roadmapFile,
      `# Roadmap — Milestone ${version}\n\n*Created: ${today}*\n`,
      'utf-8'
    );
  }

  const requirementsFile = path.join(workspaceDir, 'REQUIREMENTS.md');
  if (!fs.existsSync(requirementsFile)) {
    fs.writeFileSync(requirementsFile,
      `# Requirements — Milestone ${version}\n\n*Created: ${today}*\n`,
      'utf-8'
    );
  }

  // Write conflict manifest
  const conflictFile = path.join(workspaceDir, 'conflict.json');
  if (!fs.existsSync(conflictFile)) {
    const manifest = {
      version,
      created_at: today,
      status: 'active',
      files_touched: [],
    };
    fs.writeFileSync(conflictFile, JSON.stringify(manifest, null, 2), 'utf-8');
  }

  const result = {
    version,
    workspace_dir: path.join('.planning', 'milestones', version),
    created: true,
    files: {
      state: path.join('.planning', 'milestones', version, 'STATE.md'),
      roadmap: path.join('.planning', 'milestones', version, 'ROADMAP.md'),
      requirements: path.join('.planning', 'milestones', version, 'REQUIREMENTS.md'),
      conflict: path.join('.planning', 'milestones', version, 'conflict.json'),
    },
    dirs: {
      phases: path.join('.planning', 'milestones', version, 'phases'),
      research: path.join('.planning', 'milestones', version, 'research'),
    },
  };

  output(result, raw);
}
```

**Idempotency:** The `if (!fs.existsSync(...))` guard ensures running `milestone new-workspace v2.0` twice doesn't overwrite already-populated files. `fs.mkdirSync(..., { recursive: true })` is already idempotent.

### Pattern 2: conflict.json Manifest Schema (CNFL-01)

**What:** A JSON file at `.planning/milestones/<version>/conflict.json` that declares which source files this milestone intends to modify.

**Schema:**
```json
{
  "version": "v2.0",
  "created_at": "2026-02-24",
  "status": "active",
  "files_touched": [
    "get-shit-done/bin/lib/milestone.cjs",
    "get-shit-done/bin/lib/init.cjs",
    "get-shit-done/bin/gsd-tools.cjs"
  ]
}
```

**Field semantics:**
- `version`: The milestone version string (mirrors the directory name)
- `created_at`: ISO date string, set at workspace creation
- `status`: `"active"` when running, `"complete"` when `complete-milestone` runs
- `files_touched`: Initially empty array `[]`; the workflow populates this via a `milestone update-manifest` subcommand or by direct file write as planning/execution proceeds

**When `files_touched` is populated:** The requirement says the manifest declares files the milestone "intends to modify." This happens during the planning phase when the planner knows which source files will be touched. The workflow writes to `conflict.json` via `gsd-tools.cjs` after roadmap/planning is complete. Phase 9 only needs to: create the manifest with an empty `files_touched` array (CNFL-01) and provide a way to update it. The actual overlap detection is Phase 11 (CNFL-02, CNFL-03).

**Update mechanism:** Two options for how `files_touched` gets populated:
1. A dedicated `milestone update-manifest --files <...>` subcommand in `gsd-tools.cjs`
2. The workflow writes directly via `config-set` style or inline JSON patch

Option 1 is cleaner and testable. Add a `cmdMilestoneUpdateManifest(cwd, version, files, raw)` function that reads the existing `conflict.json`, merges new files into `files_touched` (deduplicating), and writes it back.

### Pattern 3: Extending cmdMilestoneComplete for WKSP-04

**What:** When `milestone complete v2.0` is called and a workspace exists at `.planning/milestones/v2.0/`, the command must also write `completed_at` and set `status: "complete"` in `conflict.json`.

**Current behavior of `cmdMilestoneComplete`** (from direct read of `milestone.cjs`):
- Archives ROADMAP.md to `.planning/milestones/v1.0-ROADMAP.md`
- Archives REQUIREMENTS.md to `.planning/milestones/v1.0-REQUIREMENTS.md`
- Creates/appends MILESTONES.md
- Updates STATE.md

**New behavior for WKSP-04:**
```javascript
// After existing logic, at the end of cmdMilestoneComplete:
const workspaceConflict = path.join(cwd, '.planning', 'milestones', version, 'conflict.json');
if (fs.existsSync(workspaceConflict)) {
  try {
    const manifest = JSON.parse(fs.readFileSync(workspaceConflict, 'utf-8'));
    manifest.status = 'complete';
    manifest.completed_at = today;
    fs.writeFileSync(workspaceConflict, JSON.stringify(manifest, null, 2), 'utf-8');
    result.conflict_marked_complete = true;
  } catch {
    result.conflict_marked_complete = false;
  }
} else {
  result.conflict_marked_complete = false;
}
```

This is a non-breaking extension — the legacy `milestone complete` path (archiving old-style projects) continues to work. The workspace check (`fs.existsSync`) ensures old-style projects that have no workspace directory are unaffected.

### Pattern 4: Routing in gsd-tools.cjs

**What:** The `milestone` command switch block currently handles only `complete`. Extend it to also handle `new-workspace` and `update-manifest`.

**Current routing (lines 476-496 of gsd-tools.cjs):**
```javascript
case 'milestone': {
  const subcommand = args[1];
  if (subcommand === 'complete') {
    // ... existing logic
    milestone.cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw);
  } else {
    error('Unknown milestone subcommand. Available: complete');
  }
  break;
}
```

**Extended routing:**
```javascript
case 'milestone': {
  const subcommand = args[1];
  if (subcommand === 'complete') {
    // ... existing logic unchanged
  } else if (subcommand === 'new-workspace') {
    milestone.cmdMilestoneNewWorkspace(cwd, args[2], {}, raw);
  } else if (subcommand === 'update-manifest') {
    const filesIndex = args.indexOf('--files');
    const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
    milestone.cmdMilestoneUpdateManifest(cwd, args[2], files, raw);
  } else {
    error('Unknown milestone subcommand. Available: complete, new-workspace, update-manifest');
  }
  break;
}
```

### Pattern 5: Updating cmdInitNewMilestone for WKSP-03 context

**What:** The `init new-milestone` command is called at the start of the `new-milestone` workflow. It currently returns models, config flags, and basic file existence. It needs to return additional context so the workflow knows whether to call `milestone new-workspace`.

**Current output** (from direct read of `init.cjs` lines 229-258):
- `researcher_model`, `synthesizer_model`, `roadmapper_model`
- `commit_docs`, `research_enabled`
- `current_milestone`, `current_milestone_name`
- `project_exists`, `roadmap_exists`, `state_exists`
- `project_path`, `roadmap_path`, `state_path`

**New fields to add:**
```javascript
// Add to cmdInitNewMilestone result:
layout_style: detectLayoutStyle(cwd),  // 'legacy' | 'milestone-scoped' | 'uninitialized'
milestones_dir: path.join('.planning', 'milestones'),
milestones_dir_exists: pathExistsInternal(cwd, '.planning/milestones'),
```

This allows the `new-milestone` workflow to branch: if `layout_style === 'milestone-scoped'`, call `milestone new-workspace <version>`. If `layout_style === 'legacy'`, use the existing flow unchanged.

**Import addition required:** `detectLayoutStyle` must be imported in `init.cjs`. It's already exported from `core.cjs`.

### Anti-Patterns to Avoid

- **Creating the workspace inside the wrong directory:** The workspace is `.planning/milestones/<version>/`, NOT `.planning/milestones/<version>-phases/` (that's the archive path for old-style). Do not confuse with the existing archive pattern.
- **Parsing conflict.json with regex:** It's JSON — use `JSON.parse` + `JSON.stringify`. The existing codebase occasionally uses regex on markdown but never on JSON files.
- **Making conflict.json writes non-idempotent:** Always read-then-write (not overwrite from scratch) when updating `files_touched` to avoid discarding existing data.
- **Adding `concurrent: true` to config.json automatically:** Phase 9 does NOT modify `config.json`. The sentinel must be set explicitly by the user or a future command; Phase 9 just reads `detectLayoutStyle`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Directory creation | Custom mkdir with existence checks | `fs.mkdirSync(path, { recursive: true })` | Already the pattern throughout `milestone.cjs`; handles nested dirs and idempotency |
| JSON manifest update | String regex patch | `JSON.parse` + object merge + `JSON.stringify(_, null, 2)` | Correct JSON round-trip; already used in `config.cjs` for config-set |
| File existence guard | Manual try/catch | `fs.existsSync(path)` | Consistent with every other guard in `milestone.cjs` and `commands.cjs` |
| Deduplication of `files_touched` | Manual loop | `[...new Set([...existing, ...newFiles])]` | One-liner, no library needed |

**Key insight:** Every pattern needed in Phase 9 already exists in `milestone.cjs` or `config.cjs`. The implementation is composing known primitives, not inventing new ones.

## Common Pitfalls

### Pitfall 1: Workspace Directory Confusion with Archive Directory

**What goes wrong:** `cmdMilestoneComplete` creates `.planning/milestones/v1.0-ROADMAP.md` (flat files) and optionally `.planning/milestones/v1.0-phases/` (phase archive). The new workspace is `.planning/milestones/v2.0/` (a directory, not a file). If naming is not carefully distinguished, `cmdMilestoneNewWorkspace` for `v1.0` would create `.planning/milestones/v1.0/` and `cmdMilestoneComplete` would try to write `v1.0-ROADMAP.md` into that same `milestones/` directory — causing no collision, but conceptual confusion.

**Why it happens:** The existing archive pattern uses flat files (`v1.0-ROADMAP.md`), not subdirectories. The new workspace pattern uses subdirectories (`v2.0/`). Both live in `.planning/milestones/`.

**How to avoid:** The two models coexist fine since files vs directories don't conflict. Document clearly in comments: "flat files in `.planning/milestones/` are archives from old-style `milestone complete`; subdirectories are concurrent milestone workspaces from `milestone new-workspace`." This distinction is also visible in `REQUIREMENTS.md`: WKSP-02 says global root retains PROJECT.md, config.json, MILESTONES.md — not the archive files.

**Warning signs:** Code that assumes all entries in `.planning/milestones/` are files (vs checking `isDirectory()` vs `isFile()`).

### Pitfall 2: Forgetting to Export New Functions from milestone.cjs

**What goes wrong:** `cmdMilestoneNewWorkspace` and `cmdMilestoneUpdateManifest` defined but not added to `module.exports` at the bottom of `milestone.cjs`.

**Why it happens:** `milestone.cjs` exports explicitly at lines 212-215. Easy to define a function and miss the export.

**How to avoid:** Add to `module.exports` in the same edit as the function definition. Tests catch this immediately with `TypeError: milestone.cmdMilestoneNewWorkspace is not a function`.

**Warning signs:** Any test calling `milestone new-workspace` gets `Unknown milestone subcommand`.

### Pitfall 3: conflict.json Written with Wrong Path (Relative vs Absolute)

**What goes wrong:** `conflict.json` path constructed as a relative string in the JSON output, causing callers to resolve it incorrectly.

**Why it happens:** `output` fields in init commands use relative paths (e.g., `.planning/STATE.md`), but the actual file is written to the absolute path `path.join(cwd, '.planning', 'milestones', version, 'conflict.json')`.

**How to avoid:** Write file to absolute path `path.join(cwd, ...)`. Return path in JSON output as relative `.planning/milestones/<version>/conflict.json`. This matches every other path field in init commands (e.g., `state_path: '.planning/STATE.md'`).

**Warning signs:** Workflow cannot find `conflict.json` because path includes `cwd` prefix.

### Pitfall 4: Attempting to Create Workspace for an Already-Complete Milestone

**What goes wrong:** `milestone new-workspace v1.0` called when `v1.0` was already completed — workspace exists and may have a `completed_at` in `conflict.json`.

**Why it happens:** Workflow called twice, or version typo.

**How to avoid:** The idempotency guards (`if (!fs.existsSync(...))`) prevent overwriting existing files. Optionally check `conflict.json.status === 'complete'` and warn (but don't error — advisory only, consistent with STATE.md "warnings only" policy).

**Warning signs:** `conflict.json` shows `status: "complete"` but `cmdMilestoneNewWorkspace` was called again.

### Pitfall 5: new-milestone Workflow Not Invoking new-workspace in Legacy Mode

**What goes wrong:** `new-milestone` workflow always creates a workspace, even for old-style (legacy) projects.

**Why it happens:** Workflow code calls `milestone new-workspace` unconditionally.

**How to avoid:** The `init new-milestone` response now includes `layout_style`. Workflow must check: `if (layout_style === 'milestone-scoped') { call milestone new-workspace }`. Legacy mode uses the existing `new-milestone` workflow unchanged.

**Warning signs:** Old-style project suddenly has `.planning/milestones/v2.0/` created unexpectedly.

## Code Examples

Verified patterns from direct source reads:

### Existing fs.mkdirSync + writeFileSync Pattern (milestone.cjs lines 93-131)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/milestone.cjs (read directly)
// Archive directory creation pattern — Phase 9 follows same structure:
const archiveDir = path.join(cwd, '.planning', 'milestones');
fs.mkdirSync(archiveDir, { recursive: true });

if (fs.existsSync(roadmapPath)) {
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
}
```

### Existing milestone.cjs module.exports Block (lines 212-215)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/milestone.cjs (read directly)
module.exports = {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  // ADD: cmdMilestoneNewWorkspace, cmdMilestoneUpdateManifest
};
```

### JSON Read-Modify-Write Pattern (config.cjs — confirmed pattern for manifest updates)
```javascript
// Pattern: read existing JSON, merge, write back
// Source: inferred from config.cjs cmdConfigSet pattern (same in all config operations)
const existing = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
existing.files_touched = [...new Set([...existing.files_touched, ...newFiles])];
fs.writeFileSync(conflictPath, JSON.stringify(existing, null, 2), 'utf-8');
```

### Existing milestone.cjs routing block in gsd-tools.cjs (lines 476-496)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs (read directly)
case 'milestone': {
  const subcommand = args[1];
  if (subcommand === 'complete') {
    const nameIndex = args.indexOf('--name');
    const archivePhases = args.includes('--archive-phases');
    let milestoneName = null;
    if (nameIndex !== -1) {
      const nameArgs = [];
      for (let i = nameIndex + 1; i < args.length; i++) {
        if (args[i].startsWith('--')) break;
        nameArgs.push(args[i]);
      }
      milestoneName = nameArgs.join(' ') || null;
    }
    milestone.cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw);
  } else {
    error('Unknown milestone subcommand. Available: complete');
  }
  break;
}
```

### detectLayoutStyle import pattern (from init.cjs — showing how imports are done)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/init.cjs line 8 (read directly)
const { loadConfig, resolveModelInternal, findPhaseInternal, getRoadmapPhaseInternal,
        pathExistsInternal, generateSlugInternal, getMilestoneInfo, normalizePhaseName,
        planningRoot, output, error } = require('./core.cjs');
// ADD: detectLayoutStyle to this destructure
```

### Existing Test Pattern (milestone.test.cjs)
```javascript
// Source: /Users/tmac/Projects/gsdup/tests/milestone.test.cjs (read directly)
describe('milestone complete command', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('archives roadmap, requirements, creates MILESTONES.md', () => {
    // Setup files, call runGsdTools, assert on JSON output + fs.existsSync
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `milestone complete` archives to flat files in `.planning/milestones/` | `milestone new-workspace` creates isolated subdirectory workspace | Phase 9 (this phase) | Enables concurrent milestone sessions with no cross-contamination |
| `new-milestone` reuses root-level STATE.md, ROADMAP.md, REQUIREMENTS.md | `new-milestone` (in milestone-scoped mode) creates fresh versions in workspace | Phase 9 (this phase) | Multiple milestones can have independent state without global clobbering |
| No conflict tracking | `conflict.json` with `files_touched` array | Phase 9 (this phase) | Phase 11 can detect overlapping source file intentions across sessions |

**No deprecations.** The old `milestone complete` archive path (flat files) is not removed or changed; it continues to work for old-style projects.

## Open Questions

1. **Should `cmdInitNewMilestone` return the workspace path, or should the workflow compute it?**
   - What we know: `init new-milestone` is called at workflow start (Step 7 of `new-milestone.md`); version number is determined in Step 3
   - What's unclear: The workflow knows the version (determined in Step 3), but `init new-milestone` is called before version is determined; it can't return a workspace-specific path
   - Recommendation: `cmdInitNewMilestone` returns `layout_style` and `milestones_dir` only; the workflow calls `milestone new-workspace <version>` separately after version is confirmed (Step 3). This is clean separation — init gives context, milestone new-workspace does the creation.

2. **Who populates `files_touched` in conflict.json, and when?**
   - What we know: CNFL-01 only says the file must exist with the field; CNFL-02/03 (Phase 11) handle the checking. Phase 9 creates the manifest with an empty array.
   - What's unclear: Does Phase 9 need to provide an `update-manifest` command, or is that Phase 11's concern?
   - Recommendation: Implement `milestone update-manifest <version> --files <...>` in Phase 9. This completes the workspace lifecycle (create → update → check). The command is trivial (read + merge + write), and Phase 11 needs it to already exist. If deferred to Phase 11, Phase 11 must implement both detection and the update mechanism.

3. **What minimal content should the scaffold STATE.md, ROADMAP.md, REQUIREMENTS.md contain?**
   - What we know: These files must exist (WKSP-01). The `new-milestone` workflow will overwrite/populate them immediately after workspace creation (Steps 4, 9, 10 of the workflow).
   - What's unclear: Should the stubs contain valid frontmatter, or just a header line?
   - Recommendation: Minimal header stubs only (one `# Title` line + creation date). The workflow will replace content. Avoid adding frontmatter or structure that the workflow might not overwrite, creating stale data.

4. **Does `complete-milestone` need to detect whether a workspace exists before trying to update conflict.json?**
   - What we know: `cmdMilestoneComplete` is called for all projects (old-style and new-style). Old-style projects have no workspace at `.planning/milestones/<version>/`.
   - What's unclear: none — the `fs.existsSync(workspaceConflict)` guard is the correct pattern.
   - Recommendation: The guard is mandatory. `result.conflict_marked_complete = false` for old-style projects is correct and does not constitute an error.

## Validation Architecture

> Skipped: `workflow.nyquist_validation` is not present in `.planning/config.json` (the key is absent, which means the feature is disabled by default in this project).

## Test Plan

(Not the Validation Architecture section — this is practical test coverage guidance for the planner.)

**Test framework:** `node:test` + `node:assert`, run via `node --test tests/*.test.cjs`
**Test file:** Append to `tests/milestone.test.cjs` (already exists, 2 passing tests)
**Quick run:** `node --test tests/milestone.test.cjs`

**Required test cases:**

| Behavior | Test Type | What to assert |
|----------|-----------|----------------|
| `milestone new-workspace v2.0` creates workspace directory | Integration | `fs.existsSync(path.join(tmpDir, '.planning', 'milestones', 'v2.0'))` |
| Workspace contains STATE.md, ROADMAP.md, REQUIREMENTS.md | Integration | `fs.existsSync` for each file |
| Workspace contains `phases/` and `research/` directories | Integration | `fs.statSync(...).isDirectory()` for each |
| `conflict.json` is valid JSON with `version`, `created_at`, `status: "active"`, `files_touched: []` | Integration | `JSON.parse(content)` assertions |
| `milestone new-workspace` is idempotent (run twice, no error, files not overwritten) | Integration | Write content to STATE.md, run again, assert content unchanged |
| `milestone update-manifest v2.0 --files a.js b.js` populates `files_touched` | Integration | Read conflict.json, assert `files_touched` contains both files |
| `milestone update-manifest` deduplicates files | Integration | Run twice with same file, assert only one entry |
| `milestone complete v2.0` sets `status: "complete"` and `completed_at` in workspace conflict.json | Integration | Run new-workspace, then complete, read conflict.json |
| `milestone complete v1.0` without workspace does not error (old-style compat) | Integration | `result.conflict_marked_complete === false`, command succeeds |
| `init new-milestone` returns `layout_style` field | Integration | `output.layout_style === 'legacy'` for project without `concurrent: true` |

**Baseline:** 2 tests in `milestone.test.cjs` currently pass. Pre-existing failures (3 in `init.test.cjs` config suites) are unrelated — do not fix or introduce.

## Sources

### Primary (HIGH confidence)
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/milestone.cjs` — full source, all functions and exports
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/init.cjs` — `cmdInitNewMilestone` and all init functions
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — `planningRoot`, `detectLayoutStyle`, `pathExistsInternal`, `fs`/`path` patterns, `module.exports` block
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs` — full routing, milestone switch block (lines 476-496), init switch block (lines 539-582)
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/workflows/new-milestone.md` — workflow steps 1-11, where workspace creation must be inserted
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/workflows/complete-milestone.md` — `archive_milestone` step using `milestone complete`, where WKSP-04 extension attaches
- Direct read of `/Users/tmac/Projects/gsdup/tests/milestone.test.cjs` — existing test patterns and structure
- Direct read of `/Users/tmac/Projects/gsdup/tests/helpers.cjs` — `createTempProject`, `cleanup`, `runGsdTools`
- Direct read of `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` — WKSP-01/02/03/04, CNFL-01 requirements
- Direct read of `/Users/tmac/Projects/gsdup/.planning/STATE.md` — locked design decisions (workspace isolation, conflict advisory-only, lock-free)
- Direct read of `/Users/tmac/Projects/gsdup/.planning/phases/08-path-architecture-foundation/08-02-SUMMARY.md` — Phase 8 deliverables and what Phase 9 can depend on
- Direct read of `/Users/tmac/Projects/gsdup/package.json` — `node --test tests/*.test.cjs`, no external test deps

### Secondary (MEDIUM confidence)
None — all findings come from direct source reads.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Node.js built-ins only; confirmed from package.json and all lib files
- Architecture: HIGH — all patterns directly observed in `milestone.cjs`, `init.cjs`, `core.cjs`; no inference required
- Pitfalls: HIGH — root causes identified directly in source (workspace vs archive confusion is visible by reading `cmdMilestoneComplete`; export omission pattern is documented from Phase 8 experience)
- conflict.json schema: HIGH — requirements are explicit; schema design is straightforward JSON

**Research date:** 2026-02-24
**Valid until:** Stable indefinitely — all findings are from static source reads of the repo itself, not external documentation
