---
phase: "31"
plan: "31-01"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - .planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md
must_haves:
  truths:
    - Quality gating exists at three levels (fast/standard/strict) but there is zero instrumentation of whether gates actually fire, pass, or block during real sessions
    - Gate outcomes are tracked in shell variables (GATE_OUTCOMES array) within the executor agent's session but are never persisted anywhere — they die with the session
    - corrections.jsonl captures user corrections but has no field linking a correction to which quality gate was active at the time, making correlation impossible
    - context7 usage is governed by quality.context7_token_cap (2000 tokens) but there is no record of whether context7 was actually invoked, how many tokens were consumed, or what was returned
    - The dashboard quality section renders plan-vs-summary accuracy metrics (scope_change, accuracy scores, deviation summary) but these are planning accuracy metrics, not quality gate enforcement metrics
    - Preference promotion (write-preference.cjs) promotes corrections at 3+ occurrences by category+scope — but has no field tracking which quality level was active when the correction occurred
  artifacts:
    - .planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md
  key_links:
    - agents/gsd-executor.md (quality_sentinel section, lines 128-250)
    - .claude/hooks/gsd-correction-capture.js
    - .claude/hooks/lib/write-correction.cjs
    - .claude/hooks/lib/write-preference.cjs
    - src/dashboard/metrics/quality/
    - .planning/config.json
---

# Plan 31-01: Quality Gating Metrics — Research and Scope Assessment

## Objective

Produce a research document that maps the current quality gating system, identifies what is and is not observable, proposes concrete metrics to capture, and scopes a new milestone for quality enforcement observability. This is a research-only deliverable — no implementation code.

---

## Task 1: Write quality gating research document and milestone brief

**Files:**
- `.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md` (create)

**Action:**

Create `RESEARCH.md` at `.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md` with the following sections. Each section must be filled with specific, accurate content drawn from the codebase analysis below — do not write placeholder text.

### What to document in each section:

**Section 1: Current State — What Quality Gating Does Today**

Document the three quality levels and what each enables/disables:
- `fast`: entire sentinel block skipped in gsd-executor, gsd-verifier, and gsd-plan-checker — no gates fire
- `standard`: gates run, findings are `warned` (non-blocking), outcomes tracked in GATE_OUTCOMES array
- `strict`: gates run, blocking findings cause `blocked` outcome that prevents commit

Document the five sentinel steps in gsd-executor and which quality levels activate each:
1. Codebase scan (Step 1): active in standard + strict
2. Context7 lookup (Step 2): active in standard + strict; token cap from `quality.context7_token_cap` (default 2000)
3. Test baseline (Step 3): active in standard + strict
4. Test gate (Step 4): active in standard + strict; blocking in strict
5. Diff review (Step 5): active in standard + strict

Document the GATE_OUTCOMES tracking mechanism: bash array `GATE_OUTCOMES+=("{task_num}|{step_name}|{outcome}|{detail}")` initialized per plan in the executor agent. The four outcome states: `passed`, `warned`, `skipped`, `blocked`.

Document the correction capture pipeline:
- PostToolUse hook (`gsd-correction-capture.js`) detects edit and revert signals
- `write-correction.cjs` persists to `.planning/patterns/corrections.jsonl`
- Fields captured: `correction_from`, `correction_to`, `diagnosis_category` (14-category taxonomy), `secondary_category`, `diagnosis_text`, `scope`, `phase`, `timestamp`, `session_id`, `milestone`, `source`
- `write-preference.cjs` promotes to `preferences.jsonl` at 3+ occurrences by category+scope

Document the dashboard quality metrics (planning accuracy, not gate enforcement):
- `accuracy-score.ts`: per-phase scope_change classification (on_track/expanded/contracted/shifted)
- `emergent-ratio.ts`: ratio of unplanned work
- `deviation-summary.ts`: plan deviation summaries
- `accuracy-trend.ts`: scope accuracy over time
- Source: PlanSummaryDiff entries from plan-vs-summary comparison, NOT from gate executions

**Section 2: Observability Gaps — What Is Not Captured**

Document each gap precisely:

Gap 1 — Gate outcomes are ephemeral. The GATE_OUTCOMES bash array in gsd-executor lives only for the duration of the session. Nothing persists these to disk. After session end: zero record of how many gates fired, which passed/warned/blocked, or what the detail was.

Gap 2 — No quality_level field on corrections. `corrections.jsonl` entries lack a `quality_level` field. It is impossible to answer: "Were corrections more common when running in fast mode vs standard mode?" The hook captures the correction but not the enforcement context at the time.

Gap 3 — Context7 usage is unobserved. The executor reads `quality.context7_token_cap` and is instructed to call Context7 for library lookups, but no record exists of: (a) whether Context7 was called at all, (b) how many tokens were consumed vs the cap, (c) which library/query was used, (d) whether the lookup influenced the implementation.

Gap 4 — No gate-to-correction linkage. When a correction is captured post-execution, there is no way to know which gate was supposed to catch the mistake. A `process.convention_violation` correction might have been preventable by the codebase scan gate — but there is no data to confirm or deny this.

Gap 5 — Quality level is not surfaced in session observations. `SessionObservation` in `src/types/observation.ts` tracks `activeSkills`, `topCommands`, `topFiles`, `topTools` — but not the quality level active during the session.

Gap 6 — No gate firing rate metrics. The dashboard has no panel showing: "In standard mode, codebase scan fires N times per session on average" or "context7 is called in X% of tasks with external dependencies."

Gap 7 — No correlation between quality level and correction rate. The system cannot answer: "Do sessions in strict mode produce fewer corrections?" because quality level is absent from the corrections data model.

**Section 3: Proposed Metrics to Capture**

For each proposed metric, document: the metric name, what it measures, where it would be stored, and which existing file/structure would need to change.

Metric 1 — Gate execution log
- What: per-task record of which gates fired, outcome (passed/warned/skipped/blocked), and detail
- Storage: `.planning/patterns/gate-executions.jsonl`
- New fields: `session_id`, `phase`, `milestone`, `task_num`, `step_name`, `outcome`, `detail`, `quality_level`, `timestamp`
- Requires: gsd-executor to write to disk at sentinel step completion (instead of only bash array)

Metric 2 — quality_level on corrections
- What: which quality level was active when a correction was captured
- Storage: new field `quality_level` on existing corrections.jsonl entries
- Requires: `gsd-correction-capture.js` hook to read config and include `quality_level` when calling `writeCorrection()`
- Minimal change: one `config-get quality.level` call in the hook, one new field

Metric 3 — Context7 invocation log
- What: whether context7 was called, which library, what query, tokens consumed vs cap, whether result was used
- Storage: `.planning/patterns/context7-calls.jsonl`
- New fields: `session_id`, `phase`, `task_num`, `library`, `query`, `tokens_requested`, `tokens_cap`, `capped`, `result_used`, `timestamp`
- Requires: executor agent to log before/after each context7 call

Metric 4 — quality_level on session observations
- What: the quality level active during a session
- Storage: new field `quality_level` on `SessionObservation` in `src/types/observation.ts`
- Requires: session observation writer to read config.json at capture time

Metric 5 — Gate-to-correction attribution (deferred)
- What: link a correction to the gate that should have caught it
- Notes: requires heuristic mapping from diagnosis_category to gate step (e.g., `code.wrong_pattern` → codebase_scan, `code.stale_knowledge` → context7_lookup). This is complex; flag as Phase 2 of the milestone.

Metric 6 — Dashboard gate health panel
- What: dashboard panel showing gate firing rates, block rates, and quality level distribution across recent sessions
- Storage: reads from gate-executions.jsonl and sessions.jsonl
- Requires: new dashboard metrics renderer consuming gate-executions data

**Section 4: Milestone Scope — Quality Enforcement Observability**

Write a milestone brief for a new milestone titled "v7.0 Quality Enforcement Observability" with the following phase structure:

Phase 1 — Gate Execution Persistence
- Goal: Make gate outcomes durable — write gate execution events to disk during executor runs
- Deliverables: `gate-executions.jsonl` writer library (CJS, mirrors write-correction.cjs pattern), executor agent update to call writer at each sentinel step, schema definition
- Key files: `.claude/hooks/lib/write-gate-execution.cjs` (new), `agents/gsd-executor.md` (modify sentinel section)
- Complexity: Low — mechanical addition following the correction capture pattern

Phase 2 — Quality Context on Corrections
- Goal: Add `quality_level` field to corrections so correlation analysis is possible
- Deliverables: update `gsd-correction-capture.js` to read and pass quality level, update `write-correction.cjs` validation to accept (but not require) quality_level field
- Key files: `.claude/hooks/gsd-correction-capture.js`, `.claude/hooks/lib/write-correction.cjs`
- Complexity: Low — two files, minimal change

Phase 3 — Context7 Invocation Logging
- Goal: Record every context7 call with tokens consumed vs cap
- Deliverables: context7 call log library, executor agent update to log calls
- Key files: `.claude/hooks/lib/write-context7-call.cjs` (new), `agents/gsd-executor.md` (modify context7 lookup step)
- Complexity: Low-Medium — executor modification requires care to not disrupt context7 flow

Phase 4 — Dashboard Gate Health Panel
- Goal: Surface gate enforcement metrics in the device-wide dashboard
- Deliverables: new dashboard metrics renderer for gate executions, integration with warm-tier refresh
- Key files: `src/dashboard/metrics/quality/gate-health.ts` (new), `src/dashboard/metrics/quality/index.ts` (modify)
- Complexity: Medium — follows existing renderer pattern but needs new data source

Phase 5 — Gate-to-Correction Attribution (optional / stretch)
- Goal: Heuristic mapping from correction category to the gate that should have caught it
- Deliverables: attribution analysis in digest, category-to-gate mapping table
- Complexity: Medium-High — requires defining and validating the heuristic mapping

**Section 5: Recommended Starting Point**

State which phase to implement first and why. Recommend Phase 1 (Gate Execution Persistence) as the foundation because:
- All other observability depends on having persisted gate execution data
- The pattern is identical to the existing correction capture system (well-understood, battle-tested)
- No schema changes to existing data files — additive only
- Low risk of disrupting existing executor behavior

Recommend Phase 2 (Quality Context on Corrections) as the second phase because it is a two-file change with immediate analytical value — enables the "do strict mode sessions produce fewer corrections?" query.

Flag that Phase 4 (Dashboard) should wait until Phase 1 data is present in real sessions (at least a few days of gate-executions.jsonl accumulation) so the dashboard has something to render.

**Formatting requirements for RESEARCH.md:**
- Use `##` for top-level sections, `###` for subsections
- Tables are preferred for structured data (gap inventory, proposed metrics, phase list)
- Each gap must have a unique ID (GAP-01 through GAP-07)
- Each proposed metric must have a unique ID (MET-01 through MET-06)
- The milestone brief section should include a phase table at the top with: phase number, name, complexity, deliverable count
- Total document length: target 600-900 lines — be thorough

**Verify:**
```bash
ls -la /Users/tmac/Projects/gsdup/.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md
wc -l /Users/tmac/Projects/gsdup/.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md
grep -c "^##" /Users/tmac/Projects/gsdup/.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md
grep "GAP-0[1-7]" /Users/tmac/Projects/gsdup/.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md | wc -l
grep "MET-0[1-6]" /Users/tmac/Projects/gsdup/.planning/quick/31-quality-gating-metrics-research-and-scop/RESEARCH.md | wc -l
```

**Done criteria:**
- `RESEARCH.md` exists at the specified path
- File has at least 5 top-level `##` sections
- File contains all 7 gap IDs (GAP-01 through GAP-07)
- File contains all 6 metric IDs (MET-01 through MET-06)
- File contains a milestone brief with at least 4 named phases
- No section contains placeholder text like "TODO" or "TBD"
- `wc -l` output is at least 300 lines (markdown is dense, prose fills lines)
