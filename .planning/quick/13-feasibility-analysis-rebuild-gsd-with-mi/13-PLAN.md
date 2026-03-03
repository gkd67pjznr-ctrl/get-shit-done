---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md
autonomous: true
requirements: [FEASIBILITY-01]

must_haves:
  truths:
    - "User has a clear quantified picture of how much code touches legacy layout paths"
    - "User understands the effort to strip legacy vs rebuild from scratch"
    - "User knows whether GSD upstream updates can still be pulled after either approach"
    - "User has a concrete recommendation with tradeoffs for each path"
  artifacts:
    - path: ".planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md"
      provides: "Complete feasibility analysis document"
      min_lines: 100
  key_links: []
---

<objective>
Produce a feasibility analysis answering: should GSD be rebuilt from the ground up with milestone-scoped as the ONLY layout, or should the existing codebase be surgically stripped of legacy support? Also answer whether upstream GSD updates can still be pulled under each approach.

Purpose: The user is considering a significant architectural simplification. They need hard data (line counts, file counts, complexity metrics) and a clear recommendation before committing.
Output: FEASIBILITY.md with quantified analysis, effort estimates, and recommendation.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/config.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Audit codebase for legacy/dual-layout surface area and produce FEASIBILITY.md</name>
  <files>.planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md</files>
  <action>
Perform a comprehensive audit of the GSD codebase to quantify the legacy layout footprint, then write a FEASIBILITY.md with the following sections:

**Section 1: Current State Inventory**
Quantify across all source files (get-shit-done/bin/lib/*.cjs, get-shit-done/bin/gsd-tools.cjs):
- Total lines of code (currently ~7,601 across 14 files)
- Lines directly related to legacy layout detection, dual-layout branching, and migration
- Count occurrences of: `detectLayoutStyle`, `planningRoot` with conditional branches, `concurrent` flag checks, `legacy` string references, layout_style conditionals
- List every file and its legacy-related line count
- Count across workflows (get-shit-done/workflows/*.md): references to layout_style checks, legacy fallbacks, conditional milestone-scoped blocks
- Count across templates: any legacy-related content
- Count test files: tests dedicated to legacy layout, migration, compat

**Section 2: Three Paths Analysis**

Path A — Surgical Strip (remove legacy from current codebase):
- Effort: Estimate lines to delete/simplify in each file
- What gets removed: detectLayoutStyle function, all 'legacy' branches, migrate.cjs entirely, compat tests, layout_style conditionals in workflows
- What gets simplified: planningRoot becomes just milestone path resolution, init.cjs loses layout detection, findPhaseInternal loses fallback chains
- Risk: Medium — existing tests catch regressions, but many touch layout indirectly
- Estimated scope: List each file and approximate changes (delete X lines, simplify Y functions)
- Update path: Still a fork of upstream. Can pull upstream changes but merge conflicts likely in the same files we modify. Since upstream probably has legacy too, conflicts are manageable — we'd resolve by keeping our milestone-only versions.

Path B — Ground-up Rebuild (new codebase, milestone-only from start):
- Effort: Estimate total lines for a clean implementation
- What gets built: Same features but without any legacy branching; every function assumes milestone-scoped
- Risk: High — must reimplement and re-test everything; regression risk; lose battle-tested edge case handling
- Estimated scope: ~4,000-5,000 lines new code + ~5,000 lines new tests
- Update path: Cannot pull upstream at all. This is a hard fork. Must manually port any upstream improvements.

Path C — Thorough Rewrite of upstream GSD (contribute back):
- Effort: Highest — must also handle upstream's legacy users
- Feasibility: Unlikely — upstream serves both legacy and milestone-scoped users
- Update path: Best if accepted — becomes THE upstream. But acceptance is uncertain.

**Section 3: What Lives at .planning Root After Simplification**
Under milestone-only layout, define what stays at `.planning/`:
- config.json (project-level settings)
- STATE.md (coordinator — milestone index only)
- MILESTONES.md (milestone registry)
- PROJECT.md (project description)
- DEBT.md (project-level tech debt)
- quick/ (quick tasks — not milestone-scoped)
- milestones/ (all milestone workspaces)
- codebase/ (codebase analysis docs)
What moves or disappears:
- Root ROADMAP.md becomes unnecessary (each milestone has its own)
- Root REQUIREMENTS.md becomes unnecessary
- No phases/ at root level

**Section 4: Code That Gets Deleted/Simplified (for Path A)**
For each source file, list specific functions/blocks that simplify:
- core.cjs: detectLayoutStyle() deleted entirely, planningRoot() simplified to always use milestone path
- init.cjs: Remove all layout detection blocks (~27 occurrences), auto-detect milestone scope without fallback chain
- phase.cjs: Remove legacy fallback in findPhaseInternal
- roadmap.cjs: Remove detectLayoutStyle conditionals
- migrate.cjs: Delete entirely (694 lines — migration tool no longer needed once all projects are milestone-scoped)
- commands.cjs: Remove layoutStyle check
- Workflows: Remove ~20 layout_style conditionals across 8 workflow files
- Tests: Remove compat.test.cjs (246 lines), migrate.test.cjs (304 lines), simplify others

**Section 5: Recommendation**
Recommend Path A (Surgical Strip) with clear reasoning:
- Quantified effort (estimated hours of Claude execution time)
- It preserves all battle-tested logic minus the branching
- Fork pull remains possible (conflicts manageable)
- Can be done incrementally (milestone by milestone of work)
- Risk mitigation: 349 tests currently pass, run after each change
- Suggested execution order: migrate.cjs first (pure delete), then core.cjs simplification, then init.cjs, then phase.cjs/roadmap.cjs, then workflows, then test cleanup

**Section 6: Update Path Deep Dive**
Answer the specific question: "Can I still pull GSD updates?"
- Current setup: fork remote + origin remote
- Path A: Yes, with merge conflicts in modified files. Since changes are deletions (removing legacy branches), conflicts are straightforward to resolve — keep our simplified version.
- Path B: No. Hard fork. Must manually port features.
- Recommendation: Path A preserves the ability to `git pull fork` and selectively merge.

Format as clean markdown with tables for quantified data, code examples for key simplifications.
  </action>
  <verify>
    <automated>test -f /Users/tmac/Projects/gsdup/.planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md && wc -l /Users/tmac/Projects/gsdup/.planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/FEASIBILITY.md | awk '{if ($1 >= 100) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>FEASIBILITY.md exists with 100+ lines covering all 6 sections: current state inventory with real line counts, three paths analysis, root layout definition, specific code deletions for Path A, recommendation with effort estimate, and update path deep dive answering the pull question</done>
</task>

</tasks>

<verification>
- FEASIBILITY.md contains quantified data (actual line counts, file counts, occurrence counts from the codebase)
- All three paths (surgical strip, ground-up rebuild, upstream rewrite) are analyzed with effort/risk/update-path
- The "can I still pull updates?" question is directly answered for each path
- Recommendation is clear and actionable
</verification>

<success_criteria>
User can read FEASIBILITY.md and make an informed decision about whether to pursue a legacy-stripping effort, a full rebuild, or maintain status quo — with concrete numbers backing the recommendation.
</success_criteria>

<output>
After completion, create `.planning/quick/13-feasibility-analysis-rebuild-gsd-with-mi/13-SUMMARY.md`
</output>
