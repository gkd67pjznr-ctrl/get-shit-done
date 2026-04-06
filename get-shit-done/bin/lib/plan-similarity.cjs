'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { planningRoot } = require('./core.cjs');

// ─── Keyword map for task-type inference (mirrors TASK_TYPE_PATTERNS in plan-indexer.cjs) ────

const TASK_TYPE_KEYWORDS = {
  'test-setup':  ['test', 'stub', 'fixture', 'spec', 'mock'],
  'lib-module':  ['lib', 'module', 'implement', 'create', 'build', 'indexer', 'scanner', 'extractor'],
  'cli-wiring':  ['cli', 'command', 'subcommand', 'route', 'wire', 'routing', 'case'],
  'schema':      ['schema', 'type', 'interface', 'model', 'struct', 'format', 'json'],
  'hook':        ['hook', 'trigger', 'callback', 'event', 'milestone', 'complete'],
  'integration': ['integration', 'e2e', 'end-to-end', 'workflow', 'inject', 'join'],
  'docs':        ['doc', 'readme', 'comment', 'gitignore', 'changelog'],
  'refactor':    ['refactor', 'rename', 'move', 'extract', 'split', 'cleanup', 'staleness'],
};

// ─── loadIndex ────────────────────────────────────────────────────────────────

/**
 * Read plan-index.json from .planning/. Returns parsed object { idf, plans }
 * or null on any error (file not found, parse error, etc.).
 */
function loadIndex(cwd) {
  try {
    const indexPath = path.join(planningRoot(cwd, null), 'plan-index.json');
    const raw = fs.readFileSync(indexPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ─── tokenize ─────────────────────────────────────────────────────────────────

/**
 * Lowercase, strip non-alphanumeric except spaces, split on whitespace,
 * filter length >= 2, deduplicate. Returns string array.
 */
function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = lower.split(/\s+/).filter(w => w.length >= 2);
  return [...new Set(words)];
}

// ─── cosineSimilarity ─────────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two TF-IDF vectors (plain objects).
 * Returns 0 if either vector has zero magnitude.
 */
function cosineSimilarity(vecA, vecB) {
  const keysA = Object.keys(vecA);
  const keysB = Object.keys(vecB);
  if (keysA.length === 0 || keysB.length === 0) return 0;

  // Dot product (only over shared keys for efficiency)
  let dot = 0;
  for (const k of keysA) {
    if (k in vecB) dot += vecA[k] * vecB[k];
  }

  // Magnitudes
  let magA = 0;
  for (const k of keysA) magA += vecA[k] * vecA[k];

  let magB = 0;
  for (const k of keysB) magB += vecB[k] * vecB[k];

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ─── jaccardTokens ────────────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two Sets.
 * Returns 0 if union is empty.
 */
function jaccardTokens(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) intersectionSize++;
  }
  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0;
  return intersectionSize / unionSize;
}

// ─── inferTaskTypes ───────────────────────────────────────────────────────────

/**
 * Infer task types from goal tokens using the same keyword map as plan-indexer.
 * Returns a Set<string> of matched types. Defaults to 'lib-module' if no match.
 */
function inferTaskTypes(goalTokens) {
  const matched = new Set();
  for (const token of goalTokens) {
    for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
      if (keywords.includes(token)) {
        matched.add(type);
      }
    }
  }
  if (matched.size === 0) matched.add('lib-module');
  return matched;
}

// ─── inferFilePatterns ────────────────────────────────────────────────────────

/**
 * Best-effort inference of file patterns from goal tokens.
 * Returns array of matched glob-style patterns.
 */
function inferFilePatterns(goalTokens) {
  const patterns = [];
  const tokenSet = new Set(goalTokens);

  if (tokenSet.has('lib') || tokenSet.has('module') || tokenSet.has('cjs')) {
    patterns.push('get-shit-done/bin/lib/*.cjs');
  }
  if (tokenSet.has('test') || tokenSet.has('spec')) {
    patterns.push('tests/*.cjs');
  }
  if (tokenSet.has('workflow') || tokenSet.has('plan-phase')) {
    patterns.push('get-shit-done/workflows/*.md');
  }

  return patterns;
}

// ─── adaptSkeleton ────────────────────────────────────────────────────────────

/**
 * Adapt a matched plan entry's skeleton for the current phase.
 * Replaces NN-NN phase-plan prefixes in files_modified paths.
 */
function adaptSkeleton(matchedEntry, currentPhase, currentReqIds) {
  const adaptedFiles = (matchedEntry.files_modified || []).map(
    f => f.replace(/\d{2}-\d{2}/, currentPhase)
  );
  return {
    adapted_files: adaptedFiles,
    adapted_requirements: currentReqIds,
    source_plan: matchedEntry.plan_id,
    adapted_for: currentPhase,
  };
}

// ─── buildQueryVec ────────────────────────────────────────────────────────────

/**
 * Build a TF-IDF query vector from goal tokens using the corpus IDF map.
 */
function buildQueryVec(goalTokens, idf) {
  const vec = {};
  for (const token of goalTokens) {
    vec[token] = (1 / goalTokens.length) * (idf[token] || 0);
  }
  return vec;
}

// ─── scoreEntry ───────────────────────────────────────────────────────────────

/**
 * Score a single index entry against the query.
 * Returns score breakdown object including composite_score.
 */
function scoreEntry(goalTokens, goalVec, inferredTypes, inferredFilePatterns, entry) {
  const tfidfScore = cosineSimilarity(goalVec, entry.tfidf_vector || {});
  const jaccardScore = jaccardTokens(new Set(goalTokens), new Set(entry.tokens || []));
  const tagOverlap = jaccardTokens(new Set(goalTokens), new Set(entry.tags || []));
  const taskTypeOverlap = jaccardTokens(inferredTypes, new Set(entry.task_pattern || []));
  const filePatternOverlap = jaccardTokens(new Set(inferredFilePatterns), new Set(entry.file_patterns || []));

  const rawComposite = 0.70 * tfidfScore + 0.20 * jaccardScore + 0.10 * tagOverlap;
  const finalComposite = rawComposite * (entry.age_weight != null ? entry.age_weight : 1.0);

  return {
    keyword_score: tfidfScore,
    task_type_score: taskTypeOverlap,
    file_pattern_score: filePatternOverlap,
    composite_score: finalComposite,
  };
}

// ─── searchSimilarPlans ───────────────────────────────────────────────────────

/**
 * Search the pre-built plan index for plans similar to the given goal.
 *
 * @param {string} cwd - Project root directory
 * @param {object} opts
 * @param {string} opts.goal - Natural language goal description
 * @param {number} [opts.limit=3] - Maximum results to return
 * @param {number} [opts.threshold=0.65] - Minimum composite score to include
 * @returns {Array} Scored plan entries, or [] on any error / below threshold
 */
function searchSimilarPlans(cwd, { goal, limit = 3, threshold = 0.65 } = {}) {
  try {
    const indexData = loadIndex(cwd);
    if (!indexData) return [];

    const goalTokens = tokenize(goal);
    if (goalTokens.length === 0) return [];

    const goalVec = buildQueryVec(goalTokens, indexData.idf || {});
    const inferredTypes = inferTaskTypes(goalTokens);
    const inferredFilePatterns = inferFilePatterns(goalTokens);

    const plans = indexData.plans || [];
    const scored = [];

    for (const entry of plans) {
      // Skip superseded entries
      if (entry.superseded_by !== null && entry.superseded_by !== undefined) continue;

      const scores = scoreEntry(goalTokens, goalVec, inferredTypes, inferredFilePatterns, entry);

      if (scores.composite_score < threshold) continue;

      scored.push({
        ...entry,
        keyword_score: scores.keyword_score,
        task_type_score: scores.task_type_score,
        file_pattern_score: scores.file_pattern_score,
        composite_score: scores.composite_score,
        adapted_skeleton: adaptSkeleton(entry, goal, []),
      });
    }

    // Sort descending by composite_score
    scored.sort((a, b) => b.composite_score - a.composite_score);

    return scored.slice(0, limit);
  } catch {
    return [];
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { searchSimilarPlans, adaptSkeleton, cosineSimilarity, jaccardTokens };
