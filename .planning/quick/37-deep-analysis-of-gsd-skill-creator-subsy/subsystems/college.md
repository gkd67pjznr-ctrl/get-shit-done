# College

## What It Is

The College is gsd-skill-creator's hierarchical skill organization structure, providing a domain taxonomy for navigating a large skill ecosystem. It lives in `.college/` and organizes skills into departments, language panels, and cross-references under a shared Rosetta Core — a translation layer that maps concepts across programming paradigms and domains. The College is the answer to the question "where does this skill belong?" when skill count reaches the scale where a flat directory becomes unnavigable.

## How It Works

The College structure has four logical layers:

- **Rosetta Core** — the conceptual anchor at `.college/rosetta-core/`. Defines shared vocabulary and concept mappings that departments reference. When a skill in the "mathematics" department references a concept also present in "coding," Rosetta Core is the shared definition they both point to.
- **Departments** — 43 named categories under `.college/departments/` (culinary-arts, mathematics, mind-body, coding, etc.). Each department has its own skill set, calibration rules, and cross-references to other departments. Departments are the primary navigation unit for finding skills by domain.
- **Panels** — language/paradigm-specific collections under `.college/panels/` (ALGOL, C++, FORTRAN, LISP, Java, and others). Panels sit across departments: a LISP panel skill might belong to both the "mathematics" department and the "coding" department, with the panel providing the paradigm-specific framing.
- **Calibration and Safety layers** — `.college/calibration/` holds tuning data for how skills in each department should be loaded and weighted. `.college/safety/` provides guardrails for skill activation in sensitive domains (e.g., preventing a culinary-arts skill from loading in a security audit context).

Navigation works by department or panel lookup. A skill query resolves first through the panel (paradigm match), then through the department (domain match), then through Rosetta Core (concept match). The result is a ranked candidate list before the token budget filter runs.

## Integration Verdict for gsdup

**Defer**

The College runtime (calibration, safety layers, cross-references, full 43-department hierarchy) is architecturally complex and premature for gsdup's current 17-skill flat structure. The directory hierarchy pattern is worth adopting when skill count significantly exceeds 34 — the point at which a flat `.claude/skills/` becomes hard to navigate. The effort tier for the hierarchy-only adoption is S; the full runtime is M. Trigger condition: revisit when gsdup's skill count exceeds 34 or when a new milestone introduces 10+ domain-specific skills that don't fit the current flat structure.

## Action Items

1. Define 5-7 top-level skill categories for gsdup (workflow, code-quality, architecture, documentation, testing, security) as a pre-College grouping — no runtime required, just a README that maps existing skills to categories.
2. Track skill count in STATE.md so the trigger condition (exceeds 34) is visible without a manual audit.
