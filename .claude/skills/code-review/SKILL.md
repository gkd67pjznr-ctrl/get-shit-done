---
name: code-review
description: Reviews code for bugs, style, and best practices. Use when reviewing PRs or checking code quality.
---

# Code Review

## Adaptive Review Focus

Before starting a review, check if `.planning/patterns/review-profile.json` exists in the project root:

- If the file exists, read it and extract the `weights` object.
- Categories with weight > 0.15 are high-priority for this project based on correction history.
- In your review, give **more attention** to checklist items that map to high-weight categories:
  - `code.wrong_pattern` / `code.stale_knowledge` / `code.style_mismatch` → Correctness and style sections
  - `code.over_engineering` / `code.under_engineering` → Maintainability section
  - `code.scope_drift` / `process.scope_drift` → Flag out-of-scope changes explicitly
  - `process.implementation_bug` / `process.integration_miss` / `process.regression` → Correctness and edge-case depth
  - `process.convention_violation` → Flag all style/convention issues regardless of severity level
- List the top weighted categories at the top of your review output under a "**Focus areas (from correction history):**" label.
- If the file does not exist or cannot be read, proceed with the standard balanced checklist below.

## Checklist

**Correctness:** Logic errors, edge cases, off-by-one, resource leaks, race conditions, error handling

**Security:** Input validation, injection (SQL/XSS), auth/authz, secrets exposure, CSRF

**Performance:** N+1 queries, redundant work, memory leaks, blocking I/O, missing indexes

**Maintainability:** Clear naming, single responsibility, DRY, test coverage

## Severity

| Level | Action |
|-------|--------|
| CRITICAL | Security/data-loss risk — must fix |
| MAJOR | Bug/performance — should fix |
| MINOR | Code smell — consider fixing |
| STYLE | Formatting — optional |

## Comment Format

```
### [SEVERITY] Brief description
**File:** path:line
**Issue:** What's wrong
**Suggestion:** Proposed fix
```

## Flag These

- `== true/false` → use boolean directly
- `catch(e) {}` → swallowed error
- Magic numbers → named constants
- Deep nesting → early returns
- Commented-out code → delete it

## Learned Patterns
- [process.regression] User reverted Claude's commit or file changes
- [process.regression] User reverted Claude's commit or file changes
- [process.regression] User reverted Claude's commit or file changes
