# Pitfalls Research

**Domain:** Adding planning intelligence (plan reuse, task composition, milestone decomposition, prompt quality scoring) to an existing GSD framework
**Researched:** 2026-04-04
**Confidence:** HIGH (pitfalls derived from this project's own execution history, v14.0 milestone context, established research on automation bias and similarity scoring, and direct inspection of existing data structures)

---

## Critical Pitfalls

### Pitfall 1: Planner Anchoring — Treating Suggestions as Authoritative Rather Than Advisory

**What goes wrong:**
The planner agent receives a "suggested task sequence from historical performance" and stops reasoning about the new phase's actual requirements. It adopts the suggestion wholesale, including tasks that were needed in the historical phase but are not needed now, and misses tasks that are novel to this phase. The result is a plan that executes cleanly against the wrong goal — all suggested tasks are completed, but the phase requirements are not met because the template was wrong for this context.

This is the highest-severity risk because it manifests as a quality failure at verification time, not at plan creation time. The plan looks correct and complete throughout execution.

**Why it happens:**
Anchoring bias is well-documented: when an AI (or human planner) receives an initial suggestion, it anchors to that structure and adjusts rather than reasoning from scratch. Research on automation bias confirms that first-impression strengths of a system cause significantly more errors due to over-reliance. The composition assistant's framing — "here's what worked before" — is exactly the condition that triggers anchoring. If the suggestion looks plausible, the planner will not question it deeply.

**How to avoid:**
Surface suggestions as context input, not as pre-filled plan drafts. Specifically:
- The composition assistant should display matched tasks with their correction rates and source phases as a reference table, not as a draft task list.
- The plan-phase workflow must still require the planner to write the task breakdown from scratch, using the suggestion table as a reference.
- Frame all suggestions with explicit "adapt as needed" language and a reminder that the planner owns the final breakdown.
- Never auto-populate the plan template fields with suggested tasks. The planner types the tasks; the assistant annotates which historical pattern each task resembles.

The v14.0 milestone context (Key Decision Point #2) explicitly specifies "suggest as context input to the planner, not as a pre-filled plan template." This must be a hard architectural constraint, not a soft recommendation.

**Warning signs:**
- Plan task descriptions closely match historical plan descriptions word-for-word
- A plan's task count exactly matches the historical "best match" plan's task count
- The planner agent produces a plan without referencing the phase-specific requirements
- Completed plans show 0 corrections but requirements verification fails at transition

**Phase to address:** Plan reuse and composition assistant phases (Phase 1 of v14.0). The suggestion surface format must be specified before the similarity engine is built, because the format determines whether planner anchoring is structurally prevented or structurally encouraged.

---

### Pitfall 2: Stale Index Producing Bad Matches at Critical Moments

**What goes wrong:**
The plan index is built at milestone completion and cached to a JSON file. A new phase is started, the index is queried, and a "85% similar" match is returned — but the matched plan is from a phase that has since been superseded by a refactoring in a later milestone. The structural pattern it represents is now an anti-pattern (e.g., a CLI subcommand wiring approach that was replaced in v3.1 when the legacy layout was stripped). The planner follows the suggestion and introduces a pattern that was explicitly removed.

Staleness is especially dangerous when the best-match plan is one milestone old. The index was current when built, but the intervening milestone changed the pattern it encoded.

**Why it happens:**
Build-time indexes are fast but drift. The plan index captures structural patterns at a point in time; it does not know when those patterns are superseded by later implementation changes. A "refactor the CLI subcommand wiring" milestone (like v3.1's legacy strip) invalidates many historical plans without updating their index entries. The index has no mechanism to detect this.

**How to avoid:**
Two mechanisms, both required:

1. **Index entry age gating:** Weight matches by recency. Matches from the two most recent milestones receive full weight; matches older than three milestones receive 50% weight; matches older than five milestones receive 25% weight. Never suppress old matches entirely (they may still be valid), but surface their age prominently.

2. **Invalidation markers:** When a plan is superseded by a later plan that explicitly replaces or refactors it, mark the older plan's index entry with `superseded_by: "plan_id"`. The similarity scorer skips superseded entries by default (with a `--include-superseded` flag for manual inspection). Superseded entries are identified during index rebuild by scanning SUMMARY.md files for phrases like "replaces," "refactors," or "removes" referencing earlier plans.

3. **`--rebuild-index` trigger:** The existing recommendation (from v14.0 milestone context) to rebuild at `cmdMilestoneComplete` is correct. Add a `--rebuild-index` flag for manual refresh. Also add a stale-index warning: if the index mtime is more than 14 days old when `plan-phase` runs, warn before surfacing suggestions.

**Warning signs:**
- Suggestions reference plans from milestones that predated a major refactoring milestone (v3.1, v4.0, etc.)
- A suggestion references file paths that no longer exist in the codebase
- The "best match" plan's `task_pattern` includes patterns like `detect-layout-style` or `legacy-compatibility` — patterns explicitly removed in v3.1
- Index mtime is more than 30 days old in an active project

**Phase to address:** Plan indexer phase (Phase 1 of v14.0). Build age-weighting and superseded markers into the index schema from the first iteration. Retrofitting them later requires re-scanning all historical plans and rewriting the index format.

---

### Pitfall 3: Similarity Metrics That Measure Lexical Overlap, Not Structural Relevance

**What goes wrong:**
The similarity scorer reports "78% match" between a new phase targeting "prompt quality scoring" and a historical phase targeting "skill quality metrics." Both involve the word "quality" prominently, both produce a numeric score, both read from JSONL files. The Jaccard token overlap is high. But the structural patterns are completely different: skill quality metrics involve CATEGORY_SKILL_MAP attribution logic and per-skill correction rate aggregation, while prompt quality scoring involves per-task correction attribution and prompt pattern extraction. A planner following this suggestion adopts the wrong task decomposition.

The deeper version of this failure: two phases share the same file patterns (e.g., both touch `get-shit-done/bin/lib/*.cjs` and `tests/*.test.cjs`) but for entirely different reasons. The file pattern similarity is architectural coincidence, not structural equivalence.

**Why it happens:**
Jaccard overlap on tokens is a surface-level signal. It measures shared vocabulary, not shared structure. "Quality," "score," "metric," and "JSONL" appear in many plans for very different reasons. File patterns are even more misleading — `*.cjs` and `*.test.cjs` appear in virtually every plan in this project because the entire codebase is CJS.

This is the gap between keyword similarity and semantic similarity. The current GSD stack (CJS, no ML dependencies, zero-external-dependency constraint) cannot support embedding-based semantic similarity without violating the stack constraints.

**How to avoid:**
Enrich index entries with structural discriminators that keyword overlap cannot capture:

1. **Task type composition:** The task type sequence is the primary structural fingerprint. `["test-setup", "lib-module", "cli-wiring"]` versus `["test-setup", "lib-module", "algorithm-implementation", "digest-integration"]` are structurally different even if the goal keywords overlap heavily. Weight task type sequence similarity higher than keyword overlap in the final score.

2. **Require task type minimum threshold:** Only surface a match if the task type overlap is above a minimum threshold (suggest 50%) independent of keyword score. A high keyword score with low task type overlap is a false positive.

3. **Exclude universal file patterns from scoring:** Remove file patterns that appear in more than 60% of all plans from the similarity computation. In this codebase: `get-shit-done/bin/lib/*.cjs`, `tests/*.test.cjs`, and `get-shit-done/bin/gsd-tools.cjs` are near-universal and contribute noise, not signal. Only project-specific or domain-specific file patterns carry discriminating information.

4. **Show the confidence breakdown:** Surface the keyword overlap score, task type overlap score, and file pattern score separately. A "78% overall" that hides "keyword 95%, task type 40%" is dangerous. The planner can dismiss a false positive immediately when they see low task type overlap.

**Warning signs:**
- Multiple phases from different domains (analytics, CLI commands, JSONL persistence) all score above 70% similarity
- The top match for a new phase shares only generic tokens ("score," "compute," "track") without specific domain tokens
- File pattern matching contributes more than 30% of the total similarity score
- Suggested task sequences from the match don't map to the new phase's specific requirements

**Phase to address:** Similarity scorer phase (Phase 1 of v14.0). The scoring formula must be defined with discriminating weights before implementation. A naive Jaccard-only scorer that produces plausible-looking numbers is harder to fix than no scorer at all.

---

### Pitfall 4: Prompt Quality Score That Penalizes Necessary Complexity

**What goes wrong:**
The prompt quality score is calibrated against the median correction rate across all plans. A complex task — like implementing a similarity scoring algorithm, a milestone decomposition engine, or a safety gate pipeline — produces 2-3 corrections from genuine ambiguity in novel territory, not from a poorly-written prompt. The quality score flags this plan as "low quality" and the digest surfaces "Plan 86-01 task 3 had 3 corrections — action text may be ambiguous." The planner infers that complex technical tasks should be decomposed more aggressively to reduce per-task correction rates, leading to over-decomposition where each subtask is too narrow to be meaningful.

The inverse also occurs: a simple, well-scoped task with 0 corrections scores as "high quality" even if the prompt was underspecified — the simplicity meant Claude had no opportunity to misinterpret, not that the prompt was good.

**Why it happens:**
Correction count is a proxy for prompt quality, but it conflates prompt quality with task novelty and task complexity. Novel domains inherently produce more corrections because Claude has less context about the project's conventions for that domain. Complex tasks have more ambiguous decision points. Neither is a prompt quality problem.

The calibration baseline compounds this: if the median is computed across all milestones including early milestones (v1.0-v4.0) where the quality infrastructure was being built (higher corrections everywhere), the baseline is inflated. If computed only against recent milestones, it may be too tight.

**How to avoid:**

1. **Stratify by task type:** Compute separate correction baselines for each task type category. `lib-module` tasks have a different expected correction distribution than `algorithm-implementation` tasks. Flagging an algorithm task against a CLI wiring baseline is an apples-to-oranges comparison.

2. **Track correction categories, not just counts:** A count of 3 corrections in `code.pattern_violation` (Claude used the wrong existing utility) is a prompt quality signal — the prompt should have specified which utilities to use. A count of 3 corrections in `code.scope_drift` (Claude added unrequested features) is also a prompt quality signal. But a count of 3 corrections in `process.planning_error` (requirements changed mid-execution) is not a prompt quality problem at all. Only count correction categories that are plausibly caused by prompt ambiguity.

3. **Surface ratio with task type context:** Display the score as "3 corrections (2.1x median for algorithm-implementation tasks)" rather than "3 corrections (3.0x overall median)." This immediately disambiguates expected versus unexpected correction rates.

4. **Avoid using score as a gate:** Prompt quality score is a diagnostic tool, not a quality gate. The plan-phase workflow must not block or require justification when a score is low. It surfaces as an observation in digest, never as a blocking condition.

**Warning signs:**
- Plans for novel features consistently score lower than plans for routine CLI wiring, even when execution outcomes were equivalent
- The digest flags every ambitious milestone's plans as "low quality" despite clean verification outcomes
- Planners start writing artificially narrow task prompts to minimize correction exposure
- Score distribution has no variance — everything clusters in a narrow band because the baseline absorbs legitimate complexity

**Phase to address:** Prompt quality scoring phase (Phase 4 of v14.0). The scoring formula and calibration approach must be designed before implementation. Calibrating against raw correction counts without stratification produces a metric that is actively misleading.

---

### Pitfall 5: Milestone Decomposition Proposal Replacing the Requirements Step

**What goes wrong:**
`/gsd:new-milestone` surfaces a draft phase breakdown: "Phase 1: indexer infrastructure, Phase 2: similarity scoring, Phase 3: planner integration." The user accepts the proposal during the questioning step without the planner deeply considering whether these phases match the actual milestone requirements. The requirements step produces a requirements list that conforms to the phase breakdown rather than the phase breakdown being derived from the requirements. Requirements are shaped to fit the template, not the other way around.

This is the milestone-level version of Pitfall 1 (planner anchoring), and it is more severe because it affects the entire milestone roadmap, not just a single plan.

**Why it happens:**
Once a draft exists, cognitive anchoring makes it the reference point for all subsequent questions. The questioning step asks "Does this look right?" rather than "What are the actual goals?" Users and planners edit the draft rather than deriving from scratch. The milestone context document (v14.0's Key Decision Point #3) explicitly warns: "specific with explicit 'adapt as needed' framing" — but this framing is easy to ignore under time pressure.

**How to avoid:**
Sequence is everything: the requirements step must complete before the decomposition proposal is shown.

- Structure the new-milestone workflow as: (1) goal elicitation, (2) requirements definition, (3) decomposition proposal informed by requirements.
- The decomposition proposal must reference specific requirements: "Phase 1 addresses REQ-001, REQ-002. Phase 2 addresses REQ-003, REQ-004." If a requirement is not covered by any proposed phase, that is a visible gap.
- Make the proposal explicitly provisional: "This is one possible phase structure. You should add, remove, or reorder phases to match your actual requirements."
- Never show the decomposition proposal before the requirements list is complete.

**Warning signs:**
- Requirements list maps cleanly to proposed phases in a 1:1 correspondence (sign the requirements were written to fit the phases)
- The requirements step is shorter than normal — fewer questions, faster agreement
- Phase goals in the roadmap echo the decomposition proposal language rather than the user's own requirement language

**Phase to address:** Milestone decomposition phase (Phase 3 of v14.0). The new-milestone workflow integration must enforce the sequencing constraint structurally, not just in documentation.

---

### Pitfall 6: Index Rebuild Race — Milestone Complete Triggers Rebuild Before Summary Files Are Written

**What goes wrong:**
The index rebuild is triggered at `cmdMilestoneComplete`. This command runs the finalization sequence: it marks phases complete, updates MILESTONES.md, archives the workspace. If the index rebuild runs at the start of this sequence, the most recently completed plans' SUMMARY.md files may not yet be fully written or the phase-benchmarks.jsonl entry for the last plan may not yet be committed. The new index is built without the latest plan's data, and the next query returns a "best match" that is missing the most recent (and most relevant) historical example.

**Why it happens:**
Finalization sequences have dependencies that are not always obvious. `cmdMilestoneComplete` is a multi-step operation; the order of sub-operations matters for the index rebuild. Developers placing the rebuild "somewhere in complete" without checking the data availability invariants hit this silently — the rebuild succeeds but with incomplete data.

**How to avoid:**
Trigger the index rebuild as the last step in `cmdMilestoneComplete`, after all SUMMARY.md files are written and all JSONL updates are committed. Add an explicit assertion: before rebuilding, verify that the last plan's SUMMARY.md exists and has `status: complete` in its frontmatter. If not, skip the rebuild and log a warning — the user can run `--rebuild-index` manually.

**Warning signs:**
- Index entry count after rebuild is one fewer than expected
- The most recent milestone's last plan is absent from the index
- `plan-phase` queries immediately after milestone completion return the second-most-recent milestone's plans as top matches

**Phase to address:** Plan indexer phase (Phase 1 of v14.0). The `cmdMilestoneComplete` integration point and rebuild ordering must be specified in the initial design.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Single Jaccard score without task type weighting | Simpler implementation, easier to tune | False positives on keyword-similar but structurally different phases; planner gets bad suggestions | Never — task type weighting is the minimum viable discriminator |
| Build-time index without age decay | Fast queries, simple implementation | Stale matches from superseded patterns become increasingly frequent as milestones accumulate | Never — add age decay from first version |
| Prompt quality score as a blocking gate | Appears to enforce quality | Penalizes complexity and novel work; planners game the metric with narrow task decompositions | Never — diagnostic only, never blocking |
| Auto-populate plan draft from template match | Faster plan creation for common patterns | Planner anchoring guaranteed; novel requirements get missed because the template looks "good enough" | Never — suggestions as context only |
| Global correction baseline (no task type stratification) | Single formula, easy to explain | Algorithm tasks always look worse than CLI tasks; metric loses meaning as project complexity grows | Acceptable in MVP if clearly labeled "baseline not stratified — treat as directional only" |
| Query-time index scanning (no pre-built index) | Always fresh data, no cache invalidation problem | Scans all PLAN.md and SUMMARY.md files on every `plan-phase` invocation; slow as plan count grows; blocks the planning workflow | Acceptable for first prototype only — switch to pre-built index before 50+ plans exist |

---

## Integration Gotchas

Common mistakes when connecting to existing GSD framework components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `phase-benchmarks.jsonl` | Reading the full file and computing stats at query time | Pre-aggregate per-plan stats during index build; `phase-benchmarks.jsonl` can grow to thousands of lines across milestones |
| `plan-phase` workflow | Injecting suggestion context into the middle of an existing multi-step workflow | Surface suggestions in the research step (before plan writing begins), not inline during plan creation |
| `cmdMilestoneComplete` | Triggering index rebuild before verifying all SUMMARY.md files are written | Rebuild as the final step; assert last plan completeness before rebuilding |
| `corrections.jsonl` for prompt scoring | Joining all corrections without filtering by category | Only count prompt-attributable categories (pattern_violation, ambiguous_requirements, missing_context); exclude scope_drift and planning_error from the count |
| Task type classifier | Classifying tasks by action keyword alone ("implement," "add," "create") | Action keywords are ambiguous; classify by the combination of action keyword plus target file pattern (e.g., "add" + `*.test.cjs` = `test-setup`, not `lib-module`) |
| Milestone decomposition in `new-milestone` | Showing proposal before requirements step | Requirements must be complete before proposal is generated; proposal must reference specific requirement IDs |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full PLAN.md scan at every `plan-phase` invocation | `plan-phase` startup latency grows from 100ms to 2+ seconds | Pre-build index at milestone completion; query is O(1) JSON lookup | At 100+ completed plans (~milestone v20+) |
| Storing full PLAN.md content in index entries | Index file grows to 5MB+; JSON parse cost grows | Store only structural features (task types, file patterns, goal keywords) — never raw plan content | At 50+ plans (~milestone v15+) |
| Recomputing prompt quality scores at every digest invocation | Digest generation becomes slow; `corrections.jsonl` scanned repeatedly | Cache per-plan scores in `phase-benchmarks.jsonl` entries at plan completion; digest reads cached values | At 200+ plans (not current concern) |
| Task type classifier running regex against all historical plans on every query | Query time grows with plan count | Classify task types during index build, not at query time; store `task_types: []` in index entries | At 50+ plans |

---

## "Looks Done But Isn't" Checklist

- [ ] **Plan index:** Index entries include `superseded_by` field and age-weighted score — not just keyword overlap
- [ ] **Similarity scorer:** Displays keyword score, task type score, and file pattern score separately — not just a single composite score
- [ ] **Composition assistant:** Surfaces suggestions as a reference table, not as pre-filled plan task fields
- [ ] **Milestone decomposition:** Only surfaces proposal after requirements list is complete; proposal references specific requirement IDs
- [ ] **Prompt quality scoring:** Stratified by task type — not computed against a global correction baseline
- [ ] **Prompt quality scoring:** Digest displays "Nx median for task-type" — not just raw correction count
- [ ] **Index rebuild:** Fires as the last step in `cmdMilestoneComplete` after all SUMMARY.md files are written
- [ ] **Index staleness:** `plan-phase` warns when index mtime is more than 14 days old
- [ ] **False positive prevention:** Similarity matches with task type overlap < 50% are suppressed or clearly labeled as weak matches
- [ ] **Planner anchoring guard:** `plan-phase` workflow language explicitly tells the planner to write tasks from requirements, using suggestions as reference only

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Planner anchored to bad template — plan executed wrong structure | HIGH | Requirements step must be rerun; plan rewritten from requirements; new execution needed. No shortcut. |
| Stale index produced bad match | LOW | Run `gsd-tools index --rebuild`; re-run `plan-phase` to get fresh suggestions |
| Similarity false positive adopted | MEDIUM | Identify which tasks came from the bad match; rewrite those tasks from requirements; re-execute only affected tasks |
| Prompt quality score penalizing good complex work | LOW | Adjust task type stratification thresholds; recompute cached scores with `gsd-tools digest --recompute-scores` |
| Milestone decomposition proposal anchored requirements | HIGH | Discard the roadmap; redo the requirements elicitation step without showing the proposal first; rebuild roadmap from requirements |
| Index rebuild missing last plan (race condition) | LOW | Run `gsd-tools index --rebuild` manually after confirming all SUMMARY.md files are written |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Planner anchoring | Phase 1 (plan indexer + composition assistant) — specify suggestion format as reference table, not draft | Plan-phase test: provide a high-similarity suggestion; verify planner produces task list from requirements, not from suggestion |
| Stale index | Phase 1 (plan indexer) — build age decay and superseded markers into index schema | Index rebuild test: verify entries include age weights; verify superseded entries are skipped |
| Similarity false positives | Phase 1 (similarity scorer) — implement task type weighting and universal file pattern exclusion | Regression test: keyword-similar but structurally different phases score below 50% task type overlap |
| Prompt quality penalizes complexity | Phase 4 (prompt quality scoring) — stratify baseline by task type; prompt-attributable categories only | Score distribution test: algorithm-implementation tasks do not systematically score lower than cli-wiring tasks |
| Milestone decomposition anchoring | Phase 3 (automated decomposition) — enforce requirements-first sequencing in new-milestone integration | Workflow sequence test: decomposition proposal cannot be generated before requirements list is non-empty |
| Index rebuild race | Phase 1 (plan indexer) — rebuild as last step in cmdMilestoneComplete with SUMMARY.md assertion | Integration test: run cmdMilestoneComplete and verify index includes the final plan's entry |

---

## Sources

- Project execution history: `.planning/milestones/v14.0-MILESTONE-CONTEXT.md` — Key Decision Points #2 and #3 explicitly identify anchoring and template over-adoption as risks; recommendation to suggest rather than auto-populate
- Project execution history: `.planning/milestones/v9.0/phases/42-skill-relevance-scoring/42-RESEARCH.md` — Jaccard scoring implementation: documents lexical overlap limitations and the need for stratified baseline computation
- Project execution history: `.planning/PROJECT.md` — v9.0 Skill Relevance Scoring (Jaccard + cold-start + decay): the scoring approach that v14.0 reuses and extends
- Research on automation bias: [Exploring automation bias in human-AI collaboration (Springer, 2025)](https://link.springer.com/article/10.1007/s00146-025-02422-7) — anchoring effect: users rely on initial suggestions and make more errors when system strengths appear early
- Research on anchoring: [Anchoring Bias Affects Mental Model Formation and User Reliance in Explainable AI Systems (ACM IUI 2021)](https://dl.acm.org/doi/10.1145/3397481.3450639) — algorithmic suggestions anchor and influence human judgments even when incorrect
- Research on prompt evaluation: [Evaluating Prompt Effectiveness (Portkey AI, 2025)](https://portkey.ai/blog/evaluating-prompt-effectiveness-key-metrics-and-tools/) — single metrics are insufficient; chasing high scores leads to rigid prompts; metrics are proxies, not goals
- Research on similarity systems: [One-Stop Guide for Production Recommendation Systems (Medium, 2025)](https://medium.com/@zaiinn440/one-stop-guide-for-production-recommendation-systems-9491f68d92e3) — content-based filtering over-specialization and cold-start problems; norm sensitivity in dot-product similarity
- GSD framework constraints: `.planning/PROJECT.md` Constraints section — zero-external-dependency constraint eliminates embedding-based semantic similarity; Jaccard is the correct choice within the constraint but requires structural enrichment to avoid false positives

---
*Pitfalls research for: v14.0 Planning Intelligence — adding plan reuse, task composition, milestone decomposition, and prompt quality scoring to GSD framework*
*Researched: 2026-04-04*
