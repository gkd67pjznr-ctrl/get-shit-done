---
task: 31
type: research
title: Quality Gating Metrics — Research and Scope Assessment
date: "2026-03-10"
author: gsd-executor
---

# Quality Gating Metrics — Research and Scope Assessment

This document maps the current quality gating system, identifies what is and is not observable
about gate enforcement, proposes concrete metrics to capture, and scopes a new milestone for
quality enforcement observability. No implementation code is produced here — this is a
research-and-scope deliverable.

---

## 1. Current State — What Quality Gating Does Today

### 1.1 Quality Levels

The system defines three quality levels, configured via `quality.level` in `.planning/config.json`.
This project currently runs at `standard` (`"level": "standard"` in config.json, confirmed at time of writing).

| Level    | Sentinel Block | Gate Outcomes | Blocking Possible |
|----------|---------------|---------------|-------------------|
| `fast`   | Skipped entirely — no gates fire | None | No |
| `standard` | All five steps run | `passed`, `warned`, `skipped` | No (warnings only) |
| `strict` | All five steps run | `passed`, `warned`, `skipped`, `blocked` | Yes — `blocked` prevents commit |

**`fast` mode behavior:** The entire quality sentinel block is skipped in `gsd-executor`,
`gsd-verifier`, and `gsd-plan-checker`. No gate fires, no outcomes are recorded, no tests
are run pre/post task. Execution proceeds directly from plan parse to implementation.

**`standard` mode behavior:** All five sentinel steps run. Findings from codebase scan and
diff review produce `warned` outcomes — logged to the `GATE_OUTCOMES` bash array but non-blocking.
Tests failing in standard mode generate warnings, not blocks.

**`strict` mode behavior:** All five sentinel steps run. Blocking findings (failing tests,
diff review violations in strict context) produce `blocked` outcomes that prevent commit
and trigger the Debt Auto-Log Protocol. The executor halts the task when `blocked` fires.

### 1.2 The Five Sentinel Steps

The quality sentinel has two phases: pre-task (steps 1-3) and post-task (steps 4-5).

**Pre-Task Protocol** — runs before each `type="auto"` task:

| Step | Name | Active In | Trigger | Outcome States |
|------|------|-----------|---------|----------------|
| 1 | Codebase scan | standard + strict | Always (uses `<code_to_reuse>` from plan task) | passed, skipped |
| 2 | Context7 lookup | standard + strict | Conditional: external lib deps present | passed, skipped |
| 3 | Test baseline | standard + strict | Always | passed, warned |

**Post-Task Protocol** — runs after all files written, before commit:

| Step | Name | Active In | Trigger | Outcome States |
|------|------|-----------|---------|----------------|
| 4 | Test gate | standard (new `.cjs/.js/.ts` only), strict (always) | New exported logic | passed, skipped, blocked |
| 5 | Diff review | standard + strict | Always | passed, warned, blocked |

#### Step 1: Targeted Codebase Scan

Reads `<code_to_reuse>` from the current plan task. If the task specifies `Known:` entries,
the executor evaluates each as a reuse candidate. If `Grep pattern:` lines are provided, it
runs each pattern capped at `| head -10`. If `N/A`, it falls back to a generic grep scoped
to the task's touch directories.

The purpose is to prevent duplicate code by surfacing existing implementations before any
new code is written. The reuse decision is documented in the commit message.

#### Step 2: Context7 Lookup

Reads `<docs_to_consult>` from the current plan task. If a `Context7:` entry specifies a
library and query, the executor calls `mcp__context7__resolve_library_id` followed by
`mcp__context7__query_docs` with the token cap from `quality.context7_token_cap`
(default: 2000 tokens, configured in `.planning/config.json`).

The lookup is skipped entirely when `<docs_to_consult>` says `N/A — no external library
dependencies`. One Context7 query is permitted per plan execution maximum.

#### Step 3: Test Baseline

Runs `node --test tests/*.test.cjs 2>&1 | tail -3` and records the passing count before
changes. A red baseline is `warned` (not blocked) and documented under "Issues Encountered"
in SUMMARY.md.

#### Step 4: Test Gate

In `standard` mode: fires only when the task produces a new `.cjs`, `.js`, or `.ts` file
with exports that is not in `quality.test_exemptions`. In `strict` mode: fires for every
task regardless. Files matching exemption patterns (`.md`, `.json`, `templates/**`,
`.planning/**`) are always exempt.

If `<tests_to_write>` specifies a file path and behaviors, the executor uses those. If the
task specifies `N/A — no new exported logic` but produces exported logic anyway, the
executor writes tests and logs the deviation.

In strict mode, failing tests produce a `blocked` outcome and halt the task.

#### Step 5: Diff Review

Runs `git diff --staged` and self-reviews for: naming conflicts, logic duplication found in
step 1, leftover `TODO`/`FIXME` comments in changed lines, and unhandled error paths. Auto-
fixable findings are handled inline and reported as `warned`. Issues that exceed the fix
attempt limit or require architectural changes escalate to Rule 4.

In strict mode, unresolvable diff findings produce a `blocked` outcome.

### 1.3 Gate Outcome Tracking Mechanism

The GATE_OUTCOMES bash array is initialized once per plan (not per task) at sentinel entry:

```bash
if [ -z "$GATE_OUTCOMES_INITIALIZED" ]; then
  GATE_OUTCOMES=()
  GATE_OUTCOMES_INITIALIZED=true
fi
```

After each sentinel step, the outcome is appended:

```bash
GATE_OUTCOMES+=("{task_num}|{step_name}|{outcome}|{detail}")
```

**Field schema:**

| Field | Type | Values |
|-------|------|--------|
| `task_num` | Integer | Current task number (1, 2, 3...) |
| `step_name` | String | `codebase_scan`, `context7_lookup`, `test_baseline`, `test_gate`, `diff_review` |
| `outcome` | String | `passed`, `warned`, `skipped`, `blocked` |
| `detail` | String | Brief description (e.g., "3 reuse candidates found", "queried vitest") |

**Outcome definitions:**

- `passed` — Gate ran and found no issues
- `warned` — Gate ran and found non-blocking issues (standard mode produces warned, not blocked)
- `skipped` — Gate was conditionally skipped for this task (not due to fast mode — fast mode skips the entire sentinel)
- `blocked` — Gate found blocking issues; strict mode only; prevents commit

**Lifetime:** The `GATE_OUTCOMES` array lives only for the duration of the executor's shell
session. It is read once at SUMMARY.md creation time to populate the `## Quality Gates`
section — then it is gone. Nothing writes this data to disk beyond the SUMMARY.md text.

### 1.4 Gate Behavior Matrix

| Gate | fast | standard | strict |
|------|------|----------|--------|
| Pre-task codebase scan | Skip | Run | Run |
| Context7 lookup | Skip | Conditional (new external deps only) | Always |
| Test baseline record | Skip | Run | Run |
| Test gate (new logic) | Skip | New `.cjs/.js/.ts` with exports only | Always |
| Post-task diff review | Skip | Run | Run |

### 1.5 Correction Capture Pipeline

The correction pipeline runs independently of the quality sentinel. It is driven by a
PostToolUse hook (`gsd-correction-capture.js`) that fires on every tool call.

**Detection channels:**

| Channel | Trigger | Source Label |
|---------|---------|--------------|
| Edit detection | External mtime/size change on a file Claude wrote | `edit_detection` |
| Revert detection | Bash command matching `git revert`, `reset --hard`, `checkout --`, or `restore` | `revert_detection` |
| Self-report | Executor explicitly calls writeCorrection() | `self_report` |

**Persistence:** `write-correction.cjs` appends to `.planning/patterns/corrections.jsonl`.
The file rotates to a dated archive (`corrections-YYYY-MM-DD.jsonl`) when it reaches
`adaptive_learning.observation.max_entries` (default: 1000). Archives older than
`retention_days` (default: 90) are deleted automatically.

**Fields captured per correction entry:**

| Field | Type | Description |
|-------|------|-------------|
| `correction_from` | string (≤200 chars) | What Claude did that was wrong |
| `correction_to` | string (≤200 chars) | What the correction indicates Claude should have done |
| `diagnosis_category` | string | One of 14 categories (see taxonomy below) |
| `secondary_category` | string or null | Optional secondary category |
| `diagnosis_text` | string (≤100 words) | Root-cause explanation |
| `scope` | string | `file`, `project`, etc. |
| `phase` | integer | GSD phase number at time of correction |
| `timestamp` | ISO 8601 string | When the correction was captured |
| `session_id` | string | Claude session identifier |
| `milestone` | string | Active milestone (e.g., `v6.0`) |
| `source` | string | `edit_detection`, `revert_detection`, or `self_report` |

**14-category diagnosis taxonomy:**

| Category | Description |
|----------|-------------|
| `code.wrong_pattern` | Used an incorrect pattern for the situation |
| `code.missing_context` | Missing relevant codebase knowledge |
| `code.stale_knowledge` | Outdated knowledge about library or API |
| `code.over_engineering` | Overcomplicated solution |
| `code.under_engineering` | Undersized/insufficient solution |
| `code.style_mismatch` | Output did not match project style |
| `code.scope_drift` | Went beyond or short of task scope |
| `process.planning_error` | Plan was wrong or incomplete |
| `process.research_gap` | Failed to look up necessary information |
| `process.implementation_bug` | Logic bug in implementation |
| `process.integration_miss` | Failed to integrate with existing system |
| `process.convention_violation` | Violated project convention |
| `process.requirement_misread` | Misunderstood a requirement |
| `process.regression` | Broke existing behavior |

**Preference promotion:** `write-preference.cjs` is called after each correction write (via
`checkAndPromote()`). It scans all corrections (active + archived) and counts entries matching
both `diagnosis_category` and `scope`. When the count reaches 3, it upserts a preference
entry to `preferences.jsonl` with a confidence score of `count / (count + 2)`.

The promotion threshold is documented in `adaptive_learning.suggestions.min_occurrences` (=3)
in config.json, though `write-preference.cjs` currently hard-codes the threshold to 3 and does
not read this config key.

### 1.6 Dashboard Quality Metrics

The dashboard renders quality metrics via `src/dashboard/metrics/quality/`. These are
**planning accuracy metrics, not gate enforcement metrics.**

The `assembleQualitySection()` function in `index.ts` combines four renderers:

| Renderer | Source Data | What It Shows |
|----------|-------------|---------------|
| `accuracy-score.ts` | `PlanSummaryDiff[]` from plan-vs-summary diff | Per-phase scope classification: `on_track`, `expanded`, `contracted`, `shifted` |
| `emergent-ratio.ts` | `PlanSummaryDiff[]` | Ratio of unplanned work vs planned work |
| `deviation-summary.ts` | `PlanSummaryDiff[]` | Plan deviation summaries (what changed from plan to summary) |
| `accuracy-trend.ts` | `PlanSummaryDiff[]` | Scope accuracy trend over time (improving/degrading planning quality) |

**Critical distinction:** `PlanSummaryDiff` entries are produced by comparing PLAN.md files
against SUMMARY.md files — they measure how accurately Claude planned the work. They have
**zero connection** to gate execution data. The dashboard currently has no panel that reflects
whether codebase scan ran, whether context7 was called, or whether any gate produced a
`warned` or `blocked` outcome.

---

## 2. Observability Gaps — What Is Not Captured

The following gaps were identified by tracing the flow from gate execution through to
persistent storage and dashboard rendering.

### Gap Inventory

| ID | Gap | Impact |
|----|-----|--------|
| GAP-01 | Gate outcomes are ephemeral | Cannot answer: how many gates fired this week? Which ones blocked? |
| GAP-02 | No `quality_level` field on corrections | Cannot correlate quality mode to correction rate |
| GAP-03 | Context7 usage is unobserved | Cannot measure: was context7 actually called? How many tokens? |
| GAP-04 | No gate-to-correction linkage | Cannot identify which gate failed to catch a defect |
| GAP-05 | Quality level absent from session observations | Session-level analytics missing enforcement context |
| GAP-06 | No gate firing rate metrics in dashboard | No visibility into sentinel step coverage over time |
| GAP-07 | No quality-mode-to-correction-rate correlation | Cannot evaluate ROI of strict vs standard mode |

### GAP-01: Gate Outcomes Are Ephemeral

**Description:** The `GATE_OUTCOMES` bash array in `gsd-executor` lives only for the duration
of the executor's shell session. The SUMMARY.md `## Quality Gates` table is the only human-
readable artifact, but it is a formatted narrative, not a machine-readable data source.

**What is lost:** After session end, there is zero record of:
- How many gates fired across all tasks in the plan
- Which gates produced `warned` vs `passed` vs `blocked` outcomes
- The detail text for each outcome (e.g., "3 reuse candidates found")
- The quality level at the time of execution

**Why it matters:** Without persisted gate execution data, it is impossible to build any
time-series view of gate enforcement, identify which gates consistently produce warnings,
or detect drift in quality gate behavior over time.

**Affected files:** `agents/gsd-executor.md` (quality_sentinel section), no disk writer exists.

### GAP-02: No `quality_level` Field on Corrections

**Description:** Correction entries in `corrections.jsonl` (written by `write-correction.cjs`)
contain `phase`, `milestone`, `session_id`, `timestamp`, `scope`, `source`, and all diagnosis
fields — but no `quality_level` field. The hook (`gsd-correction-capture.js`) does not read
`quality.level` from config.json at the time of correction capture.

**What is lost:** It is impossible to answer: "Were corrections more common when running in
`fast` mode (no gates) vs `standard` mode (gates active)?" or "Does `strict` mode reduce the
rate of `code.wrong_pattern` corrections?"

**Why it matters:** The correction pipeline is the primary signal for adaptive learning.
Without enforcement context, the learning system cannot distinguish between corrections that
occurred despite gate enforcement and corrections that occurred because gates were disabled.

**Affected files:** `.claude/hooks/gsd-correction-capture.js`, `.claude/hooks/lib/write-correction.cjs`.

### GAP-03: Context7 Usage Is Unobserved

**Description:** The executor reads `quality.context7_token_cap` (default: 2000) and is
instructed to call `mcp__context7__resolve_library_id` + `mcp__context7__query_docs` for
external library lookups. However, no record exists of:
- (a) Whether Context7 was called at all for a given task
- (b) How many tokens were consumed vs the configured cap
- (c) Which library ID and query string were used
- (d) Whether the result influenced the implementation (subjective, but worth flagging)

The GATE_OUTCOMES array tracks the `context7_lookup` step as `passed` or `skipped`, but that
data is ephemeral (GAP-01) and contains only a brief detail string, not structured fields.

**Why it matters:** Context7 calls consume tokens from the session budget. Without visibility
into actual call frequency and token consumption, it is impossible to tune `context7_token_cap`
meaningfully or understand whether the cap is being hit in practice.

**Affected files:** `agents/gsd-executor.md` (context7_protocol section), no call log exists.

### GAP-04: No Gate-to-Correction Linkage

**Description:** When a correction is captured post-execution, there is no way to know which
gate was supposed to catch the mistake. For example:

- A `code.stale_knowledge` correction might have been preventable by the `context7_lookup` gate
- A `code.wrong_pattern` correction might have been preventable by the `codebase_scan` gate
- A `process.regression` correction might have been preventable by the `test_gate`

The correction's `source` field (`edit_detection`, `revert_detection`, `self_report`) describes
the detection channel, not the gate that should have caught the issue.

**Why it matters:** Without gate-to-correction linkage, it is impossible to evaluate gate
effectiveness. A gate that consistently fails to catch the class of mistake it is designed
for should be strengthened — but currently this failure mode is invisible.

**Affected files:** `.claude/hooks/lib/write-correction.cjs` (no gate_attribution field).

### GAP-05: Quality Level Absent from Session Observations

**Description:** `SessionObservation` in `src/types/observation.ts` tracks `activeSkills`,
`topCommands`, `topFiles`, `topTools`, `metrics`, and tier/squash metadata — but no
`quality_level` field. The session observation writer does not read `quality.level` from
config.json at capture time.

**What is lost:** Session-level analyses (e.g., "which sessions touched the most files",
"which sessions had the most tool calls") cannot be stratified by quality mode. A session
running in `fast` mode looks identical to a `strict` mode session in the observations data.

**Affected files:** `src/types/observation.ts` (SessionObservation interface), session
observation writer (wherever it reads config and writes sessions.jsonl).

### GAP-06: No Gate Firing Rate Metrics in Dashboard

**Description:** The dashboard quality section (`src/dashboard/metrics/quality/`) has no
panel showing gate enforcement metrics. There is no rendering of:
- How many times codebase scan ran per session on average
- What percentage of tasks invoked Context7
- The distribution of gate outcomes (pass/warn/block) over recent sessions
- Which gates most frequently produce `warned` outcomes

The `assembleQualitySection()` function accepts only `PlanSummaryDiff[]` — it has no code
path that reads gate execution data because no such data exists in machine-readable form.

**Affected files:** `src/dashboard/metrics/quality/index.ts`, all four renderer files under
that directory.

### GAP-07: No Quality-Mode-to-Correction-Rate Correlation

**Description:** This gap is the compounded effect of GAP-01, GAP-02, and GAP-05. Even if
an analyst wanted to manually correlate quality mode to correction outcomes, the necessary
data does not exist in any queryable form:

- Gate execution data (which sessions ran in which mode) — not persisted (GAP-01)
- Quality level on corrections (was the gate active when the mistake was made) — not captured (GAP-02)
- Quality level on session observations (mode context for session analytics) — not present (GAP-05)

**Why it matters:** The central value proposition of quality gating is that strict enforcement
produces better outcomes. Without data, this claim cannot be validated, calibrated, or
communicated to users considering whether to invest in running `strict` mode.

**Affected files:** System-wide gap — no single file fix resolves it.

---

## 3. Proposed Metrics to Capture

For each proposed metric: what it measures, where it would be stored, and which existing
file(s) would need to change.

### Metric Inventory

| ID | Name | Storage | Complexity | Depends On |
|----|------|---------|------------|------------|
| MET-01 | Gate execution log | `.planning/patterns/gate-executions.jsonl` | Low | None |
| MET-02 | `quality_level` on corrections | Add field to `corrections.jsonl` entries | Low | None |
| MET-03 | Context7 invocation log | `.planning/patterns/context7-calls.jsonl` | Low-Medium | None |
| MET-04 | `quality_level` on session observations | Add field to `SessionObservation` type | Low | None |
| MET-05 | Gate-to-correction attribution | Add field to `corrections.jsonl` entries | Medium-High | MET-01, MET-02 |
| MET-06 | Dashboard gate health panel | New renderer in `src/dashboard/metrics/quality/` | Medium | MET-01 |

---

### MET-01: Gate Execution Log

**What it measures:** A per-task, per-gate record of which sentinel steps fired, their
outcomes, and detail text. One entry per gate step per task.

**Storage:** `.planning/patterns/gate-executions.jsonl` — append-only JSONL, one JSON object
per line. Follows the same storage pattern as `corrections.jsonl`.

**Proposed schema per entry:**

```json
{
  "session_id": "abc123",
  "phase": 23,
  "milestone": "v6.0",
  "task_num": 1,
  "step_name": "codebase_scan",
  "outcome": "passed",
  "detail": "2 reuse candidates evaluated",
  "quality_level": "standard",
  "timestamp": "2026-03-10T17:00:00.000Z"
}
```

**Fields:**

| Field | Type | Source |
|-------|------|--------|
| `session_id` | string | Session identifier (available in executor context) |
| `phase` | integer | Current GSD phase number |
| `milestone` | string | Active milestone (e.g., `v6.0`) |
| `task_num` | integer | Current task number within the plan |
| `step_name` | string | `codebase_scan`, `context7_lookup`, `test_baseline`, `test_gate`, `diff_review` |
| `outcome` | string | `passed`, `warned`, `skipped`, `blocked` |
| `detail` | string | Brief detail from GATE_OUTCOMES entry |
| `quality_level` | string | `fast`, `standard`, `strict` (read at sentinel entry) |
| `timestamp` | ISO 8601 | When the gate step completed |

**Files that need to change:**

- **New:** `.claude/hooks/lib/write-gate-execution.cjs` — writer library following the
  pattern of `write-correction.cjs`. Exports `writeGateExecution(entry, { cwd })`.
  Handles directory creation, entry validation, JSONL append, and rotation.
- **Modify:** `agents/gsd-executor.md` — quality_sentinel section, at each step where
  `GATE_OUTCOMES+=` is recorded, also call the writer. The executor already runs bash
  commands during sentinel steps; adding a `node write-gate-execution.cjs` call is additive.

**Notes:** The writer must be a CJS module (same constraint as `write-correction.cjs`) since
it is called from the executor's bash context. Rotation and retention should mirror the
corrections pattern: rotate at `max_entries`, delete archives older than `retention_days`.

---

### MET-02: `quality_level` on Corrections

**What it measures:** Which quality enforcement level was active when a correction was
captured. Enables correlation between enforcement mode and correction frequency/category.

**Storage:** New field `quality_level` on existing `corrections.jsonl` entries. No new file.

**Proposed addition to correction entry:**

```json
{
  "correction_from": "...",
  "correction_to": "...",
  "diagnosis_category": "code.wrong_pattern",
  "quality_level": "standard",
  ...existing fields...
}
```

**Files that need to change:**

- **Modify:** `.claude/hooks/gsd-correction-capture.js` — at correction write time, read
  `quality.level` from `.planning/config.json`. Minimal change: one `fs.readFileSync` call
  before `writeCorrection()`, add `quality_level` to the correction object.
- **Modify:** `.claude/hooks/lib/write-correction.cjs` — `validateEntry()` currently checks
  required fields. `quality_level` should be accepted as optional (not required) to maintain
  backward compatibility with entries written before this change. The `VALID_CATEGORIES` set
  and required fields list remain unchanged.

**Design constraint:** `quality_level` must be optional in validation to avoid breaking
existing corrections written without the field. This means corrections from before the
metric is deployed will have no `quality_level` field — downstream analysis must handle
`undefined` gracefully.

**Why this is high-value with low effort:** Two files, minimal change, immediate analytical
value. Enables the core question: "Do fast-mode sessions produce more corrections than
standard-mode sessions?"

---

### MET-03: Context7 Invocation Log

**What it measures:** Whether Context7 was called for a given task, which library was queried,
what query was used, how many tokens were requested vs the configured cap, and whether the
result was used in the implementation.

**Storage:** `.planning/patterns/context7-calls.jsonl` — append-only JSONL, one entry per
Context7 invocation.

**Proposed schema per entry:**

```json
{
  "session_id": "abc123",
  "phase": 23,
  "milestone": "v6.0",
  "task_num": 1,
  "library": "/org/vitest",
  "query": "schema validation with optional fields",
  "tokens_requested": 2000,
  "tokens_cap": 2000,
  "capped": true,
  "result_used": true,
  "timestamp": "2026-03-10T17:00:00.000Z"
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session identifier |
| `phase` | integer | GSD phase number |
| `milestone` | string | Active milestone |
| `task_num` | integer | Task number within the plan |
| `library` | string | Resolved library ID (from resolve_library_id result) |
| `query` | string | Query string passed to query_docs |
| `tokens_requested` | integer | Token count passed to query_docs call |
| `tokens_cap` | integer | Value from `quality.context7_token_cap` at call time |
| `capped` | boolean | Whether `tokens_requested` equals the cap (indicates cap was hit) |
| `result_used` | boolean | Executor self-assessment: did the result influence implementation |
| `timestamp` | ISO 8601 | When the Context7 call completed |

**Files that need to change:**

- **New:** `.claude/hooks/lib/write-context7-call.cjs` — writer library following the
  same pattern. Exports `writeContext7Call(entry, { cwd })`.
- **Modify:** `agents/gsd-executor.md` — context7_protocol section. After each
  `mcp__context7__query_docs` call, the executor adds a bash step to call the writer.
  The `result_used` field requires executor self-assessment at the point of implementation
  (before committing) — this is the most speculative part of this metric.

**Complexity note:** The `result_used` field is inherently subjective. The executor must
decide "did I actually use this?" which requires an honest self-report. Alternative: make
`result_used` optional and omit it, treating presence of any entry as evidence the call
was made. The simpler version (log that context7 was called, library, query, tokens) is
unambiguously low-complexity; `result_used` upgrades it to low-medium.

---

### MET-04: `quality_level` on Session Observations

**What it measures:** The quality enforcement level active during a session. Enables session-
level stratification: "fast mode sessions vs standard mode sessions — how do they differ in
tool usage, file touches, and duration?"

**Storage:** New field `quality_level` on `SessionObservation` in `src/types/observation.ts`.
No new file.

**Proposed type change:**

```typescript
export interface SessionObservation {
  // ...existing fields...
  activeSkills: string[];
  tier?: ObservationTier;
  squashedFrom?: number;

  // New: quality enforcement level active during this session (optional for backward compat)
  quality_level?: 'fast' | 'standard' | 'strict';
}
```

**Files that need to change:**

- **Modify:** `src/types/observation.ts` — add optional `quality_level` field to
  `SessionObservation` interface.
- **Modify:** Session observation writer — wherever `SessionObservation` is constructed
  before being written to `sessions.jsonl`, add a read of `quality.level` from config.json.
  The field is optional to maintain backward compatibility with existing session entries.

**Why optional:** Session observations are written at session end (on `clear`, `compact`,
etc.). Making `quality_level` required would invalidate all historical session observations
written before this metric is deployed. Optional preserves backward compatibility.

---

### MET-05: Gate-to-Correction Attribution (Deferred — Phase 2)

**What it measures:** A heuristic link between a correction's diagnosis category and the gate
that should have caught the mistake before commit.

**Storage:** New optional field `gate_attribution` on `corrections.jsonl` entries.

**Proposed heuristic mapping:**

| Diagnosis Category | Attributed Gate | Rationale |
|--------------------|----------------|-----------|
| `code.wrong_pattern` | `codebase_scan` | Wrong pattern = failed to find existing correct pattern |
| `code.missing_context` | `codebase_scan` | Missing context = failed to read relevant files first |
| `code.stale_knowledge` | `context7_lookup` | Stale knowledge = should have looked up current docs |
| `code.style_mismatch` | `diff_review` | Style mismatch should be caught by diff review |
| `process.regression` | `test_gate` | Regression = test should have caught it |
| `process.implementation_bug` | `test_gate` | Bug = test should have caught it |
| `process.convention_violation` | `diff_review` | Convention violation visible in diff |

**Complexity:** Medium-High. The heuristic mapping is a starting point, not ground truth. A
`code.wrong_pattern` correction might be attributable to `diff_review` if the diff contained
a duplicate pattern, or to `context7_lookup` if the wrong pattern was due to stale knowledge.
Attribution is ambiguous in many real cases.

**Recommended approach:** Implement as a post-hoc analysis script rather than real-time
attribution in the hook. The script reads corrections.jsonl and gate-executions.jsonl, applies
the heuristic mapping, and writes attribution annotations to a separate
`.planning/patterns/gate-attribution.jsonl` file. This avoids modifying the hot path of the
correction hook.

**Why deferred:** Depends on MET-01 (gate execution log) being present in production. Without
gate-executions.jsonl data showing which gates actually fired and their outcomes, attribution
analysis is speculative. Flag as Phase 2 of the v7.0 milestone.

---

### MET-06: Dashboard Gate Health Panel

**What it measures:** A new dashboard section showing gate enforcement metrics across recent
sessions: gate firing rates, outcome distributions (pass/warn/block), quality level usage
distribution, and per-gate warn rates.

**Storage:** Reads from `.planning/patterns/gate-executions.jsonl` (MET-01 output).
No new storage file needed — the renderer is a pure read path.

**Proposed panel content:**

```
Gate Health (last 30 days)
├── Quality Level Distribution: fast: 0%  standard: 87%  strict: 13%
├── Gate Firing Rate (per task): codebase_scan: 1.0  context7_lookup: 0.3  test_gate: 0.8
├── Outcome Distribution:  passed: 74%  warned: 18%  skipped: 8%  blocked: 0%
└── Top Warned Gates:  diff_review: 42%  codebase_scan: 12%
```

**Files that need to change:**

- **New:** `src/dashboard/metrics/quality/gate-health.ts` — renderer following the pattern
  of `accuracy-score.ts`. Accepts parsed gate execution data, renders HTML. Pure renderer:
  typed data in, HTML string out, no IO.
- **Modify:** `src/dashboard/metrics/quality/index.ts` — add `renderGateHealth` export and
  include it in `assembleQualitySection()`. The assembly function currently accepts only
  `PlanSummaryDiff[]` — will need a second parameter or a new overload to pass gate data.

**Data source change:** The dashboard warm-tier refresh that calls `assembleQualitySection()`
will need to also read `gate-executions.jsonl` and pass parsed data to the updated function.
This is the primary complexity driver: it touches the refresh pipeline, not just the renderer.

**Recommendation:** Wait until MET-01 has accumulated at least a few days of real data before
implementing MET-06. Rendering a gate health panel from empty data provides no value and risks
displaying misleading zeros.

---

## 4. Milestone Scope — Quality Enforcement Observability

### Milestone Brief

**Proposed milestone:** v7.0 Quality Enforcement Observability

**Goal:** Make quality gate enforcement fully observable. By end of milestone: every gate
execution is persisted to disk, every correction is tagged with the enforcement context, and
the dashboard shows real gate health metrics grounded in actual session data.

**Success criteria:**
- `gate-executions.jsonl` exists and accumulates entries in real sessions
- `corrections.jsonl` entries include `quality_level` field
- `sessions.jsonl` entries include `quality_level` field
- Dashboard gate health panel renders without errors when gate data is present
- No disruption to existing quality sentinel behavior (additive only)

### Phase Summary Table

| Phase | Name | Complexity | Deliverable Count | Depends On |
|-------|------|------------|-------------------|------------|
| 1 | Gate Execution Persistence | Low | 2 files (1 new, 1 modified) | None |
| 2 | Quality Context on Corrections | Low | 2 files (both modified) | None |
| 3 | Context7 Invocation Logging | Low-Medium | 2 files (1 new, 1 modified) | None |
| 4 | Dashboard Gate Health Panel | Medium | 2 files (1 new, 1 modified) | Phase 1 (data needed) |
| 5 | Gate-to-Correction Attribution | Medium-High | 1 new script + analysis | Phases 1 and 2 |

### Phase 1 — Gate Execution Persistence

**Goal:** Make gate outcomes durable by writing gate execution events to disk during every
executor run. This is the foundational data source for all downstream observability.

**Deliverables:**

1. **`write-gate-execution.cjs`** (new, at `.claude/hooks/lib/`)
   - CJS module following the exact pattern of `write-correction.cjs`
   - Exports `writeGateExecution(entry, { cwd })` function
   - Handles: patternsDir creation, entry validation (required fields + enum values),
     JSONL append to `gate-executions.jsonl`, rotation at maxEntries, archive cleanup
   - Schema: `session_id`, `phase`, `milestone`, `task_num`, `step_name`, `outcome`,
     `detail`, `quality_level`, `timestamp`

2. **`agents/gsd-executor.md`** (modify, quality_sentinel section)
   - At each sentinel step where `GATE_OUTCOMES+=` is recorded, add a bash call to
     `write-gate-execution.cjs` with the current step data
   - Total: 5 insertion points (one per sentinel step)
   - No behavioral change to the sentinel — purely additive logging

**Key files:**
- `.claude/hooks/lib/write-gate-execution.cjs` (new)
- `agents/gsd-executor.md` (modify sentinel section)

**Complexity rationale:** Low. The correction capture pattern is well-understood and
battle-tested. The writer library is a direct structural copy of `write-correction.cjs`
with different fields and a different target file. The executor modification is purely
additive — inserting bash calls that can fail silently without disrupting execution.

**Risk:** Near-zero. If the writer fails (ENOENT, permissions, etc.), the sentinel continues
normally. Worst case: no gate-executions.jsonl entry for that step.

### Phase 2 — Quality Context on Corrections

**Goal:** Add `quality_level` field to correction entries so that quality mode can be
correlated with correction frequency and category. Enables the foundational analytics query:
"Does strict mode reduce corrections?"

**Deliverables:**

1. **`.claude/hooks/gsd-correction-capture.js`** (modify)
   - Read `quality.level` from `.planning/config.json` before calling `writeCorrection()`
   - Add `quality_level` to the correction object passed to `writeCorrection()`
   - Fallback: if config is unreadable, omit `quality_level` (hook must not throw)

2. **`.claude/hooks/lib/write-correction.cjs`** (modify)
   - Update `validateEntry()` to accept `quality_level` as optional (not required)
   - Accept values: `'fast'`, `'standard'`, `'strict'`, or `undefined`/absent
   - No change to existing required fields — backward compatible

**Key files:**
- `.claude/hooks/gsd-correction-capture.js`
- `.claude/hooks/lib/write-correction.cjs`

**Complexity rationale:** Low. Two files, minimal changes. The hook already reads config.json
implicitly via `write-correction.cjs` (for `captureCorrections` flag). Adding one explicit
read of `quality.level` at the top of the hook is consistent with existing patterns.

**Risk:** Very low. The `quality_level` field is optional in validation — any error in reading
config simply omits the field. No existing corrections are invalidated.

### Phase 3 — Context7 Invocation Logging

**Goal:** Record every Context7 call with library, query, tokens consumed vs cap, and whether
the result was used. Enables tuning of `quality.context7_token_cap` and audit of actual
context7 utilization.

**Deliverables:**

1. **`write-context7-call.cjs`** (new, at `.claude/hooks/lib/`)
   - CJS module following the correction capture pattern
   - Exports `writeContext7Call(entry, { cwd })` function
   - Schema: `session_id`, `phase`, `milestone`, `task_num`, `library`, `query`,
     `tokens_requested`, `tokens_cap`, `capped`, `result_used`, `timestamp`

2. **`agents/gsd-executor.md`** (modify, context7_protocol section)
   - After the Context7 call sequence (resolve + query), add a bash call to the writer
   - The `result_used` field is set at implementation time (self-assessment before commit)
   - Skip condition: if context7 was skipped for the task, write a skipped entry with
     `library: null` and `result_used: false`

**Key files:**
- `.claude/hooks/lib/write-context7-call.cjs` (new)
- `agents/gsd-executor.md` (modify context7 protocol section)

**Complexity rationale:** Low-Medium. The writer library is straightforward. The executor
modification requires care: the Context7 call is an MCP tool invocation, not a bash command,
so the "log after the call" pattern must be encoded as an instruction to the executor agent
(not a bash snippet). The `result_used` self-assessment is a new concept for the executor.

**Risk:** Low. Context7 logging failure is silent. The sentinel step outcome (`context7_lookup
| passed | queried {library}`) continues to be recorded in GATE_OUTCOMES regardless.

### Phase 4 — Dashboard Gate Health Panel

**Goal:** Surface gate enforcement metrics in the device-wide dashboard so that users can
see gate activity without reading SUMMARY.md files.

**Deliverables:**

1. **`src/dashboard/metrics/quality/gate-health.ts`** (new)
   - Pure renderer: typed gate execution data in, HTML string out
   - Renders: quality level distribution, gate firing rates per task, outcome distribution,
     top warned gates
   - Follows the structural pattern of `accuracy-score.ts`

2. **`src/dashboard/metrics/quality/index.ts`** (modify)
   - Add `renderGateHealth` export
   - Update `assembleQualitySection()` to accept gate execution data as second parameter
   - Include gate health panel in the assembled HTML

3. **Dashboard warm-tier refresh** (locate and modify)
   - Add read of `gate-executions.jsonl` from each project's `.planning/patterns/`
   - Parse and pass data to updated `assembleQualitySection()`

**Key files:**
- `src/dashboard/metrics/quality/gate-health.ts` (new)
- `src/dashboard/metrics/quality/index.ts` (modify)
- Dashboard refresh pipeline (locate via `assembleQualitySection` call sites)

**Complexity rationale:** Medium. The renderer itself is low complexity (pure function,
follows established pattern). The complexity comes from: (a) modifying `assembleQualitySection`
signature (may affect callers), (b) wiring the new data source into the warm-tier refresh
pipeline, and (c) handling the case where `gate-executions.jsonl` is absent or empty.

**Hard dependency:** Phase 1 (MET-01) must be complete and accumulating real data before
Phase 4 is implemented. A dashboard panel backed by empty data provides no value.
Recommendation: wait at least 3-5 days of real sessions after Phase 1 deploys before
starting Phase 4.

### Phase 5 — Gate-to-Correction Attribution (Optional / Stretch)

**Goal:** Heuristic mapping from correction diagnosis category to the gate that should have
caught the mistake. Enables analysis of which gates are failing to prevent which error types.

**Deliverables:**

1. **Attribution analysis script** — offline script (not a real-time hook) that reads
   `corrections.jsonl` and `gate-executions.jsonl`, applies the heuristic mapping table,
   and writes a summary report to `.planning/patterns/gate-attribution.jsonl`

2. **Category-to-gate mapping table** — documented in the script and in the milestone summary.
   Starting mapping: `code.stale_knowledge` → `context7_lookup`, `code.wrong_pattern` →
   `codebase_scan`, `process.regression` → `test_gate`, `code.style_mismatch` → `diff_review`,
   `process.convention_violation` → `diff_review`, `process.implementation_bug` → `test_gate`.

**Key files:**
- `.claude/hooks/lib/write-gate-attribution.cjs` or a standalone analysis script (decision deferred to Phase 5 planning)
- Category-to-gate mapping table (to be defined during Phase 5 planning)

**Complexity rationale:** Medium-High. The heuristic mapping is not ground truth — many
corrections span multiple root causes, and attribution is inherently ambiguous. The Phase 5
risk is delivering misleading attribution data that looks authoritative but is not. This
requires careful validation: check a sample of corrections manually to confirm the mapping
produces reasonable attributions before treating the output as reliable.

**Gating requirement:** Phase 5 requires at least 2-3 weeks of gate-executions.jsonl data
(Phase 1) and corrections.jsonl with quality_level (Phase 2) before attribution analysis
is meaningful.

---

## 5. Recommended Starting Point

### Start with Phase 1 (Gate Execution Persistence)

Phase 1 is the correct first step for these reasons:

**1. Foundational data dependency.** MET-06 (Dashboard, Phase 4) and MET-05 (Attribution,
Phase 5) both require persisted gate execution data to function. Without Phase 1, those
phases have nothing to render or analyze. Phase 1 is the only phase with zero dependencies.

**2. Mechanical addition following a battle-tested pattern.** `write-correction.cjs` has been
in production through multiple milestones (v4.0, v5.0, v6.0). It has proven reliable under
the constraints of PostToolUse hook execution: CJS-only, silent failure, append-only JSONL,
rotation, retention. `write-gate-execution.cjs` is a structural copy with different fields.
The implementation risk is near-zero.

**3. Additive only — no schema changes to existing data files.** Phase 1 introduces a new
file (`gate-executions.jsonl`) and a new writer library. It does not modify `corrections.jsonl`,
`preferences.jsonl`, `sessions.jsonl`, or any existing TypeScript types. If anything goes wrong,
the new file simply does not accumulate data — no existing behavior degrades.

**4. Low executor modification risk.** The executor sentinel steps already record outcomes
via `GATE_OUTCOMES+=`. Phase 1 adds a parallel disk write at each step. If the disk write
fails (permissions, missing directory, config parse error), the sentinel continues normally.
The writer handles all errors silently, consistent with hook design principles throughout
this codebase.

### Follow with Phase 2 (Quality Context on Corrections)

Phase 2 is the correct second step because:

**1. Two-file change with immediate analytical value.** Adding `quality_level` to corrections
does not require accumulating new data — the field starts appearing on all new corrections
immediately after deployment. Within one session, you have corrections with quality context.

**2. Enables the core correlation question.** "Do fast-mode sessions produce more corrections
than standard-mode sessions?" This is the most direct test of whether quality gating is
earning its overhead. Phase 2 makes this question answerable.

**3. Backward compatible.** `quality_level` is optional — existing corrections are not
invalidated, existing tests pass without modification, and the hook's silent-failure design
means any config read error simply omits the field rather than crashing.

### Hold Phase 4 (Dashboard) Until Phase 1 Data Is Present

The dashboard gate health panel (Phase 4) should not be implemented until Phase 1 has been
running in real sessions for at least 3-5 days. Reasons:

- A gate health panel with no data would render empty state or zeros, providing no insight
- First-session data may contain anomalies from executor behavior during Phase 1 deployment
- The renderer logic should be validated against realistic data distributions, not synthetic samples

The recommended sequence: deploy Phase 1, run 3-5 normal sessions (normal GSD usage with
quality sentinel active), inspect `gate-executions.jsonl` to confirm the schema looks right,
then implement Phase 4.

### Phase 3 and Phase 5 Are Independent

Phase 3 (Context7 Invocation Logging) can be done in parallel with Phase 2 — they touch
different files with no overlap. Phase 5 (Attribution) is gated on Phase 1 and Phase 2
data accumulation and can be deferred to a later iteration of the milestone or treated as
a stretch goal if Phase 1-4 are complete ahead of schedule.

### Summary

| Priority | Phase | When | Why |
|----------|-------|------|-----|
| 1 | Phase 1 — Gate Execution Persistence | First | Foundation for all other metrics |
| 2 | Phase 2 — Quality Context on Corrections | Second | Immediate analytical value, zero dependency |
| 3 | Phase 3 — Context7 Invocation Logging | Third (parallel to 2 if possible) | Independent, tuning value |
| 4 | Phase 4 — Dashboard Gate Health Panel | After Phase 1 data accumulates | Needs real data to be useful |
| 5 | Phase 5 — Gate-to-Correction Attribution | Stretch / later | High complexity, needs 2-3 weeks of data |
