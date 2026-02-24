# Summary Template

Template for `.planning/phases/XX-name/{phase}-{plan}-SUMMARY.md` - phase completion documentation.

---

## File Template

```markdown
---
phase: XX-name
plan: YY
subsystem: [primary category: auth, payments, ui, api, database, infra, testing, etc.]
tags: [searchable tech: jwt, stripe, react, postgres, prisma]

# Dependency graph
requires:
  - phase: [prior phase this depends on]
    provides: [what that phase built that this uses]
provides:
  - [bullet list of what this phase built/delivered]
affects: [list of phase names or keywords that will need this context]

# Tech tracking
tech-stack:
  added: [libraries/tools added in this phase]
  patterns: [architectural/code patterns established]

key-files:
  created: [important files created]
  modified: [important files modified]

key-decisions:
  - "Decision 1"
  - "Decision 2"

patterns-established:
  - "Pattern 1: description"
  - "Pattern 2: description"

requirements-completed: []  # REQUIRED — Copy ALL requirement IDs from this plan's `requirements` frontmatter field.

# Metrics
duration: Xmin
completed: YYYY-MM-DD
---

# Phase [X]: [Name] Summary

**[Substantive one-liner describing outcome - NOT "phase complete" or "implementation finished"]**

## Performance

- **Duration:** [time] (e.g., 23 min, 1h 15m)
- **Started:** [ISO timestamp]
- **Completed:** [ISO timestamp]
- **Tasks:** [count completed]
- **Files modified:** [count]

## Accomplishments
- [Most important outcome]
- [Second key accomplishment]
- [Third if applicable]

## Task Commits

Each task was committed atomically:

1. **Task 1: [task name]** - `abc123f` (feat/fix/test/refactor)
2. **Task 2: [task name]** - `def456g` (feat/fix/test/refactor)
3. **Task 3: [task name]** - `hij789k` (feat/fix/test/refactor)

**Plan metadata:** `lmn012o` (docs: complete plan)

_Note: TDD tasks may have multiple commits (test → feat → refactor)_

## Files Created/Modified
- `path/to/file.ts` - What it does
- `path/to/another.ts` - What it does

## Decisions Made
[Key decisions with brief rationale, or "None - followed plan as specified"]

## Deviations from Plan

[If no deviations: "None - plan executed exactly as written"]

[If deviations occurred:]

### Auto-fixed Issues

**1. [Rule X - Category] Brief description**
- **Found during:** Task [N] ([task name])
- **Issue:** [What was wrong]
- **Fix:** [What was done]
- **Files modified:** [file paths]
- **Verification:** [How it was verified]
- **Committed in:** [hash] (part of task commit)

[... repeat for each auto-fix ...]

---

**Total deviations:** [N] auto-fixed ([breakdown by rule])
**Impact on plan:** [Brief assessment - e.g., "All auto-fixes necessary for correctness/security. No scope creep."]

## Quality Gates

<!-- This section is CONDITIONAL:
  - ABSENT when quality.level is "fast" (do not include, not even as empty)
  - PRESENT when quality.level is "standard" or "strict"
-->

**Quality Level:** {standard|strict}

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | [brief description] |
| 1 | context7_lookup | skipped | [reason] |
| 1 | test_baseline | passed | [N tests passing] |
| 1 | test_gate | passed | [description] |
| 1 | diff_review | passed | [description] |

**Summary:** {N} gates ran, {M} passed, {W} warned, {S} skipped, {B} blocked

<!-- If any gate blocked (strict mode only): -->
**Blocked gates:** Task {N} {gate_name} — {detail}

## Issues Encountered
[Problems and how they were resolved, or "None"]

[Note: "Deviations from Plan" documents unplanned work that was handled automatically via deviation rules. "Issues Encountered" documents problems during planned work that required problem-solving.]

## User Setup Required

[If USER-SETUP.md was generated:]
**External services require manual configuration.** See [{phase}-USER-SETUP.md](./{phase}-USER-SETUP.md) for:
- Environment variables to add
- Dashboard configuration steps
- Verification commands

[If no USER-SETUP.md:]
None - no external service configuration required.

## Next Phase Readiness
[What's ready for next phase]
[Any blockers or concerns]

---
*Phase: XX-name*
*Completed: [date]*
```

<frontmatter_guidance>
**Purpose:** Enable automatic context assembly via dependency graph. Frontmatter makes summary metadata machine-readable so plan-phase can scan all summaries quickly and select relevant ones based on dependencies.

**Fast scanning:** Frontmatter is first ~25 lines, cheap to scan across all summaries without reading full content.

**Dependency graph:** `requires`/`provides`/`affects` create explicit links between phases, enabling transitive closure for context selection.

**Subsystem:** Primary categorization (auth, payments, ui, api, database, infra, testing) for detecting related phases.

**Tags:** Searchable technical keywords (libraries, frameworks, tools) for tech stack awareness.

**Key-files:** Important files for @context references in PLAN.md.

**Patterns:** Established conventions future phases should maintain.

**Population:** Frontmatter is populated during summary creation in execute-plan.md. See `<step name="create_summary">` for field-by-field guidance.
</frontmatter_guidance>

<one_liner_rules>
The one-liner MUST be substantive:

**Good:**
- "JWT auth with refresh rotation using jose library"
- "Prisma schema with User, Session, and Product models"
- "Dashboard with real-time metrics via Server-Sent Events"

**Bad:**
- "Phase complete"
- "Authentication implemented"
- "Foundation finished"
- "All tasks done"

The one-liner should tell someone what actually shipped.
</one_liner_rules>

<quality_gates_guidance>
The Quality Gates section is populated from the `GATE_OUTCOMES` array collected during quality_sentinel execution. Each entry is `"{task_num}|{step_name}|{outcome}|{detail}"`.

**Conditional presence:**
- The section must be completely ABSENT in fast mode — not present as empty, not present with "N/A". Fast mode means no gates ran, nothing to report.
- In standard mode: outcomes are `passed`, `warned`, or `skipped`
- In strict mode: outcomes can additionally be `blocked` — blocked gates must be surfaced prominently after the summary line

**Gate names (step_name values):**
- `codebase_scan` — Targeted codebase grep for reuse candidates (Step 1)
- `context7_lookup` — Context7 library documentation query (Step 2)
- `test_baseline` — Test suite baseline before changes (Step 3)
- `test_gate` — Tests written and passing after changes (Step 4)
- `diff_review` — Staged diff self-review for issues (Step 5)

**Outcome definitions:**
- `passed` — Gate ran and found no issues
- `warned` — Gate ran and found non-blocking issues (auto-fixed in standard mode)
- `skipped` — Gate was skipped due to task type or N/A condition (not due to fast mode)
- `blocked` — Gate found blocking issues; execution halted (strict mode only)
</quality_gates_guidance>

<example>
```markdown
# Phase 1: Foundation Summary

**JWT auth with refresh rotation using jose library, Prisma User model, and protected API middleware**

## Performance

- **Duration:** 28 min
- **Started:** 2025-01-15T14:22:10Z
- **Completed:** 2025-01-15T14:50:33Z
- **Tasks:** 5
- **Files modified:** 8

## Accomplishments
- User model with email/password auth
- Login/logout endpoints with httpOnly JWT cookies
- Protected route middleware checking token validity
- Refresh token rotation on each request

## Files Created/Modified
- `prisma/schema.prisma` - User and Session models
- `src/app/api/auth/login/route.ts` - Login endpoint
- `src/app/api/auth/logout/route.ts` - Logout endpoint
- `src/middleware.ts` - Protected route checks
- `src/lib/auth.ts` - JWT helpers using jose

## Decisions Made
- Used jose instead of jsonwebtoken (ESM-native, Edge-compatible)
- 15-min access tokens with 7-day refresh tokens
- Storing refresh tokens in database for revocation capability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added password hashing with bcrypt**
- **Found during:** Task 2 (Login endpoint implementation)
- **Issue:** Plan didn't specify password hashing - storing plaintext would be critical security flaw
- **Fix:** Added bcrypt hashing on registration, comparison on login with salt rounds 10
- **Files modified:** src/app/api/auth/login/route.ts, src/lib/auth.ts
- **Verification:** Password hash test passes, plaintext never stored
- **Committed in:** abc123f (Task 2 commit)

**2. [Rule 3 - Blocking] Installed missing jose dependency**
- **Found during:** Task 4 (JWT token generation)
- **Issue:** jose package not in package.json, import failing
- **Fix:** Ran `npm install jose`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import succeeds, build passes
- **Committed in:** def456g (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both auto-fixes essential for security and functionality. No scope creep.

## Quality Gates

**Quality Level:** standard

| Task | Gate | Outcome | Detail |
|------|------|---------|--------|
| 1 | codebase_scan | passed | 2 reuse candidates evaluated |
| 1 | context7_lookup | passed | queried jose |
| 1 | test_baseline | passed | 14 tests passing |
| 1 | test_gate | passed | tests written and passing |
| 1 | diff_review | passed | clean diff |
| 2 | codebase_scan | passed | no matches in scoped grep |
| 2 | context7_lookup | skipped | already queried this session |
| 2 | test_baseline | passed | 14 tests passing |
| 2 | test_gate | skipped | no new exported logic |
| 2 | diff_review | warned | 1 finding auto-fixed |

**Summary:** 10 gates ran, 8 passed, 1 warned, 1 skipped, 0 blocked

## Issues Encountered
- jsonwebtoken CommonJS import failed in Edge runtime - switched to jose (planned library change, worked as expected)

## Next Phase Readiness
- Auth foundation complete, ready for feature development
- User registration endpoint needed before public launch

---
*Phase: 01-foundation*
*Completed: 2025-01-15*
```
</example>

<guidelines>
**Frontmatter:** MANDATORY - complete all fields. Enables automatic context assembly for future planning.

**One-liner:** Must be substantive. "JWT auth with refresh rotation using jose library" not "Authentication implemented".

**Decisions section:**
- Key decisions made during execution with rationale
- Extracted to STATE.md accumulated context
- Use "None - followed plan as specified" if no deviations

**After creation:** STATE.md updated with position, decisions, issues.
</guidelines>
