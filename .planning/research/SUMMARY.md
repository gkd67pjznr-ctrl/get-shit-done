# Project Research Summary

**Project:** GSD — Planning Intelligence (v14.0)
**Domain:** Planning intelligence layer for an adaptive project management CLI
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

v14.0 adds a planning intelligence layer to an existing, well-instrumented GSD framework. The project has 80+ completed PLAN.md files across v1.0-v15.0, JSONL execution history (phase-benchmarks.jsonl, corrections.jsonl), and a v13.0 event journal — all on disk, all readable. The intelligence features are purely additive consumers of this existing data. Nothing about the stack needs to change: zero new npm dependencies are required. Every capability (plan indexing, similarity scoring, task classification, milestone decomposition, prompt quality scoring) can be built with pure Node.js and gray-matter, which is already a devDependency.

The recommended approach is four sequenced phases that build from foundation to surface. Phase 1 builds the plan indexer and its pre-built JSON index — this is the prerequisite for everything else. Phase 2 builds the similarity scorer, task classifier, and composition engine, delivering the first user-visible planning leverage. Phase 3 wires the intelligence into the existing plan-phase and new-milestone workflows through the established init-injection pattern. Phase 4 adds prompt quality scoring to the digest workflow, closing the feedback loop. The milestone decomposer fits into Phase 3 but should be deferred as a stretch goal until Phases 1-2 are validated in real usage.

The dominant risk is not technical — it is behavioral: planner anchoring. When the system surfaces a "similar plan found," the planner agent may anchor to that structure rather than reasoning from the new phase's requirements. This risk is present at the similarity surface (plan-phase) and at the milestone level (new-milestone decomposition proposal). The mitigation is architectural: suggestions must appear as reference tables with explicit "adapt as needed" framing, never as pre-filled drafts. Prompt quality scoring carries a secondary risk of penalizing legitimate complexity; stratifying the correction baseline by task type rather than computing a global ceiling is the correct fix and must be designed before implementation begins.

## Key Findings

### Recommended Stack

The full capability set requires no new packages. TF-IDF weighted cosine similarity (~60 lines of pure Node.js) outperforms pure Jaccard for this corpus because rare structural terms ("hook-integration", "jsonl-persistence", "tdd") are highly discriminating and Jaccard treats them identically to common terms ("file", "test", "cli"). gray-matter handles PLAN.md frontmatter parsing and is already in devDependencies. All new modules follow the established `get-shit-done/bin/lib/*.cjs` pattern.

**Core technologies:**
- `node:fs` + `node:path` + `node:crypto`: file scanning, plan index writes, content-hash cache invalidation — built-in, zero cost
- `gray-matter` (devDep, already installed at `^4.0.3`): PLAN.md YAML frontmatter parsing at index-build time only
- Pure TF-IDF cosine (~60 lines inline): plan similarity scoring — outperforms Jaccard for discriminating rare structural terms across 80+ plans
- Hybrid query-time scoring: `0.70 * tfidf_cosine + 0.20 * jaccard + 0.10 * tag_overlap` — graceful fallback for queries with tokens outside the IDF vocabulary
- Existing modules reused: `skill-scorer.cjs` (tokenize/Jaccard), `benchmark.cjs` (parseJsonlFile), `frontmatter.cjs` (extractFrontmatter), `core.cjs` (planningRoot)

**What NOT to add:** `natural`, `compromise`, `vectra`, OpenAI embeddings, `better-sqlite3`, `fuse.js` — all solve problems that don't exist at this corpus size or violate the zero-external-dependency constraint.

### Expected Features

**Must have (table stakes — planning intelligence feels like a demo without these):**
- Plan index built from all completed PLAN.md files across all milestones, joined with correction counts from phase-benchmarks.jsonl
- Similarity search against plan index surfaced before plan-phase drafting begins (0.65+ threshold; below threshold emits no signal)
- Task-type classification for historical tasks (8 canonical types: test-setup, lib-module, cli-wiring, hook-integration, workflow-update, dashboard-page, config-extension, documentation)
- Per-task correction attribution with fallback to per-plan totals if v13.0 event journal is unavailable
- Prompt quality score per plan surfaced in /gsd:digest with task-type-stratified baseline
- Index rebuild triggered at `cmdMilestoneComplete` as the final step — index must stay current without manual intervention

**Should have (differentiators — turn a lookup table into planning leverage):**
- Skeleton adapter: substitute file paths, requirement IDs, phase numbers from matched PLAN.md into an adapted draft for the planner
- Composition assistant: surface best-performing historical example per required task type ranked by correction rate
- Milestone decomposition: propose phase breakdown for new milestones based on patterns extracted from completed ROADMAP.md files
- Index entry age decay and superseded markers: weight recent milestones higher, skip invalidated patterns

**Defer to v2+ (stretch / P3):**
- Prompt pattern analysis: n-gram extraction from high-quality vs low-quality action text — high implementation cost, limited immediate leverage
- Draft proposal auto-generation at new-milestone time — depends on decomposition parser being validated in real usage first

### Architecture Approach

The architecture introduces four new CJS lib modules that integrate into the existing GSD framework through two proven patterns: init injection (intelligence outputs added as new JSON fields to `cmdInitPlanPhase` and `cmdInitNewMilestone`, both wrapped in try/catch for graceful degradation) and milestone-completion hooks (index rebuild as final step in `cmdMilestoneComplete`). No new workflow files are needed — existing plan-phase.md and new-milestone.md gain new JSON field parsing only. The plan index lives at `.planning/plan-index.json` (project-scope, not milestone-scoped) and is a derived artifact that is never committed to git.

**Major components:**
1. `plan-indexer.cjs` — scans all milestone phase dirs, extracts structural features from PLAN.md frontmatter and task tags, builds TF-IDF index, writes `.planning/plan-index.json`; exposes `buildIndex`, `searchIndex`, `refreshIndex`
2. `task-classifier.cjs` — classifies `<task>` XML by action keywords plus file patterns into 8 canonical task types, joins correction data from phase-benchmarks.jsonl, composes ranked task sequences; reads `plan-index.json` directly via JSON.parse (no circular import with indexer)
3. `milestone-decomposer.cjs` — parses completed ROADMAP.md files across all milestones, matches milestone goal to historical structural patterns, produces a draft phase breakdown proposal
4. `prompt-scorer.cjs` — reads phase-benchmarks.jsonl and corrections.jsonl, computes per-plan quality score stratified by task type, feeds a new digest section
5. Modified: `init.cjs` (adds `plan_suggestions` and `decomposition_proposal` fields with try/catch graceful degradation), `milestone.cjs` (adds `refreshIndex()` call as final step), `gsd-tools.cjs` (wires 4 new CLI subcommands, ~60 lines)

### Critical Pitfalls

1. **Planner anchoring on similarity suggestions** — The planner agent anchors to the suggested task structure and stops reasoning from requirements. Prevention: surface suggestions as a reference table with source plan, similarity score, and correction rate — never as pre-filled plan fields. This is a hard architectural constraint, not a soft recommendation. The v14.0 milestone context doc explicitly identifies this as Key Decision Point #2.

2. **Stale index producing superseded pattern matches** — Build-time index does not know when historical patterns are invalidated by later refactoring milestones. Prevention: add `superseded_by` field and age-decay weights to the index schema from day one. Warn in `plan-phase` when index mtime exceeds 14 days old.

3. **Similarity false positives from lexical overlap without structural validation** — Jaccard-only scoring conflates keyword-similar but structurally different phases (e.g., "prompt quality scoring" vs "skill quality metrics" both score high on "quality"). Prevention: require task type overlap >= 50% independent of keyword score; exclude near-universal file patterns from scoring; surface keyword, task type, and file pattern score components separately rather than as a single composite score.

4. **Prompt quality score penalizing necessary complexity** — Algorithm-implementation tasks naturally produce more corrections than CLI wiring tasks. A global baseline flags them as low quality, which causes planners to write artificially narrow tasks. Prevention: stratify the correction baseline by task type; only count prompt-attributable correction categories (pattern_violation, ambiguous_requirements, missing_context); never use the score as a blocking gate.

5. **Milestone decomposition proposal replacing the requirements step** — Showing a phase breakdown proposal before requirements are complete causes requirements to be written to fit the proposal (milestone-level version of Pitfall 1). Prevention: enforce requirements-first sequencing structurally in the new-milestone workflow; proposal must reference specific requirement IDs and must not be generated until requirements are non-empty.

6. **Index rebuild race at cmdMilestoneComplete** — Rebuilding before all SUMMARY.md files are written produces an index missing the latest completed plan. Prevention: trigger rebuild as the absolute last step; assert last plan's SUMMARY.md has `status: complete` before rebuilding.

## Implications for Roadmap

Based on combined research, the suggested phase structure has 4 phases with an optional stretch phase.

### Phase 1: Plan Indexer Foundation

**Rationale:** Everything in v14.0 reads from the plan index. Nothing else can be built or validated without it. This is the unavoidable first dependency in the entire feature set.
**Delivers:** `plan-indexer.cjs` with `buildIndex`, `searchIndex`, `refreshIndex`; `.planning/plan-index.json` schema with age-decay and `superseded_by` fields baked in from the start; `cmdMilestoneComplete` rebuild hook as final step; `gsd-tools plan-index --rebuild` CLI subcommand; full test coverage via `plan-indexer.test.cjs`.
**Addresses features:** plan-index.json foundation, index rebuild at milestone completion, similarity search data layer, task-type classification data layer
**Avoids pitfalls:** stale index (age-decay and superseded_by in schema from day one), index rebuild race (last-step assertion before rebuilding), performance trap (pre-built file, not query-time scan)

### Phase 2: Similarity Engine and Task Classifier

**Rationale:** With the index available, similarity scoring and task classification can be built and validated against real plan data in isolation — not wired into live workflows yet. Validating the scoring logic independently before coupling it to workflow injection is the correct order. The suggestion format (reference table, not draft) must be specified here before wiring.
**Delivers:** `plan-similarity.cjs` with TF-IDF cosine plus Jaccard hybrid scoring; `task-classifier.cjs` with 8 canonical types; composition engine ranking historical task sequences by type and correction rate; similarity threshold gating at 0.65; component score breakdown (keyword / task type / file pattern displayed separately).
**Addresses features:** similarity search, task-type classification, composition assistant, skeleton adapter (partial)
**Avoids pitfalls:** false positives (task type minimum threshold of 50%, universal file pattern exclusion, decomposed score display), planner anchoring (suggestion format specified as reference table before workflow integration begins)

### Phase 3: Workflow Integration

**Rationale:** Only after scoring logic is validated independently can it be safely injected into live workflows. Init injection is the lowest-risk wiring pattern — additive JSON fields with try/catch graceful degradation mean the planning workflow never breaks if intelligence modules fail.
**Delivers:** `cmdInitPlanPhase` gains `plan_suggestions` field; plan-phase.md injects `<planning_intelligence>` block before planner spawns; `cmdInitNewMilestone` gains `decomposition_proposal` field; new-milestone.md injects proposal only after requirements step completes.
**Uses stack:** init injection pattern established in `init.cjs`, existing plan-phase.md Step 1 and Step 8 structure, existing new-milestone.md Step 7
**Avoids pitfalls:** planner anchoring (explicit framing in workflow injection text), milestone decomposition anchoring (proposal shown only after requirements list is non-empty)

### Phase 4: Prompt Quality Scoring

**Rationale:** Structurally independent of Phases 1-3 — reads phase-benchmarks.jsonl and corrections.jsonl directly without any plan-index dependency. Can be built in parallel with Phase 3 if capacity allows, but is lower priority because it adds analytical visibility rather than planning leverage.
**Delivers:** `prompt-scorer.cjs` with task-type-stratified correction baseline; per-task correction attribution (timestamp matching with per-plan fallback); `/gsd:digest` "Prompt Quality" section showing "Nx median for task-type" framing; `gsd-tools prompt-score --milestone` CLI subcommand.
**Addresses features:** per-task correction attribution, prompt quality score, digest integration
**Avoids pitfalls:** complexity penalization (stratified baseline by task type, prompt-attributable categories only), prompt quality as gate (diagnostic only, never blocking)

### Phase 5 (Stretch): Milestone Decomposer

**Rationale:** Highest leverage but highest complexity. Depends on Phases 1-2 being validated in real planning usage to confirm that structural pattern matching works at the plan level before applying it to full milestone decomposition. Defer until core planning intelligence proves its value.
**Delivers:** `milestone-decomposer.cjs`; parsed structural patterns from all completed ROADMAP.md files; new-milestone.md integration presenting draft proposal only after requirements are complete.
**Avoids pitfalls:** milestone decomposition anchoring (requirements-first sequencing enforced structurally with proposal referencing specific requirement IDs)

### Phase Ordering Rationale

- **Foundation before consumers:** plan-index.json is the shared data store every other module reads. Building it first lets Phases 2-4 develop and test against real data.
- **Schema decisions made in Phase 1:** Age decay, superseded_by markers, and component score breakdown are all index schema decisions. Retrofitting them after Phase 2 builds on the index is expensive. PITFALLS.md makes this explicit.
- **Library modules before workflow coupling:** Phases 1-2 are pure library modules testable in isolation with low risk. Phase 3 touches live workflows — should not land until underlying modules are validated in real usage.
- **Analytics last:** Prompt quality scoring (Phase 4) adds visibility, not planning leverage. The planning leverage features (Phases 1-3) deliver user value first.

### Research Flags

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** pre-built JSON index pattern is identical to existing `skill-scores.json`; CJS module structure matches 25 existing lib modules; test structure follows established Node.js test-runner pattern
- **Phase 2:** TF-IDF + Jaccard implementation fully specified in STACK.md with working code; task type taxonomy fully defined in both STACK.md and ARCHITECTURE.md
- **Phase 4:** correction scoring reads from phase-benchmarks.jsonl following the exact `parseJsonlFile` pattern already in `benchmark.cjs`

Phases that may need deeper inspection during planning:
- **Phase 3 (workflow integration):** plan-phase.md and new-milestone.md have complex multi-step structures with many existing context fields; inspect the current workflow files directly before writing Phase 3 plans to confirm exact injection points and field names
- **Phase 5 (milestone decomposer):** ROADMAP.md format varies across early milestones (v1.0-v4.0 vs v5.0+); requires a pre-planning scan of ROADMAP.md format variance before implementing the parser

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All conclusions derived from direct inspection of package.json, 25 existing lib modules, and the v14.0 milestone context doc. No external packages needed — confirmed by checking all runtime and devDeps. |
| Features | HIGH | Feature set derived from v14.0-MILESTONE-CONTEXT.md (authored by project owner) plus confirmed data schemas inspected on disk. No ambiguity about what data is available to consume. |
| Architecture | HIGH | Based on direct inspection of 25 lib modules, all workflow files, and 15 completed milestone artifacts. Integration patterns (init injection, milestone hook) are proven in production. |
| Pitfalls | HIGH | Six critical pitfalls derived from this project's own execution history, the v14.0 milestone context doc's explicit warnings (Key Decision Points #2 and #3), and published research on automation bias and anchoring. |

**Overall confidence:** HIGH

### Gaps to Address

- **Task type taxonomy completeness:** 8 task types are derived from 80+ plans through v15.0. As the project enters novel territory (e.g., UI milestones or Tauri integration), new task types may be needed. Design the classifier to accept additional types without schema migration.
- **Corrections.jsonl `task_index` field availability:** Per-task attribution assumes either a `task_index` field in corrections.jsonl or timestamp-based matching via the v13.0 workflow.jsonl. Validate this by inspecting a sample of corrections.jsonl entries during Phase 4 planning — the per-plan fallback is acceptable if per-task matching is not available.
- **ROADMAP.md format variance across early milestones:** STACK.md and ARCHITECTURE.md focus on v5.0+ milestone structure. If Phase 5 is pursued, inspect v1.0-v4.0 ROADMAP.md files before writing parser code. Early milestones may use different phase structure conventions.
- **Similarity scoring threshold calibration:** The 0.65 threshold is research-derived, not computed from this project's actual plan corpus. The first run of the similarity engine should validate that this threshold produces meaningful signal. Plan for a calibration pass after initial real usage.

## Sources

### Primary (HIGH confidence)
- `.planning/v14.0-MILESTONE-CONTEXT.md` — feature specifications, key decision points (#1-#4), dependency analysis, anchoring risk warnings (project owner authorship)
- `.planning/PROJECT.md` — existing system capabilities, zero-external-dependency constraint, established patterns
- `get-shit-done/bin/lib/skill-scorer.cjs` — Jaccard + tokenize production code, content-hash cache pattern
- `get-shit-done/bin/lib/mcp-classifier.cjs` — keyword classification pattern, established in v13.0
- `get-shit-done/bin/lib/benchmark.cjs` — phase-benchmarks.jsonl schema, parseJsonlFile pattern
- `get-shit-done/bin/lib/init.cjs` — init injection pattern, cmdInitPlanPhase context assembly
- `.planning/patterns/phase-benchmarks.jsonl` — confirmed schema on disk: `{ phase, plan, phase_type, quality_level, correction_count, gate_fire_count, duration_min, test_count, test_delta, timestamp }`
- `.planning/patterns/corrections.jsonl` — confirmed schema on disk: `{ correction_from, correction_to, diagnosis_category, scope, phase, milestone, session_id, timestamp }`
- `.planning/milestones/v9.0/phases/42-skill-relevance-scoring/42-01-PLAN.md` — confirmed PLAN.md schema (YAML frontmatter + XML task tag structure)

### Secondary (MEDIUM confidence)
- [OpenGenus: Document Similarity TF-IDF](https://iq.opengenus.org/document-similarity-tf-idf/) — TF-IDF cosine implementation pattern for small corpora
- [Leapcell: Pure Node.js Search Engine](https://leapcell.medium.com/step-by-step-build-a-lightweight-search-engine-using-only-node-js-106980d86f28) — TF-IDF + inverted index in ~100 lines of pure Node.js
- [PyImageSearch: Jaccard vs Cosine Similarity](https://pyimagesearch.com/2024/07/22/implementing-semantic-search-jaccard-similarity-and-vector-space-models/) — Jaccard better for duplicate detection, cosine+TF-IDF better for recommendation
- [Portkey AI: Evaluating Prompt Effectiveness](https://portkey.ai/blog/evaluating-prompt-effectiveness-key-metrics-and-tools/) — single metrics insufficient; chasing scores leads to rigid prompts

### Tertiary (HIGH confidence, academic sources)
- [Anchoring Bias in Explainable AI Systems (ACM IUI 2021)](https://dl.acm.org/doi/10.1145/3397481.3450639) — algorithmic suggestions anchor human judgment even when incorrect; directly supports planner anchoring prevention requirement
- [Automation Bias in Human-AI Collaboration (Springer, 2025)](https://link.springer.com/article/10.1007/s00146-025-02422-7) — over-reliance on initial AI suggestions; directly supports suggestion-as-reference-not-draft architectural requirement

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
