---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - ~/Projects/gymrats2/.planning/config.json
  - ~/Projects/gymrats2/.planning/milestones/
  - ~/Projects/gymrats2/.planning/phases/
  - ~/Projects/gymrats2/.planning/ROADMAP.md
  - ~/Projects/gymrats2/.planning/STATE.md
autonomous: true
requirements: [QUICK-4]
must_haves:
  truths:
    - "gymrats2 config.json has concurrent: true"
    - "Flat archive files (v3.0-ROADMAP.md etc.) are restructured into nested dirs (v3.0/ROADMAP.md)"
    - "Shipped phases 01-53 live in their correct milestone directories (v3.0-v10.0)"
    - "Active v11.0 phases 54-71 + 62.1 live in milestones/v11.0/phases/"
    - "v12.0 milestone workspace exists with research docs"
    - "Root ROADMAP.md and STATE.md are coordinator stubs"
    - "No stale flat archive files remain in milestones/"
  artifacts:
    - path: "~/Projects/gymrats2/.planning/config.json"
      provides: "concurrent: true flag"
      contains: "concurrent"
    - path: "~/Projects/gymrats2/.planning/milestones/v11.0/phases/"
      provides: "Active v11.0 phases"
    - path: "~/Projects/gymrats2/.planning/milestones/v3.0/ROADMAP.md"
      provides: "Nested v3.0 archive"
    - path: "~/Projects/gymrats2/.planning/milestones/v12.0/"
      provides: "Pre-planned v12.0 workspace"
  key_links:
    - from: "config.json"
      to: "milestones/"
      via: "concurrent: true enables milestone-scoped layout detection"
      pattern: "concurrent.*true"
---

<objective>
Migrate ~/Projects/gymrats2 from legacy flat .planning/ layout to milestone-scoped layout.

Purpose: The gymrats2 project has 71 phase directories in a single flat phases/ folder spanning milestones v3.0 through v11.0 (in-progress). This migration restructures it into the milestone-scoped layout where each milestone has its own workspace with phases, roadmap, requirements, and state files. This enables concurrent milestone operation and clean separation of shipped vs active work.

Output: A fully migrated gymrats2/.planning/ with milestone-scoped layout, shipped phases sorted into their correct milestones, v12.0 workspace created, and all stale flat archives cleaned up.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Target project: ~/Projects/gymrats2 (NOT the current gsdup project)
Migration tool: node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate

Phase-to-milestone mapping (from MILESTONES.md and ROADMAP.md):
- v3.0: phases 01-08 (01-foundation through 08-polish)
- v4.0: phases 09-13 (09-reactions-comments-foundation through 13-in-app-notifications)
- v5.0: phases 14-20 (14-exercise-data-foundation through 20-social-integration)
- v6.0: phases 21-26 (21-foundation-header-bar through 26-art-asset-creation-workflow)
- v7.0: phases 27-30 (27-achievement-system-core through 30-push-notifications)
- v8.0: phases 31-38 (31-economy-foundation through 38-body-composition)
- v9.0: phases 39-46 (39-foundation-database-timer through 46-onboarding-beta-art-checkpoint)
- v10.0: phases 47-53 (47-friendship-database-foundation through 53-room-capacity-upgrades)
- v11.0: phases 54-71 + 62.1 (54-pre-workout-check-in through 71-screen-ui-ux-pass)

Note: v1.1 and v2.0 are listed as milestones in ROADMAP.md but have no phase directories or archive files. They predate GSD planning and should be ignored during phase sorting.

Important: The migrate tool with --version v11.0 will move ALL phases (01-71) into v11.0. After running it, shipped phases must be moved to their correct milestone directories.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run migrate tool and sort shipped phases into correct milestones</name>
  <files>
    ~/Projects/gymrats2/.planning/config.json
    ~/Projects/gymrats2/.planning/milestones/ (all nested dirs)
    ~/Projects/gymrats2/.planning/phases/ (emptied)
    ~/Projects/gymrats2/.planning/ROADMAP.md
    ~/Projects/gymrats2/.planning/STATE.md
  </files>
  <action>
    **Step 1: Git commit current state as safety backup.**
    In the gymrats2 project directory, create a commit of the current .planning/ state so we can revert if needed:
    ```
    cd ~/Projects/gymrats2
    git add .planning/
    git commit -m "chore: snapshot pre-migration state"
    ```
    If nothing to commit (clean tree), that's fine — skip.

    **Step 2: Run the migrate tool.**
    Execute from gymrats2 directory (the tool uses cwd for the target project):
    ```
    cd /Users/tmac/Projects/gymrats2 && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --apply --version v11.0
    ```
    This will:
    - Set `concurrent: true` in config.json
    - Restructure flat archives (v3.0-ROADMAP.md -> v3.0/ROADMAP.md) for v3.0-v10.0
    - Create v11.0 workspace at milestones/v11.0/
    - Move ALL phases (01-71 + 62.1) into milestones/v11.0/phases/
    - Move root ROADMAP.md and STATE.md into v11.0 workspace
    - Create coordinator stubs at root ROADMAP.md and STATE.md

    Verify the output JSON shows the expected number of actions (~80+ moves/creates).

    **Step 3: Sort shipped phases from v11.0 into their correct milestone directories.**
    After migrate puts everything in v11.0/phases/, move shipped phases to the correct milestones. Each milestone dir was already created by the migrate tool (from flat archive restructuring).

    Create phases/ subdirectories in each milestone that doesn't have one yet, then move:

    ```bash
    GYMRATS="/Users/tmac/Projects/gymrats2/.planning/milestones"

    # Ensure phases/ dirs exist in each shipped milestone
    for v in v3.0 v4.0 v5.0 v6.0 v7.0 v8.0 v9.0 v10.0; do
      mkdir -p "$GYMRATS/$v/phases"
    done

    # v3.0: phases 01-08
    for dir in 01-* 02-* 03-* 04-* 05-* 06-* 07-* 08-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v3.0/phases/"
    done

    # v4.0: phases 09-13
    for dir in 09-* 10-* 11-* 12-* 13-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v4.0/phases/"
    done

    # v5.0: phases 14-20
    for dir in 14-* 15-* 16-* 17-* 18-* 19-* 20-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v5.0/phases/"
    done

    # v6.0: phases 21-26
    for dir in 21-* 22-* 23-* 24-* 25-* 26-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v6.0/phases/"
    done

    # v7.0: phases 27-30
    for dir in 27-* 28-* 29-* 30-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v7.0/phases/"
    done

    # v8.0: phases 31-38
    for dir in 31-* 32-* 33-* 34-* 35-* 36-* 37-* 38-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v8.0/phases/"
    done

    # v9.0: phases 39-46
    for dir in 39-* 40-* 41-* 42-* 43-* 44-* 45-* 46-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v9.0/phases/"
    done

    # v10.0: phases 47-53
    for dir in 47-* 48-* 49-* 50-* 51-* 52-* 53-*; do
      [ -d "$GYMRATS/v11.0/phases/$dir" ] && mv "$GYMRATS/v11.0/phases/$dir" "$GYMRATS/v10.0/phases/"
    done
    ```

    After sorting, v11.0/phases/ should contain ONLY: 54-* through 71-* plus 62.1-*.
    Verify with `ls` that v11.0/phases/ has ~18 directories (phases 54-71 + 62.1, minus absorbed 65).

    **Step 4: Run cleanup to remove stale flat archive duplicates.**
    ```
    cd /Users/tmac/Projects/gymrats2 && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --cleanup
    ```
    This removes any remaining flat-pattern files (e.g., v3.0-ROADMAP.md) where the nested equivalent (v3.0/ROADMAP.md) now exists.

    **Step 5: Verify the phase counts per milestone.**
    Run `ls` on each milestone's phases/ directory and confirm:
    - v3.0/phases/: 8 dirs (01-08)
    - v4.0/phases/: 5 dirs (09-13)
    - v5.0/phases/: 7 dirs (14-20)
    - v6.0/phases/: 6 dirs (21-26)
    - v7.0/phases/: 4 dirs (27-30)
    - v8.0/phases/: 8 dirs (31-38)
    - v9.0/phases/: 8 dirs (39-46)
    - v10.0/phases/: 7 dirs (47-53)
    - v11.0/phases/: ~17 dirs (54-64, 62.1, 66-71; no 65 — absorbed into 64)

    <quality_scan>
      <code_to_reuse>
        - Known: `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/migrate.cjs` — `cmdMigrateApply()` handles full conversion; `cmdMigrateCleanup()` handles stale file removal
        - Grep pattern: `grep -rn "move_dir\|move_file" /Users/tmac/Projects/gsdup/get-shit-done/bin/lib/migrate.cjs | head -10`
      </code_to_reuse>
      <docs_to_consult>
        N/A — using GSD's own migrate tool, fully understood from source code read above.
      </docs_to_consult>
      <tests_to_write>
        N/A — no new exported logic. Verification is via directory listing and file existence checks.
      </tests_to_write>
    </quality_scan>
  </action>
  <verify>
    <automated>
      cd /Users/tmac/Projects/gymrats2 && cat .planning/config.json | grep concurrent && ls .planning/milestones/v3.0/phases/ | wc -l && ls .planning/milestones/v11.0/phases/ | wc -l && ls .planning/milestones/ | grep -c "^v[0-9]" && echo "PASS: milestone dirs exist"
    </automated>
  </verify>
  <done>
    - config.json has concurrent: true
    - Flat archives restructured into nested milestone directories (v3.0/ through v10.0/)
    - Shipped phases sorted: v3.0 has 8, v4.0 has 5, v5.0 has 7, v6.0 has 6, v7.0 has 4, v8.0 has 8, v9.0 has 8, v10.0 has 7
    - v11.0/phases/ has only active phases (54-71 + 62.1, ~17 dirs)
    - Root ROADMAP.md and STATE.md are coordinator stubs
    - No stale flat archive files remain
  </done>
</task>

<task type="auto">
  <name>Task 2: Create v12.0 workspace and finalize coordinator docs</name>
  <files>
    ~/Projects/gymrats2/.planning/milestones/v12.0/
    ~/Projects/gymrats2/.planning/milestones/v12.0/research/
    ~/Projects/gymrats2/.planning/milestones/v12.0/ROADMAP.md
    ~/Projects/gymrats2/.planning/milestones/v12.0/REQUIREMENTS.md
    ~/Projects/gymrats2/.planning/milestones/v12.0/STATE.md
    ~/Projects/gymrats2/.planning/ROADMAP.md
    ~/Projects/gymrats2/.planning/STATE.md
    ~/Projects/gymrats2/.planning/MILESTONES.md
  </files>
  <action>
    **Step 1: Create v12.0 milestone workspace.**
    ```
    mkdir -p /Users/tmac/Projects/gymrats2/.planning/milestones/v12.0/phases
    mkdir -p /Users/tmac/Projects/gymrats2/.planning/milestones/v12.0/research
    ```

    **Step 2: Copy v12.0 research docs into the milestone workspace.**
    The research directory at `.planning/research/v12.0-history-and-calendar/` contains pre-planning research for v12.0. Copy these files into the v12.0 workspace:
    ```
    cp -r /Users/tmac/Projects/gymrats2/.planning/research/v12.0-history-and-calendar/* \
      /Users/tmac/Projects/gymrats2/.planning/milestones/v12.0/research/
    ```

    **Step 3: Create v12.0 scaffold files.**
    Create a minimal ROADMAP.md for v12.0:
    ```markdown
    # Roadmap: v12.0 History & Calendar

    ## Goal
    [To be planned — see research/ for pre-planning research]

    ## Phases
    (No phases planned yet)
    ```

    Create a minimal STATE.md for v12.0:
    ```markdown
    # State: v12.0 History & Calendar

    ## Status
    Pre-planned — research complete, awaiting phase planning.

    ## Research
    See `research/` directory for pre-planning research docs.
    ```

    Create a minimal REQUIREMENTS.md from the research if one exists, otherwise:
    ```markdown
    # Requirements: v12.0 History & Calendar

    (To be defined during planning phase)
    ```
    Check if `~/Projects/gymrats2/.planning/research/v12.0-history-and-calendar/REQUIREMENTS.md` exists — if so, copy it as the v12.0 REQUIREMENTS.md instead.

    **Step 4: Update the root coordinator ROADMAP.md.**
    The coordinator stub generated by the migrate tool only knows about milestones detected from the original ROADMAP.md. It will NOT include v11.0 (which was the active milestone, so it shows differently) or v12.0 (which was never a top-level milestone entry).

    Read the generated root ROADMAP.md and update it to include:
    - v11.0 Mind, Body & Pixels as an active milestone (with link to milestones/v11.0/ROADMAP.md)
    - v12.0 History & Calendar as a planned milestone (with link to milestones/v12.0/)

    The coordinator ROADMAP should list ALL milestones (v1.1, v2.0 as historical notes, v3.0-v10.0 as completed with archive links, v11.0 as active, v12.0 as planned).

    **Step 5: Update the root coordinator STATE.md.**
    Read the generated root STATE.md and update it to include:
    - v11.0 as the active milestone with workspace path
    - v12.0 as a planned milestone

    **Step 6: Update MILESTONES.md.**
    Read the existing MILESTONES.md and add a note at the bottom about the layout migration:
    ```markdown
    ---

    ## Layout Migration (2026-02-26)

    Migrated from flat layout to milestone-scoped layout. Each milestone now has its own workspace under `.planning/milestones/<version>/` with phases, roadmap, requirements, and state files. Active milestone: v11.0. Pre-planned: v12.0.
    ```

    **Step 7: Git commit the migrated state.**
    ```
    cd ~/Projects/gymrats2
    git add .planning/
    git commit -m "chore: migrate to milestone-scoped layout

    - Converted flat .planning/ to milestone-scoped layout
    - Sorted 53 shipped phases into milestones v3.0-v10.0
    - Active v11.0 phases (54-71 + 62.1) in milestones/v11.0/
    - Created v12.0 workspace with research docs
    - Root ROADMAP.md and STATE.md are now coordinator stubs
    - Cleaned up stale flat archive duplicates"
    ```

    <quality_scan>
      <code_to_reuse>
        - Known: existing research at `/Users/tmac/Projects/gymrats2/.planning/research/v12.0-history-and-calendar/` — copy contents to v12.0 workspace
        - Grep pattern: `grep -rn "v12.0\|History.*Calendar" /Users/tmac/Projects/gymrats2/.planning/ROADMAP.md | head -5`
      </code_to_reuse>
      <docs_to_consult>
        N/A — no external library dependencies. Following GSD milestone-scoped layout conventions from gsdup project.
      </docs_to_consult>
      <tests_to_write>
        N/A — no new exported logic. Verification is via directory listing and file content checks.
      </tests_to_write>
    </quality_scan>
  </action>
  <verify>
    <automated>
      ls /Users/tmac/Projects/gymrats2/.planning/milestones/v12.0/research/ | wc -l && cat /Users/tmac/Projects/gymrats2/.planning/milestones/v12.0/STATE.md | head -3 && grep "v11.0" /Users/tmac/Projects/gymrats2/.planning/ROADMAP.md && grep "v12.0" /Users/tmac/Projects/gymrats2/.planning/ROADMAP.md && echo "PASS: v12.0 workspace and coordinator docs complete"
    </automated>
  </verify>
  <done>
    - v12.0 milestone workspace exists with phases/, research/, ROADMAP.md, REQUIREMENTS.md, STATE.md
    - v12.0 research docs copied from .planning/research/v12.0-history-and-calendar/
    - Root coordinator ROADMAP.md lists all milestones including v11.0 (active) and v12.0 (planned)
    - Root coordinator STATE.md shows v11.0 as active milestone
    - MILESTONES.md has layout migration note
    - All changes committed to git in gymrats2 repo
  </done>
</task>

</tasks>

<verification>
Run these checks to verify the full migration:

1. Layout detection: `cd /Users/tmac/Projects/gymrats2 && node /Users/tmac/Projects/gsdup/get-shit-done/bin/gsd-tools.cjs migrate --dry-run --version v11.0` should report `already-milestone-scoped`
2. Phase count audit:
   - `ls .planning/milestones/v3.0/phases/ | wc -l` = 8
   - `ls .planning/milestones/v4.0/phases/ | wc -l` = 5
   - `ls .planning/milestones/v5.0/phases/ | wc -l` = 7
   - `ls .planning/milestones/v6.0/phases/ | wc -l` = 6
   - `ls .planning/milestones/v7.0/phases/ | wc -l` = 4
   - `ls .planning/milestones/v8.0/phases/ | wc -l` = 8
   - `ls .planning/milestones/v9.0/phases/ | wc -l` = 8
   - `ls .planning/milestones/v10.0/phases/ | wc -l` = 7
   - `ls .planning/milestones/v11.0/phases/ | wc -l` = ~17
3. No flat archives: `ls .planning/milestones/ | grep -c "^v.*-"` = 0
4. Config: `cat .planning/config.json | python3 -c "import sys,json; c=json.load(sys.stdin); assert c['concurrent']==True; print('OK')"` = OK
5. Coordinator stubs: `grep "milestone-scoped" .planning/ROADMAP.md` and `grep "milestone-scoped" .planning/STATE.md` both match
6. v12.0 workspace: `ls .planning/milestones/v12.0/` shows phases/, research/, ROADMAP.md, STATE.md, REQUIREMENTS.md
</verification>

<success_criteria>
- gymrats2/.planning/config.json has `concurrent: true`
- 8 shipped milestone workspaces (v3.0-v10.0) each contain their phases sorted correctly
- v11.0 workspace contains only active phases (54-71 + 62.1)
- v12.0 workspace exists with research docs and scaffold files
- Root ROADMAP.md and STATE.md are coordinator stubs referencing all milestones
- No stale flat archive files remain in milestones/
- Root .planning/phases/ is empty (all phases moved to milestones)
- All changes committed in gymrats2 git repo
</success_criteria>

<output>
After completion, create `.planning/quick/4-migrate-gymrats2-to-milestone-scoped-lay/4-SUMMARY.md`
</output>
