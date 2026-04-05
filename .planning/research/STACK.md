# Technology Stack — v14.0 Planning Intelligence

**Project:** GSD — Planning Intelligence milestone
**Researched:** 2026-04-04
**Confidence:** HIGH (all recommendations use existing Node.js built-ins or already-installed devDependencies; no new npm packages required)

---

## Executive Summary

v14.0 needs four capabilities: plan indexing, structural similarity scoring, task type classification, and milestone decomposition. After examining the full corpus size (80+ plans across v1.0-v15.0), the existing algorithmic infrastructure (Jaccard in `skill-scorer.cjs`, keyword classifier in `mcp-classifier.cjs`), and the strict file-based/zero-infrastructure philosophy of this codebase, the conclusion is:

**Zero new npm dependencies.** Every capability can be built from pure Node.js plus `gray-matter` (already a devDependency). The corpus is small enough that no index server, vector database, or ML library is needed or appropriate.

The one algorithmic upgrade worth making: replace pure Jaccard with **TF-IDF weighted cosine similarity** for plan-to-plan structural matching. The plan corpus has 80+ documents where rare structural terms ("hook-integration", "jsonl-persistence", "tdd") are highly discriminating and should score higher than common terms ("file", "test", "update"). TF-IDF achieves this; Jaccard treats all tokens equally. The implementation is ~60 lines of pure JS, requires no dependency, and fits the existing scorer pattern.

---

## Stack Additions

### No New Runtime Dependencies

| Capability | Implementation | Why Not a Package |
|------------|---------------|-------------------|
| Plan PLAN.md parsing | `gray-matter` (already `devDependencies@^4.0.3`) | Already installed; parses YAML frontmatter + body cleanly |
| TF-IDF + cosine similarity | Pure Node.js, ~60 lines | Corpus is 80-150 docs; no index server overhead justified; no package adds value over inline impl |
| Structural feature extraction | Pure Node.js regex + string ops | Extracting `task_pattern`, `tags`, `file_patterns` from PLAN.md is straightforward text parsing |
| Task type classifier | Extend `mcp-classifier.cjs` pattern | Pattern already established and tested; add 8 new planning-domain task types |
| Pre-built index file | Write JSON to `.planning/patterns/plan-index.json` | Consistent with `skill-scores.json`, `phase-benchmarks.jsonl` — file-based is the project standard |
| Milestone pattern store | Write JSON to `.planning/patterns/milestone-patterns.json` | Same pattern as plan-index |

### Existing Infrastructure Already Usable

| Asset | Where | What v14.0 Uses It For |
|-------|-------|----------------------|
| `extractFrontmatter()` | `frontmatter.cjs` | Parse `phase`, `plan`, `files_modified`, `requirements` from PLAN.md files |
| `parseJsonlFile()` | `benchmark.cjs`, `skill-scorer.cjs` | Read `phase-benchmarks.jsonl` for correction_count per plan |
| `jaccardScore()` + `tokenize()` | `skill-scorer.cjs` | Reusable as fallback scorer; export and share |
| `classifyTask()` pattern | `mcp-classifier.cjs` | Template for planning-domain task type classifier |
| `node:crypto` MD5 hash | `skill-scorer.cjs` | Content-hash cache invalidation for plan-index.json |
| `node:fs` + `node:path` | Throughout | File scanning for completed PLAN.md and SUMMARY.md files |

---

## Algorithm Selection

### Plan Similarity: TF-IDF Cosine (not pure Jaccard)

**Why TF-IDF over Jaccard for this corpus:**

Jaccard treats all tokens equally. In a plan corpus, "test", "file", and "cli" appear in nearly every plan — they contribute noise without signal. Rare structural terms like "hook-integration", "jsonl-persistence", "tdd", "dashboard-page" are the discriminating features that define plan archetypes. TF-IDF down-weights common tokens and up-weights rare ones, making it substantially better for structural similarity across 80+ plans.

Published comparison for small document sets (80-100 docs): TF-IDF cosine achieves 70-85% accuracy for semantic matching vs. Jaccard which is better suited to duplicate detection than recommendation (IJCA 2017, iq.opengenus.org 2024).

**TF-IDF implementation plan (no package needed):**

```js
// In plan-indexer.cjs — pure Node.js, ~60 lines
function buildTfIdfIndex(planEntries) {
  // planEntries = [{ plan_id, tokens: Set, ... }]
  const N = planEntries.length;
  const df = {};  // document frequency per token
  for (const entry of planEntries) {
    for (const t of entry.tokens) {
      df[t] = (df[t] || 0) + 1;
    }
  }
  // idf(t) = log(N / df(t)) — standard smoothed IDF
  const idf = {};
  for (const [t, freq] of Object.entries(df)) {
    idf[t] = Math.log(N / freq);
  }
  // tfidf vector per entry (sparse — only non-zero terms)
  for (const entry of planEntries) {
    const vec = {};
    for (const t of entry.tokens) {
      vec[t] = (1 / entry.tokens.size) * idf[t];  // tf * idf
    }
    entry.tfidf_vector = vec;
  }
  return { entries: planEntries, idf };
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, magA = 0, magB = 0;
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  for (const k of allKeys) {
    const a = vecA[k] || 0, b = vecB[k] || 0;
    dot += a * b; magA += a * a; magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

**Hybrid scoring for query-time search:**

When the planner provides a free-text new-phase goal, the corpus IDF is known but the query has no TF context. Use a hybrid:

```
final_score = 0.70 * tfidf_cosine(query, candidate)
            + 0.20 * jaccard(query_tokens, candidate_tokens)
            + 0.10 * tag_overlap(query_tags, candidate_tags)
```

Jaccard provides a fallback for new queries not represented in the IDF vocabulary. Tag overlap gives bonus weight to exact structural matches (e.g., both tagged "cli-subcommand").

### Task Classification: Keyword Rules (not ML)

The existing `mcp-classifier.cjs` pattern — keyword matching + file extension heuristics — is the right approach for planning-domain task types. The corpus is well-defined and the vocabulary is constrained. An ML classifier would need training data that doesn't yet exist and would add unnecessary complexity.

**Planning-domain task types to add** (extend the existing 5 MCP types with 8 new planning types):

| Task Type | Discriminating Keywords | File Patterns |
|-----------|------------------------|---------------|
| `test-first` | "write tests", "wave 0", "test stubs", "tdd" | `tests/*.test.cjs` |
| `lib-module` | "lib module", "cjs module", "new module", "implement" | `get-shit-done/bin/lib/*.cjs` |
| `cli-wiring` | "cli subcommand", "gsd-tools", "wire command", "route" | `get-shit-done/bin/gsd-tools.cjs` |
| `hook-integration` | "hook", "posttooluse", "pretooluse", "sessionend" | `.claude/hooks/*.js` |
| `workflow-update` | "workflow", "agent", "executor", "planner", "verifier" | `.claude/agents/*.md`, `skills/*/SKILL.md` |
| `dashboard-page` | "dashboard", "panel", "page", "chart", "metric" | `desktop/src/**` |
| `config-extension` | "config key", "config.json", "adaptive_learning", "schema" | `.planning/config.json` |
| `jsonl-persistence` | "jsonl", "append-only", "persist", "write entry" | `*.jsonl` |

### Milestone Decomposition: Pattern Extraction (not ML)

Parse ROADMAP.md files from v1.0-v15.0, extract structural patterns:
- Phase count per milestone
- Phase goal keywords (tokenized)
- Dependency chain shape (linear vs parallel vs mixed)
- Effort distribution (plan count per phase)

Store as `milestone-patterns.json`. At new-milestone time, score the user's goal description against historical milestone goals using the same TF-IDF cosine approach.

---

## Index Strategy: Pre-Built File (not Query-Time Scan)

**Decision: pre-built `plan-index.json` refreshed at `cmdMilestoneComplete`.**

Rationale from v14.0 milestone context (Key Decision Point 1):
- Query-time scanning of 80+ PLAN.md + SUMMARY.md files on every `/gsd:plan-phase` invocation is slow and wasteful
- The corpus changes only at milestone completion — rebuilding then is exactly the right trigger
- Pattern is already established: `skill-scores.json` is a pre-built cache refreshed when skills change

The index file lives at `.planning/patterns/plan-index.json`:

```json
{
  "metadata": {
    "built_at": "2026-04-04T10:00:00Z",
    "plan_count": 87,
    "milestone_range": "v1.0-v15.0"
  },
  "plans": [
    {
      "plan_id": "42-01",
      "milestone": "v9.0",
      "phase_goal": "skill relevance scoring with jaccard and dormancy decay",
      "task_pattern": ["test-first", "lib-module", "cli-wiring"],
      "file_patterns": ["get-shit-done/bin/lib/*.cjs", "tests/*.test.cjs"],
      "tags": ["tdd", "cli-subcommand", "jsonl-persistence"],
      "requirement_count": 4,
      "correction_rate": 0.12,
      "tokens": ["skill", "relevance", "scoring", "jaccard", "dormancy"],
      "tfidf_vector": { "jaccard": 0.82, "dormancy": 0.71, "scoring": 0.43 }
    }
  ],
  "idf": { "jaccard": 1.23, "dormancy": 1.45, "test": 0.12 }
}
```

**Manual rebuild flag:** `gsd-tools.cjs plan-index --rebuild` for use when adding historical milestones mid-development.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `natural` npm package | 47KB, adds IDF/stemming but more than needed for 80-doc corpus; adds binary dep risk | Pure Node.js TF-IDF ~60 lines |
| `compromise` npm package | NLP heavy-hitter, overkill for keyword matching; 1.3MB | Regex keyword rules as in `mcp-classifier.cjs` |
| `vectra` (local vector DB) | Adds JSON-lines file format with separate index management; solves a scale problem that doesn't exist here | Write `plan-index.json` directly with same pattern as `skill-scores.json` |
| Embeddings API (OpenAI, Cohere) | Requires network call per plan; adds API key management; semantic similarity beyond keyword overlap not needed for structured plan templates | TF-IDF cosine on structural tokens |
| SQLite (`better-sqlite3`) | Binary native module; overkill for read-mostly 80-150 doc index | `plan-index.json` loaded into memory at query time |
| `fuse.js` fuzzy search | Designed for UI autocomplete; not for structural plan similarity; scores don't translate to "85% similar plan" | TF-IDF + hybrid scoring above |
| `gray-matter` as runtime dep | Already a devDep; keep it there — PLAN.md parsing only runs at index-build time (developer context), not in production hooks | Import from devDeps in `plan-indexer.cjs` which is build/CLI only |

---

## Integration Points

### New Modules to Create

| Module | Location | Purpose |
|--------|----------|---------|
| `plan-indexer.cjs` | `get-shit-done/bin/lib/` | Scan PLAN.md/SUMMARY.md files, build TF-IDF index, write `plan-index.json` |
| `plan-similarity.cjs` | `get-shit-done/bin/lib/` | Query plan-index.json with cosine + Jaccard hybrid, return ranked matches |
| `task-classifier.cjs` | `get-shit-done/bin/lib/` | Extend mcp-classifier pattern with 8 planning task types |
| `milestone-analyzer.cjs` | `get-shit-done/bin/lib/` | Parse historical ROADMAP.md files, extract phase patterns, write milestone-patterns.json |

### Existing Modules to Extend

| Module | Change |
|--------|--------|
| `mcp-classifier.cjs` | Add 8 planning task types to `classifyTask()` OR extract into shared `task-classifier.cjs` that both consume |
| `benchmark.cjs` | Export `parseJsonlFile` so `plan-indexer.cjs` can read correction counts without re-implementing |
| `skill-scorer.cjs` | Export `tokenize()` and `jaccardScore()` — reused by `plan-similarity.cjs` as hybrid fallback |
| `gsd-tools.cjs` | Wire `plan-index`, `plan-similar`, `task-classify`, `milestone-patterns` subcommands |

### Trigger Points

| Event | Action |
|-------|--------|
| `cmdMilestoneComplete` | Auto-rebuild `plan-index.json` and `milestone-patterns.json` |
| `/gsd:plan-phase` (research step) | Call `plan-similar` to surface top-3 matches before planner runs |
| `/gsd:new-milestone` (questioning step) | Call `milestone-patterns` to surface phase breakdown proposal |
| `gsd-tools.cjs plan-index --rebuild` | Manual rebuild flag |

---

## No Installation Required

```bash
# No new installs. All capabilities use:
# - node:fs, node:path, node:crypto (built-in)
# - gray-matter (already devDependencies@^4.0.3)
# - frontmatter.cjs, benchmark.cjs, skill-scorer.cjs (existing lib modules)
```

---

## Version Compatibility

| Dependency | Current Version | Used By |
|------------|----------------|---------|
| Node.js | 25.x | All modules |
| `gray-matter` (devDep) | `^4.0.3` | `plan-indexer.cjs` for PLAN.md YAML frontmatter parsing |
| `node:crypto` | built-in | Content hash cache invalidation (same as `skill-scorer.cjs`) |

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Pure JS TF-IDF cosine | `natural` npm package (TF-IDF class) | Package is 47KB; the `TfIdf` class in `natural` is ~200 LOC — implementing inline saves a dependency for equivalent functionality at this scale |
| Pre-built JSON index | Query-time scan | Scanning 80+ files on every plan-phase invocation adds 50-200ms latency with no benefit; plan corpus changes only at milestone completion |
| TF-IDF cosine + Jaccard hybrid | Pure Jaccard | Jaccard's term-frequency blindness means "test", "file", "cli" dominate every score — structural discriminators like "hook-integration" get swamped; TF-IDF fixes this |
| Keyword rules for task classification | Training a classifier | No labeled training set exists; vocabulary is constrained and well-understood; rules match existing `mcp-classifier.cjs` pattern already working in production |
| `plan-index.json` in `.planning/patterns/` | Separate `.planning/intelligence/` dir | Consistency with `skill-scores.json`, `phase-benchmarks.jsonl` — all analytical artifacts live in `patterns/`; no new directory needed |

---

## Sources

- `get-shit-done/bin/lib/skill-scorer.cjs` — existing `jaccardScore()`, `tokenize()`, content-hash cache pattern (HIGH confidence — read directly)
- `get-shit-done/bin/lib/mcp-classifier.cjs` — existing keyword-rule classification pattern (HIGH confidence — read directly)
- `package.json` — confirmed `gray-matter@^4.0.3` in devDependencies, zero text-analysis dependencies in runtime (HIGH confidence — read directly)
- `.planning/v14.0-MILESTONE-CONTEXT.md` — index strategy decision (pre-built vs query-time), composition vs template distinction (HIGH confidence — read directly)
- [PyImageSearch: Jaccard vs Cosine Similarity](https://pyimagesearch.com/2024/07/22/implementing-semantic-search-jaccard-similarity-and-vector-space-models/) — Jaccard best for duplicate detection, cosine+TF-IDF better for recommendation (MEDIUM confidence — single source but consistent with information theory)
- [OpenGenus: Document Similarity TF-IDF](https://iq.opengenus.org/document-similarity-tf-idf/) — TF-IDF cosine implementation pattern for small corpora (MEDIUM confidence)
- [Leapcell: Pure Node.js Search Engine](https://leapcell.medium.com/step-by-step-build-a-lightweight-search-engine-using-only-node-js-106980d86f28) — confirms TF-IDF + inverted index implementable in ~100 lines of pure Node.js (MEDIUM confidence)

---

*Stack research for: Planning Intelligence — plan indexing, similarity scoring, task classification, milestone decomposition*
*Researched: 2026-04-04*
