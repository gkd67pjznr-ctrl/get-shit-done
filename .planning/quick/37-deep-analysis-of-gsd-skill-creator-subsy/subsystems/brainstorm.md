# Brainstorm

## What It Is

The brainstorm engine is gsd-skill-creator's structured ideation subsystem, living in `src/brainstorm/`. It provides a dedicated mode — separate from plan/execute — for generating feature proposals, architecture options, and improvement candidates in a structured, reproducible format. Its key distinction from ad-hoc brainstorming is that it produces normalized output objects: each idea has a priority, a feasibility estimate, a dependency list, and a category tag, making the output directly consumable by the planning pipeline.

## How It Works

The brainstorm engine operates as a pipeline with three stages:

1. **Seed collection** — the engine takes an input prompt (a problem statement, a constraint, or a "what should we build next?" question) and generates a seed list of candidate ideas using a structured prompting strategy. Seeds are tagged with a category (feature, fix, architecture, docs, test) at generation time.

2. **Expansion and deduplication** — each seed is expanded into a full proposal object with: title, category, priority (P1–P4), feasibility (S/M/L/XL effort), dependencies (other proposals this one requires), and a one-paragraph rationale. A deduplication pass removes semantic near-duplicates before the list is finalized.

3. **Output normalization** — proposals are written to a structured Markdown file (`FEATURE-IDEAS.md` or equivalent) with a consistent schema. The output is designed to be read by the planner agent (`/gsd:plan-phase`) as a candidate input for roadmap construction.

The engine does not require embeddings for its core value — the structured output pattern and the category/priority tagging are the differentiating features, not semantic search. Optional embedding-based deduplication improves quality when available but is not required for basic operation.

## Integration Verdict for gsdup

**Integrate**

The brainstorm engine is the highest-effort-efficiency target after MCP server. Quick task 34 demonstrated that gsdup needs structured ideation — the FEATURE-IDEAS.md produced manually in that task is exactly what this engine would automate. The effort tier is S-M (COMPARISON.md Section 3F): the core logic can be adapted as a `/gsd:brainstorm` command backed by a `brainstorm.cjs` module without the embedding dependency. No postgres or external infrastructure required.

## Action Items

1. Create `get-shit-done/bin/lib/brainstorm.cjs` implementing seed collection, expansion, and normalized Markdown output — adapt the three-stage pipeline from `src/brainstorm/` without the embedding deduplication step.
2. Add a `/gsd:brainstorm` slash command at `.claude/commands/gsd/brainstorm.md` that invokes the module and writes output to `.planning/quick/<task>/FEATURE-IDEAS.md`.
3. Wire the `brainstorm` CLI subcommand to `gsd-tools.cjs` for non-interactive use.
