# Phase 1: Foundation - Research

**Researched:** 2026-02-23
**Domain:** Node.js CJS module patching, JSON config schema extension, markdown workflow text editing
**Confidence:** HIGH

---

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-01 | `cmdPhaseComplete` in `phase.cjs` determines `is_last_phase` by parsing ROADMAP.md phase headers instead of scanning filesystem directories | FIXED: Analysis shows `cmdPhaseComplete` already uses filesystem scan — bug is actually in the old code path that was removed. See Architecture Patterns for exact location and correct fix. |
| BUG-02 | `execute-plan.md` offer_next step uses ROADMAP.md phase count for routing instead of independent filesystem directory scan | CONFIRMED: `offer_next` in `execute-plan.md` determines "highest phase" via `current < highest phase` with no tooling call — the AI must infer this without a filesystem scan command. Fix: add `phases list` CLI call before the routing table. |
| BUG-03 | Both bug fixes are atomic — applied in the same plan with before/after test fixtures validating JSON output | Test infrastructure uses Node's built-in `node:test` runner and the `runGsdTools` helper. Pattern is well established in `tests/phase.test.cjs`. New `describe` blocks can be added for phase-complete multi-phase and offer_next routing. |
| CFG-01 | `config.json` template includes `quality.level` key with values `strict`, `standard`, or `fast` | The template at `get-shit-done/templates/config.json` is the source of truth. `cmdConfigEnsureSection` in `config.cjs` reads from a hardcoded object — BOTH the template file and the hardcoded object must be updated. |
| CFG-02 | `quality.level: fast` preserves existing GSD behavior exactly — zero quality gates fire | No quality gates exist yet (Phase 2 adds them). `fast` mode must be the default so adding the key doesn't change existing behavior. |
| CFG-03 | `config.json` includes `quality.test_exemptions` array listing file patterns exempt from test requirements | Array value in JSON. Default list: `[".md", ".json", "templates/**", ".planning/**"]` as specified in requirements. |
| CFG-04 | Every quality gate reads `quality_level` at its entry point before executing any checks | No quality gates exist yet in this codebase. The pattern to establish: gates call `config-get quality.level` at entry. This is a convention requirement — CFG-04 is satisfied by documenting the pattern in a comment or convention note in the config template or a workflow file that Phase 2 gates will follow. |

</phase_requirements>

---

## Summary

Phase 1 is a targeted bug-fix and config-extension phase with no external library dependencies. The entire scope is two files for the bugs (`get-shit-done/bin/lib/phase.cjs` and `get-shit-done/workflows/execute-plan.md`) and two files for config (`get-shit-done/templates/config.json` and `get-shit-done/bin/lib/config.cjs`), plus new test fixtures in `tests/phase.test.cjs`.

The BUG-01 claim in REQUIREMENTS.md says `cmdPhaseComplete` determines `is_last_phase` via ROADMAP.md parsing. Inspection of the current code (lines 782-802 of `phase.cjs`) shows it already uses `fs.readdirSync(phasesDir)` — a filesystem scan. The bug is therefore already fixed in the current codebase for `phase.cjs`. However BUG-02 is a real and unfixed issue: the `offer_next` step in `execute-plan.md` (lines 416-431) has the AI determine "current < highest phase" with no filesystem CLI call provided — only two `ls | wc -l` commands for plan/summary counts within the *current* phase. The AI must infer which is the highest phase without a reliable tool call, which is the bug. The fix is to add a `phases list` CLI invocation before the routing table so the AI has the full sorted directory listing.

The config changes are purely additive: add a `quality` object to the template and to the hardcoded defaults in `config.cjs`. The `fast` default preserves all existing behavior. CFG-04 establishes a convention (not an implementation) since no quality gates exist yet in Phase 1 — the convention is that gates will call `config-get quality.level` at entry. The planner must decide whether CFG-04 is satisfied by documentation or by a sentinel pattern in the workflow file.

**Primary recommendation:** Plan 01-01 covers BUG-01 (verify/document the existing fix), BUG-02 (fix `execute-plan.md` offer_next), and BUG-03 (add test fixtures for both). Plan 01-02 covers CFG-01 through CFG-04 (update config template and cjs defaults, add test for config shape).

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | Node >=16.7 | File I/O for phase.cjs fixes | Already used throughout; no external deps needed |
| Node.js built-in `node:test` | Node >=18 | Test runner for BUG-03 fixtures | Already used in all test files (`tests/*.test.cjs`) |
| Node.js built-in `node:assert` | Node >=16 | Assertions | Already used in all test files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `runGsdTools` helper | local | Spawns `gsd-tools.cjs` in a temp directory | Every test that needs to verify CLI JSON output |
| `createTempProject` / `cleanup` | local | Creates isolated `.planning/phases/` structure | Every `describe` block's `beforeEach`/`afterEach` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` | Jest, Mocha, Vitest | Project has zero devDependencies for testing; `node:test` is the existing pattern. Do not add external test frameworks. |

**Installation:** No installation needed. Zero new dependencies.

---

## Architecture Patterns

### Recommended Project Structure (for new files)

No new files are needed for Phase 1. All changes are edits to existing files:

```
get-shit-done/
├── bin/lib/phase.cjs         # BUG-01: verify/annotate existing fix
├── bin/lib/config.cjs        # CFG-01/02/03: add quality defaults
├── templates/config.json     # CFG-01/02/03: add quality key to template
└── workflows/execute-plan.md # BUG-02: fix offer_next routing

tests/
└── phase.test.cjs            # BUG-03: add new describe blocks
```

### Pattern 1: BUG-01 — is_last_phase in cmdPhaseComplete

**What:** `cmdPhaseComplete` (phase.cjs lines 697-862) already contains a correct filesystem-based `is_last_phase` determination. The relevant block is at lines 782-802:

```javascript
// Find next phase
let nextPhaseNum = null;
let nextPhaseName = null;
let isLastPhase = true;

try {
  const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort((a, b) => comparePhaseNum(a, b));

  // Find the next phase directory after current
  for (const dir of dirs) {
    const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)?)-?(.*)/i);
    if (dm) {
      if (comparePhaseNum(dm[1], phaseNum) > 0) {
        nextPhaseNum = dm[1];
        nextPhaseName = dm[2] || null;
        isLastPhase = false;
        break;
      }
    }
  }
} catch {}
```

This scans `.planning/phases/` on disk. It does NOT parse ROADMAP.md. The existing test at line 765 in `phase.test.cjs` ("detects last phase in milestone") already validates this path using only a filesystem directory (no ROADMAP.md `Phase N:` headers for the phase count).

**BUG-01 disposition:** The filesystem-scan fix is already present. BUG-03 requires adding before/after test fixtures. The "before" fixture should simulate what the bug would have been (ROADMAP.md with 3 phases but only 1 phase directory = filesystem says last phase, ROADMAP says not). The "after" fixture is the current behavior. This satisfies BUG-03 atomically.

### Pattern 2: BUG-02 — offer_next in execute-plan.md

**What:** The `offer_next` step (lines 416-431 of execute-plan.md) determines routing via a table:

```
| summaries < plans               | A: More plans    | ...                         |
| summaries = plans, current < highest phase | B: Phase done | /gsd:plan-phase {Z+1}  |
| summaries = plans, current = highest phase | C: Milestone done | /gsd:complete-milestone |
```

The two bash commands shown only count PLANs and SUMMARYs in the *current* phase directory. "current < highest phase" has no CLI call to determine what the highest phase is. The AI must infer this from context (typically STATE.md, which may be stale or use ROADMAP.md phase count).

**Fix pattern:** Before the routing table, add a `phases list` CLI call:

```bash
PHASE_DIRS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phases list --raw)
# Parse to get highest phase number from sorted directory list
```

The `phases list` command (implemented in `cmdPhasesList` in phase.cjs) returns:
```json
{"directories": ["01-foundation", "02-api", "03-features"], "count": 3}
```

The last element of `directories` (after numeric sort, which the CLI already applies) gives the highest phase. The AI can compare `current_phase` to the numeric prefix of the last directory entry.

**When to use:** Anytime `execute-plan.md` needs to determine if the current phase is the last phase on disk.

### Pattern 3: Config Extension (CFG-01/02/03)

**What:** Two files must be updated in lockstep:

**File 1:** `get-shit-done/templates/config.json` (the template users copy)
**File 2:** `get-shit-done/bin/lib/config.cjs` (the hardcoded defaults in `cmdConfigEnsureSection`)

The `quality` block to add:

```json
"quality": {
  "level": "fast",
  "test_exemptions": [".md", ".json", "templates/**", ".planning/**"]
}
```

`level: "fast"` is the correct default — it means zero behavioral change from vanilla GSD (CFG-02). The values are `"strict"`, `"standard"`, or `"fast"`.

In `config.cjs`, the `hardcoded` object (lines 46-61) must add the `quality` key. The merge logic at lines 62-66 will propagate it correctly:

```javascript
const hardcoded = {
  // ...existing keys...
  quality: {
    level: 'fast',
    test_exemptions: ['.md', '.json', 'templates/**', '.planning/**'],
  },
};
```

### Pattern 4: CFG-04 Convention Pattern

**What:** CFG-04 says "Every quality gate reads `quality_level` at its entry point before executing any checks." No quality gates exist yet (Phase 2 adds them). This requirement establishes a convention.

**How to satisfy in Phase 1:** Add a comment block to the config template (or a new workflow/reference file) documenting the convention. Alternatively, document it in a `## Quality Level Convention` section in the config template. The simplest approach is a comment in `config.json` (JSON doesn't support comments) or a note in a new `get-shit-done/references/quality.md` file that Phase 2 gates will follow.

**Recommended approach:** Add a `## CFG-04: Quality Gate Convention` note within the plan itself, and assert in the test that `config-get quality.level` returns a valid value. This satisfies the requirement without inventing infrastructure.

### Pattern 5: Test Fixture Structure (BUG-03)

The existing test pattern in `tests/phase.test.cjs`:

```javascript
describe('phase complete command', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('description', () => {
    // 1. Write fixture files (ROADMAP.md, STATE.md, phase dirs)
    // 2. runGsdTools('phase complete N', tmpDir)
    // 3. assert.ok(result.success)
    // 4. const output = JSON.parse(result.output)
    // 5. assert specific JSON fields
    // 6. Optionally read back written files
  });
});
```

**For BUG-01 "before" test fixture (proves filesystem scan beats ROADMAP):**

```javascript
test('is_last_phase uses filesystem not ROADMAP (3 phases in ROADMAP, only 1 on disk = last)', () => {
  // ROADMAP has Phase 1, 2, 3 — but only Phase 1 dir exists on disk
  // BUG would have said is_last_phase=false (ROADMAP has more phases)
  // Correct: is_last_phase=true (no next phase dir on disk)
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), `...Phase 1...\n...Phase 2...\n...Phase 3...`);
  // Only create phase 01 dir, not 02 or 03
  const p1 = path.join(tmpDir, '.planning', 'phases', '01-foundation');
  fs.mkdirSync(p1, { recursive: true });
  fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '# Plan');
  fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary');
  // ... STATE.md ...
  const result = runGsdTools('phase complete 1', tmpDir);
  const output = JSON.parse(result.output);
  assert.strictEqual(output.is_last_phase, true, 'filesystem has no next phase dir');
  assert.strictEqual(output.next_phase, null);
});
```

**For BUG-02** — the fix is in a markdown workflow file (`execute-plan.md`), not a CJS file, so there is no automated unit test possible for it. BUG-03's requirement to "validate the correct JSON output" applies to the `phase complete` command's JSON output (which is already testable). The planner must document this limitation and satisfy BUG-03 via the `phase.cjs` test fixture only.

**For CFG-01/02/03 tests** — add to existing or new `tests/init.test.cjs`:

```javascript
test('config-ensure-section creates quality key with fast default', () => {
  const result = runGsdTools('config-ensure-section', tmpDir);
  const config = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
  assert.ok(config.quality, 'quality key must exist');
  assert.strictEqual(config.quality.level, 'fast', 'default level must be fast');
  assert.ok(Array.isArray(config.quality.test_exemptions), 'test_exemptions must be array');
  assert.ok(config.quality.test_exemptions.includes('.md'), 'must include .md exemption');
});
```

### Anti-Patterns to Avoid

- **Do not add ROADMAP.md parsing to cmdPhaseComplete:** The filesystem scan is already the correct approach. Adding ROADMAP.md parsing would reintroduce the bug.
- **Do not make quality.level default to "strict" or "standard":** Either would change existing GSD behavior. `fast` is the only safe default.
- **Do not add external test dependencies:** The project has zero test framework dependencies. Use `node:test` and `node:assert` only.
- **Do not modify `cmdConfigGet` or `cmdConfigSet`:** These already support dot-notation traversal (e.g., `config-get quality.level` will work once the key exists). No changes needed.
- **Do not attempt to test execute-plan.md with unit tests:** It is a markdown workflow file interpreted by Claude Code at runtime. BUG-02 is validated by inspection and the PLAN.md's before/after description, not by an automated fixture.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phase sorting | Custom sort | `comparePhaseNum` from `core.cjs` | Already handles integers, decimals, letter-suffix, hybrids |
| Phase directory scan | Custom `fs.readdirSync` | `cmdPhasesList` via `gsd-tools phases list` | Returns pre-sorted JSON with count |
| Config dot-notation | Custom traversal | `cmdConfigGet`/`cmdConfigSet` | Already handles nested paths like `quality.level` |
| Test isolation | Manual temp dirs | `createTempProject()` / `cleanup()` from `tests/helpers.cjs` | Handles `.planning/phases/` structure creation and cleanup |

**Key insight:** All necessary utilities already exist. Phase 1 is entirely additive editing of existing files, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update Both Config Locations

**What goes wrong:** You update `get-shit-done/templates/config.json` but not the `hardcoded` object in `config.cjs` (or vice versa). New projects created via `config-ensure-section` get different defaults than the template suggests.

**Why it happens:** The template file is what's documented for users; the hardcoded object in `config.cjs` is what the CLI actually writes. They are maintained separately.

**How to avoid:** Always update both files in the same task. Add a test that calls `config-ensure-section` and verifies the resulting `.planning/config.json` contains the expected `quality` block — this will catch divergence.

**Warning signs:** Test passes but template and hardcoded object differ.

### Pitfall 2: BUG-02 Fix Breaking Pattern A (More Plans) Routing

**What goes wrong:** The `phases list` call is added but the AI's extraction of "highest phase" from the JSON uses a fragile pattern (e.g., regex on `directories[0]` instead of `directories[directories.count-1]`).

**Why it happens:** The `phases list` output is an array sorted ascending. The "highest" is the last element, not the first.

**How to avoid:** The plan must explicitly specify: parse the `directories` array from the JSON, take the last element, extract its numeric prefix, compare to current phase number.

**Warning signs:** Routes to "Milestone done" (C) when there are still future phases because it's reading the first directory instead of the last.

### Pitfall 3: is_last_phase Test Not Proving the Bug

**What goes wrong:** The "before" fixture test passes even if someone reimplements the buggy ROADMAP.md-parsing approach, because the test scenario happens to have the ROADMAP.md and filesystem in sync.

**Why it happens:** If phase dirs and ROADMAP.md phase count match, both approaches return the same answer.

**How to avoid:** The "before" fixture must intentionally create a mismatch: ROADMAP.md with 3 phase headers, only 1 phase directory on disk. This is the only scenario that distinguishes filesystem from ROADMAP behavior.

**Warning signs:** Test passes with either implementation.

### Pitfall 4: quality.level Enum Not Validated at Read Time

**What goes wrong:** A user sets `quality.level: "turbo"` (an invalid value). Phase 2 quality gates silently treat it as `fast` or crash.

**Why it happens:** `cmdConfigGet` returns whatever value is stored without validation.

**How to avoid:** Phase 1 does not need to add validation — that is Phase 2's responsibility when gates are implemented. The planner should note this explicitly so Phase 2 adds the validation. Do not add enum validation in Phase 1.

---

## Code Examples

### Read quality.level from config in a bash workflow step

```bash
# In a GSD workflow file (e.g., execute-plan.md or gsd-executor.md)
QUALITY_LEVEL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs config-get quality.level 2>/dev/null || echo "fast")
# QUALITY_LEVEL will be "fast", "standard", or "strict"
```

This is the CFG-04 pattern that Phase 2 gates will adopt. It defaults to `"fast"` if the key is missing (backward compat).

### phases list call to determine highest phase

```bash
PHASES_JSON=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs phases list)
# Returns: {"directories":["01-foundation","02-api","03-features"],"count":3}
# Highest phase = last element of directories array after sort (already sorted by CLI)
```

The directories are already sorted numerically by `cmdPhasesList` using `comparePhaseNum`. The last element is the highest phase.

### Exact config.json additions (CFG-01/02/03)

```json
{
  "mode": "interactive",
  "depth": "standard",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": false
  },
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  },
  "quality": {
    "level": "fast",
    "test_exemptions": [".md", ".json", "templates/**", ".planning/**"]
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Status | Impact |
|--------------|------------------|--------|--------|
| `is_last_phase` via ROADMAP.md parsing | `is_last_phase` via filesystem `readdirSync` | Already fixed in codebase | BUG-01 is pre-fixed; only test validation needed |
| `offer_next` "highest phase" via implicit context | `offer_next` via `phases list` CLI call | Not yet fixed | BUG-02 requires explicit fix to execute-plan.md |
| No `quality` key in config | `quality.level` and `quality.test_exemptions` in config | Not yet added | Phase 1 adds the foundation; Phase 2 adds gates |

**Deprecated/outdated:**
- The REQUIREMENTS.md description of BUG-01 describes a past state of `cmdPhaseComplete`. The current codebase has already corrected this. The fix commitment (BUG-03) is satisfied by adding tests that prove the filesystem scan is the actual implementation.

---

## Open Questions

1. **Does BUG-01 need additional context about what the old buggy code looked like?**
   - What we know: The current `phase.cjs` already uses filesystem scan at lines 782-802. There is no ROADMAP.md parsing in `cmdPhaseComplete`.
   - What's unclear: Was the ROADMAP.md parsing removed in a prior commit, or was it never present in this fork? The REQUIREMENTS.md records it as a known bug.
   - Recommendation: Treat as "already fixed, needs test validation." The planner should write the test that proves the fix is real (mismatch scenario: ROADMAP has 3 phases, disk has 1). If a future reader of the code cannot find the buggy code path, the test is the documentation.

2. **Does CFG-04 require any code change in Phase 1, or is documentation sufficient?**
   - What we know: No quality gates exist yet. CFG-04 says "every quality gate reads `quality_level` at its entry point." There are no entry points yet.
   - What's unclear: Does the requirement intend a code change (e.g., adding a comment/stub in the workflow), or just the convention being established by the config key existing?
   - Recommendation: Satisfy CFG-04 with: (a) the `quality.level` key existing in config so `config-get quality.level` works, and (b) a documented note in the config template or plan SUMMARY that Phase 2 gates must call `config-get quality.level` at entry. No code change needed beyond the config addition.

3. **Should `quality.test_exemptions` support glob patterns or only suffixes?**
   - What we know: The requirements list both suffix patterns (`.md`, `.json`) and glob patterns (`templates/**`, `.planning/**`).
   - What's unclear: Phase 2 will need to evaluate whether a file path matches an exemption. Using both suffixes and globs requires a glob matching library or custom logic.
   - Recommendation: Phase 1 stores the array as-is (no evaluation logic needed yet). The planner should note this as a Phase 2 concern and not add glob evaluation in Phase 1.

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/phase.cjs` (lines 697-862, `cmdPhaseComplete` function)
- Direct code inspection of `/Users/tmac/Projects/gsdup/get-shit-done/workflows/execute-plan.md` (lines 416-431, `offer_next` step)
- Direct code inspection of `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/config.cjs` (lines 1-163, `cmdConfigEnsureSection`)
- Direct code inspection of `/Users/tmac/Projects/gsdup/get-shit-done/templates/config.json`
- Direct code inspection of `/Users/tmac/Projects/gsdup/tests/phase.test.cjs` (lines 706-1008, existing phase complete tests)
- Direct code inspection of `/Users/tmac/Projects/gsdup/tests/helpers.cjs` (test helper patterns)
- Verified test runner: `node --test tests/*.test.cjs` — 96 tests, 0 failures (confirmed via `npm test`)

### Secondary (MEDIUM confidence)

- N/A — all claims are verified via direct code inspection

### Tertiary (LOW confidence)

- N/A

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; existing Node.js built-ins and helpers fully sufficient
- Architecture: HIGH — all relevant code inspected directly; exact line numbers and function names verified
- Pitfalls: HIGH — derived from direct inspection of the two-location config pattern and the ascending-sort array behavior of `phases list`
- BUG-01 status: HIGH — filesystem scan is present and correct at lines 782-802 of `phase.cjs`
- BUG-02 status: HIGH — `execute-plan.md` offer_next has no CLI call for determining highest phase; fix approach is clear
- CFG-01/02/03: HIGH — both files requiring update identified; exact JSON shape specified
- CFG-04: MEDIUM — convention-only in Phase 1; no gates exist to test against

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable domain — Node.js CJS, JSON config, no external APIs)
