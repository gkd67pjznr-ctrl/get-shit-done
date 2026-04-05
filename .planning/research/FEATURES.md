# Feature Research — v14.0 Planning Intelligence

**Domain:** Planning intelligence layer on top of an existing JSONL-based execution history (PLAN.md files,
phase-benchmarks.jsonl, corrections.jsonl)
**Researched:** 2026-04-04
**Confidence:** HIGH — all features derived from existing data structures confirmed on disk, existing code
patterns confirmed in source, and milestone context document authored by the project owner.

---

## Context

v14.0 is a purely additive milestone. The system already has:

- **PLAN.md files** with YAML frontmatter (`phase`, `plan`, `requirements[]`, `files_modified[]`, structured
  `<task>` tags with `type`, `wave`, `title`, `<action>` body)
- **SUMMARY.md files** capturing execution outcome and outcome narratives
- **phase-benchmarks.jsonl** — `{ phase, plan, phase_type, quality_level, correction_count, gate_fire_count, duration_min, test_count, test_delta, timestamp }`
- **corrections.jsonl** — `{ correction_from, correction_to, diagnosis_category, scope, phase, milestone, session_id, timestamp }`
- **ROADMAP.md files** — one per milestone, with phase goals, dependency chains, plan counts, success criteria
- **Skill relevance scoring** (v9.0) — Jaccard overlap, keyword tokenization, cold-start floor, dormancy decay

The four v14.0 features convert this historical data into planning inputs. None require new data capture
infrastructure — they read what already exists.

---

## Feature Landscape

### Table Stakes (The Planner Must Have These to Feel "Learned")

Features the user expects from a system that has executed 80+ plans. Missing these = planning intelligence
feels like a demo, not a real system.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Plan index built from completed PLAN.md files | 15 milestones of PLAN.md files exist. If the system can't read its own history, there is no planning intelligence at all. This is the prerequisite for everything else. | MEDIUM | Scan all `phases/*/` dirs for `*-PLAN.md`. Extract: `plan_id`, `phase_goal` (from `<objective>` tag), `task_types` (from `type=` attr on `<task>` tags), `files_modified[]` (from frontmatter), `requirement_count` (frontmatter `requirements[]` length). Join with phase-benchmarks.jsonl on `(phase, plan)` to attach `correction_count`. Persist to `patterns/plan-index.json`. |
| Similarity search against plan index when planning a new phase | The user describes a phase goal. The system checks whether a structurally similar phase exists. Without this search, the index is a write-only artifact. | MEDIUM | Inputs: goal keywords + files_modified list from requirements. Algorithm: TF-IDF or Jaccard on tokenized goal strings + file pattern overlap. Output: ranked list of top-3 matches with similarity score. The v9.0 skill-scorer already implements Jaccard tokenization — reuse the same pattern. |
| Surface "similar plan found" signal before plan-phase drafting | If a match exists but the planner never sees it, the index has no effect on planning quality. The signal must appear before the planner starts — not in digest after the fact. | LOW | Inject into `/gsd:plan-phase` pre-planning step. One-line prompt injection: "Phase N is 82% similar to 42-01 (skill-scorer) — reuse skeleton?" with accept/skip choice. |
| Task-type classification for historical tasks | Without classifying what each historical task *did*, there is no way to compose task sequences or rank by performance. This is the primitive that composition and recommendation rest on. | MEDIUM | Classify each `<task>` tag using `type=` attribute + keyword matching on `<title>` and first line of `<action>`. Categories: `test-setup`, `lib-module`, `cli-wiring`, `hook-integration`, `workflow-update`, `dashboard-page`, `config-extension`, `documentation`. Store in plan-index alongside each plan's task list. |
| Per-task correction attribution | Prompt quality scoring requires knowing which task within a plan generated corrections. Without per-task attribution, scoring is per-plan only, which is too coarse to identify which *action text* is ambiguous. | MEDIUM | corrections.jsonl has `phase` and a `task` field (or derive from session event timeline). Group corrections by `(phase, plan, task_index)`. This is the denominator for prompt quality score per task. |
| Prompt quality score per plan surfaced in /gsd:digest | The user already looks at `/gsd:digest` for correction analytics. Adding a prompt quality section to an existing report is table stakes — it integrates into existing workflow, not a new command to learn. | LOW | Score formula: `quality = 1.0 - min(1.0, correction_count / calibrated_ceiling)`. Calibrated ceiling = 2x the median corrections per plan across all historical plans. Flag plans above ceiling. Surface in digest as: "Prompt quality: 3/5 plans scored HIGH, 1 MEDIUM, 1 LOW (Plan 42-01 Task 3: 4 corrections)." |

### Differentiators (What Makes This More Than a Lookup Table)

Features that turn historical pattern matching into genuine planning leverage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Skeleton adapter: adjusts matched plan for the new phase | Without adaptation, a matched plan skeleton uses the wrong file paths, wrong requirement IDs, and wrong phase number. A raw match is a starting point; an adapted skeleton is a usable draft. | MEDIUM | Input: matched plan skeleton + new phase's files_modified + requirement IDs from REQUIREMENTS.md. Output: skeleton with file paths, req IDs, and phase references substituted. Can be done with string substitution against the matched PLAN.md template. |
| Composition assistant: compose task sequence from best historical examples per task type | Template library matches whole plans. Composition matches individual task types and surfaces the best-performing example of each. "TDD setup from 42-01 (0 corrections), CLI wiring from 40-01 (1 correction)" is more useful than "Plan 42-01 is similar." | HIGH | Per-task-type performance table: join task classifications from plan-index with correction counts from phase-benchmarks.jsonl. Rank by correction_count ASC, duration_min ASC. Compose into a suggested task sequence for the new phase. Surface as: "Suggested sequence based on 0-correction examples: 1. test-setup (42-01 pattern), 2. lib-module (41-01 pattern), 3. cli-wiring (40-01 pattern)." |
| Milestone decomposition: propose phase breakdown for new milestones using structural patterns | When `/gsd:new-milestone` runs, it currently starts from zero. 15 completed ROADMAP.md files contain structural patterns ("CLI feature milestones: 3-4 phases; infrastructure → core logic → integration → polish"). A draft proposal anchors the conversation rather than leaving the planner to invent structure from scratch. | HIGH | Parse all completed ROADMAP.md files: extract phase count, phase goals (tokenized), dependency chain shape (linear vs branching), effort distribution (plans per phase). Cluster by milestone type using goal keywords. When a new milestone goal is described, match to nearest cluster, propose a draft phase breakdown with goals, estimated plan counts, and dependency chain. |
| Prompt pattern analysis: extract phrases from high-quality vs low-quality prompts | Scoring plans is retrospective. Pattern analysis is prospective: it identifies which *phrases* in action text correlate with clean execution, enabling the planner to write better action text from the start. | HIGH | Extract n-grams from `<action>` bodies of tasks with correction_count = 0 vs correction_count >= 3. Diff the n-gram frequency distributions. High-quality signals: specific file paths, concrete function names, explicit test assertions. Low-quality signals: vague verbs ("handle", "manage", "update as needed"), passive constructions, missing file references. Surface in digest as: "Phrase 'add to CATEGORY_SKILL_MAP' appears in 8 zero-correction tasks. Phrase 'update as needed' appears in 5 tasks with 3+ corrections." |
| Index rebuild trigger at milestone completion | A stale index is worse than no index — it surfaces completed plans as "similar" while missing recent work. Triggering a rebuild at `/gsd:complete-milestone` ensures the index always reflects current history without requiring manual intervention. | LOW | Add `rebuildPlanIndex()` call to `cmdMilestoneComplete` in milestone.cjs, same pattern as how `analyze-patterns.cjs` is triggered at SessionEnd. The rebuild scans all `phases/` directories and rewrites `plan-index.json`. |

### Anti-Features (Avoid These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-populate plan drafts from matched skeleton without user confirmation | Seems like the logical endpoint — if a match is found, just use it. | The planner agent adapts based on context it reads. If it receives a pre-filled PLAN.md, it may treat the structure as final and not adapt file paths, requirements, or task granularity to the current phase's actual needs. This defeats the point of having an intelligent planner. The skeleton is starting context, not a completed artifact. | Surface the match as a suggestion with "reuse skeleton?" choice. The planner reads the matched plan as *input context*, not as the plan being written. |
| Auto-decompose milestones without user input | The milestone goal description feeds an automated decomposer that produces a final ROADMAP.md. | Milestone structure involves judgment calls the user made consciously: which features to bundle, what constitutes a phase boundary, how much risk to take on in one phase. Automating these decisions loses the intent behind them. Auto-decomposed roadmaps may propose phases that conflict with the user's mental model of the milestone scope. | Produce a draft proposal presented *during* the `/gsd:new-milestone` questioning step, not as a replacement for it. The user refines the proposal interactively. |
| Embedding-based similarity for plan matching | Semantic similarity via embeddings would be "smarter" than Jaccard/TF-IDF. | Requires an external embedding model (API call or local model), adds a binary dependency, introduces latency, and potentially leaks task descriptions to an external service. The v9.0 skill relevance scorer proves that Jaccard tokenization is good enough for this domain — task descriptions are short, keyword-dense, and technical. "Jaccard on task keywords" catches structural similarity reliably. | Jaccard overlap on tokenized goal strings + file path pattern overlap. The v9.0 `scoreSkills()` function is the direct reuse target. |
| Replace the plan-phase planner agent with a template engine | Templates could replace the planner entirely for common patterns: just fill in the blanks. | The planner agent provides value that a template engine cannot: adapting to non-standard requirements, noticing contradictions in the requirement set, proposing a sensible task sequence when the pattern is novel. Replacing the agent with templates degrades planning quality for complex phases. | Templates as *input context* to the agent. The agent reads the template and decides how to adapt it. |
| Storing plan similarity scores in git-tracked files | Similarity scores are computed from historical data. Storing them means a commit every time the index rebuilds — noisy git history. | Constant git churn from auto-generated data files pollutes commit history with mechanical entries that have no review value. | `plan-index.json` lives in `.planning/patterns/` — already in `.gitignore` per PROJECT.md pattern. Never commit auto-generated analysis artifacts. |
| Per-task correction attribution via LLM disambiguation | If corrections.jsonl doesn't have a `task_index` field, ask an LLM to match each correction to the most likely task in the plan. | LLM disambiguation for attribution is non-deterministic and expensive. Running an LLM inference pass over corrections at every digest execution makes digest slow and non-reproducible. | Deterministic attribution via session timestamp matching against workflow.jsonl event timeline (v13.0 delivers this). If v13.0 event journal is not available, fall back to per-plan correction totals — imprecise but honest. Never use LLM inference for data attribution. |

---

## Feature Dependencies

```
[plan-index.json — index of completed plans]
    └──required-by──> Similarity search (template library)
    └──required-by──> Task-type classification
    └──required-by──> Per-task performance ranking (composition assistant)
    └──built-by──>    Plan indexer (scan PLAN.md files + join phase-benchmarks.jsonl)

[Task-type classification per historical task]
    └──required-by──> Composition assistant (rank by task type + correction rate)
    └──stored-in──>   plan-index.json (each plan entry has classified task list)

[Similarity search result]
    └──required-by──> plan-phase integration ("similar plan found" signal)
    └──required-by──> Skeleton adapter (adapts matched plan for new phase)

[phase-benchmarks.jsonl — correction_count per plan (v9.0)]
    └──required-by──> Plan indexer (attaches correction_count to index entries)
    └──required-by──> Composition assistant (ranks per-task-type by correction rate)
    └──required-by──> Prompt quality scoring (correction_count per plan denominator)

[corrections.jsonl — per-correction entries with phase/plan context (v6.0)]
    └──required-by──> Per-task correction attribution
    └──required-by──> Prompt pattern analysis (n-gram extraction from correlated tasks)

[workflow.jsonl event timeline (v13.0 — beneficial, not blocking)]
    └──enhances──>    Per-task correction attribution (precise task_index matching)
    └──fallback-to──> Per-plan totals from phase-benchmarks.jsonl if v13.0 unavailable

[ROADMAP.md files — all completed milestones]
    └──required-by──> Milestone decomposition (structural pattern extraction)

[Prompt quality score per plan]
    └──required-by──> /gsd:digest prompt quality section (display layer only)
    └──optional-for──> Planner quality directives (feeds high-quality prompt examples back)

[Skeleton adapter output]
    └──enhances──>    plan-phase integration (produces adapted draft, not raw match)
    └──not-required-by──> Similarity search (search works without adaptation)
```

### Dependency Notes

- **plan-index.json is the foundation:** Every intelligent feature reads from the plan index. Build and validate the indexer before building anything that queries it.
- **Task-type classification feeds composition but not template matching:** Template matching operates on goal strings and file patterns (no task classification needed). Composition requires classified task lists to rank per-task-type.
- **phase-benchmarks.jsonl is required for quality-weighted features:** Similarity search can work on structural patterns alone (no correction data needed). The composition assistant and prompt quality scorer both require correction_count from benchmarks.
- **v13.0 event journal enhances but does not block per-task attribution:** Corrections.jsonl has `phase` and `milestone` fields. Per-plan correction totals are computable today. Per-task attribution is more precise with the event timeline but the fallback (per-plan total) is acceptable for v14.0.
- **Milestone decomposition is structurally independent:** It reads ROADMAP.md files (not plan-index.json) and writes output to the new-milestone workflow. It shares no runtime dependencies with the other three features.
- **Index rebuild at milestone completion is a trigger, not a feature:** It ensures the index is fresh. It is one function call added to an existing hook point, not a phase of its own.

---

## MVP Definition

### Phase 1: Plan Indexer

The foundational primitive. Without it, none of the intelligent features have data to query.

- [ ] Plan indexer scans all completed PLAN.md files across all milestone workspaces
- [ ] Extracts: `plan_id`, `phase_goal` (from `<objective>`), `task_types` (from `type=` on `<task>` tags), `files_modified` (frontmatter), `requirement_count`, `tags` (inferred from file patterns and task types)
- [ ] Joins with phase-benchmarks.jsonl on `(phase, plan)` to attach `correction_count` and `gate_fire_count`
- [ ] Writes `patterns/plan-index.json` (in `.gitignore` patterns directory — never committed)
- [ ] Rebuild triggered by `cmdMilestoneComplete`
- [ ] CLI subcommand: `gsd-tools plan-index --rebuild` for manual refresh

### Phase 2: Template Library + Composition Assistant

The two features that integrate into plan-phase workflow — the user-visible planning leverage.

- [ ] Similarity scorer: Jaccard on tokenized goal strings + file path overlap against plan-index.json
- [ ] Surface top-3 matches in `/gsd:plan-phase` pre-planning context with similarity scores
- [ ] Skeleton adapter: substitute file paths, requirement IDs, phase numbers from matched PLAN.md
- [ ] Task-type classifier: classify `<task>` tags from plan-index by `type=` attr + title keywords
- [ ] Per-task-type performance table: rank by correction_count ASC from benchmarks
- [ ] Composition suggestion: surface best-performing examples per required task type

### Phase 3: Prompt Quality Scoring

The analytics layer — no new planning inputs, but closes the feedback loop via digest.

- [ ] Per-task correction attribution (timestamp matching or per-plan fallback)
- [ ] Prompt quality score formula calibrated from historical correction distribution (2x median ceiling)
- [ ] `/gsd:digest` section: "Prompt quality: N/M plans HIGH, n plans scored LOW (Plan X Task Y: 4 corrections)"
- [ ] Flag plans above ceiling with "action text may be ambiguous" signal

### Phase 4: Milestone Decomposition (Stretch)

The highest-leverage but highest-complexity feature. Deferred after Phases 1-3 are validated.

- [ ] Milestone structure analyzer: parse completed ROADMAP.md files, extract phase count, goals, dependency shape, plans-per-phase
- [ ] Structural pattern clustering by milestone type (CLI feature, analytics layer, infrastructure, learning loop)
- [ ] Draft proposal generator: given a milestone goal description, produce phase breakdown with goals, estimated plan counts, dependency chain
- [ ] Integration into `/gsd:new-milestone` questioning step: present proposal as a starting point during the interactive questioning phase

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Plan indexer (scan + join + persist) | HIGH | MEDIUM | P1 — foundation for everything |
| Index rebuild at milestone completion | HIGH | LOW | P1 — keeps index current without friction |
| Similarity scorer (Jaccard on goals + files) | HIGH | MEDIUM | P1 — primary template library query mechanism |
| "Similar plan found" signal in plan-phase | HIGH | LOW | P1 — integrates intelligence into existing workflow |
| Task-type classifier | MEDIUM | MEDIUM | P1 — feeds composition assistant |
| Per-task-type performance ranking | MEDIUM | LOW | P2 — requires classifier, low marginal cost after |
| Composition suggestion surface | MEDIUM | MEDIUM | P2 — high value once ranking exists |
| Skeleton adapter | MEDIUM | MEDIUM | P2 — quality-of-life improvement on raw match |
| Per-task correction attribution | MEDIUM | MEDIUM | P2 — prerequisite for prompt quality scoring |
| Prompt quality score formula | MEDIUM | LOW | P2 — formula is trivial once attribution exists |
| `/gsd:digest` prompt quality section | MEDIUM | LOW | P2 — adds to existing report, low friction |
| Prompt pattern analysis (n-gram extraction) | LOW | HIGH | P3 — insight is valuable, but requires substantial n-gram infra |
| Milestone decomposition (ROADMAP.md parser) | HIGH | HIGH | P3 — high value, highest complexity, needs Phases 1-2 validated first |
| Draft proposal generator | HIGH | MEDIUM | P3 — depends on decomposition parser |
| new-milestone integration | HIGH | LOW | P3 — integration is straightforward once proposal generator exists |

**Priority key:**
- P1: Required for planning intelligence to exist at all (Phase 1-2 core)
- P2: Closes the feedback loop and surfaces the intelligence to users (Phase 2-3)
- P3: Stretch features — high value but defer until P1/P2 are validated in real usage

---

## What "Good" Looks Like for Each Feature

These definitions of success drive the DONE criteria for each plan.

### Plan Similarity Measurement

**Good:** Similarity score between 42-01 (skill-scorer) and 41-01 (skill-metrics) scores above 0.75 (both have
`lib-module`, `cli-wiring`, `tdd` task patterns and overlapping `lib/*.cjs` + `tests/*.test.cjs` file patterns).
Similarity between 42-01 (skill-scorer) and 84-01 (event journaling) scores below 0.4 (different file patterns,
different task types, different goal vocabulary).

**Avoid:** A scorer that returns high similarity for any two CLI features regardless of task structure (too broad),
or a scorer that requires exact file name matches and misses structural siblings (too narrow).

**Implementation signal:** Use two-component similarity: `0.6 * goal_jaccard + 0.4 * file_pattern_overlap`. Goal
Jaccard tokenizes the `<objective>` text with the same normalizer as v9.0 skill-scorer (lowercase, strip
punctuation, remove stopwords). File pattern overlap compares the directory component of `files_modified` paths
(e.g., `get-shit-done/bin/lib/` matches `get-shit-done/bin/lib/` regardless of filename).

### Template Library Usefulness vs Annoyingness

**Useful:** The signal fires only when similarity is above a meaningful threshold (0.7 minimum). It shows
concrete detail: plan ID, phase goal, similarity score, and a one-line summary of the task sequence. The user
can skip it with one keystroke. It appears *before* any plan drafting begins (pre-planning context injection,
not post-execution noise).

**Annoying:** Fires on every plan-phase invocation regardless of similarity ("no similar plans found — here are
the 3 closest matches at 0.2 similarity"). Requires the user to act (confirm or decline) even when they want to
ignore it. Fires after the planner has already produced a draft (too late to be useful).

**Implementation signal:** Hard threshold at 0.65 similarity. Below threshold, no signal is emitted. Above
threshold, inject as a single line in pre-planning context with a `[skip]` option that sets a session flag to
suppress for this invocation.

### Prompt Quality Metrics That Are Meaningful

**Meaningful:** Score is calibrated against the actual historical distribution, not an arbitrary scale. A task
with 0 corrections in a milestone where the median is 0.3 corrections/task should score HIGH. A task with 4
corrections in that same context should score LOW. The score reflects *relative* quality within the project's
actual execution history.

**Not meaningful:** A score computed from a fixed rubric ("more than 2 corrections = LOW") applied uniformly
regardless of task type, complexity, or historical baseline. Hook-integration tasks naturally generate more
corrections than simple lib-module tasks — a good scorer accounts for task-type baseline, not just raw count.

**Implementation signal:** Compute per-task-type median correction count from phase-benchmarks.jsonl (e.g.,
`test-setup` tasks median = 0.1, `hook-integration` tasks median = 1.2). Flag tasks whose correction count
exceeds 2x their *task-type median*, not a global threshold. This requires task-type classification to be
complete before calibration.

### Milestone Decomposition Quality

**Good:** Given the goal "Add planning intelligence to GSD — plan reuse, task composition, milestone
decomposition, prompt quality scoring," the decomposer proposes 4 phases roughly matching: (1) data foundation,
(2) similarity + composition, (3) analytics/digest integration, (4) milestone decomposition itself. The proposal
matches the actual v14.0 ROADMAP structure because the patterns exist in history.

**Not good:** A generic "3-4 phases" recommendation with no phase goals. A proposal with 8 phases for a
milestone that historically patterns as 3-4. A proposal that ignores the dependency chain (trying to build
similarity search before the plan index exists).

**Implementation signal:** Require the draft to include: phase count (based on similar milestone's count
±1), phase goals (adapted from nearest historical milestone's phase goals), dependency chain (copied from
historical pattern), estimated plans per phase (from historical plans-per-phase average). If no similar
milestone is found (similarity below 0.5), emit "no strong historical match — using default 3-phase pattern"
rather than an overconfident proposal.

---

## Existing Data Inventory (What v14.0 Reads)

All features are consumers of existing files — no new data capture infrastructure required.

| File | Location | Used By | Notes |
|------|----------|---------|-------|
| `*-PLAN.md` files | `.planning/milestones/vN.N/phases/*/` | Plan indexer | YAML frontmatter + `<objective>`, `<task>` XML tags |
| `*-SUMMARY.md` files | Same directories | Plan indexer (optional) | Execution narrative — lower priority for v14.0 |
| `phase-benchmarks.jsonl` | `.planning/patterns/` | Plan indexer, prompt scorer, composition assistant | `correction_count`, `gate_fire_count` per `(phase, plan)` |
| `corrections.jsonl` | `.planning/patterns/` | Prompt scorer, pattern analysis | Per-correction entries with `phase`, `milestone`, `diagnosis_category` |
| `ROADMAP.md` (per milestone) | `.planning/milestones/vN.N/` | Milestone decomposer | Phase goals, dependency chain, plan counts |
| `workflow.jsonl` | `.planning/observations/` | Per-task attribution (v13.0) | Available if v13.0 is complete; fallback to per-plan totals |

---

## Sources

- `/Users/tmac/Projects/gsdup/.planning/v14.0-MILESTONE-CONTEXT.md` — feature specifications, effort
  estimates, key decision points, dependency analysis
- `/Users/tmac/Projects/gsdup/.planning/PROJECT.md` — existing system capabilities (v9.0 Jaccard scorer,
  corrections.jsonl schema, phase-benchmarks.jsonl schema), constraints (additive only, no binary deps)
- `/Users/tmac/Projects/gsdup/.planning/patterns/phase-benchmarks.jsonl` — confirmed schema on disk:
  `{ phase, plan, phase_type, quality_level, correction_count, gate_fire_count, duration_min, test_count, test_delta, timestamp }`
- `/Users/tmac/Projects/gsdup/.planning/patterns/corrections.jsonl` — confirmed schema on disk:
  `{ correction_from, correction_to, diagnosis_category, scope, phase, milestone, session_id, timestamp }`
- `/Users/tmac/Projects/gsdup/.planning/milestones/v9.0/phases/42-skill-relevance-scoring/42-01-PLAN.md` —
  confirmed PLAN.md structure: YAML frontmatter (`phase`, `plan`, `requirements[]`, `files_modified[]`), `<objective>`, `<must_haves>`, `<tasks>` with `<task id type wave>` and `<title>`, `<files>`, `<action>` children
- `/Users/tmac/Projects/gsdup/.planning/milestones/v9.0/ROADMAP.md` — confirmed ROADMAP.md structure: phase
  goal, dependency chain, plan list per phase
- `/Users/tmac/Projects/gsdup/.planning/milestones/v13.0/ROADMAP.md` — confirmed current milestone structure
  and phase numbering convention

---

*Feature research for: Planning intelligence layer (v14.0 — plan reuse, task composition,
milestone decomposition, prompt quality scoring)*
*Researched: 2026-04-04*
