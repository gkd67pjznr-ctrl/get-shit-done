# Phase 24: Live Recall and Session Injection - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Claude remembers past mistakes — corrections and preferences are surfaced at session boundaries and during active work so Claude avoids repeating known errors. A new SessionStart hook loads relevant corrections and preferences into the context window. A lightweight skill hint reminds Claude to reference them during work. Corrections already baked into skill refinements (Phase 26) are excluded. The observer agent, suggestion pipeline, and skill refinement workflow are separate phases (25, 26).

</domain>

<decisions>
## Implementation Decisions

### Session-Start Injection
- New dedicated SessionStart hook: `gsd-recall-corrections.cjs` (CJS module, not ESM)
- CJS chosen to directly `require()` existing `readPreferences()` from write-preference.cjs
- Follows the same pattern as gsd-inject-snapshot.js: read data, write formatted output to stdout
- Registered as a new entry in `.claude/settings.json` SessionStart hooks array
- Add `readCorrections()` function to write-correction.cjs (mirrors readPreferences API pattern)
- No phase filtering — all active corrections shown regardless of current phase/milestone (concurrent milestones mean sessions span many phases)
- Silent when no corrections or preferences exist (no output, no noise)

### Active-Work Recall
- Lightweight skill hint in existing session-awareness skill (not a separate skill)
- Generic reminder: "Before writing code, review the correction reminders from session start"
- No mid-session re-reads — the session-start injection is sufficient; corrections are already in the context window
- Long-term, corrections get promoted to preferences, then baked into skill refinements (Phase 26), then auto-loaded as permanent memory — this recall is the bridge for the gap before that happens

### Relevance Filtering
- Recency-first ranking: most recent corrections/preferences first
- Preferences get priority slots (higher signal — promoted from 3+ corrections), then remaining slots filled with recent corrections
- Corrections that have been promoted to a preference (matching category+scope) are excluded from the corrections list (dedup — preference is the distilled version)
- Corrections/preferences with `retired_at` set are excluded (baked into skill refinements per Phase 26)
- Up to 10 entries total (preferences + corrections combined)
- Soft token limit at 3K: add entries one at a time, estimate token count via word-count proxy (consistent with write-correction.cjs approach), stop when next entry would exceed budget — no mid-entry truncation

### Output Format
- Terse bullet style: `- [category] action text`
- Two sections: "Preferences (learned):" then "Recent corrections:"
- Each entry is a single-line bullet maximizing entries per token budget
- Overflow footer: "(+N more corrections not shown — see corrections.jsonl)" when entries are truncated
- Wrapped in `<system-reminder>` tag consistent with other SessionStart hooks
- Header: "## Correction Recall"

### Claude's Discretion
- Exact implementation of readCorrections() filters and return type
- How to estimate token count (word count / 0.75 or similar proxy)
- Whether to add the skill hint as a new section in session-awareness or inline with existing guidance
- Test structure and organization

</decisions>

<specifics>
## Specific Ideas

- The recall system is explicitly a bridge mechanism — the end state is corrections → preferences → skill refinements → auto-loaded skills (permanent memory)
- Preferences-first ordering ensures the highest-signal items (reinforced by 3+ corrections) always surface
- Dedup by excluding promoted corrections prevents showing "use snake_case" as both a preference and individual corrections
- Concurrent milestone usage means phase filtering would miss relevant corrections from other milestones

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `write-preference.cjs` → `readPreferences({ scope, status })`: Ready-to-use query API for preferences, filters by active/retired
- `write-correction.cjs`: Template for readCorrections() — same CJS pattern, same directory, JSONL parsing already implemented in `countMatchingCorrections()`
- `gsd-inject-snapshot.js`: Reference for SessionStart hook pattern (read data → stdout)
- `session-awareness` skill: Existing auto-loading skill to extend with recall hint

### Established Patterns
- SessionStart hooks: CJS/ESM scripts registered in `.claude/settings.json`, output to stdout for context injection
- Silent failure: all hook errors caught, never block session start
- JSONL parsing: line-by-line, JSON.parse each line, skip malformed
- Word-count proxy for token estimation: `text.split(/\s+/).length` (established in write-correction.cjs)
- `.planning/patterns/` is the canonical observation data directory

### Integration Points
- `.claude/settings.json` → SessionStart hooks array (add new entry)
- `.claude/hooks/lib/write-correction.cjs` → add readCorrections() export
- `.claude/hooks/lib/write-preference.cjs` → readPreferences() already exported
- `.claude/skills/session-awareness/SKILL.md` → add recall hint section
- `.planning/patterns/corrections.jsonl` + `corrections-*.jsonl` as read sources
- `.planning/patterns/preferences.jsonl` as read source
- Downstream: Phase 26 sets `retired_at` on preferences/corrections baked into skills

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 24-live-recall-and-session-injection*
*Context gathered: 2026-03-10*
