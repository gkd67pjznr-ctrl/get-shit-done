---
phase: quick-5
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - UPGRADES.md
autonomous: true
requirements:
  - QUICK-5

must_haves:
  truths:
    - "Reader can understand what the GSD Enhanced Fork adds over vanilla GSD"
    - "Reader can see what each milestone (v1.0-v3.0) delivered and why"
    - "Reader can find how to use every fork-specific feature (quality levels, concurrent milestones, debt system, migration)"
    - "Document covers the full journey: 4 milestones, 20 phases, 34 plans, 85+ requirements, 313 files changed"
  artifacts:
    - path: "UPGRADES.md"
      provides: "Complete documentation of all fork accomplishments and usage"
      min_lines: 300
  key_links:
    - from: "UPGRADES.md"
      to: "docs/USER-GUIDE.md"
      via: "cross-reference link"
      pattern: "USER-GUIDE\\.md"
    - from: "UPGRADES.md"
      to: ".planning/MILESTONES.md"
      via: "cross-reference link"
      pattern: "MILESTONES\\.md"
---

<objective>
Create UPGRADES.md — a comprehensive README documenting everything the GSD Enhanced Fork accomplished across 4 milestones (v1.0 through v3.0), explaining what was built, why each upgrade was made, and how to use every feature.

Purpose: Provide a single document that a user, contributor, or future maintainer can read to understand the full scope of this fork's enhancements — from quality enforcement to concurrent milestones to tech debt management.

Output: `UPGRADES.md` at the repository root.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/MILESTONES.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/RETROSPECTIVE.md
@docs/USER-GUIDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write UPGRADES.md with full fork documentation</name>
  <files>UPGRADES.md</files>
  <action>
Create `UPGRADES.md` at the repository root. This is a prose-driven document (not a changelog) aimed at someone encountering this fork for the first time. Structure it with these sections:

**1. Header and Introduction**
- Title: "GSD Enhanced Fork — Upgrades"
- One-paragraph elevator pitch: what this fork adds over vanilla GSD (quality enforcement, concurrent milestones, tech debt management)
- Core value statement: "Claude writes code like a senior engineer who always checks the codebase first, always reads the docs, always writes tests, and never takes shortcuts — enforced by the framework, not dependent on ad-hoc prompting."
- Stats summary: 4 milestones shipped in 4 days (2026-02-23 to 2026-02-26), 20 phases, 34 plans, 85+ validated requirements, 313 files changed (+75K/-8K lines), 266 tests across 14 suites, 13 lib modules (6,537 LOC), 34 architectural decisions

**2. Why This Fork Exists**
- Vanilla GSD gives Claude structure (phases, plans, verification) but doesn't enforce quality at the code level
- The gap: Claude can still skip tests, ignore existing patterns, hand-roll utilities that already exist, and produce "slop"
- This fork closes that gap with three major systems: quality enforcement, concurrent milestones, and tech debt tracking

**3. Milestone v1.0 — Quality Enforcement (Shipped 2026-02-24)**
- What it delivers: Quality Sentinel in executor, Context7 integration, mandatory testing, quality dimensions in verifier, quality_scan directives in planner
- The Quality Sentinel (explain the 3-stage gate: pre-task codebase scan, during-task quality checks, post-task diff review)
- Context7 Integration (library lookup before implementation — no hand-rolling utilities that already exist)
- Mandatory Test Step (write tests for new logic, run existing tests before every commit)
- Quality Dimensions in Verifier (Step 7b: duplication detection, orphaned exports, missing test files)
- Planner Quality Directives (quality_scan blocks in task actions: code_to_reuse, docs_to_consult, tests_to_write)
- Config-gated enforcement levels: fast (zero behavioral change from vanilla), standard (recommended), strict (maximum enforcement)
- Bug fixes included: is_last_phase routing bug, roadmap-aware phase routing
- How to use: quality levels are controlled by config; fast is the default so existing behavior is preserved

**4. Milestone v1.1 — Quality UX (Shipped 2026-02-24)**
- What it delivers: Quality enforcement made discoverable, configurable, and observable
- `/gsd:set-quality` command: switch between fast/standard/strict per-project or globally
- Config auto-migration: existing projects automatically get the quality block added
- Global defaults: `~/.gsd/defaults.json` — new projects inherit your preferred quality level
- Quality observability: Quality Gates section in SUMMARY.md shows what gates ran and their outcomes (passed/warned/skipped/blocked)
- Context7 token cap configuration via `quality.context7_token_cap`
- Quality level visible in `/gsd:progress` output

**5. Milestone v2.0 — Concurrent Milestones (Shipped 2026-02-25)**
- What it delivers: Run multiple milestones in parallel with isolated workspaces
- `planningRoot()` — single path resolver that routes to `.planning/` or `.planning/milestones/<v>/` based on layout
- `detectLayoutStyle()` — three-state detection: legacy, milestone-scoped, uninitialized
- Workspace isolation: each milestone gets its own STATE.md, ROADMAP.md, REQUIREMENTS.md, phases/, research/
- `--milestone` flag threaded through all 7 workflows and all 7 init commands
- Lock-free dashboard: per-milestone STATUS.md files, aggregated at read time via `cmdProgressRenderMulti`
- Advisory conflict detection: reads all active conflict.json files, warns on file overlaps, never blocks (exit 0 always)
- Legacy compatibility: old-style projects auto-detected, zero migration required, permanent support
- How to use: `concurrent: true` in config.json, then `/gsd:new-milestone` creates isolated workspaces

**6. Milestone v3.0 — Tech Debt System (Shipped 2026-02-26)**
- What it delivers: Structured tech debt tracking and resolution
- DEBT.md schema: 10-field entries with TD-NNN IDs (id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan)
- CLI commands: `gsd-tools debt log`, `gsd-tools debt list`, `gsd-tools debt resolve`
- Executor auto-logging: Quality Sentinel hooks auto-create debt entries when gates fail (gated by quality level: fast=off, standard=critical/high, strict=all)
- Verifier auto-logging: quality dimension findings with provenance
- `migrate.cjs`: upgrade existing .planning/ layouts with dry-run inspection and additive-only apply
- `/gsd:fix-debt` skill: 8-step orchestrator routing debt entries through debugger diagnosis and executor fix execution
- Also resolved v2.0 integration gaps (INTEGRATION-3, INTEGRATION-4) as foundation work

**7. CLI Tool Reference**
- Brief overview of `gsd-tools.cjs` — the CJS CLI backing all GSD operations
- Key fork-added commands organized by category:
  - Quality: `set-quality` (per-project and global scope)
  - Debt: `debt log`, `debt list`, `debt resolve`
  - Migration: `migrate --dry-run`, `migrate --apply`, `migrate --cleanup`
  - Milestone: `milestone complete`, `milestone write-status`, `milestone info`
  - Fix: `/gsd:fix-debt` (on-demand debt resolution skill)

**8. Architecture and Design Decisions**
- Table of key decisions with rationale (pull from PROJECT.md Key Decisions table — include the top 10-12 most important)
- Group by theme: quality approach, concurrency approach, debt approach

**9. Test Coverage**
- 266 tests across 14 suites
- Module breakdown: phase.test.cjs (1,511 LOC), commands.test.cjs (857 LOC), init.test.cjs (596 LOC), milestone.test.cjs (510 LOC), roadmap.test.cjs (503 LOC), etc.
- How to run: `node --test tests/*.test.cjs`

**10. Known Limitations / Tech Debt**
- List the known gaps from v3.0 MILESTONES.md entry (cmdMilestoneComplete phasesDir regression, execute-plan.md missing --milestone pass-through, CLI help text incomplete, agent files outside git repo, dual-file maintenance for fix-debt.md)

**11. Links and References**
- Cross-references to: docs/USER-GUIDE.md (full command reference), .planning/MILESTONES.md (detailed milestone history), .planning/RETROSPECTIVE.md (lessons learned), .planning/PROJECT.md (project context), CHANGELOG.md

**Formatting guidelines:**
- Use clear Markdown headings (##, ###)
- Use tables for structured data (decisions, test coverage, stats)
- Use code blocks for CLI commands and file paths
- Keep each section self-contained — a reader should be able to jump to any milestone section and understand it independently
- No emojis
- Target 350-500 lines total
- Write in a direct, technical style — this is documentation for developers, not marketing copy

  <quality_scan>
    <code_to_reuse>
      N/A — this task creates a standalone Markdown document with no code dependencies
    </code_to_reuse>
    <docs_to_consult>
      - .planning/PROJECT.md — core value statement, requirements list, key decisions table, constraints
      - .planning/MILESTONES.md — per-milestone accomplishments, stats, known gaps
      - .planning/RETROSPECTIVE.md — cross-milestone trends, patterns established, key lessons
      - .planning/STATE.md — milestone shipping dates, quick task history
      - docs/USER-GUIDE.md — existing command reference structure (avoid duplication, cross-reference instead)
    </docs_to_consult>
    <tests_to_write>
      N/A — no new exported logic
    </tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>test -f /Users/tmac/Projects/gsdup/UPGRADES.md && wc -l /Users/tmac/Projects/gsdup/UPGRADES.md | awk '{if ($1 >= 300) print "PASS: " $1 " lines"; else print "FAIL: only " $1 " lines"}'</automated>
  </verify>
  <done>
    - UPGRADES.md exists at repository root with 300+ lines
    - Document covers all 4 milestones (v1.0, v1.1, v2.0, v3.0) with what/why/how for each
    - Every fork-specific feature has usage instructions (quality levels, concurrent milestones, debt commands, migration)
    - Stats are accurate (cross-referenced with MILESTONES.md and PROJECT.md)
    - Cross-references to USER-GUIDE.md, MILESTONES.md, and RETROSPECTIVE.md are present
    - No emojis, no marketing fluff, direct technical prose
  </done>
</task>

</tasks>

<verification>
1. File exists: `test -f UPGRADES.md`
2. Minimum length: `wc -l UPGRADES.md` shows 300+ lines
3. All milestones covered: grep for "v1.0", "v1.1", "v2.0", "v3.0" in UPGRADES.md
4. Cross-references present: grep for "USER-GUIDE.md", "MILESTONES.md" in UPGRADES.md
5. No emojis: `grep -P '[\x{1F600}-\x{1F64F}\x{1F300}-\x{1F5FF}\x{1F680}-\x{1F6FF}\x{1F1E0}-\x{1F1FF}]' UPGRADES.md` returns empty
</verification>

<success_criteria>
UPGRADES.md exists at repository root, contains 300+ lines of structured documentation covering all 4 milestones with what/why/how sections, includes usage instructions for every fork-specific feature, and cross-references existing documentation.
</success_criteria>

<output>
After completion, create `.planning/quick/5-create-upgrades-readme-documenting-all-a/5-SUMMARY.md`
</output>
