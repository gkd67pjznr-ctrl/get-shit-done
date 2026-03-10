# Phase 22: Data Layer and Correction Capture - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Hook-based correction detection with structured JSONL storage and rotation. Captures corrections through three channels (self-report, edit detection, revert detection), diagnoses root cause using a 14-category two-tier taxonomy, stores entries in corrections.jsonl, and rotates archives when line count exceeds threshold. This phase delivers the raw data layer — preference tracking, recall, and analysis are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Correction Detection Triggers
- Three detection channels:
  1. **Claude self-report** — When Claude recognizes it's being corrected, it writes the correction entry as part of its response flow. Primary channel.
  2. **Edit-based detection** — PostToolUse hook detects when user modifies files Claude touched in the same session. For users who manually edit code.
  3. **Revert detection** — PostToolUse hook watches for git revert/reset of Claude's commits.
- Hook assignments: PostToolUse for edit-based and revert detection, UserPromptSubmit not needed (self-report handles verbal corrections)
- Self-report is the primary mechanism — Claude writes correction entries inline when it recognizes a correction

### Diagnosis Taxonomy
- 14-category, two-tier taxonomy with dot-notation grouping:
  - **Code categories (7):**
    - `code.wrong_pattern` — Used wrong approach/algorithm
    - `code.missing_context` — Didn't read relevant code first
    - `code.stale_knowledge` — Outdated API, deprecated method
    - `code.over_engineering` — Added unnecessary complexity
    - `code.under_engineering` — Cut corners, incomplete implementation
    - `code.style_mismatch` — Didn't match user conventions
    - `code.scope_drift` — Did more or less than asked
  - **Process categories (7):**
    - `process.planning_error` — Bad approach chosen upfront
    - `process.research_gap` — Didn't look up docs/code
    - `process.implementation_bug` — Logic error in written code
    - `process.integration_miss` — Broke existing connections
    - `process.convention_violation` — Didn't follow project rules
    - `process.requirement_misread` — Misunderstood the ask
    - `process.regression` — Broke something that worked
- Cardinality: One required `diagnosis_category`, optional `secondary_category`
- Diagnosis text follows structured template: "Did X because Y. Should have done Z." — under 100 tokens

### Storage Schema
- File: `.planning/patterns/corrections.jsonl` (same directory as sessions.jsonl)
- Required fields per entry:
  - `correction_from` — Summary description of what was done wrong (under 200 chars)
  - `correction_to` — Summary description of what should have been done (under 200 chars)
  - `diagnosis_category` — Primary category from 14-category taxonomy (e.g., `code.missing_context`)
  - `secondary_category` — Optional secondary category (nullable)
  - `diagnosis_text` — Structured "Did X because Y. Should have done Z." (under 100 tokens)
  - `scope` — Correction scope (file/filetype/phase/project/global)
  - `phase` — Phase number when correction occurred
- Additional metadata:
  - `timestamp` — ISO timestamp
  - `session_id` — Current session identifier
  - `milestone` — Current milestone version
  - `source` — Detection channel: `"self_report"` | `"edit_detection"` | `"revert_detection"`

### Rotation and Retention
- Rotation trigger: Line count exceeds 1000 (matches `observation.max_entries` config)
- Check-and-rotate on each correction write, inside the hook/write function
- Archive naming: `corrections-YYYY-MM-DD.jsonl` (date-stamped, sequence number if multiple rotations in one day)
- Retention cleanup runs during rotation — scan for and delete archives older than `retention_days` (90 default from config)
- Active file is always `corrections.jsonl`

### Claude's Discretion
- Exact hook implementation details (JS vs shell for PostToolUse handlers)
- How session file tracking works for edit-based detection (temp file, env var, etc.)
- How self-report integrates into Claude's response flow (workflow step, inline instruction, etc.)
- Whether to create `.planning/patterns/` directory if missing or report error with fix command

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hooks/gsd-snapshot-session.js`: Reference implementation for JSONL append with silent failure pattern
- `src/types/learning.ts`: Existing `FeedbackEvent`, `CorrectionAnalysis` types — inform schema design
- `src/integration/config/schema.ts`: `ObservationSchema` with `retention_days`, `max_entries`, `capture_corrections` — config already supports this phase
- `hooks/session-state.sh`, `hooks/phase-boundary-check.sh`: Existing PostToolUse hooks to reference for hook registration patterns

### Established Patterns
- JSONL format: one compact JSON object per line, newline-terminated
- Provenance tracking via `source` field (established in Phase 15 with `"hook"`, `"scan"`, `"workflow"`)
- `.planning/patterns/` is the canonical observation data directory
- Config path: `.planning/config.json` → `adaptive_learning.observation.*`

### Integration Points
- PostToolUse hook registration in project's hooks configuration
- `.planning/patterns/corrections.jsonl` as the write target
- `adaptive_learning.observation.max_entries` config for rotation threshold
- `adaptive_learning.observation.retention_days` config for archive cleanup
- Downstream consumers: Phase 23 (preference tracking), Phase 24 (recall), Phase 25 (observer agent)

</code_context>

<specifics>
## Specific Ideas

- Self-report is the primary correction channel — Claude recognizes corrections and logs them inline
- Edit-based detection exists for other GSD users who manually edit code (this is a shared tool via git)
- Diagnosis template "Did X because Y. Should have done Z." ensures entries are actionable and parseable
- Two-tier taxonomy enables both detailed per-category analysis and tier-level aggregation (all code vs all process issues)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-data-layer-and-correction-capture*
*Context gathered: 2026-03-10*
