# Phase 23: Preference Tracking - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Repeated corrections are promoted to durable preferences so Claude builds persistent memory of user expectations. When the same correction pattern (category + scope) appears 3+ times, a preference is automatically created in preferences.jsonl with a confidence score. Preferences are queryable by scope for downstream recall (Phase 24). Scope escalation and cross-project promotion are separate phases (Phase 27).

</domain>

<decisions>
## Implementation Decisions

### Pattern Matching
- Two corrections are "the same pattern" when they share the same `diagnosis_category` AND `scope`
- Fixed threshold of 3 occurrences to trigger promotion (not configurable)
- All-time window — scan corrections.jsonl AND archived correction files (corrections-*.jsonl)
- Preference text comes from the most recent matching correction's `correction_to` field

### Promotion Trigger
- Promotion check runs inline after each successful `writeCorrection()` call
- New library module `write-preference.cjs` in `.claude/hooks/lib/` alongside `write-correction.cjs`
- `writeCorrection()` calls into `write-preference.cjs` after a successful write
- Upsert behavior — if a preference already exists for that category+scope, update its confidence, preference_text, updated_at, source_count, and last_correction_ts

### Preference Storage
- File: `.planning/patterns/preferences.jsonl` (same directory as corrections.jsonl and sessions.jsonl)
- No rotation — preferences are derived/curated data, one per category+scope combination, unlikely to hit volume thresholds
- JSONL format consistent with corrections.jsonl

### Preference Schema
- `category` — diagnosis_category from source corrections (e.g., `code.style_mismatch`)
- `scope` — narrowest applicable scope from source corrections (file/filetype/phase/project/global)
- `preference_text` — from latest correction_to (what the user wants)
- `confidence` — calculated as `source_count / (source_count + 2)` (0.6 at 3, 0.71 at 5, 0.83 at 10, asymptotes to 1.0)
- `created_at` — ISO timestamp of first promotion
- `updated_at` — ISO timestamp, refreshes on every upsert
- `retired_at` — ISO timestamp, nullable; null means active (soft delete pattern)
- `source_count` — number of corrections that contributed to this preference
- `last_correction_ts` — ISO timestamp of the most recent source correction

### Preference Lifecycle
- Soft delete via `retired_at` timestamp — Phase 26 sets this when preferences are baked into skill refinements
- No scope escalation in this phase — scope is set at creation from the narrowest scope of source corrections
- Phase 27 handles cross-project promotion to global scope

### Confidence Scoring
- Formula: `source_count / (source_count + 2)`
- Informational only in this phase — downstream phases (24, 25) decide how to use it
- Updated on every upsert (new correction reinforcing same category+scope)

### Query API
- Library function `readPreferences({ scope, status })` exported from write-preference.cjs
- Filters by scope and active/retired status (retired_at null = active)
- Phase 24 recall calls this function directly — no CLI overhead

### Claude's Discretion
- Whether to read all archive files synchronously or implement a caching/index strategy
- Internal implementation of JSONL upsert (read-modify-write vs temp file swap)
- Error handling strategy (silent failure like write-correction.cjs or logged warnings)
- Whether readPreferences returns parsed objects or raw JSONL lines
- Test structure and organization

</decisions>

<specifics>
## Specific Ideas

- Follow the same module pattern as write-correction.cjs: CJS, silent failure, CLI invocation support, validation before write
- Upsert means read entire preferences.jsonl, find matching entry, update in place, rewrite file — acceptable since file will be small (one entry per unique category+scope pair)
- The `source_count / (source_count + 2)` formula is a Bayesian-inspired smoothing: never reaches 1.0, starts meaningful at 3 occurrences

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.claude/hooks/lib/write-correction.cjs`: Direct template for write-preference.cjs — same directory, same CJS pattern, same silent-failure approach, same CLI invocation mode
- `.claude/hooks/lib/write-correction.cjs` → `getObservationConfig()`: Reusable for reading `.planning/config.json` settings
- `.planning/patterns/corrections.jsonl`: Source data that this phase reads and aggregates

### Established Patterns
- JSONL format: one compact JSON object per line, newline-terminated
- Silent failure: all errors caught, returned as `{ written: false, reason, error }`
- Validation before write: `validateEntry()` pattern with required field checks
- `.planning/patterns/` is the canonical observation data directory
- CJS modules in `.claude/hooks/lib/` with `module.exports` and `require.main === module` CLI support

### Integration Points
- `writeCorrection()` in write-correction.cjs needs to call promotion check after successful write
- `.planning/patterns/preferences.jsonl` as the write/read target
- `.planning/patterns/corrections.jsonl` + `corrections-*.jsonl` archives as read sources for pattern counting
- Downstream consumers: Phase 24 (readPreferences for recall), Phase 25 (observer reads preferences), Phase 26 (sets retired_at)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 23-preference-tracking*
*Context gathered: 2026-03-10*
