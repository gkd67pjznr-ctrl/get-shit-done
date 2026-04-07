'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ─── Internal helpers ─────────────────────────────────────────────────────────

function loadIndex(cwd) {
  const { planningRoot } = require('./core.cjs');
  const indexPath = path.join(planningRoot(cwd, null), 'plan-index.json');
  if (!fs.existsSync(indexPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  } catch {
    return null;
  }
}

// Sort ascending and return median. Returns 0 for empty array.
function median(arr) {
  if (!arr || arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// ─── dominantType ─────────────────────────────────────────────────────────────

/**
 * Returns the type with the highest frequency in taskPattern.
 * Tie-break: return the first element of the array.
 * Returns 'unknown' if array is empty or null.
 *
 * @param {string[]} taskPattern
 * @returns {string}
 */
function dominantType(taskPattern) {
  if (!Array.isArray(taskPattern) || taskPattern.length === 0) return 'unknown';

  // Count frequencies
  const freq = {};
  for (const t of taskPattern) {
    freq[t] = (freq[t] || 0) + 1;
  }

  // Find max frequency
  let maxCount = 0;
  for (const count of Object.values(freq)) {
    if (count > maxCount) maxCount = count;
  }

  // Return first element in taskPattern that has maxCount (preserves input order for tie-break)
  for (const t of taskPattern) {
    if (freq[t] === maxCount) return t;
  }

  return taskPattern[0];
}

// ─── buildTypeMedians ─────────────────────────────────────────────────────────

/**
 * Takes an array of non-superseded plan entries (all milestones).
 * Returns Record<string, number> mapping each task type to its median correction_rate.
 * Skips plans with null/missing task_pattern.
 * Returns {} for empty input.
 *
 * @param {object[]} plans
 * @returns {Object.<string, number>}
 */
function buildTypeMedians(plans) {
  if (!Array.isArray(plans) || plans.length === 0) return {};

  const byType = {};
  for (const entry of plans) {
    if (!Array.isArray(entry.task_pattern)) continue;
    for (const type of entry.task_pattern) {
      if (!byType[type]) byType[type] = [];
      byType[type].push(entry.correction_rate ?? 0);
    }
  }

  const result = {};
  for (const [type, rates] of Object.entries(byType)) {
    result[type] = median(rates);
  }
  return result;
}

// ─── loadCorrections ──────────────────────────────────────────────────────────

/**
 * Loads active correction entries from corrections.jsonl.
 * Returns [] if file does not exist or cannot be read.
 *
 * @param {string} cwd
 * @returns {object[]}
 */
function loadCorrections(cwd) {
  try {
    const { planningRoot } = require('./core.cjs');
    const correctionsPath = path.join(planningRoot(cwd, null), 'patterns', 'corrections.jsonl');
    if (!fs.existsSync(correctionsPath)) return [];
    const lines = fs.readFileSync(correctionsPath, 'utf-8').split('\n').filter(Boolean);
    const entries = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (!entry.retired_at) entries.push(entry);
      } catch {
        // skip malformed lines
      }
    }
    return entries;
  } catch {
    return [];
  }
}

// ─── computePromptQuality ─────────────────────────────────────────────────────

/**
 * Computes task-type-stratified prompt quality scores for plans in a given milestone.
 * Never throws — returns { plans: [], outliers: [], medians: {} } on any error.
 *
 * @param {string} cwd
 * @param {string|null} milestoneVersion
 * @returns {{ plans: object[], outliers: object[], medians: Object.<string, number> }}
 */
function computePromptQuality(cwd, milestoneVersion) {
  try {
    const indexData = loadIndex(cwd);
    if (!indexData || !Array.isArray(indexData.plans)) {
      return { plans: [], outliers: [], medians: {} };
    }

    // Filter non-superseded plans (all milestones — for cross-milestone baseline)
    const nonSuperseded = indexData.plans.filter(
      entry => entry.superseded_by === null || entry.superseded_by === undefined
    );

    // Build type medians from all non-superseded plans (cross-milestone baseline)
    const medians = buildTypeMedians(nonSuperseded);

    // Filter scored plans: apply milestone filter if provided
    const scoredSource = milestoneVersion
      ? nonSuperseded.filter(entry => entry.milestone === milestoneVersion)
      : nonSuperseded;

    // Load correction categories for attribution
    const corrections = loadCorrections(cwd);

    // Score each plan
    const scoredPlans = scoredSource.map(entry => {
      const dom = dominantType(entry.task_pattern);
      const typeMedian = medians[dom] ?? 0;
      const denominator = Math.max(typeMedian, 0.01);
      const correctionRate = entry.correction_rate ?? 0;
      const score = correctionRate / denominator;
      const scoreLabel = `${score.toFixed(1)}x median for ${dom}`;
      const isOutlier = score > 2.0;

      // Correction category attribution (PROM-01)
      const phasePrefix = String(entry.plan_id).split('-')[0];
      const categories = corrections
        .filter(c => String(c.phase) === phasePrefix && c.diagnosis_category)
        .map(c => c.diagnosis_category);

      return {
        plan_id: entry.plan_id,
        phase_slug: entry.phase_slug,
        milestone: entry.milestone,
        task_pattern: entry.task_pattern,
        correction_count: entry.correction_count ?? 0,
        correction_rate: correctionRate,
        dominant_type: dom,
        type_median: typeMedian,
        score,
        score_label: scoreLabel,
        is_outlier: isOutlier,
        categories,
        superseded_by: entry.superseded_by ?? null,
      };
    });

    const outliers = scoredPlans.filter(p => p.is_outlier);

    return { plans: scoredPlans, outliers, medians };
  } catch {
    return { plans: [], outliers: [], medians: {} };
  }
}

// ─── cmdPromptScore ───────────────────────────────────────────────────────────

/**
 * CLI command handler for `prompt-score` subcommand.
 *
 * @param {string} cwd
 * @param {{ milestone?: string|null }} opts
 * @param {boolean} raw
 */
function cmdPromptScore(cwd, opts, raw) {
  const milestoneVersion = opts.milestone ?? null;
  const result = computePromptQuality(cwd, milestoneVersion);

  const output = {
    milestone: milestoneVersion ?? 'all',
    plan_count: result.plans.length,
    outlier_count: result.outliers.length,
    plans: result.plans,
    outliers: result.outliers,
    medians: result.medians,
  };

  if (raw) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable summary
  const milestoneLabel = milestoneVersion ?? 'all';
  console.log(`Prompt Quality — ${milestoneLabel} (${output.plan_count} plans, ${output.outlier_count} outliers)`);

  if (result.plans.length > 0) {
    // Table header
    const header = 'plan_id          | dominant_type   | score_label                   | status';
    const divider = '-'.repeat(header.length);
    console.log(header);
    console.log(divider);
    for (const plan of result.plans) {
      const pid = plan.plan_id.padEnd(16);
      const dtype = plan.dominant_type.padEnd(15);
      const label = plan.score_label.padEnd(29);
      const status = plan.is_outlier ? 'OUTLIER' : 'normal';
      console.log(`${pid} | ${dtype} | ${label} | ${status}`);
    }
  }

  if (result.outliers.length > 0) {
    console.log('\nOutliers (score > 2x type median):');
    for (const plan of result.outliers) {
      const cats = plan.categories.length > 0 ? plan.categories.join(', ') : 'none';
      console.log(`- Plan ${plan.plan_id}: ${plan.score_label}. Correction categories: ${cats}`);
    }
  }

  console.log('\n_Prompt quality is diagnostic only — not a gate._');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { computePromptQuality, cmdPromptScore };
