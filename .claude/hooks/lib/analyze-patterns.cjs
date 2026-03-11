'use strict';
// Observer engine library for the suggestion pipeline.
// Reads corrections.jsonl, aggregates cross-scope patterns, applies bounded-learning
// guardrails, and writes suggestions.json.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks.
// Zero external dependencies — built-in Node.js fs and path only.

const fs = require('fs');
const path = require('path');

// Maps correction taxonomy categories to target skill names
const CATEGORY_SKILL_MAP = {
  'code.wrong_pattern': 'typescript-patterns',
  'code.missing_context': 'code-review',
  'code.stale_knowledge': 'typescript-patterns',
  'code.over_engineering': 'code-review',
  'code.under_engineering': 'code-review',
  'code.style_mismatch': 'typescript-patterns',
  'code.scope_drift': 'gsd-workflow',
  'process.planning_error': 'gsd-workflow',
  'process.research_gap': 'gsd-workflow',
  'process.implementation_bug': 'code-review',
  'process.integration_miss': 'code-review',
  'process.convention_violation': 'session-awareness',
  'process.requirement_misread': 'gsd-workflow',
  'process.regression': 'code-review',
};

/**
 * Reads adaptive_learning.suggestions config from .planning/config.json.
 * Returns defaults on any error.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ minOccurrences: number, cooldownDays: number, autoDismissAfterDays: number }}
 */
function getSuggestionsConfig(cwd) {
  const defaults = { minOccurrences: 3, cooldownDays: 7, autoDismissAfterDays: 30 };
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const sug = ((config.adaptive_learning || {}).suggestions) || {};
    return {
      minOccurrences: typeof sug.min_occurrences === 'number' ? sug.min_occurrences : defaults.minOccurrences,
      cooldownDays: typeof sug.cooldown_days === 'number' ? sug.cooldown_days : defaults.cooldownDays,
      autoDismissAfterDays: typeof sug.auto_dismiss_after_days === 'number' ? sug.auto_dismiss_after_days : defaults.autoDismissAfterDays,
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * Reads and parses suggestions.json. Returns a fresh document if file is missing or invalid.
 *
 * @param {string} filePath - Absolute path to suggestions.json
 * @returns {{ metadata: object, suggestions: object[] }}
 */
function loadSuggestions(filePath) {
  const fresh = { metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] }, suggestions: [] };
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(raw);
    // Ensure required structure exists
    if (!doc || typeof doc !== 'object') return fresh;
    if (!doc.metadata || typeof doc.metadata !== 'object') doc.metadata = fresh.metadata;
    if (!Array.isArray(doc.metadata.skipped_suggestions)) doc.metadata.skipped_suggestions = [];
    if (!Array.isArray(doc.suggestions)) doc.suggestions = [];
    return doc;
  } catch (e) {
    return fresh;
  }
}

/**
 * Writes doc as JSON to filePath atomically (tmp + rename).
 *
 * @param {string} filePath
 * @param {object} doc
 */
function writeSuggestionsAtomic(filePath, doc) {
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2));
  fs.renameSync(tmpPath, filePath);
}

/**
 * Generates a unique suggestion ID with prefix sug- + epoch seconds + - + zero-padded counter.
 * Guarantees uniqueness within the provided Set of existing IDs.
 *
 * @param {Set<string>} existingIds - Set of already-used IDs
 * @returns {string}
 */
function generateSuggestionId(existingIds) {
  const epochSec = Math.floor(Date.now() / 1000);
  let counter = 1;
  let id;
  do {
    id = `sug-${epochSec}-${String(counter).padStart(3, '0')}`;
    counter++;
  } while (existingIds.has(id));
  return id;
}

/**
 * Takes a Set<string> of scopes, returns a human-readable summary string.
 * Lists up to 5 scopes to avoid excessively long strings.
 *
 * @param {Set<string>} scopeSet
 * @returns {string}
 */
function summarizeScopes(scopeSet) {
  const scopes = Array.from(scopeSet);
  const count = scopes.length;
  const listed = scopes.slice(0, 5);
  return `${count} scope${count !== 1 ? 's' : ''}: ${listed.join(', ')}`;
}

/**
 * Enforces bounded-learning guardrails for a given category.
 *
 * Cooldown: if the target skill for this category had a suggestion accepted within
 * cooldownDays, block the new suggestion.
 *
 * @param {string} category
 * @param {{ metadata: object, suggestions: object[] }} suggestionsDoc
 * @param {{ cooldownDays: number }} config
 * @returns {{ pass: boolean, reason?: string, cooldown_expires?: string }}
 */
function checkGuardrails(category, suggestionsDoc, config) {
  const targetSkill = CATEGORY_SKILL_MAP[category] || null;
  if (!targetSkill) return { pass: true };

  const cooldownMs = config.cooldownDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - cooldownMs;

  // Find most recent accepted or refined suggestion for this target_skill within cooldown window
  const recentTerminal = suggestionsDoc.suggestions
    .filter(s => {
      if (s.target_skill !== targetSkill) return false;
      if (s.status === 'accepted' && s.accepted_at) return true;
      if (s.status === 'refined' && s.refined_at) return true;
      return false;
    })
    .map(s => {
      const ts = s.status === 'refined'
        ? new Date(s.refined_at).getTime()
        : new Date(s.accepted_at).getTime();
      return ts;
    })
    .filter(ts => !isNaN(ts) && ts > cutoff);

  if (recentTerminal.length > 0) {
    const latestTs = Math.max(...recentTerminal);
    const cooldownExpires = new Date(latestTs + cooldownMs).toISOString();
    return { pass: false, reason: 'cooldown_active', cooldown_expires: cooldownExpires };
  }

  return { pass: true };
}

/**
 * Auto-dismisses pending suggestions older than autoDismissAfterDays days.
 * Mutates suggestionsDoc.suggestions in place.
 *
 * @param {{ suggestions: object[] }} suggestionsDoc
 * @param {number} autoDismissAfterDays
 */
function autoDismissExpired(suggestionsDoc, autoDismissAfterDays) {
  const cutoffMs = autoDismissAfterDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - cutoffMs;
  const now = new Date().toISOString();

  for (const suggestion of suggestionsDoc.suggestions) {
    if (suggestion.status !== 'pending') continue;
    if (!suggestion.created_at) continue;
    const createdTs = new Date(suggestion.created_at).getTime();
    if (isNaN(createdTs)) continue;
    if (createdTs < cutoff) {
      suggestion.status = 'dismissed';
      suggestion.dismissed_at = now;
      suggestion.dismiss_reason = 'auto_expired';
    }
  }
}

/**
 * Main observer engine function. Reads corrections, aggregates cross-scope patterns,
 * applies guardrails, and writes suggestions.json.
 * Never throws — all errors caught and returned as { analyzed: false, reason: 'error', error: e.message }.
 *
 * @param {{ cwd?: string }} [options]
 * @returns {{ analyzed: boolean, suggestions_written?: number, reason?: string, error?: string }}
 */
function analyzePatterns(options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const config = getSuggestionsConfig(cwd);
    const patternsDir = path.join(cwd, '.planning', 'patterns');

    fs.mkdirSync(patternsDir, { recursive: true });

    const suggestionsPath = path.join(patternsDir, 'suggestions.json');
    let suggestionsDoc = loadSuggestions(suggestionsPath);
    const watermark = suggestionsDoc.metadata.last_analyzed_at || null;

    // Auto-dismiss expired suggestions before processing new ones
    autoDismissExpired(suggestionsDoc, config.autoDismissAfterDays);

    const { readCorrections } = require('./write-correction.cjs');
    const { readPreferences } = require('./write-preference.cjs');

    const allCorrections = readCorrections({ status: 'active' }, { cwd });
    const activePreferences = readPreferences({ status: 'active' }, { cwd });

    // Build dedup set: corrections already promoted to active preferences (category:scope)
    const promotedKeys = new Set(
      activePreferences.map(p => (p.category || '') + ':' + (p.scope || ''))
    );

    // Filter: remove promoted and pre-watermark corrections
    const candidates = allCorrections.filter(c => {
      if (promotedKeys.has((c.diagnosis_category || '') + ':' + (c.scope || ''))) return false;
      if (watermark && c.timestamp <= watermark) return false;
      return true;
    });

    // Group by category (cross-scope aggregation — ignore scope for grouping)
    const groups = {};
    for (const c of candidates) {
      const cat = c.diagnosis_category;
      if (!cat) continue;
      if (!groups[cat]) groups[cat] = { corrections: [], scopes: new Set() };
      groups[cat].corrections.push(c);
      groups[cat].scopes.add(c.scope || 'unknown');
    }

    const existingIds = new Set(suggestionsDoc.suggestions.map(s => s.id));
    let written = 0;

    for (const [category, group] of Object.entries(groups)) {
      if (group.corrections.length < config.minOccurrences) continue;

      // Check guardrails
      const guardrailResult = checkGuardrails(category, suggestionsDoc, config);
      if (!guardrailResult.pass) {
        const targetSkill = CATEGORY_SKILL_MAP[category] || 'unknown';
        const skippedEntry = {
          category,
          target_skill: targetSkill,
          reason: guardrailResult.reason,
          skipped_at: new Date().toISOString(),
        };
        if (guardrailResult.cooldown_expires) {
          skippedEntry.cooldown_expires = guardrailResult.cooldown_expires;
        }
        suggestionsDoc.metadata.skipped_suggestions.push(skippedEntry);
        continue;
      }

      // Skip if a pending suggestion for this category already exists
      const existingPending = suggestionsDoc.suggestions.find(
        s => s.category === category && s.status === 'pending'
      );
      if (existingPending) continue;

      // Map to skill, validate existence
      const targetSkill = CATEGORY_SKILL_MAP[category] || null;
      const skillExists = targetSkill &&
        fs.existsSync(path.join(cwd, '.claude', 'skills', targetSkill));

      const id = generateSuggestionId(existingIds);
      existingIds.add(id);

      suggestionsDoc.suggestions.push({
        id,
        type: skillExists ? 'refine_skill' : 'new_skill_needed',
        target_skill: targetSkill,
        category,
        scope_summary: summarizeScopes(group.scopes),
        correction_count: group.corrections.length,
        sample_corrections: group.corrections.slice(0, 3).map(c => c.correction_to || ''),
        status: 'pending',
        created_at: new Date().toISOString(),
        accepted_at: null,
        dismissed_at: null,
      });
      written++;
    }

    // Update watermark to current time
    suggestionsDoc.metadata.last_analyzed_at = new Date().toISOString();

    writeSuggestionsAtomic(suggestionsPath, suggestionsDoc);

    return { analyzed: true, suggestions_written: written };
  } catch (e) {
    return { analyzed: false, reason: 'error', error: e.message };
  }
}

module.exports = { analyzePatterns };

// CLI invocation: node analyze-patterns.cjs [cwd]
if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const result = analyzePatterns({ cwd });
  if (process.env.DEBUG_OBSERVER) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
