# Phase 11: Dashboard and Conflict Detection - Research

**Researched:** 2026-02-24
**Domain:** Node.js CLI file aggregation, multi-milestone STATUS.md writes, conflict manifest overlap detection
**Confidence:** HIGH

## Summary

Phase 11 adds two capabilities to the GSD toolset: a live multi-milestone dashboard (`/gsd:progress` reads all active milestone STATUS.md files and renders a summary table) and advisory conflict detection (`manifest-check` reads all active `conflict.json` files and reports overlapping `files_touched` paths). Both capabilities operate on the existing milestone workspace structure established in Phase 9, and the compatibility layer from Phase 10 ensures old-style projects see a graceful degrade (single-milestone progress, no-op on conflict check when no workspace exists).

This phase is entirely within the project's own Node.js codebase — no new external libraries are needed. All implementation targets the three existing modules: `commands.cjs` (progress rendering), `milestone.cjs` (conflict detection), and `gsd-tools.cjs` (CLI routing). The work also includes creating `STATUS.md` writers called at natural checkpoints, and updating MILESTONES.md to act as a live dashboard rather than a static append-only log.

The project uses Node.js built-in `node:test` and `node:assert` for tests, and follows the established spawnSync child process pattern for functions that call `process.exit()`. Nyquist validation is not configured (`workflow.nyquist_validation` is absent from config.json), so the Validation Architecture section is skipped.

**Primary recommendation:** Implement `cmdMilestoneWriteStatus`, `cmdManifestCheck`, and `cmdProgressRenderMulti` as three clean additions to existing modules. Wire the new CLI verbs in `gsd-tools.cjs`. Build STATUS.md writes as passive side effects of existing plan/phase-complete checkpoints. Keep all conflict detection advisory (warnings only, exit 0 always).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Each milestone writes STATUS.md in its workspace folder at natural checkpoints (plan start, plan complete, phase complete) | STATUS.md is written by `cmdMilestoneWriteStatus` — called from execute-phase and plan-phase workflows at checkpoint events |
| DASH-02 | `/gsd:progress` reads all active milestone STATUS.md files and renders multi-milestone summary table | `cmdProgressRenderMulti` in `commands.cjs` scans `.planning/milestones/*/STATUS.md`, renders table; replaces or augments `cmdProgressRender` |
| DASH-03 | MILESTONES.md repurposed as live dashboard with structured per-milestone sections updated independently by concurrent sessions | Each milestone session writes only its own section; reader aggregates; sections keyed by version |
| DASH-04 | Old-style projects show single-milestone progress (graceful degrade) | `detectLayoutStyle` returns `'legacy'` — progress render falls back to existing `cmdProgressRender` single-milestone path |
| CNFL-02 | `manifest-check` command reads all active milestone conflict.json files and reports overlapping file paths | `cmdManifestCheck` in `milestone.cjs` reads all `conflict.json` where `status === 'active'`, finds intersection of `files_touched` arrays, returns advisory report |
| CNFL-03 | Overlap detection runs automatically during `/gsd:new-milestone` workflow | `new-milestone.md` workflow calls `manifest-check` after workspace creation, surfaces advisory warnings before proceeding |
| CNFL-04 | Conflicts are advisory (warnings only) — do not block execution | `cmdManifestCheck` always exits 0; result contains `has_conflicts: boolean` and `conflicts: []`; caller decides to warn or ignore |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:fs | built-in | Read/write STATUS.md and conflict.json files | All existing file operations in this codebase use node:fs |
| node:path | built-in | Path resolution across workspace directories | Existing pattern in all lib files |
| node:test + node:assert | built-in | Unit and integration tests | Project's established test framework (package.json: `node --test tests/*.test.cjs`) |
| child_process.spawnSync | built-in | Test helper for commands that call process.exit | Established pattern from Phase 9 tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON.stringify with null/2 | built-in | STATUS.md is JSON or markdown; conflict.json is already JSON | STATUS.md should be markdown (human-readable); conflict.json is JSON |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain markdown STATUS.md | JSON status file | Markdown is human-readable in concurrent sessions; JSON is machine-parseable — use markdown with structured sections that are regex-parseable |
| Global lock file for concurrent writes | Lock-free per-milestone files | Project decisions reject locking; workspace isolation means each session writes its own file only |

**Installation:**
```bash
# No new dependencies — pure Node.js built-ins
```

## Architecture Patterns

### Recommended Project Structure

No new files/directories needed beyond what Phase 9 established:

```
.planning/milestones/<version>/
├── STATUS.md          # NEW: written at plan start, plan complete, phase complete
├── conflict.json      # Existing (Phase 9) — files_touched manifest
├── STATE.md           # Existing
├── ROADMAP.md         # Existing
├── phases/            # Existing
└── research/          # Existing
```

New functions added to existing modules:

```
get-shit-done/bin/lib/
├── milestone.cjs      # + cmdMilestoneWriteStatus, + cmdManifestCheck
├── commands.cjs       # + cmdProgressRenderMulti (milestone-aware progress)
└── init.cjs           # + status fields in cmdInitExecutePhase, cmdInitPlanPhase
```

New CLI verbs in gsd-tools.cjs:
```
milestone write-status <version> --phase N --plan M --checkpoint <start|plan-complete|phase-complete>
milestone manifest-check
progress multi [json|table|bar]
```

### Pattern 1: STATUS.md Format (per-milestone)

**What:** Each milestone workspace has a `STATUS.md` written at natural checkpoints. Must be human-readable (concurrent sessions may need to see it) and machine-parseable (progress rendering reads it).

**When to use:** Written by `execute-phase` and `plan-phase` workflows via `milestone write-status` CLI verb.

**Example:**
```markdown
# Status — Milestone v2.0

**Updated:** 2026-02-24
**Phase:** 3
**Plan:** 2
**Checkpoint:** plan-complete
**Progress:** 2/5 plans (40%)
**Status:** In Progress
```

The renderer reads all `STATUS.md` files by scanning `.planning/milestones/*/STATUS.md`. This is a glob scan — no central registry needed (lock-free, consistent with project decisions).

### Pattern 2: manifest-check Implementation

**What:** Reads all `conflict.json` files from active milestones. Finds files_touched arrays that share elements. Reports overlapping paths as advisory warnings.

**When to use:** Called by `new-milestone` workflow automatically; also directly callable as `milestone manifest-check`.

```javascript
// Source: project pattern from cmdMilestoneUpdateManifest in milestone.cjs
function cmdManifestCheck(cwd, raw) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');

  // Collect all active conflict.json files
  const manifests = [];
  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const conflictPath = path.join(milestonesDir, entry.name, 'conflict.json');
      if (fs.existsSync(conflictPath)) {
        const manifest = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
        if (manifest.status === 'active') {
          manifests.push({ version: manifest.version, files: manifest.files_touched || [] });
        }
      }
    }
  } catch { /* graceful degrade */ }

  // Find overlaps: for each pair of milestones, find common files
  const conflicts = [];
  for (let i = 0; i < manifests.length; i++) {
    for (let j = i + 1; j < manifests.length; j++) {
      const a = manifests[i];
      const b = manifests[j];
      const overlap = a.files.filter(f => b.files.includes(f));
      if (overlap.length > 0) {
        conflicts.push({ milestones: [a.version, b.version], files: overlap });
      }
    }
  }

  // Always advisory — exit 0 regardless
  output({
    has_conflicts: conflicts.length > 0,
    conflicts,
    manifests_checked: manifests.length,
  }, raw);
}
```

### Pattern 3: Multi-Milestone Progress Rendering

**What:** `cmdProgressRenderMulti` scans all milestone workspaces, reads each STATUS.md, renders a cross-milestone table. For old-style (legacy) projects, falls back to `cmdProgressRender`.

**When to use:** `/gsd:progress` workflow calls this when `layout_style === 'milestone-scoped'`.

```javascript
function cmdProgressRenderMulti(cwd, format, raw) {
  const layoutStyle = detectLayoutStyle(cwd);

  // Graceful degrade for old-style projects (DASH-04)
  if (layoutStyle !== 'milestone-scoped') {
    return cmdProgressRender(cwd, format, raw);
  }

  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const milestones = [];

  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const statusPath = path.join(milestonesDir, entry.name, 'STATUS.md');
      if (fs.existsSync(statusPath)) {
        const content = fs.readFileSync(statusPath, 'utf-8');
        // Parse structured fields from STATUS.md
        const phaseMatch = content.match(/\*\*Phase:\*\*\s*(\S+)/);
        const planMatch = content.match(/\*\*Plan:\*\*\s*(\S+)/);
        const progressMatch = content.match(/\*\*Progress:\*\*\s*(.+)/);
        const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
        milestones.push({
          version: entry.name,
          phase: phaseMatch ? phaseMatch[1] : '?',
          plan: planMatch ? planMatch[1] : '?',
          progress: progressMatch ? progressMatch[1].trim() : '?',
          status: statusMatch ? statusMatch[1].trim() : 'Unknown',
        });
      }
    }
  } catch {}

  output({ milestones, layout_style: 'milestone-scoped' }, raw);
}
```

### Pattern 4: MILESTONES.md as Live Dashboard (DASH-03)

**What:** MILESTONES.md currently has append-only entries written by `cmdMilestoneComplete`. For the live dashboard, each active session can update its own section independently. Sections are keyed by version (`## v2.0 ...`).

**When to use:** Dashboard writes happen alongside STATUS.md writes. The `cmdMilestoneWriteStatus` function updates (or creates) the milestone's section in MILESTONES.md.

**Key constraint from project decisions:** "Dashboard writes are lock-free — per-milestone STATUS.md files, aggregated at read time." MILESTONES.md updates must use the existing `atomicWrite()` pattern or simple write (since each session only writes its own section — no concurrent write collision risk if scoped correctly).

**Implementation approach:** Each session only writes/updates the `## <version>` section for its own milestone. The progress renderer reads all sections. Use regex replacement to update the section for a given version (similar to how `cmdMilestoneComplete` appends entries).

### Anti-Patterns to Avoid
- **Locking MILESTONES.md:** Project explicitly rejects file locking. Each session writes its own section only; concurrent sessions don't collide on the same version.
- **Blocking on conflict:** `cmdManifestCheck` must always exit 0. Conflicts are warnings, not errors.
- **Directory-presence detection for layout:** `detectLayoutStyle` reads `config.json` only. Do not check if `milestones/` directory exists to determine layout.
- **Re-implementing progress parsing:** Re-use `comparePhaseNum`, `normalizePhaseName` from `core.cjs` for any phase ordering in the dashboard.
- **New dependencies:** Do not add npm packages. All needed I/O is in Node built-ins.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent file writes | Custom mutex/lock | Per-milestone files (one writer per file) | Project decision: stale locks from killed sessions are worse than no locks |
| Progress bar rendering | Custom bar code | Extend existing `cmdProgressRender` in `commands.cjs` | Already handles bar/table/JSON formats with the right unicode characters |
| Phase number sorting | Custom sort | `comparePhaseNum` from `core.cjs` | Handles decimal phases (12A, 12A.1, 12A.2) correctly |
| Config reading | Direct fs.readFileSync | `loadConfig(cwd)` from `core.cjs` | Handles defaults, nested fields, migration |
| Layout detection | Directory existence checks | `detectLayoutStyle(cwd)` from `core.cjs` | Uses the sentinel-based approach required by COMPAT-02 |
| JSON output | console.log | `output(result, raw)` from `core.cjs` | Handles large payload tmpfile routing, raw mode |

**Key insight:** This phase adds features to existing modules — not new modules. Follow the existing file structure and function signatures exactly.

## Common Pitfalls

### Pitfall 1: Writing STATUS.md at Wrong Granularity
**What goes wrong:** Writing STATUS.md too frequently (every bash action) bloats the milestone workspace with unnecessary file writes and creates noise. Writing too infrequently means the dashboard is stale.
**Why it happens:** Unclear definition of "natural checkpoint."
**How to avoid:** DASH-01 specifies three checkpoints only: plan start, plan complete, phase complete. These map exactly to the existing `execute-phase` and `plan-phase` workflow steps where SUMMARY.md is written.
**Warning signs:** If STATUS.md write is called from more than 3 workflow locations, it's over-written.

### Pitfall 2: STATUS.md Parse Fragility
**What goes wrong:** Regex parsing of STATUS.md fields fails when content differs (extra spaces, missing fields, different formatting).
**Why it happens:** Free-form markdown is hard to parse reliably.
**How to avoid:** Use the exact field format specified (`**Phase:** N`, `**Progress:** X/Y plans (Z%)`). The writer and reader must agree on the schema. Keep it simple — match the existing patterns in STATE.md fields (e.g., `**Status:** ...`).
**Warning signs:** Dashboard shows `?` for most fields.

### Pitfall 3: manifest-check Returns Wrong Results for Complete Milestones
**What goes wrong:** A completed milestone's `conflict.json` has `status: 'complete'` but its files are still counted in overlap detection.
**Why it happens:** Forgetting to filter by `status === 'active'`.
**How to avoid:** `cmdManifestCheck` explicitly filters `manifest.status === 'active'`. Completed milestones (marked by `cmdMilestoneComplete` in Phase 9) are excluded from conflict detection.
**Warning signs:** False positives for finished milestones.

### Pitfall 4: DASH-03 Section Collision in MILESTONES.md
**What goes wrong:** Two concurrent sessions both update MILESTONES.md at the same time, one overwrites the other's section.
**Why it happens:** Each session reads the file, modifies its section, and writes — race condition if two sessions run simultaneously.
**How to avoid:** This is an advisory/best-effort feature. The lock-free design accepts this. The writer uses `status === 'active'` scoping — if two milestones update at the same moment, the last write wins for each respective section, but they're updating different sections (different versions). In practice, a regex that only replaces the `## <version>` section avoids clobbering other sections.
**Warning signs:** Missing sections in MILESTONES.md.

### Pitfall 5: `process.exit()` in Tests
**What goes wrong:** Calling `cmdManifestCheck` or `cmdMilestoneWriteStatus` directly in tests causes the test runner to exit.
**Why it happens:** All gsd-tools functions call `output()` which calls `process.exit(0)`.
**How to avoid:** Use the established spawnSync child process pattern (from `milestone.test.cjs`). Do NOT call functions directly in tests — always use `runGsdToolsFull` or a `spawnSync` helper.
**Warning signs:** Only the first test in a describe block runs.

### Pitfall 6: progress multi Breaks Legacy Projects (DASH-04)
**What goes wrong:** New `cmdProgressRenderMulti` is called unconditionally, breaks when `.planning/milestones/` doesn't exist.
**Why it happens:** Forgetting the graceful degrade path.
**How to avoid:** Always call `detectLayoutStyle(cwd)` first. If `!== 'milestone-scoped'`, delegate to existing `cmdProgressRender`. The `progress` CLI verb should route to `cmdProgressRenderMulti` which internally falls back.
**Warning signs:** Test failures on `createTempProject()` (no milestones dir).

## Code Examples

Verified patterns from existing codebase:

### Scanning All Milestone Workspace Directories
```javascript
// Source: core.cjs getArchivedPhaseDirs pattern
const milestonesDir = path.join(cwd, '.planning', 'milestones');
if (!fs.existsSync(milestonesDir)) return [];

const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
const workspaceDirs = entries
  .filter(e => e.isDirectory())
  .map(e => e.name);
// Filter to only active workspaces: check conflict.json status
```

### Writing STATUS.md (per-milestone, lock-free)
```javascript
// Source: cmdMilestoneNewWorkspace pattern from milestone.cjs
function cmdMilestoneWriteStatus(cwd, version, options, raw) {
  const workspaceDir = path.join(cwd, '.planning', 'milestones', version);
  const statusPath = path.join(workspaceDir, 'STATUS.md');
  const today = new Date().toISOString().split('T')[0];

  const content = [
    `# Status — Milestone ${version}`,
    '',
    `**Updated:** ${today}`,
    `**Phase:** ${options.phase || '?'}`,
    `**Plan:** ${options.plan || '?'}`,
    `**Checkpoint:** ${options.checkpoint || 'unknown'}`,
    `**Progress:** ${options.progress || '?'}`,
    `**Status:** ${options.status || 'In Progress'}`,
    '',
  ].join('\n');

  fs.writeFileSync(statusPath, content, 'utf-8');
  output({ version, written: true, path: statusPath }, raw);
}
```

### Extending the progress CLI verb
```javascript
// Source: gsd-tools.cjs case 'progress': pattern
case 'progress': {
  const subcommand = args[1] || 'json';
  // New: route to multi-milestone render
  commands.cmdProgressRenderMulti(cwd, subcommand, raw);
  break;
}
```

### Test Pattern: spawnSync for process.exit functions
```javascript
// Source: milestone.test.cjs runNewWorkspace pattern
function runManifestCheck(cwd) {
  const script = `
    const m = require(${JSON.stringify(MILESTONE_LIB)});
    m.cmdManifestCheck(${JSON.stringify(cwd)}, true);
  `;
  return spawnSync(process.execPath, ['-e', script], { encoding: 'utf-8' });
}
```

### Updating a Section in MILESTONES.md (DASH-03)
```javascript
// Pattern: regex-based section replacement
// Each version has a section header: ## v2.0 ...
// Replace only the matching section, preserve others
function updateMilestoneSection(content, version, newSection) {
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionPattern = new RegExp(
    `(## ${escapedVersion}[^\n]*\n)([\\s\\S]*?)(?=\n## |$)`,
    'g'
  );
  if (sectionPattern.test(content)) {
    return content.replace(sectionPattern, newSection + '\n');
  }
  // Section doesn't exist yet — append
  return content + '\n' + newSection + '\n';
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-milestone progress bar (cmdProgressRender) | Multi-milestone dashboard (cmdProgressRenderMulti falls back to cmdProgressRender) | Phase 11 | Progress command becomes milestone-aware |
| MILESTONES.md as append-only archive | MILESTONES.md as live dashboard with independently-writable sections | Phase 11 | Concurrent sessions can update their own section |
| No conflict detection | Advisory `manifest-check` warns on files_touched overlap | Phase 11 | Teams get warnings before conflicts materialize |
| No STATUS.md per workspace | STATUS.md written at 3 checkpoints per workspace | Phase 11 | Multi-milestone dashboard has live data to read |

**Deprecated/outdated:**
- `cmdProgressRender` in `commands.cjs`: not deprecated — still used for legacy projects (DASH-04 graceful degrade). `cmdProgressRenderMulti` wraps it.

## Open Questions

1. **STATUS.md format: markdown vs JSON?**
   - What we know: Existing STATE.md uses markdown with bold-key patterns (`**Status:** ...`). All parsers use regex on markdown.
   - What's unclear: Whether STATUS.md should match STATE.md format exactly or use a simpler format.
   - Recommendation: Use the same bold-key markdown pattern as STATE.md. Keep the field set minimal: Updated, Phase, Plan, Checkpoint, Progress, Status. This is consistent with existing conventions and regex-parseable.

2. **Where to call `milestone write-status` in workflows?**
   - What we know: DASH-01 says "plan start, plan complete, phase complete." The `execute-phase` and `plan-phase` workflows have clear checkpoint moments where SUMMARY.md is written.
   - What's unclear: Whether the STATUS.md write should be in the workflow markdown files or triggered by the init command automatically.
   - Recommendation: Add `milestone write-status` as an explicit step in `execute-phase.md` and `plan-phase.md` workflows at the three checkpoint moments. Keep it out of the init command itself (separation of concerns).

3. **MILESTONES.md section update — write-status or separate command?**
   - What we know: DASH-03 says MILESTONES.md is a "live dashboard." The current `cmdMilestoneComplete` writes to it, but that's for completion.
   - What's unclear: Should STATUS.md writes also update MILESTONES.md sections, or is MILESTONES.md only updated at completion?
   - Recommendation: MILESTONES.md live dashboard sections should be updated by `cmdMilestoneWriteStatus` in parallel with STATUS.md writes. This is within scope of DASH-03. Keep MILESTONES.md update as a try/catch side effect — if it fails, STATUS.md is still written.

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not present in `.planning/config.json` (treated as disabled).

## Sources

### Primary (HIGH confidence)
- Direct codebase reading: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/milestone.cjs` — existing `cmdMilestoneNewWorkspace`, `cmdMilestoneUpdateManifest`, `cmdMilestoneComplete` patterns
- Direct codebase reading: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/commands.cjs` — existing `cmdProgressRender`, `cmdProgressRenderMulti` scaffold
- Direct codebase reading: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — `detectLayoutStyle`, `planningRoot`, `output`, `comparePhaseNum`
- Direct codebase reading: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/init.cjs` — all init command patterns, milestone-scope threading
- Direct codebase reading: `/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs` — CLI routing for all existing commands including `milestone` and `progress` verbs
- Direct codebase reading: `/Users/tmac/Projects/gsdup/tests/milestone.test.cjs` — spawnSync test pattern for `process.exit`-calling functions
- Direct codebase reading: `/Users/tmac/Projects/gsdup/tests/helpers.cjs` — `createTempProject`, `createLegacyProject`, `createConcurrentProject`, `runGsdToolsFull`
- Direct codebase reading: `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` — exact requirement text for DASH-01/02/03/04 and CNFL-02/03/04
- Direct codebase reading: `/Users/tmac/Projects/gsdup/.planning/STATE.md` — confirmed decisions: lock-free dashboard, advisory conflicts
- Direct codebase reading: `/Users/tmac/Projects/gsdup/package.json` — test runner: `node --test tests/*.test.cjs`

### Secondary (MEDIUM confidence)
- Test run output: 185/188 tests pass; 3 pre-existing config test failures unrelated to Phase 11 (config quality section tests fail)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure Node.js built-ins, same as all existing code
- Architecture: HIGH — extends existing modules, follows established patterns exactly
- Pitfalls: HIGH — derived from direct code reading and project decisions in STATE.md

**Research date:** 2026-02-24
**Valid until:** 2026-03-25 (30 days — stable codebase, no external dependencies)
