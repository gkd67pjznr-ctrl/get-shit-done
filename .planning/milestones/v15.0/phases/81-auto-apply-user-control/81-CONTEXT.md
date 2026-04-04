# Phase 81: Auto-Apply User Control - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can revert any auto-applied change via `/gsd:refine-skill revert <id>`, and failed auto-apply safety checks surface as normal pending suggestions in the manual review flow. Nothing is silently discarded. Also includes the `/gsd:settings` auto_apply toggle deferred from Phase 80.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Phase 81 is small (2 requirements, 1 planned plan) and builds directly on Phase 80's locked decisions. The user delegated all implementation decisions to Claude. Key constraints from Phase 80:

**Revert command:**
- Reversal mechanism: `git revert <commit_sha>` using SHA from `auto-applied.jsonl` (Phase 80 locked decision)
- Lookup key: suggestion_id (Phase 80 locked decision — no separate auto-apply ID)
- Extend `/gsd:refine-skill` command with `revert` subcommand
- Extend `refine-skill.cjs` library with `revertAutoApply()` function
- Mark reverted entries in `auto-applied.jsonl` (add `reverted: true` + timestamp)
- Handle revert conflicts, missing SHA, and already-reverted entries gracefully

**Failed check surfacing:**
- Gate failures in Phase 80 already leave suggestions as `status: 'pending'` in `suggestions.json` — they naturally appear in the manual review flow
- Verify this is actually working (no code path silently drops them)
- Consider whether failed auto-apply suggestions should be labeled differently (e.g., `auto_apply_failed: true` flag) so the user knows why they appeared

**Settings toggle:**
- `/gsd:settings` auto_apply toggle deferred from Phase 80
- Add toggle display and modification to the settings command
- Consistent with existing quality level toggle pattern

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `refine-skill.cjs` (`acceptSuggestion()`, `dismissSuggestion()`): Existing accept/dismiss library. Revert function goes alongside these.
- `auto-apply.cjs` (`appendAuditEntry()`): Audit log writer. Revert can use same JSONL append pattern to mark entries as reverted.
- `/gsd:refine-skill` command (`.claude/commands/refine-skill.md`): Existing slash command with accept/dismiss flow. Revert subcommand extends this.
- `auto-applied.jsonl`: Contains `commit_sha`, `suggestion_id`, `reversal_instructions` for each applied entry.

### Established Patterns
- `refine-skill.cjs` CLI: `node refine-skill.cjs <action> <id> [cwd]` — revert follows same pattern
- Silent failure convention: all hook utilities exit 0 and never break user workflow
- JSONL append for audit entries (never modify existing lines)
- `git revert` for reversal (Phase 80 locked decision)

### Integration Points
- `/gsd:refine-skill` command: Add `revert` subcommand handling
- `refine-skill.cjs`: Add `revertAutoApply()` function
- `auto-applied.jsonl`: Read for lookup, append reverted marker
- `suggestions.json`: Verify failed auto-apply suggestions remain as pending
- `/gsd:settings` command: Add auto_apply toggle

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

*Phase: 81-auto-apply-user-control*
*Context gathered: 2026-04-04*
