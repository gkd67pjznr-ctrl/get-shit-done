# Phase 8: Path Architecture Foundation - Research

**Researched:** 2026-02-24
**Domain:** Node.js CJS module internals, CLI flag parsing, path resolution patterns
**Confidence:** HIGH — this is entirely internal code being read directly from the repo

## Summary

Phase 8 adds two pure functions to `core.cjs` (`planningRoot` and `detectLayoutStyle`), adds `--milestone` global flag parsing to `gsd-tools.cjs`, and fixes the `is_last_phase` bug in `cmdPhaseComplete`. No new dependencies are required. All changes are in files already read in full as part of this research. The implementation surface is small — roughly 60-80 lines of new code spread across two files — but it is load-bearing: every other v2.0 phase depends on `planningRoot` returning the correct path.

The codebase is CommonJS (`.cjs`), run with Node.js `>=16.7.0`. Tests use Node's built-in `node:test` runner (`node --test tests/*.test.cjs`). No third-party test framework is present. All existing tests use the `createTempProject()` helper in `tests/helpers.cjs`. The test helper constructs a minimal `.planning/phases/` directory tree and exercises gsd-tools.cjs via `execSync`/`spawnSync`.

The `is_last_phase` bug is already visible in the source: `cmdPhaseComplete` determines next-phase by scanning `.planning/phases/` directories on disk. When future phases are unplanned (no directory created yet, only an entry in ROADMAP.md), the directory scan finds nothing after the current phase and sets `isLastPhase = true` prematurely. The fix requires consulting ROADMAP.md as a fallback — if ROADMAP.md has a higher phase number that hasn't been completed yet, `isLastPhase` must remain `false`.

**Primary recommendation:** Add `planningRoot` and `detectLayoutStyle` to `core.cjs`, parse `--milestone` in the top-level `main()` of `gsd-tools.cjs` and pass it via a context object (or individual function arguments) to `init`, `phase`, `state`, and `roadmap` commands, and fix the `isLastPhase` scan in `cmdPhaseComplete` to also check ROADMAP.md.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (`fs`, `path`) | >=16.7.0 | File I/O, path construction | Already used throughout all lib files |
| `node:test` | built-in | Unit testing | Already used — no external test deps |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:assert` | built-in | Test assertions | Already used in all test files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `--milestone` parsing in `main()` | A dedicated flag-parser library | Overkill; the pattern is already established with `--cwd` and `--raw` and takes ~10 lines |
| Passing `milestoneScope` through every function signature | A module-level global / context object | Globals cause test isolation problems; function arguments are explicit and match existing patterns |

**Installation:**
No new packages required. Zero new dependencies.

## Architecture Patterns

### Recommended Project Structure

No new files or directories. All changes land in:

```
get-shit-done/bin/
├── gsd-tools.cjs          # Add --milestone global flag parsing (main())
└── lib/
    ├── core.cjs           # Add planningRoot(), detectLayoutStyle()
    └── phase.cjs          # Fix is_last_phase bug in cmdPhaseComplete()
tests/
└── phase.test.cjs         # Add is_last_phase regression test (or new file)
```

### Pattern 1: The planningRoot() Function

**What:** Single source of truth for the `.planning/` base path. Returns milestone-scoped path when `milestoneScope` is provided, legacy path otherwise.

**When to use:** Any module that constructs a path into `.planning/`. Phase 8 just adds the function; Phase 12 migrates all callers.

**Example:**
```javascript
// Source: inferred from requirements PATH-01 + existing path.join patterns in core.cjs
function planningRoot(cwd, milestoneScope) {
  if (milestoneScope) {
    return path.join(cwd, '.planning', 'milestones', milestoneScope);
  }
  return path.join(cwd, '.planning');
}
```

Return value is an **absolute path** (matches existing conventions — all internal functions use `path.join(cwd, ...)` and return absolute paths).

### Pattern 2: The detectLayoutStyle() Function

**What:** Reads `config.json` at `.planning/config.json` and returns one of three string constants based solely on whether `concurrent: true` is present.

**When to use:** Any code that needs to branch on layout mode. Called once at command entry, result threaded through.

**Example:**
```javascript
// Source: requirements PATH-02 + existing loadConfig() pattern in core.cjs
function detectLayoutStyle(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.concurrent === true) {
      return 'milestone-scoped';
    }
    return 'legacy';
  } catch {
    return 'uninitialized';
  }
}
```

Return values: `'legacy'`, `'milestone-scoped'`, `'uninitialized'` (string constants — consider exporting them as named constants to avoid typos in callers).

**Critical design constraint from STATE.md:** Detection uses `concurrent: true` sentinel in `config.json`, NEVER directory presence. This is a locked decision.

### Pattern 3: --milestone Global Flag Parsing

**What:** `gsd-tools.cjs` `main()` already parses `--cwd` and `--raw` as global flags before the command switch. Add `--milestone` to the same block.

**When to use:** Any command that needs milestone-scoped path resolution.

**Example:**
```javascript
// Source: existing --cwd pattern in gsd-tools.cjs lines 148-165
let milestoneScope = null;
const milestoneEqArg = args.find(arg => arg.startsWith('--milestone='));
const milestoneIdx = args.indexOf('--milestone');
if (milestoneEqArg) {
  milestoneScope = milestoneEqArg.slice('--milestone='.length).trim();
  args.splice(args.indexOf(milestoneEqArg), 1);
} else if (milestoneIdx !== -1) {
  const value = args[milestoneIdx + 1];
  if (!value || value.startsWith('--')) error('Missing value for --milestone');
  args.splice(milestoneIdx, 2);
  milestoneScope = value;
}
```

Threading `milestoneScope` to commands: the cleanest approach is passing it as an explicit argument to the init/phase/state/roadmap command functions that need it. Phase 8 only needs to wire it into the `init` commands and `phase complete` command. Full routing (all commands) is Phase 12.

### Pattern 4: is_last_phase Bug Fix

**What:** `cmdPhaseComplete` (phase.cjs lines 783-799) determines `isLastPhase` by scanning `.planning/phases/` on disk. When subsequent phases have no directory yet (unplanned), it falsely returns `isLastPhase: true`.

**Root cause (confirmed by reading source):**
```javascript
// Current code — only checks disk directories:
const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
const dirs = entries.filter(e => e.isDirectory()).map(e => e.name)...
for (const dir of dirs) {
  if (comparePhaseNum(dm[1], phaseNum) > 0) {
    isLastPhase = false;  // only set false if a DIRECTORY exists
    break;
  }
}
```

**Fix:** After the directory scan, if `isLastPhase` is still `true`, consult ROADMAP.md via `getRoadmapPhaseInternal` or raw regex to check whether any phase with a higher number exists and is not marked complete. If such a phase exists in ROADMAP.md, set `isLastPhase = false`.

**Example:**
```javascript
// After directory scan:
if (isLastPhase && fs.existsSync(roadmapPath)) {
  const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*):/gi;
  let m;
  while ((m = phasePattern.exec(roadmapContent)) !== null) {
    if (comparePhaseNum(m[1], phaseNum) > 0) {
      // Higher phase exists in roadmap — not last
      isLastPhase = false;
      break;
    }
  }
}
```

Note: The fix must also check whether that higher roadmap phase is already marked complete (via `[x]` checkbox or progress table). If already complete, `isLastPhase` logic should remain unaffected by it.

### Anti-Patterns to Avoid

- **Building `.planning/` paths with string concatenation:** `cwd + '/.planning/'` — use `path.join()`. Already the pattern everywhere.
- **Using `concurrent: true` detection based on directory presence:** REQUIREMENTS.md and STATE.md are explicit — always use config.json sentinel only.
- **Mutating `args` array before extracting `--milestone`:** Must strip `--milestone` from `args` before the command router sees it, exactly like `--cwd` and `--raw` are handled.
- **Exporting `planningRoot` without adding to `module.exports`:** `core.cjs` uses explicit `module.exports` at the bottom — easy to add the function but forget to export it.
- **Making `detectLayoutStyle` read from a global module cache:** Each call must read from disk so tests can swap config.json contents per test case.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON config reading | Custom config parser | Existing `loadConfig()` pattern (fs.readFileSync + JSON.parse + try/catch) | Already handles missing files gracefully |
| CLI flag parsing | Argument parsing library (minimist, yargs) | Same inline splicing pattern as `--cwd` | Zero new dependencies, consistent with existing style |
| Roadmap phase number extraction | New parser | Existing `getRoadmapPhaseInternal()` or the regex pattern already in phase.cjs | Avoid duplicating regex logic |

**Key insight:** This phase adds no new external dependencies. Everything is Node.js built-ins + patterns already present in the codebase.

## Common Pitfalls

### Pitfall 1: Forgetting to Export New Functions

**What goes wrong:** `planningRoot` and `detectLayoutStyle` are defined in `core.cjs` but not added to `module.exports` — every caller gets `undefined` at runtime.

**Why it happens:** `core.cjs` has a large explicit `module.exports` block at the bottom (lines 402-421). It's easy to add a function and forget to add the export.

**How to avoid:** Add to `module.exports` in the same commit as the function definition. The test will catch it immediately if it's missing.

**Warning signs:** `TypeError: planningRoot is not a function` in tests.

### Pitfall 2: --milestone Stripping Order Matters

**What goes wrong:** `--milestone` is stripped from `args` AFTER the command router runs, so `args[0]` is `'--milestone'` instead of the command name.

**Why it happens:** The existing `--cwd` and `--raw` parsing happens at the top of `main()` before `const command = args[0]`. If `--milestone` parsing is added after `const command = args[0]`, the command will be `undefined` or `'--milestone'`.

**How to avoid:** Insert `--milestone` parsing block between the existing `--raw` parsing and the `const command = args[0]` line.

**Warning signs:** `Unknown command: --milestone` error.

### Pitfall 3: is_last_phase Fix Breaks the Real Last Phase

**What goes wrong:** The fix to check ROADMAP.md for higher phases accidentally marks a phase as `isLastPhase = false` even when it actually IS the last phase in the roadmap (because a phase header was found but it was already completed).

**Why it happens:** The raw regex finds all phase headers regardless of completion status. If Phase 13 is the last and all are complete, completing Phase 12 should yield `isLastPhase = true`, but if Phase 13's header is found in ROADMAP.md, the fix naively sets `isLastPhase = false`.

**How to avoid:** When a higher-numbered phase is found in ROADMAP.md, also check whether it's already marked complete (`[x]` checkbox). Only set `isLastPhase = false` for phases that are NOT already completed.

**Warning signs:** `isLastPhase: false` returned when completing the actual last phase.

### Pitfall 4: detectLayoutStyle Returns Wrong Value for Existing Projects

**What goes wrong:** An old-style project that has a `.planning/milestones/` directory (from `milestone complete --archive-phases`) is detected as `milestone-scoped` because some code checked directory presence.

**Why it happens:** It's tempting to check if `.planning/milestones/` exists as a quick layout detector. The requirement explicitly forbids this.

**How to avoid:** `detectLayoutStyle` must ONLY read `config.json`. Directory existence is irrelevant.

**Warning signs:** Calling `detectLayoutStyle` on this project's own `.planning/` returns `milestone-scoped` when it should return `legacy` (since `config.json` has no `concurrent: true`).

### Pitfall 5: planningRoot Returns Relative vs Absolute Path

**What goes wrong:** Some callers expect an absolute path (like `loadConfig` which does `path.join(cwd, '.planning', 'config.json')`), others might expect relative. If `planningRoot` returns relative, callers that do `path.join(planningRoot(...), 'STATE.md')` would produce a broken path.

**Why it happens:** The signature `planningRoot(cwd, milestoneScope)` takes `cwd` — the intent is clearly to return an absolute path. But if someone calls `planningRoot('.')` and later `path.join(result, 'STATE.md')`, they get `'./.planning/STATE.md'` which works but is inconsistent.

**How to avoid:** Always resolve `cwd` to an absolute path inside `planningRoot` using `path.resolve(cwd)` before constructing the return value. Or document clearly that `cwd` must be absolute, consistent with how every other function in the codebase treats it.

## Code Examples

Verified patterns from official sources (direct codebase reads):

### Existing --cwd Flag Parsing Pattern (gsd-tools.cjs lines 148-165)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs (read directly)
const cwdEqArg = args.find(arg => arg.startsWith('--cwd='));
const cwdIdx = args.indexOf('--cwd');
if (cwdEqArg) {
  const value = cwdEqArg.slice('--cwd='.length).trim();
  if (!value) error('Missing value for --cwd');
  args.splice(args.indexOf(cwdEqArg), 1);
  cwd = path.resolve(value);
} else if (cwdIdx !== -1) {
  const value = args[cwdIdx + 1];
  if (!value || value.startsWith('--')) error('Missing value for --cwd');
  args.splice(cwdIdx, 2);
  cwd = path.resolve(value);
}
```

The `--milestone` parsing should follow this exact same pattern.

### Existing config.json Reading Pattern (core.cjs loadConfig, lines 60-121)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs (read directly)
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  // ...
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // ...
  } catch {
    return defaults;
  }
}
```

`detectLayoutStyle` should use the same `try/catch` around `readFileSync` + `JSON.parse`.

### Existing Test Pattern (tests/phase.test.cjs)
```javascript
// Source: /Users/tmac/Projects/gsdup/tests/phase.test.cjs (read directly)
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('phase complete', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('is_last_phase false when higher phases exist only in roadmap', () => {
    // Setup: phase 08 dir, roadmap with phase 09 header (no phase 09 dir)
    // Exercise: phase complete 08
    // Assert: result.is_last_phase === false
  });
});
```

### module.exports block pattern (core.cjs lines 402-421)
```javascript
// Source: /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs (read directly)
module.exports = {
  MODEL_PROFILES,
  output,
  error,
  safeReadFile,
  loadConfig,
  isGitIgnored,
  execGit,
  escapeRegex,
  normalizePhaseName,
  comparePhaseNum,
  searchPhaseInDir,
  findPhaseInternal,
  getArchivedPhaseDirs,
  getRoadmapPhaseInternal,
  resolveModelInternal,
  pathExistsInternal,
  generateSlugInternal,
  getMilestoneInfo,
  // ADD: planningRoot, detectLayoutStyle
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `.planning/` path strings everywhere | `planningRoot(cwd, milestoneScope)` central resolver | Phase 8 (this phase) | All future callers use one function — Phase 12 migrates existing callers |
| No layout detection | `detectLayoutStyle()` reads config.json sentinel | Phase 8 (this phase) | Foundation for COMPAT-01/02/03 compatibility layer in Phase 10 |
| `is_last_phase` based solely on disk directories | Also consults ROADMAP.md | Phase 8 bug fix | Phase completion routing no longer prematurely terminates |

## Open Questions

1. **Should `planningRoot` accept `null` vs `undefined` vs `''` for milestoneScope?**
   - What we know: the flag parsing will produce `null` when `--milestone` is not passed
   - What's unclear: should `planningRoot(cwd, null)`, `planningRoot(cwd, undefined)`, and `planningRoot(cwd)` all return the same legacy path?
   - Recommendation: Use truthiness check (`if (milestoneScope)`) — all three cases return legacy path. Document this in a JSDoc comment.

2. **Should `detectLayoutStyle` also be exported from `core.cjs`, or live in a new `layout.cjs` module?**
   - What we know: `core.cjs` already has 17 exports and is the "shared utilities" module; `detectLayoutStyle` is clearly a shared utility
   - What's unclear: at what point does `core.cjs` become too large to maintain?
   - Recommendation: Add to `core.cjs` for now. The function is 10 lines. Create a `layout.cjs` module only if the file grows unwieldy (Phase 12+).

3. **Is the is_last_phase fix needed for both `cmdPhaseComplete` in phase.cjs AND the equivalent in any workflow files?**
   - What we know: `cmdPhaseComplete` is the single function called by `phase complete <N>` — all workflows call this CLI command
   - What's unclear: do any workflow bash scripts also check `is_last_phase` themselves via their own logic?
   - Recommendation: Fix `cmdPhaseComplete` in phase.cjs. It is the sole authority. The JSON output `is_last_phase` is what callers consume.

4. **Should `--milestone` flag threading for Phase 8 be minimal (just init + phase complete) or complete (all commands)?**
   - What we know: PATH-03 says "threaded to all phase/state/roadmap commands"; Phase 12 (ROUTE-01/02) is where full routing happens
   - What's unclear: is PATH-03 in Phase 8 meant to establish the parsing + demonstrate it works end-to-end for init commands, or is it meant to fully wire every command?
   - Recommendation: Phase 8 establishes the parsing infrastructure and wires it to init commands (since they immediately use `planningRoot`). Full command routing belongs to Phase 12. The distinction is: Phase 8 makes `--milestone` available and functional for the new functions; Phase 12 propagates it to all existing commands.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PATH-01 | `planningRoot(cwd, milestoneScope)` function in core.cjs returns `.planning/` for old-style or `.planning/milestones/<v>/` for new-style projects | Pattern documented above; uses existing `path.join` conventions; export to module.exports confirmed |
| PATH-02 | `detectLayoutStyle(cwd)` checks config.json for `concurrent: true` sentinel, returns `legacy`, `milestone-scoped`, or `uninitialized` | config.json reading pattern confirmed from `loadConfig()`; sentinel-only detection is locked design decision |
| PATH-03 | `--milestone <version>` global CLI flag parsed by gsd-tools.cjs and threaded to all phase/state/roadmap commands | Exact parsing pattern found at lines 148-165 of gsd-tools.cjs; `--cwd` is the direct template; threading mechanism (function arg passing) documented |
| PATH-04 | `is_last_phase` bug fixed — phase completion routing no longer prematurely marks phases as last when future phases are unplanned | Bug root cause confirmed in phase.cjs lines 783-799; fix pattern (fallback to ROADMAP.md regex scan) documented with completed-phase guard |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/core.cjs` — full source, all exports, all patterns
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs` — full CLI router, existing flag parsing patterns
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/phase.cjs` — full source including `cmdPhaseComplete` with confirmed bug location (lines 783-799)
- Direct read of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/init.cjs` — full source for init commands
- Direct read of `/Users/tmac/Projects/gsdup/tests/helpers.cjs` — test infrastructure patterns
- Direct read of `/Users/tmac/Projects/gsdup/.planning/REQUIREMENTS.md` — all PATH-0x requirements
- Direct read of `/Users/tmac/Projects/gsdup/.planning/STATE.md` — locked design decisions
- Direct read of `/Users/tmac/Projects/gsdup/.planning/milestones/v2.0-ROADMAP.md` — phase success criteria
- Direct read of `/Users/tmac/Projects/gsdup/package.json` — test runner (`node --test`), no external test deps

### Secondary (MEDIUM confidence)
None — all findings come from direct source reads.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from package.json and all lib files
- Architecture: HIGH — confirmed from direct source reads; no inference required
- Pitfalls: HIGH — bugs/patterns identified directly in source (not hypothetical)
- is_last_phase bug: HIGH — root cause confirmed by reading the exact lines

**Research date:** 2026-02-24
**Valid until:** Stable indefinitely — all findings are from static source reads of the repo itself, not external documentation
