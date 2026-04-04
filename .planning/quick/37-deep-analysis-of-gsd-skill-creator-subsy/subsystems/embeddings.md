# Embeddings

## What It Is

The embeddings subsystem is gsd-skill-creator's semantic search layer, using `@huggingface/transformers` to generate vector representations of skills, corrections, and session data. It enables fuzzy, meaning-based matching when scoring skill relevance — replacing keyword overlap with semantic similarity. The subsystem sits between the observation pipeline (which produces raw correction and session data) and the skill loading pipeline (which needs to rank skills by relevance).

## How It Works

The embeddings pipeline has two operating modes depending on infrastructure availability:

**JSON-based cache mode (no postgres required)** — Skill descriptions and correction summaries are embedded at write time and stored as JSON float arrays in a local cache file (e.g., `embeddings-cache.json`). Similarity search at load time computes cosine similarity against the cache in-process. This mode requires only `@huggingface/transformers` and works on any machine with Node.js. It is the default mode and does not require postgres.

**Postgres vector storage mode** — At scale (50+ skills, large correction history), embeddings are stored in a postgres table with the `pgvector` extension. Queries use the `<=>` operator for approximate nearest-neighbor search. The `pg` dependency (`@pg` npm package) is only needed for this mode. Switching between modes is configuration-driven.

The embedding model used is a lightweight sentence-transformer (e.g., `all-MiniLM-L6-v2` or equivalent from the HuggingFace hub). Embeddings are generated at skill registration time and refreshed when skill content changes (detected by content hash comparison, the same invalidation strategy used in gsdup's `skill-metrics.cjs`).

Data flow: skill `.md` file written → content hash computed → embedding generated via `@huggingface/transformers` → stored in JSON cache (or postgres) → at session start, task description embedded → cosine similarity computed against all cached skill embeddings → ranked list returned to skill loading pipeline.

## Integration Verdict for gsdup

**Defer**

gsdup's keyword-based Jaccard scoring in `skill-metrics.cjs` is sufficient at the current 17-skill scale, and the JSON-based cache mode does not require postgres (that is a scale-up option, not a prerequisite). The integration effort is L regardless (COMPARISON.md Section 3E) because the `@huggingface/transformers` pipeline introduces model download overhead and a new dependency class. Revisit when skill count exceeds 50 — at that scale, semantic search provides genuine disambiguation value that keyword overlap cannot deliver.

## Action Items

1. Note in the v9.0 phase 42 plan that the Jaccard scoring implementation should be designed with an interface compatible with future embedding-based scoring substitution (same input/output contract, swappable implementation).
2. Track the skill count trigger (50+) in STATE.md so the Defer condition is visible without a manual audit.
