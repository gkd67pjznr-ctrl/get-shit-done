# GSD Feasibility Analysis: Milestone-Only Layout Simplification

**Question:** Should GSD be rebuilt from the ground up with milestone-scoped as the ONLY layout, or should the existing codebase be surgically stripped of legacy support? Can upstream GSD updates still be pulled under each approach?

**Date:** 2026-03-03
**Status:** Complete — recommendation at Section 5.

---

## Section 1: Current State Inventory

### Source File Sizes

| File | Lines | Role |
|------|-------|------|
| `get-shit-done/bin/lib/phase.cjs` | 943 | Phase lookup, creation, listing |
| `get-shit-done/bin/lib/init.cjs` | 880 | CLI init command handlers |
| `get-shit-done/bin/lib/verify.cjs` | 772 | Summary verification |
| `get-shit-done/bin/gsd-tools.cjs` | 733 | CLI router / entry point |
| `get-shit-done/bin/lib/migrate.cjs` | 694 | Legacy-to-milestone migration tool |
| `get-shit-done/bin/lib/commands.cjs` | 639 | Utility command handlers |
| `get-shit-done/bin/lib/core.cjs` | 595 | Core primitives (detectLayoutStyle, planningRoot, etc.) |
| `get-shit-done/bin/lib/state.cjs` | 521 | State file management |
| `get-shit-done/bin/lib/milestone.cjs` | 477 | Milestone operations |
| `get-shit-done/bin/lib/roadmap.cjs` | 350 | Roadmap reads and updates |
| `get-shit-done/bin/lib/config.cjs` | 307 | Config ensure/set/get |
| `get-shit-done/bin/lib/frontmatter.cjs` | 299 | YAML frontmatter parsing |
| `get-shit-done/bin/lib/template.cjs` | 222 | Template scaffolding |
| `get-shit-done/bin/lib/debt.cjs` | 169 | Tech debt logging |
| **Total** | **7,601** | |

### Legacy Layout Footprint (Measured)

The "legacy layout" means the original flat `.planning/phases/` directory structure without milestone workspaces. The dual-layout code supports both the old flat layout and the new milestone-scoped layout simultaneously.

| Pattern | Occurrences in Source |
|---------|----------------------|
| `detectLayoutStyle` function calls | 27 |
| `planningRoot` calls (all, includes milestone-scoped) | 31 |
| `concurrent` flag checks | 20 |
| `'legacy'` or `"legacy"` string literals | 2 |
| `layout_style` / `layoutStyle` conditionals | 11 |

### Legacy Footprint Per File

| File | Legacy-Related Occurrences | Primary Legacy Code |
|------|--------------------------|---------------------|
| `gsd-tools.cjs` | 13 | `migrate` command dispatch block (~25 lines), `detectLayoutStyle` auto-scope call |
| `migrate.cjs` | 11 | Entire file is the migration tool (694 lines) |
| `init.cjs` | 10 | 8× `layout_style: detectLayoutStyle(cwd)` in init command outputs, 1 import |
| `config.cjs` | 8 | Config migration logic (migrating old config schemas — unrelated to layout, keep) |
| `core.cjs` | 7 | `detectLayoutStyle()` function (29 lines), legacy branch in `findPhaseInternal` (32 lines), `getArchivedPhaseDirs()` (34 lines) |
| `commands.cjs` | 4 | `layoutStyle` gate in `cmdProgressRenderMulti`, `getArchivedPhaseDirs` call in `cmdHistoryDigest` |
| `roadmap.cjs` | 3 | 2× `detectLayoutStyle` conditional guards in `cmdRoadmapGetPhase` |
| `phase.cjs` | 2 | 1× `detectLayoutStyle` conditional in cross-milestone fallback |
| `verify.cjs` | 0 | Clean |
| `state.cjs` | 0 | Clean |
| `milestone.cjs` | 0 | Clean |
| `frontmatter.cjs` | 0 | Clean |
| `template.cjs` | 0 | Clean |
| `debt.cjs` | 0 | Clean |

### Workflow Files with Legacy References

7 of the 12+ workflow `.md` files contain `layout_style` checks:

| File | Legacy Lines |
|------|-------------|
| `execute-phase.md` (509 lines) | 7 — `layout_style // "legacy"` var + 6 conditional blocks |
| `plan-phase.md` (602 lines) | 3 — `layout_style // "legacy"` var + 2 conditional blocks |
| `new-milestone.md` (407 lines) | 2 — `layout_style === 'milestone-scoped'` guard + `legacy` fallback |
| `progress.md` (402 lines) | 1 — `layout_style // "legacy"` var |
| `resume-project.md` (324 lines) | 1 — `layout_style // "legacy"` var |
| `transition.md` (556 lines) | 1 — `layout_style // "legacy"` var |
| `verify-work.md` (586 lines) | 1 — `layout_style // "legacy"` var |
| **Total workflow legacy lines** | **~15 conditional blocks across 7 files** |

### Templates

23 template files scanned. **Zero** contain legacy-layout-specific content. Templates are clean.

### Test Files

| File | Lines | Legacy Coverage |
|------|-------|-----------------|
| `compat.test.cjs` | 246 | Entirely legacy — `detectLayoutStyle` three-state, layout_style in CLI output |
| `migrate.test.cjs` | 304 | Entirely legacy — migrate dry-run, apply, idempotency |
| `core.test.cjs` | 209 | 26 legacy lines — `detectLayoutStyle` test cases, planningRoot "legacy" path tests |
| `init.test.cjs` | 823 | 9 legacy lines — layout_style in init output assertions |
| Other test files | — | Zero legacy references |
| **Total deletable test lines** | **~585** | compat + migrate + partial core + partial init |

**Current test health:** 349 passing, 0 failing.

---

## Section 2: Three Paths Analysis

### Path A — Surgical Strip (Remove Legacy from Current Codebase)

**What it is:** Delete `migrate.cjs` entirely, delete `detectLayoutStyle()` and its call sites, simplify `findPhaseInternal` to only search milestone workspaces, remove workflow `if layout_style !== 'milestone-scoped'` guards.

| Scope | Files Touched | Lines Deleted/Simplified |
|-------|---------------|--------------------------|
| Delete `migrate.cjs` | 1 file | 694 lines deleted |
| Delete `compat.test.cjs` | 1 file | 246 lines deleted |
| Delete `migrate.test.cjs` | 1 file | 304 lines deleted |
| Simplify `core.cjs` | 1 file | ~95 lines deleted (`detectLayoutStyle` 29 + legacy `findPhaseInternal` branch 32 + `getArchivedPhaseDirs` 34) |
| Simplify `init.cjs` | 1 file | ~10 lines (remove 8 `layout_style:` fields, 1 import update) |
| Simplify `roadmap.cjs` | 1 file | ~5 lines (remove 2 conditional guards, 1 import update) |
| Simplify `phase.cjs` | 1 file | ~3 lines (remove 1 conditional guard, 1 import update) |
| Simplify `commands.cjs` | 1 file | ~5 lines (remove `layoutStyle` gate, `getArchivedPhaseDirs` call, import update) |
| Simplify `gsd-tools.cjs` | 1 file | ~25 lines (migrate command block + import) |
| Remove workflow conditionals | 7 files | ~15 conditional blocks, ~20 lines |
| Simplify test files (partial) | 2 files | ~35 lines (`core.test.cjs` + `init.test.cjs`) |
| **Total** | **17 files** | **~1,437 lines removed** |

**Net result after Path A:** ~6,164 lines of source (down from 7,601), ~6,435 lines of tests (down from 7,370).

**Effort estimate:** 3-5 Claude sessions (approximately 4-6 hours of execution time). Each session targets one layer: (1) `migrate.cjs` + test files, (2) `core.cjs` + dependents, (3) `init.cjs` cleanup, (4) workflow simplification, (5) test cleanup and regression pass.

**Risk:** Medium-Low.
- 349 existing tests provide regression coverage
- Changes are mostly deletions, not rewrites
- The `planningRoot()` function already accepts `milestoneScope` — no logic change needed
- `findPhaseInternal` already has the milestone-scoped path as its primary branch (lines 251-256 run first); the legacy branch (lines 283-314) is just never reached in milestone-scoped projects

**Update path:** See Section 6.

---

### Path B — Ground-Up Rebuild (New Codebase, Milestone-Only from Start)

**What it is:** Abandon the current codebase. Write a new GSD from scratch, assuming every project is milestone-scoped. No backward compatibility.

**Effort estimate:**

| Component | Estimated Lines |
|-----------|-----------------|
| Core primitives (new, clean) | ~400 lines |
| Phase operations | ~600 lines |
| Init commands | ~500 lines |
| Roadmap operations | ~250 lines |
| State management | ~400 lines |
| Milestone management | ~350 lines |
| Config management | ~200 lines |
| CLI router | ~500 lines |
| Remaining utilities | ~500 lines |
| **Source subtotal** | **~3,700 lines** |
| Full test suite (new) | ~5,000 lines |
| **Grand total** | **~8,700 lines** |

**Risk:** High.
- Must reimplement 7,601 lines of battle-tested code that handles many edge cases
- All 349 test cases must be re-created; coverage gaps are inevitable
- Unknown regressions in edge cases (normalizePhaseName decimals, cross-milestone fallbacks, STATE.md parsing)
- No interim "run old tests to verify" — tests and code are both new
- Minimum 3-4 months of work at current pace

**Update path:** See Section 6.

---

### Path C — Thorough Rewrite as Upstream Contribution

**What it is:** Rewrite GSD upstream to be milestone-only, then submit as a PR to the original repository. If accepted, this fork converges back with upstream.

**Effort:** Highest — must (1) implement the changes, (2) document rationale for upstream maintainers, (3) handle upstream users who are still on legacy layout, (4) provide migration tooling that upstream users need.

**Feasibility:** Very Low.
- Upstream likely serves a mix of legacy and milestone-scoped users
- Removing legacy support in upstream is a breaking change they would need to version carefully
- Acceptance timeline is unknown — could be months or never
- Upstream maintainers may have different architectural priorities

**Update path:** Best-case (PR accepted) — this fork becomes irrelevant, upstream is the canonical source. Worst-case (PR rejected) — you've done the work of a rebuild with none of the simplification benefits.

---

## Section 3: What Lives at `.planning/` Root After Simplification

Under milestone-only layout, the root `.planning/` directory becomes a coordinator-only layer:

### Stays at Root

| File/Dir | Purpose |
|----------|---------|
| `config.json` | Project-level settings (quality, model, etc.) — still needed |
| `STATE.md` | Coordinator — milestone index, quick task log, session continuity |
| `MILESTONES.md` | Milestone registry (version list, status) |
| `PROJECT.md` | Project description and goals |
| `DEBT.md` | Project-level tech debt (cross-milestone) |
| `quick/` | Quick tasks — intentionally not milestone-scoped |
| `milestones/` | All milestone workspaces (`v1.0/`, `v2.0/`, `v3.1/`, etc.) |
| `codebase/` | Codebase analysis docs |

### What Disappears

| Item | Why |
|------|-----|
| Root `ROADMAP.md` | Each milestone has its own; root version becomes a stub or is removed |
| Root `REQUIREMENTS.md` | Each milestone has its own |
| Root `phases/` directory | No phases at root level — everything under `milestones/<version>/phases/` |
| `migrate` CLI command | No projects to migrate; tool becomes obsolete |

This is already the current structure of this project. The code doesn't reflect it yet — it still checks whether the layout is milestone-scoped before using milestone paths.

---

## Section 4: Code That Gets Deleted/Simplified (Path A Detail)

### `migrate.cjs` — Delete Entirely (694 lines)

This file implements the migration tool that converts legacy flat-layout projects to milestone-scoped layout. Once all projects are milestone-scoped, this tool serves no purpose.

Functions deleted:
- `cmdMigrateDryRun()` — analyzes legacy project for conversion
- `cmdMigrateApply()` — performs the conversion
- `cmdMigrateCleanup()` — removes old flat directories after migration

### `core.cjs` — Delete ~95 Lines

```
BEFORE: 595 lines
AFTER:  ~500 lines
```

**`detectLayoutStyle()` (lines 497-525 — 29 lines) — DELETE entirely:**
```javascript
// DELETE THIS ENTIRE FUNCTION
function detectLayoutStyle(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  let hasValidConfig = false;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    hasValidConfig = true;
    if (parsed.concurrent === true) return 'milestone-scoped';
  } catch { /* fall through */ }
  // Directory-based fallback...
  return hasValidConfig ? 'legacy' : 'uninitialized';
}
```

**`findPhaseInternal()` legacy branch (lines 283-314 — 32 lines) — DELETE:**
```javascript
// DELETE: lines after the milestone-scoped auto-detect block
// Legacy layout: search current phases first
const phasesDir = path.join(cwd, '.planning', 'phases');
const current = searchPhaseInDir(phasesDir, ...);
if (current) return current;
// Search archived milestone phases (flat pattern: v*-phases/)
...
return null;
```

**`getArchivedPhaseDirs()` (lines 316-349 — 34 lines) — DELETE entirely:**
This function searches for legacy `v*-phases/` archive directories inside `.planning/milestones/`. Under milestone-only layout, milestones are structured as `v*/phases/` not `v*-phases/` — this function has no callers.

**Export list (line 585) — remove `detectLayoutStyle`, `getArchivedPhaseDirs`**

### `init.cjs` — Simplify ~10 Lines

**Before** (8 occurrences):
```javascript
layout_style: detectLayoutStyle(cwd),
```

**After** — remove the field entirely. Callers that parse `layout_style` from init JSON also get simplified (they drop the conditional).

**Import line** — remove `detectLayoutStyle` from destructure.

### `roadmap.cjs` — Simplify ~5 Lines

Two conditional guards in `cmdRoadmapGetPhase`:
```javascript
// BEFORE:
if (milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {
  const fallback = _roadmapGetPhaseCrossMilestone(...);
  ...
}

// AFTER (always use cross-milestone fallback when milestoneScope is set):
if (milestoneScope) {
  const fallback = _roadmapGetPhaseCrossMilestone(...);
  ...
}
```

Remove `detectLayoutStyle` from import.

### `phase.cjs` — Simplify ~3 Lines

One conditional guard:
```javascript
// BEFORE:
if (!foundInScope && milestoneScope && detectLayoutStyle(cwd) === 'milestone-scoped') {

// AFTER:
if (!foundInScope && milestoneScope) {
```

Remove `detectLayoutStyle`, `getArchivedPhaseDirs` from import.

### `commands.cjs` — Simplify ~5 Lines

`cmdProgressRenderMulti` — remove the layout gate (always use multi-milestone render):
```javascript
// BEFORE:
const layoutStyle = detectLayoutStyle(cwd);
if (layoutStyle !== 'milestone-scoped') {
  return cmdProgressRender(cwd, format, raw);
}

// AFTER: remove the gate; always execute the milestone path
```

`cmdHistoryDigest` — remove `getArchivedPhaseDirs` call (legacy-format archives no longer exist).

### `gsd-tools.cjs` — Simplify ~25 Lines

Remove the entire `migrate` case block from the command router (~25 lines) and the `require('./lib/migrate.cjs')` import.

### Workflow Files — Remove ~20 Conditional Lines

Pattern to eliminate across 7 files:
```bash
# BEFORE:
LAYOUT=$(echo "$INIT" | jq -r '.layout_style // "legacy"')

# AFTER: remove this line; LAYOUT variable is no longer referenced
```

Also remove `if layout_style !== 'milestone-scoped', skip this step` guard blocks (they are always false).

### Test Files

| File | Action |
|------|--------|
| `compat.test.cjs` (246 lines) | Delete entire file |
| `migrate.test.cjs` (304 lines) | Delete entire file |
| `core.test.cjs` | Remove `detectLayoutStyle` describe block (~26 lines), update `planningRoot` tests to drop "legacy path" framing |
| `init.test.cjs` | Remove `layout_style` assertions from init output tests (~9 lines) |

---

## Section 5: Recommendation

**Recommend Path A — Surgical Strip.**

### Why Not Path B (Rebuild)

The existing codebase is not the problem. The logic inside `phase.cjs`, `state.cjs`, `milestone.cjs`, `roadmap.cjs` is milestone-scoped aware and correct. The legacy code is surface area, not architectural cancer. Rebuilding throws away:

- 349 passing tests
- Edge case handling accumulated over v1.0 through v3.0
- Known-good implementations of subtle things (normalizePhaseName decimal handling, cross-milestone fallback, frontmatter parsing, concurrent milestone conflict detection)

The rebuild would cost 3-4 months to return to feature parity. The strip costs 3-5 sessions.

### Why Not Path C (Upstream PR)

The upstream maintainers may not accept a breaking change that removes legacy support. The effort of writing the PR and maintaining it through review is greater than the effort of Path A. If the PR is rejected, the work is wasted.

### Path A Execution Order

| Step | Scope | Why First |
|------|-------|-----------|
| 1 | Delete `migrate.cjs` + `migrate.test.cjs` + `compat.test.cjs` | Pure deletions, no code changes required elsewhere; zero risk |
| 2 | Simplify `core.cjs` (delete `detectLayoutStyle`, legacy `findPhaseInternal` branch, `getArchivedPhaseDirs`) | All dependents break after this — do it first so dependents are fixed in same session |
| 3 | Update imports in `init.cjs`, `roadmap.cjs`, `phase.cjs`, `commands.cjs` (remove deleted exports) | Required immediately after Step 2 |
| 4 | Remove `layout_style` fields from `init.cjs` command outputs | Low risk; callers that check this field also get simplified |
| 5 | Remove `migrate` block from `gsd-tools.cjs` | Isolated change, no external dependencies |
| 6 | Simplify workflow files (remove LAYOUT var and conditionals) | Documentation-only; no test impact |
| 7 | Clean up `core.test.cjs` and `init.test.cjs` legacy test cases | After source is clean, remove tests that test deleted behavior |

**Run `node --test tests/*.test.cjs` after each step.** Starting from 349 passing, expect to maintain 349 (minus compat/migrate tests deleted in Step 1 = ~316 remaining after Step 1) through the full strip.

### Effort Estimate

| Step | Estimated Duration |
|------|-------------------|
| Steps 1-3 (deletions + import cleanup) | 1-2 Claude sessions (~1-2 hours) |
| Steps 4-5 (output field cleanup + CLI router) | 0.5 session (~30 min) |
| Steps 6-7 (workflow docs + test cleanup) | 1 session (~1 hour) |
| **Total** | **2.5-3.5 sessions / 3-5 hours** |

### Risk Mitigation

- 349 tests provide full regression coverage before starting
- Changes are additive deletions — no new logic introduced
- Test suite is run after each step; red = stop and investigate
- `planningRoot()` already works correctly for milestone-scoped layout (no change needed)
- `findPhaseInternal()` already prioritizes milestone paths (lines 251-256) before the legacy branch (lines 283-314); deleting the legacy branch doesn't change behavior for any milestone-scoped project

---

## Section 6: Update Path Deep Dive

### Current Git Setup

```
origin  https://github.com/gsd-build/get-shit-done.git  (upstream GSD)
fork    https://github.com/gkd67pjznr-ctrl/get-shit-done.git  (this fork)
```

The `fork` remote is this fork's push target. The `origin` remote is the upstream GSD repository from which updates can be pulled.

### Path A: Can You Still Pull Upstream Updates?

**Yes, with manageable merge conflicts.**

Under Path A, changes to the source files are **deletions**. When you `git pull origin main` to get an upstream update:

- Files like `init.cjs`, `roadmap.cjs`, `phase.cjs`, `commands.cjs` will have conflicts where upstream has `layout_style: detectLayoutStyle(cwd)` and this fork has removed those lines.
- Resolution strategy is always the same: **keep the fork's version** (the simpler version without the legacy field).
- Files that are entirely deleted here (`migrate.cjs`, `compat.test.cjs`, `migrate.test.cjs`) will appear as "deleted by us" in merge conflicts — mark them as resolved-as-deleted.
- The ~7 workflow files will have conflicts on the LAYOUT variable lines — resolution is always to remove them.

**Practical workflow after Path A:**

```bash
git fetch origin
git merge origin/main

# For each conflicted file:
# - Keep our (simplified) version for detectLayoutStyle call sites
# - Accept upstream additions (new features, bug fixes in milestone paths)
# - Cherry-pick upstream improvements that don't re-add legacy branching
```

The conflict surface is well-defined: every conflict will be in one of the known legacy touch points. Resolution is mechanical, not analytical.

**What upstream improvements can still be pulled:**

- New CLI commands (they land in `gsd-tools.cjs` case blocks — no conflicts expected)
- Bug fixes in `state.cjs`, `milestone.cjs`, `debt.cjs`, `verify.cjs` — these files are unmodified by Path A
- Improvements to `frontmatter.cjs`, `template.cjs`, `config.cjs` — no conflicts expected
- New workflow files — no conflicts
- Improvements to existing workflow logic (non-LAYOUT sections) — no conflicts

**Upstream pull frequency recommendation:** Pull after completing Path A strip. After that, pull when upstream ships a notable feature. The simpler the fork's diff from upstream, the easier each pull becomes.

### Path B: Can You Still Pull Upstream Updates?

**No. Hard fork.**

A ground-up rebuild produces a codebase with completely different file structure and function signatures from upstream. `git merge origin/main` would produce conflicts in every single file. There is no practical way to pull upstream changes — you would need to read each upstream commit and manually port the relevant changes.

**What this means in practice:**
- Security fixes in upstream: must manually port
- New features in upstream: must decide whether to port each one
- Bug fixes in upstream: must read commit, understand the fix, re-implement in the new codebase

This is the standard cost of a hard fork. It's manageable if the fork has a clear direction divergent from upstream, but it eliminates the "pull upstream bugfixes" workflow entirely.

### Path C: Update Path

**Best-case (PR accepted):** Fork re-converges with upstream. Pull updates trivially.
**Worst-case (PR rejected):** You have a rebuild-equivalent fork with the hard-fork update problem, having spent the PR negotiation time on top.

### Summary Table

| | Path A (Strip) | Path B (Rebuild) | Path C (Upstream PR) |
|-|----------------|------------------|----------------------|
| Can pull upstream updates? | Yes — manageable conflicts | No — hard fork | Yes if accepted; No if rejected |
| Effort | 3-5 hours | 3-4 months | Unknown + high |
| Risk | Medium-Low | High | Very Low to Very High |
| Tests preserved? | Yes (349 → ~316 after cleanup) | No — rewrite required | Yes if accepted |
| Recommendation | **DO THIS** | Avoid | Not recommended |

---

## Conclusion

The data shows Path A is the clearly correct choice. The legacy layout surface area is real but bounded:

- **1 file to delete entirely** (`migrate.cjs` — 694 lines, standalone)
- **4 functions to delete** (`detectLayoutStyle`, legacy `findPhaseInternal` branch, `getArchivedPhaseDirs` — ~95 lines in `core.cjs`)
- **~91 lines to simplify** across 5 source files (import cleanup + call site removal)
- **~20 lines to remove** from 7 workflow files
- **~585 test lines to delete** (2 full files + partial cleanup in 2 others)

Total investment: approximately 3-5 Claude execution sessions.
Total reduction: ~1,437 lines (~19% smaller codebase).
Ongoing benefit: every future change touches a simpler mental model with no branching on layout style.

The upstream pull path remains open. The test suite provides regression coverage throughout. The execution order is clear and safe.
