---
name: correction-capture
description: Recognize when the user is correcting Claude's work and log structured correction entries for the adaptive learning system. Activates when Claude detects it is being corrected.
---

# Correction Capture

## When to Activate

Activate this skill when you recognize any of these correction signals:
- User explicitly says "no", "wrong", "that's not right", "redo", "start over"
- User rewrites or significantly edits something you just produced
- User says "I told you to do X, but you did Y"
- User reverts a file or commit you created
- User expresses dissatisfaction with your approach and provides an alternative
- User corrects a factual error or misread requirement

Do NOT activate for: clarifying questions, scope additions, natural conversation.

## Correction Entry Workflow

When you recognize a correction, IMMEDIATELY (before responding substantively):

1. Identify the correction details:
   - `correction_from`: What you did wrong (under 200 chars, descriptive)
   - `correction_to`: What you should have done (under 200 chars, descriptive)
   - `diagnosis_category`: Primary category from taxonomy below
   - `secondary_category`: Secondary category if applicable (or null)
   - `diagnosis_text`: "Did X because Y. Should have done Z." (under 100 tokens)
   - `scope`: Narrowest applicable — file, filetype, phase, project, or global
   - `phase`: Read from `.planning/STATE.md` line starting with "Phase:" (integer part only)
   - `milestone`: Read from `.planning/STATE.md` line containing "v6.0" or similar milestone marker

2. Run the write script via Bash tool:
   ```bash
   node .claude/hooks/lib/write-correction.cjs '<JSON_STRING>' "$(pwd)"
   ```
   Replace `<JSON_STRING>` with the complete entry JSON including all required fields plus `timestamp`, `session_id`, `source`, `milestone`.

3. Use `source: "self_report"`, `timestamp: new Date().toISOString()` equivalent (current ISO time), `session_id`: use the session ID from your current context (if unknown, use `"unknown"`).

## Required Entry Fields

All fields are required unless marked optional:
- `correction_from` — string, max 200 chars
- `correction_to` — string, max 200 chars
- `diagnosis_category` — string, from taxonomy (required, must be one of the 14 valid categories)
- `secondary_category` — string or null (optional)
- `diagnosis_text` — string, max 100 tokens, format: "Did X because Y. Should have done Z."
- `scope` — one of: `file`, `filetype`, `phase`, `project`, `global`
- `phase` — integer
- `timestamp` — ISO 8601 string (e.g., `2026-03-10T14:30:00.000Z`)
- `session_id` — string
- `milestone` — string (e.g., `"v6.0"`)
- `source` — always `"self_report"` for this channel

## Diagnosis Taxonomy (14 categories)

**Code tier — mistakes in the code itself:**
- `code.wrong_pattern` — Used wrong approach/algorithm
- `code.missing_context` — Didn't read relevant code first
- `code.stale_knowledge` — Outdated API or deprecated method
- `code.over_engineering` — Added unnecessary complexity
- `code.under_engineering` — Cut corners, incomplete implementation
- `code.style_mismatch` — Didn't match user's conventions
- `code.scope_drift` — Did more or less than asked

**Process tier — mistakes in how work was approached:**
- `process.planning_error` — Bad approach chosen upfront
- `process.research_gap` — Didn't look up docs or existing code
- `process.implementation_bug` — Logic error in written code
- `process.integration_miss` — Broke existing connections
- `process.convention_violation` — Didn't follow project rules
- `process.requirement_misread` — Misunderstood the ask
- `process.regression` — Broke something that worked before

## Scope Selection Guide

| Scope | Use when correction applies to... |
|-------|-----------------------------------|
| `file` | A specific file (e.g., wrong style in one file) |
| `filetype` | A file extension pattern (e.g., all `.ts` files) |
| `phase` | Current project phase only |
| `project` | This entire project |
| `global` | All projects / general behavior |

## Example Entry

```json
{
  "correction_from": "Used Array.map() to filter items, creating undefined entries",
  "correction_to": "Use Array.filter() to remove non-matching items",
  "diagnosis_category": "code.wrong_pattern",
  "secondary_category": null,
  "diagnosis_text": "Did use map with conditional because confused map with filter semantics. Should have used filter() which is the correct method for removing items.",
  "scope": "global",
  "phase": 22,
  "timestamp": "2026-03-10T14:30:00.000Z",
  "session_id": "abc123",
  "milestone": "v6.0",
  "source": "self_report"
}
```

## Anti-Patterns

- Do NOT skip this step to save time — the correction entry is more valuable than the response speed
- Do NOT write partial entries (missing required fields)
- Do NOT use diagnosis_text longer than 100 tokens
- Do NOT write a correction entry for scope expansions, clarifications, or new feature requests
- Do NOT use categories outside the 14-category taxonomy
