# Phase 80: Auto-Apply Safety Engine - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

High-confidence skill refinements apply automatically without human intervention, subject to all safety guardrails (confidence gate, rate limiting, high-performer skip, audit log). This phase implements the engine and all 5 safety gates. Revert command and manual fallback for failed checks are Phase 81.

</domain>

<decisions>
## Implementation Decisions

### Trigger point
- Auto-apply fires at SessionEnd, after analyze-patterns.cjs generates/updates suggestions
- Pipeline: corrections -> suggestions -> auto-apply evaluation -> apply or leave pending
- New module: `.claude/hooks/lib/auto-apply.cjs` (alongside refine-skill.cjs and analyze-patterns.cjs)
- Reuses existing `acceptSuggestion()` from refine-skill.cjs for the actual apply — same commit format, same SKILL-HISTORY.md append, same retire flow
- No recovery mechanism needed — git commit is the atomic checkpoint; interrupted applies remain as pending suggestions for next SessionEnd

### Safety gate ordering
- Fail-fast pipeline, cheapest checks first:
  1. CONFIG GATE — `adaptive_learning.auto_apply` is true? (O(1) config read)
  2. RATE GATE — skill not auto-applied in last 7 days? (O(n) JSONL scan)
  3. QUALITY GATE — skill attribution_confidence is not 'high'? (O(1) metrics read via skill-metrics.cjs)
  4. CONFIDENCE GATE — suggestion confidence > 0.95? (O(1) field check)
  5. SIZE GATE — content change < 20%? (O(n) diff calculation)
- First gate failure stops evaluation, suggestion left as pending
- Controversial flag determined by category: `code.over_engineering`, `code.scope_drift`, `process.planning_error` are controversial — skip auto-apply for these categories
- Gate failures logged to auto-applied.jsonl with action: "skipped", gate name, and reason

### Audit log format
- File: `.planning/patterns/auto-applied.jsonl` (same directory as corrections.jsonl, suggestions.json)
- Two entry types: "applied" and "skipped"
- Applied entry fields: action, suggestion_id, skill, skill_path, commit_sha, confidence, change_percent, source_corrections, timestamp
- Skipped entry fields: action, suggestion_id, skill, gate (which gate failed), reason, timestamp
- Reversal via commit SHA — Phase 81's revert command runs `git revert <commit_sha>`
- Revert lookup uses suggestion_id (no separate auto-apply ID scheme)
- No rotation needed — expected volume is ~832 entries/year max (~50KB)

### Config & opt-in UX
- Add `auto_apply: false` directly under `adaptive_learning` in config.json (boolean, default false)
- Installer (install.cjs) auto-adds the key with default false during config migration
- Missing key treated as false — feature is completely off unless explicitly enabled
- `/gsd:settings` exposes auto_apply as a toggle alongside quality level
- Session start notification: when auto-applied.jsonl has new entries since last session, show brief summary with skill names, suggestion IDs, confidence scores, and revert instructions

### Claude's Discretion
- Exact implementation of the 20% content change calculation (character-based, line-based, or diff-based)
- How to extract commit SHA from acceptSuggestion() return value (may need to extend the function)
- Session start hook integration approach (extend existing recall hook or add new check)
- Error handling within the auto-apply pipeline (consistent with silent-failure hook convention)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `refine-skill.cjs` (`acceptSuggestion()`): Handles the full apply flow — read suggestion, modify SKILL.md, git commit, append SKILL-HISTORY.md, retire corrections. Auto-apply calls this directly.
- `analyze-patterns.cjs`: Observer engine that generates suggestions.json. Auto-apply runs after this in the SessionEnd pipeline.
- `skill-metrics.cjs` (`computeAttributionConfidence()`): Returns 'high'/'medium'/'low' per skill. Used for the quality gate check.
- `CATEGORY_SKILL_MAP`: Shared between analyze-patterns.cjs and skill-metrics.cjs. Maps correction categories to target skills.

### Established Patterns
- JSONL for append-only audit logs (corrections.jsonl, gate-executions.jsonl, context7-calls.jsonl)
- Atomic file writes via tmp + rename pattern (used in analyze-patterns.cjs for suggestions.json)
- Silent failure convention — all hook utilities exit 0 and never break user workflow
- Config reads from `.planning/config.json` via direct fs.readFileSync (no loadConfig abstraction for adaptive_learning section)

### Integration Points
- SessionEnd hook (`gsd-analyze-patterns.cjs`): Auto-apply module called after analyze-patterns completes
- Session start hook (`gsd-recall-corrections.cjs`): Extend to surface auto-apply notifications
- `install.cjs`: Config migration to add auto_apply key
- `/gsd:settings` command: Add auto_apply toggle display and modification

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 80-auto-apply-safety-engine*
*Context gathered: 2026-04-04*
