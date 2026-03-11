'use strict';
// Gate-to-correction attribution library for the analytics pipeline.
// Reads gate-executions.jsonl and corrections.jsonl, applies heuristic
// category-to-gate mappings with confidence scores, and writes structured
// attribution output to gate-attribution.jsonl.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks.
// Zero external dependencies — built-in Node.js fs and path only.

const fs = require('fs');
const path = require('path');

// Maps all 14 correction categories to their attributed gate
const CATEGORY_GATE_MAP = {
  'code.wrong_pattern':           'codebase_scan',
  'code.missing_context':         'codebase_scan',
  'code.stale_knowledge':         'context7_lookup',
  'code.over_engineering':        'diff_review',
  'code.under_engineering':       'test_gate',
  'code.style_mismatch':          'codebase_scan',
  'code.scope_drift':             'diff_review',
  'process.planning_error':       'diff_review',
  'process.research_gap':         'context7_lookup',
  'process.implementation_bug':   'test_gate',
  'process.integration_miss':     'diff_review',
  'process.convention_violation': 'codebase_scan',
  'process.requirement_misread':  'diff_review',
  'process.regression':           'test_baseline',
};

// Maps all 14 correction categories to confidence scores
// 1.0 = direct causal, 0.7 = strong correlation, 0.4 = indirect
const CONFIDENCE_MAP = {
  'code.stale_knowledge':         1.0,
  'process.research_gap':         1.0,
  'process.regression':           1.0,
  'process.implementation_bug':   1.0,
  'code.wrong_pattern':           0.7,
  'code.missing_context':         0.7,
  'code.style_mismatch':          0.7,
  'code.under_engineering':       0.7,
  'process.convention_violation': 0.7,
  'code.over_engineering':        0.4,
  'code.scope_drift':             0.4,
  'process.planning_error':       0.4,
  'process.integration_miss':     0.4,
  'process.requirement_misread':  0.4,
};

/**
 * Reads a JSONL file and returns parsed entries.
 * Silently skips invalid lines. Returns empty array if file missing or unreadable.
 *
 * @param {string} filePath - Absolute path to the JSONL file
 * @returns {object[]}
 */
function readJsonlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    const entries = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch (e) {
        // Skip malformed lines silently
      }
    }
    return entries;
  } catch (e) {
    return [];
  }
}

/**
 * Reads all gate execution entries from gate-executions.jsonl plus archives.
 *
 * @param {string} cwd - Project root directory
 * @returns {object[]}
 */
function readAllGateExecutions(cwd) {
  const observationsDir = path.join(cwd, '.planning', 'observations');
  const entries = [];

  // Read primary file
  entries.push(...readJsonlFile(path.join(observationsDir, 'gate-executions.jsonl')));

  // Read archive files
  try {
    const files = fs.readdirSync(observationsDir);
    for (const file of files) {
      if (file.startsWith('gate-executions-') && file.endsWith('.jsonl')) {
        entries.push(...readJsonlFile(path.join(observationsDir, file)));
      }
    }
  } catch (e) {
    // Silent if directory missing or unreadable
  }

  return entries;
}

/**
 * Reads all correction entries from corrections.jsonl plus archives.
 * Mirrors the readCorrections() pattern from write-correction.cjs.
 *
 * @param {string} cwd - Project root directory
 * @returns {object[]}
 */
function readAllCorrections(cwd) {
  const patternsDir = path.join(cwd, '.planning', 'patterns');
  const entries = [];

  // Read primary file
  entries.push(...readJsonlFile(path.join(patternsDir, 'corrections.jsonl')));

  // Read archive files
  try {
    const files = fs.readdirSync(patternsDir);
    for (const file of files) {
      if (file.startsWith('corrections-') && file.endsWith('.jsonl')) {
        entries.push(...readJsonlFile(path.join(patternsDir, file)));
      }
    }
  } catch (e) {
    // Silent if directory missing or unreadable
  }

  return entries;
}

/**
 * Counts outcomes from an array of gate execution entries.
 *
 * @param {object[]} gateEvents - Array of gate execution entries
 * @returns {{ passed: number, warned: number, blocked: number, skipped: number }}
 */
function countOutcomes(gateEvents) {
  const counts = { passed: 0, warned: 0, blocked: 0, skipped: 0 };
  for (const event of gateEvents) {
    const outcome = event.outcome;
    if (outcome === 'passed') counts.passed++;
    else if (outcome === 'warned') counts.warned++;
    else if (outcome === 'blocked') counts.blocked++;
    else if (outcome === 'skipped') counts.skipped++;
  }
  return counts;
}

/**
 * Returns a deduplicated sorted array of phase string values from correction entries.
 *
 * @param {object[]} corrections - Array of correction entries
 * @returns {string[]}
 */
function uniquePhases(corrections) {
  const phases = new Set();
  for (const c of corrections) {
    if (c.phase !== undefined && c.phase !== null) {
      phases.add(String(c.phase));
    }
  }
  return Array.from(phases).sort();
}

/**
 * Ensures .planning/observations/ exists and writes each attribution object
 * as a JSON line to gate-attribution.jsonl, overwriting any existing file.
 * If attributions is empty, writes an empty file.
 *
 * @param {string} cwd - Project root directory
 * @param {object[]} attributions - Array of attribution objects
 */
function writeAttributionFile(cwd, attributions) {
  const observationsDir = path.join(cwd, '.planning', 'observations');
  fs.mkdirSync(observationsDir, { recursive: true });
  const filePath = path.join(observationsDir, 'gate-attribution.jsonl');
  const content = attributions.map(a => JSON.stringify(a)).join('\n');
  fs.writeFileSync(filePath, attributions.length > 0 ? content + '\n' : '');
}

/**
 * Groups an array of objects by a string key.
 *
 * @param {object[]} arr - Array of objects
 * @param {string} key - Key to group by
 * @returns {Record<string, object[]>}
 */
function groupBy(arr, key) {
  const groups = {};
  for (const item of arr) {
    const groupKey = item[key];
    if (groupKey === undefined || groupKey === null) continue;
    const k = String(groupKey);
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  return groups;
}

/**
 * Main attribution function. Reads gate executions and corrections, applies
 * heuristic category-to-gate mappings with confidence scores, and writes
 * results to gate-attribution.jsonl.
 * Never throws — all errors caught and returned as { analyzed: false, reason: 'error', error: e.message }.
 *
 * @param {{ cwd?: string }} [options]
 * @returns {{ analyzed: boolean, attributions?: number, reason?: string, error?: string }}
 */
function attributeGates(options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();

    const gateExecutions = readAllGateExecutions(cwd);
    const corrections = readAllCorrections(cwd);

    if (corrections.length === 0) {
      writeAttributionFile(cwd, []);
      return { analyzed: true, attributions: 0 };
    }

    // Group corrections by diagnosis_category
    const correctionsByCategory = groupBy(corrections, 'diagnosis_category');

    // Group gate executions by gate name
    const gatesByName = groupBy(gateExecutions, 'gate');

    const attributions = [];

    for (const [category, catCorrections] of Object.entries(correctionsByCategory)) {
      const gate = CATEGORY_GATE_MAP[category];
      if (!gate) continue; // Skip unknown categories

      const confidence = CONFIDENCE_MAP[category] !== undefined ? CONFIDENCE_MAP[category] : 0.4;
      const gateEvents = gatesByName[gate] || [];

      const entry = {
        correction_category: category,
        gate,
        confidence,
        correction_count: catCorrections.length,
        gate_outcome_distribution: countOutcomes(gateEvents),
        phases_observed: uniquePhases(catCorrections),
        sample_corrections: catCorrections.slice(0, 3).map(c => c.diagnosis_text || ''),
        timestamp: new Date().toISOString(),
      };

      attributions.push(entry);
    }

    writeAttributionFile(cwd, attributions);

    return { analyzed: true, attributions: attributions.length };
  } catch (e) {
    return { analyzed: false, reason: 'error', error: e.message };
  }
}

module.exports = { attributeGates };

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const result = attributeGates({ cwd });
  if (process.env.DEBUG_ATTRIBUTION) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
