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

// ─── buildTypePerformanceTable ────────────────────────────────────────────────

/**
 * Reads plan-index.json and aggregates task-type performance data.
 * Returns array of { type, median_correction_rate, best_example } sorted
 * ascending by median_correction_rate.
 * Returns [] when index is missing or empty.
 *
 * @param {string} cwd
 * @returns {{ type: string, median_correction_rate: number, best_example: object }[]}
 */
function buildTypePerformanceTable(cwd) {
  const indexData = loadIndex(cwd);
  if (!indexData || !Array.isArray(indexData.plans)) return [];

  const plans = indexData.plans;

  // Accumulate correction_rates and examples per type (skip superseded)
  const byType = {};
  for (const entry of plans) {
    if (entry.superseded_by !== null && entry.superseded_by !== undefined) continue;
    if (!Array.isArray(entry.task_pattern)) continue;
    for (const type of entry.task_pattern) {
      if (!byType[type]) {
        byType[type] = { counts: [], examples: [] };
      }
      byType[type].counts.push(entry.correction_rate ?? 0);
      byType[type].examples.push(entry);
    }
  }

  const result = [];
  for (const [type, { counts, examples }] of Object.entries(byType)) {
    const median_correction_rate = median(counts);
    // Best example: lowest correction_rate; tie-break: most recent plan_id lexicographically
    const sorted = [...examples].sort((a, b) => {
      const rateDiff = (a.correction_rate ?? 0) - (b.correction_rate ?? 0);
      if (rateDiff !== 0) return rateDiff;
      // tie-break: most recent = higher lexicographic plan_id
      return b.plan_id > a.plan_id ? 1 : b.plan_id < a.plan_id ? -1 : 0;
    });
    result.push({ type, median_correction_rate, best_example: sorted[0] });
  }

  return result.sort((a, b) => a.median_correction_rate - b.median_correction_rate);
}

// ─── getBestExampleByType ─────────────────────────────────────────────────────

/**
 * Returns { [type]: lowestCorrectionRateEntry } for each requested type.
 * Types with no historical entries are omitted from the result.
 * Returns {} when index is missing.
 *
 * @param {string} cwd
 * @param {string[]} types
 * @returns {Object.<string, object>}
 */
function getBestExampleByType(cwd, types) {
  const indexData = loadIndex(cwd);
  if (!indexData || !Array.isArray(indexData.plans)) return {};

  const plans = indexData.plans.filter(
    e => e.superseded_by === null || e.superseded_by === undefined
  );

  const result = {};
  for (const type of types) {
    const matches = plans.filter(
      e => Array.isArray(e.task_pattern) && e.task_pattern.includes(type)
    );
    if (matches.length === 0) continue;
    // Sort ascending by correction_rate; tie-break: most recent plan_id
    const sorted = [...matches].sort((a, b) => {
      const rateDiff = (a.correction_rate ?? 0) - (b.correction_rate ?? 0);
      if (rateDiff !== 0) return rateDiff;
      return b.plan_id > a.plan_id ? 1 : b.plan_id < a.plan_id ? -1 : 0;
    });
    result[type] = sorted[0];
  }

  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { buildTypePerformanceTable, getBestExampleByType };
