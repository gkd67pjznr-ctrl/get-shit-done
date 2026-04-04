'use strict';
// Review profile generator — reads corrections.jsonl, computes category weight
// distribution, and writes review-profile.json to .planning/patterns/.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks.
// Zero external dependencies — built-in Node.js fs and path only.

const fs = require('fs');
const path = require('path');

const { readCorrections } = require('./write-correction.cjs');

// Minimum number of active corrections required to generate a profile.
const MIN_CORRECTIONS = 10;

// 14-category correction taxonomy (mirrors VALID_CATEGORIES in write-correction.cjs).
// Defined inline to avoid importing analyze-patterns.cjs.
const VALID_CATEGORIES = new Set([
  'code.wrong_pattern',
  'code.missing_context',
  'code.stale_knowledge',
  'code.over_engineering',
  'code.under_engineering',
  'code.style_mismatch',
  'code.scope_drift',
  'process.planning_error',
  'process.research_gap',
  'process.implementation_bug',
  'process.integration_miss',
  'process.convention_violation',
  'process.requirement_misread',
  'process.regression',
]);

/**
 * Reads corrections.jsonl, computes normalized category weight distribution,
 * and writes review-profile.json atomically to .planning/patterns/.
 *
 * Returns null when fewer than MIN_CORRECTIONS active corrections exist, or on
 * any error (silent failure — same pattern as analyze-patterns.cjs).
 *
 * @param {{ cwd?: string }} [options]
 * @returns {{ generated_at: string, sample_size: number, min_corrections_required: number, weights: object }|null}
 */
function generateReviewProfile(options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();

    // Read all active corrections
    const corrections = readCorrections({ status: 'active' }, { cwd });

    // Count active corrections per known category
    const counts = {};
    for (const c of corrections) {
      const cat = c.diagnosis_category;
      if (!VALID_CATEGORIES.has(cat)) continue;
      counts[cat] = (counts[cat] || 0) + 1;
    }

    // sampleSize: only corrections in a known category contribute
    const sampleSize = corrections.filter(c => VALID_CATEGORIES.has(c.diagnosis_category)).length;

    // Enforce minimum guard
    if (sampleSize < MIN_CORRECTIONS) {
      return null;
    }

    // Compute normalized weights (frequency ratios)
    const weights = {};
    for (const [cat, count] of Object.entries(counts)) {
      weights[cat] = count / sampleSize;
    }

    // Build profile document
    const profile = {
      generated_at: new Date().toISOString(),
      sample_size: sampleSize,
      min_corrections_required: MIN_CORRECTIONS,
      weights,
    };

    // Write atomically to .planning/patterns/review-profile.json
    const patternsDir = path.join(cwd, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const profilePath = path.join(patternsDir, 'review-profile.json');
    const tmpPath = profilePath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(profile, null, 2));
    fs.renameSync(tmpPath, profilePath);

    return profile;
  } catch (e) {
    return null;
  }
}

module.exports = { generateReviewProfile };

// CLI invocation: node review-profile.cjs [cwd]
if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const result = generateReviewProfile({ cwd });
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(0);
}
