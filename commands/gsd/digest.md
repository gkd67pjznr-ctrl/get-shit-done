---
name: gsd:digest
description: Generate a learning digest — patterns, activation history, phase trends, and recommendations from session data
allowed-tools:
  - Read
  - Bash
  - Glob
---

# /gsd:digest -- Generate learning digest from session observation data

<objective>
Generate a comprehensive learning digest by analyzing all session observation data in sessions.jsonl. Surface commit type distribution, phase activity breakdown, temporal trends, correction rate analysis, activation history, and actionable recommendations. This command closes the learning loop by turning raw observation data into insights.
</objective>

<process>

## Step 1: Read integration config

Read `.planning/config.json` using the Read tool. Extract observation settings:
- `adaptive_learning.observation.retention_days` -- how long to keep data (default: 30)
- `adaptive_learning.suggestions.min_occurrences` -- threshold for pattern suggestions (default: 3)

If the file is missing, use defaults and proceed.

Also read `.planning/STATE.md` to get the current phase and plan context. This helps contextualize recommendations (e.g., which phase is active now vs. historical data).

## Step 1.5: Run Monitoring Scan (MON-03)

Before analyzing session data, run a monitoring scan to capture any recent changes not yet recorded.

Follow the same monitoring scan process described in `/gsd:session-start` Step 1. This ensures the digest includes the very latest plan-vs-summary diffs, STATE.md transitions, and ROADMAP.md changes.

If the scan produces new observations, they will be included in the subsequent session data analysis.

## Step 1.7: Run Observer Analysis

Run the pattern observer to aggregate correction patterns and generate/update skill refinement suggestions:

```bash
node .claude/hooks/lib/analyze-patterns.cjs "$(pwd)"
```

- If the command exits 0, proceed.
- If the command fails (non-zero exit or DEBUG_OBSERVER output shows `analyzed: false`), log a note but continue — observer failure must not block the digest.
- The result is written to `.planning/patterns/suggestions.json`.

If new suggestions were written, they will be surfaced in Step 5 (Recommendations). If the observer was suppressed by guardrails (cooldown, threshold), that is normal — the `skipped_suggestions` log in suggestions.json captures the reason.

## Step 2: Load session data

### 2a. Load current project sessions

Read `.planning/patterns/sessions.jsonl` using the Read tool.

- If the file does not exist or is empty, note that the current project has no session data.

### 2b. Load sessions from all registered projects (cross-project)

Read `~/.gsd/dashboard.json` using the Read tool.

- If the file does not exist or contains no projects, skip this step and note: "No registered projects found. Only current project data analyzed."
- If the file exists and has a `projects` array, iterate over each project entry (each has a `name` and `path` field).
- For each registered project, attempt to read `<project.path>/.planning/patterns/sessions.jsonl`.
- If a project's file does not exist, skip it silently.
- Tag each entry with its source project: when analyzing, note which project each entry came from.
- Combine all entries (current project + all registered projects) into a single dataset.
- Deduplicate entries that appear in both the current project file and the registered project file for the same path (this can happen if the current project is also registered).

At the top of the digest output, note:
```
**Sources:** Current project + N registered projects (M with session data)
```

### 2c. Combined dataset

Proceed with the combined dataset for all subsequent analysis steps (3a through 3f). When showing phase activity (step 3b), include a "Project" column to show which project each phase belongs to when multiple projects are analyzed.

If the combined dataset is empty, display:
  > No session data available. Session observations are captured by the post-commit hook. Make some commits and try again.
  Then stop.

- Parse each line as JSON. Count total entries.
- Note: if the file is very large (more than 500 lines), mention that analysis may take a moment.

## Step 3: Compute pattern analysis

### 3a. Commit type distribution

Count occurrences of each `commit_type` across all entries. Display as a visual distribution with bar charts:

```
### Commit Type Distribution
feat:     ████████████ 45 (38%)
fix:      ████████ 30 (25%)
test:     ██████ 22 (18%)
docs:     ███ 12 (10%)
other:    ██ 8 (7%)
refactor: █ 3 (2%)
```

Sort by count descending. Use unicode block characters for the bars. Scale bars proportionally so the largest type gets approximately 12 blocks.

### 3b. Phase activity

Group entries by the `phase` field. For each phase, compute:
- Total commits
- Date range (earliest to latest entry timestamp)
- Dominant commit type (most frequent type in that phase, as percentage)

Display as a table, sorted by phase number descending (most recent first):

```
### Phase Activity
| Phase | Commits | Date Range | Dominant Type |
|-------|---------|------------|---------------|
| 85    | 15      | Feb 12     | test (40%)    |
| 84    | 22      | Feb 12     | feat (55%)    |
| 83    | 18      | Feb 11-12  | feat (50%)    |
```

Highlight the most active phase with a note.

### 3c. Temporal trends

Group entries by date (extract date from `timestamp`). Show commits per day:

```
### Temporal Trends
| Date       | Commits | Types                    |
|------------|---------|--------------------------|
| 2026-02-12 | 35      | feat(15) test(12) fix(8) |
| 2026-02-11 | 22      | feat(10) fix(7) docs(5)  |
```

If there are entries with `source: "manual"`, note those separately:
- "Includes [N] manual observations."

### 3d. Correction patterns

Look for `fix` commits that follow `feat` commits on the same phase. Calculate a correction rate per phase:

```
correction_rate = fix_commits / feat_commits
```

Display phases with correction rates above 0.3 (30%):

```
### Correction Patterns
| Phase | Feat | Fix | Rate | Assessment          |
|-------|------|-----|------|---------------------|
| 84    | 10   | 5   | 50%  | Consider more TDD   |
| 83    | 15   | 3   | 20%  | Healthy range       |
```

If no phases have correction rates above 0.3, display: "All phases within healthy correction range."

### 3e. File hotspots

If any entries have file-level data (entries with `type: "observation"` that include `files_touched`), identify files that appear most frequently:

```
### File Hotspots
- src/config/types.ts (appeared in 8 observations)
- project-claude/install.cjs (appeared in 6 observations)
```

If no file-level data is available, display: "No file-level data available. File-level observation data is captured natively during workflow commands."

### 3f. Plan-vs-summary diffs (MON-01)

Look for entries in sessions.jsonl with `type: "scan"` and `scan_type: "plan_summary_diff"`. For each diff entry, display:

```
### Plan vs Summary Diffs
| Phase-Plan | Scope Change | Emergent Work | Dropped Items |
|------------|-------------|---------------|---------------|
| 86-01      | on_track    | 0             | 0             |
| 85-03      | expanded    | 2             | 0             |
```

If any diffs show `scope_change` other than "on_track", highlight them:
- **Expanded:** "Phase N-M had emergent work not in the original plan: [list]"
- **Contracted:** "Phase N-M dropped planned items: [list]"
- **Shifted:** "Phase N-M scope shifted: different files than planned"

If no scan entries exist, display: "No plan-vs-summary diffs available. Run `/gsd:session-start` to capture a baseline scan."

### 3g. Correction analysis

Read `.planning/patterns/corrections.jsonl` using the Read tool. Also read all archive correction files matching `.planning/patterns/corrections-*.jsonl` (use Glob to find them).

Parse each line as JSON. Collect entries where `retired_at` is falsy (null, undefined, or empty string). These are the active corrections.

If no active corrections exist, display:
> No correction data available.

Otherwise, group by `diagnosis_category`. For each category compute:
- `count` — number of active corrections in this category
- `last_seen` — the maximum `timestamp` value across corrections in this category (display as date only, e.g. "Mar 10")
- `target_skill` — look up in this map:

```
code.wrong_pattern → typescript-patterns
code.missing_context → code-review
code.stale_knowledge → typescript-patterns
code.over_engineering → code-review
code.under_engineering → code-review
code.style_mismatch → typescript-patterns
code.scope_drift → gsd-workflow
process.planning_error → gsd-workflow
process.research_gap → gsd-workflow
process.implementation_bug → code-review
process.integration_miss → code-review
process.convention_violation → session-awareness
process.requirement_misread → gsd-workflow
process.regression → code-review
```

If a category is not in the map, display "—" for target_skill.

Display as a table sorted by count descending:

```
### Correction Analysis
| Category | Count | Last Seen | Target Skill |
|----------|-------|-----------|--------------|
| **code.style_mismatch** | **5** | Mar 10 | **typescript-patterns** |
| code.missing_context | 2 | Mar 09 | code-review |
```

Bold the entire row (category, count, last_seen, target_skill) for categories where count >= 3. After the table, if any category has count >= 3, add a callout on its own line:

> **3+ corrections detected** — run `/gsd:suggest` to review skill refinement suggestions.

This section shows corrections only. Preference data is not included here (preferences are visible in session-start recall).

### 3h. Plan benchmark trends

Read `.planning/patterns/phase-benchmarks.jsonl` using the Read tool.

- If the file does not exist or is empty, display: "No benchmark data available. Benchmark entries are written after plan completion."
- Parse each line as JSON. Count total entries (`N`).
- If `N < 5`, display: "Insufficient benchmark data (N={N}). Trends available after 5+ plan completions."
- If `N >= 5`, compute and display:

  **Averages (over all entries):**
  - Average correction count per plan
  - Average gate fire count per plan
  - Most common phase_type

  **By phase_type breakdown** (group entries by phase_type, compute avg corrections and avg gates for each type):

  ```
  ### Plan Benchmark Trends (N=12)
  | Phase Type     | Plans | Avg Corrections | Avg Gate Fires |
  |----------------|-------|-----------------|----------------|
  | implementation | 7     | 2.4             | 3.1            |
  | fix            | 3     | 1.0             | 1.3            |
  | research       | 2     | 0.5             | 0.0            |
  ```

  **By quality_level breakdown:**

  ```
  | Quality Level | Plans | Avg Corrections | Avg Gate Fires |
  |---------------|-------|-----------------|----------------|
  | standard      | 10    | 2.1             | 2.8            |
  | strict        | 2     | 3.5             | 4.5            |
  ```

  If any phase_type has average corrections > 3, add a callout: "> High correction rate for [type] phases. Consider TDD approach."

  **Test Count Trend** (plans with non-null test_count, ascending by timestamp):

  Filter entries to only those where `test_count` is not null. Sort ascending by timestamp. Display as:

  ```
  | Phase-Plan | Test Count | Delta | Timestamp |
  |------------|------------|-------|-----------|
  | 50-01      | 20580      | —     | Apr 04    |
  | 50-02      | 20600      | +20   | Apr 04    |
  | 51-01      | 20605      | +5    | Apr 04    |
  ```

  Display rules:
  - Phase-Plan: combine `entry.phase + "-" + entry.plan`.
  - Delta column: show `—` when `test_delta` is null, `+N` when positive, `-N` when negative, `0` when zero.
  - Timestamp: display as `Mon DD` (e.g., "Apr 04") extracted from the entry's timestamp field.
  - If no entries have non-null test_count, display: "No test count data available. Test count is captured at plan completion when the test suite runs."

### 3i. Skill quality metrics

Run the skill metrics compute command to refresh data:

```bash
node get-shit-done/bin/gsd-tools.cjs skill-metrics compute
```

Then read `.planning/patterns/skill-metrics.json` using the Read tool.

- If the file does not exist, display: "No skill metrics data. Run `gsd-tools skill-metrics compute` to generate."
- If it exists, parse and display a skill quality table sorted by correction_count descending:

```
### Skill Quality Metrics
| Skill | Corrections | Sessions | Rate | Confidence |
|-------|-------------|----------|------|------------|
| session-awareness | 82 | 0 | — | low |
| gsd-workflow | 1 | 19 | 5.3% | medium |
| code-review | 1 | 8 | 12.5% | medium |
```

Display rules:
- Show Rate as `—` when session_count is 0 (not "0%" — that implies a valid measurement)
- Include the Confidence column — do not hide low-confidence entries
- Note: `attribution_confidence: low` means insufficient session data, not that the skill is defective
- Include metadata context: "Computed at {metadata.computed_at}. Total active corrections: {metadata.total_active_corrections}. Unmapped: {metadata.unmapped_correction_count}."

### 3j. Decision tensions

Run the decision audit tool to detect corrections that contradict recorded decisions in PROJECT.md:

```bash
node .claude/hooks/lib/decision-audit.cjs "$(pwd)"
```

- The command outputs a JSON array to stdout. Parse it.
- If the command fails, produces no output, or produces invalid JSON, display:
  > No decision tensions detected.
  and continue to Step 4.
- If the parsed array is empty, display:
  > No decision tensions detected.
- If the array has one or more entries, display each as a table:

```
### Decision Tensions
| Decision | Corrections | Confidence | Evidence |
|----------|-------------|------------|----------|
| Fork the repo (not extension... | 4 | 0.12 | fix pattern to avoid forking... |
| Quality Sentinel in executor... | 3 | 0.08 | inline sentinel burns context... |
```

Display rules:
- Decision column: truncate `decision_text` to 60 characters, appending `...` if truncated.
- Corrections column: show `correction_count` as an integer.
- Confidence column: show `confidence` rounded to 2 decimal places (e.g., 0.12).
- Evidence column: take the first element of `matched_corrections`, use its `correction_to` field truncated to 50 characters, appending `...` if truncated.
- Sort rows by `correction_count` descending.

After the table, add a callout for each tension on its own line:
> **Tension:** "[decision_text truncated to 80 chars]" — [correction_count] correction(s) with avg Jaccard confidence [confidence to 2dp]. Consider whether this decision is still valid or whether the recurring mistake should be addressed.

If multiple tensions exist, display one callout per tension.

### 3k. Prompt quality scoring

Run the prompt scorer for the active milestone. The active milestone was read from `.planning/STATE.md` in Step 1 — use the `milestone:` value from the YAML frontmatter (e.g., `v14.0`). If the milestone could not be determined, pass no `--milestone` flag (shows all plans).

```bash
node get-shit-done/bin/gsd-tools.cjs prompt-score --milestone <ACTIVE_MILESTONE> --raw
```

Parse the JSON output. The output shape is:
```
{ milestone, plan_count, outlier_count, plans: [...], outliers: [...], medians: {...} }
```

Each entry in `plans` has: `plan_id`, `dominant_type`, `score_label` (e.g. "0.0x median for lib-module"), `is_outlier`.

**Rendering:**

If `plans` is empty, display:
> No completed plans found for this milestone.

Otherwise display a table:
```
### Prompt Quality (<milestone> — <plan_count> plans)
| Plan | Dominant Type | Score | Status |
|------|--------------|-------|--------|
| 90-01 | lib-module | 0.0x median for lib-module | normal |
| 91-01 | lib-module | 2.4x median for lib-module | OUTLIER |
```

If `outliers` array is non-empty, add an outliers callout block:
```
**Outliers (score > 2x type median):**
- Plan <plan_id>: <score_label>. Correction categories: <categories joined with ", "> (or "none" when empty)
```

If `outliers` array is empty, display:
> No outliers detected.

Always end the section with:
> _Prompt quality is diagnostic only — not a gate._

If the `prompt-score` command fails (non-zero exit or invalid JSON), display:
> Prompt quality data unavailable — run `gsd plan-index --rebuild` and retry.
and continue to Step 4 without stopping.

## Step 4: Activation history

Read `.planning/patterns/budget-history.jsonl` using the Read tool.

- If it exists, show which skills have been loaded and how often:
  ```
  ### Activation History
  | Skill | Activations | Last Used |
  |-------|-------------|-----------|
  | beautiful-commits | 12 | Feb 13 |
  | gsd-onboard | 10 | Feb 13 |
  ```
- If the file does not exist, display: "No activation history available."

## Step 5: Generate recommendations

Based on the analysis, generate 3-5 actionable recommendations. Apply these rules:

- **High correction rate:** If any phase has correction rate above 50%, recommend: "Phase [N] had a [X%] correction rate. Consider writing tests before implementation (TDD) for similar phases."
- **Dominant commit type:** If one type exceeds 50% of all commits, provide contextual advice:
  - Heavily feat: "Your work is heavily feature-oriented ([X%]). Ensure test coverage keeps pace."
  - Heavily fix: "High fix rate ([X%]) suggests bugs are found late. Consider earlier testing."
  - Heavily test: "Strong test focus ([X%]). Good TDD discipline."
- **Large session history:** If sessions.jsonl has more than 1000 entries, recommend: "Session history has [N] entries. Consider archiving old entries: copy the file to a backup and truncate sessions.jsonl to recent entries only."
- **Pending suggestions:** Check `.planning/patterns/suggestions.json` -- if it exists and has entries, recommend: "You have [N] pending suggestions. Run `/gsd:suggest` to review."
- **Decision tensions:** If any tensions were detected in Step 3j (the tensions array was non-empty), add: "N decision tension(s) detected. Review the Decision Tensions section and decide whether to update PROJECT.md or address the recurring mistake pattern."
- **Budget pressure:** Check `.planning/patterns/budget-history.jsonl` -- if recent entries show budget usage above 80%, recommend: "Skill budget at [X%]. Review loaded skills with `/gsd:session-start`."

Always generate at least one recommendation. If nothing specific triggers, provide a general tip based on the data.

## Step 6: Display complete digest

Format and display the complete digest:

```
# Learning Digest
**Generated:** [ISO 8601 timestamp]
**Data range:** [earliest entry date] to [latest entry date]
**Total entries:** [N]

[All sections from steps 3-5]

## Recommendations
1. [recommendation 1]
2. [recommendation 2]
3. [recommendation 3]

---
_Run `/gsd:session-start` for session briefing | `/gsd:digest` again for updated analysis_
```

**Important:** This command performs real analysis on potentially large datasets. Process data methodically, step by step. Present results in a scannable format with tables and visual elements. If sessions.jsonl exceeds 500 lines, note that analysis covers a large dataset.

</process>

<success_criteria>
- Digest displays without errors even when sessions.jsonl has only a few entries
- Graceful handling when sessions.jsonl is missing or empty (informative message, not an error)
- Commit type distribution shows visual bar chart with percentages
- Phase activity table is sorted and includes dominant type per phase
- Temporal trends show commits grouped by date
- Correction rate is calculated per phase with assessment labels
- Activation history section present (with data or "not available" message)
- At least one actionable recommendation is generated
- Recommendations reference specific phases, numbers, and thresholds
- Config is read from .planning/config.json under the adaptive_learning key (retention_days, thresholds)
- Footer links to related commands (/gsd:session-start, /gsd:digest)
- Correction analysis section (Step 3g) appears with category grouping table, sorted by count descending, with bold rows and callout for categories >= 3 corrections
- Benchmark trends present (or 'insufficient data' message shown) in Step 3h after correction analysis
- Decision Tensions section (Step 3j) appears with tension table and callouts when tensions exist, or "No decision tensions detected." when none
- Prompt Quality section (Step 3k) appears after Decision Tensions; shows per-plan score table with "Nx median for task-type" labels; outlier callout present when outliers exist; always ends with diagnostic-only disclaimer
</success_criteria>
