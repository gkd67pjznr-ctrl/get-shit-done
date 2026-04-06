'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { extractFrontmatter } = require('./frontmatter.cjs');

// Local copy — per codebase pattern (benchmark.cjs, skill-scorer.cjs, event-journal.cjs all duplicate this)
function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

// --- Tokenizer ---
// Tokenize a text string into lowercase words, strip punctuation, min length 2
function tokenize(text) {
  if (!text) return [];
  const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = lower.split(/\s+/).filter(w => w.length >= 2);
  // Return unique tokens
  return [...new Set(words)];
}

// --- TF-IDF builder ---
// Input: array of { tokens: string[] } entries
// Output: mutates each entry to add tfidf_vector; returns idf map
function buildTfIdfIndex(entries) {
  throw new Error('not implemented');
}

// --- Age decay ---
// completedAt: ISO date string. Returns float 0.1–1.0
function calcAgeWeight(completedAt) {
  if (!completedAt) return 1.0;
  const ageMonths = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return Math.max(0.1, Math.pow(0.95, ageMonths));
}

// --- Milestone scanner ---
// Returns array of { milestoneVersion, planFile, summaryFile, summaryFm } for all COMPLETE plans
function scanMilestonePlans(cwd) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  if (!fs.existsSync(milestonesDir)) return [];

  const results = [];
  const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
  const milestoneDirs = entries
    .filter(e => e.isDirectory() && /^v\d+\.\d+$/.test(e.name))
    .map(e => e.name);

  for (const milestoneVersion of milestoneDirs) {
    const phasesDir = path.join(milestonesDir, milestoneVersion, 'phases');
    if (!fs.existsSync(phasesDir)) continue;

    const phaseDirEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
    for (const phaseEntry of phaseDirEntries) {
      if (!phaseEntry.isDirectory()) continue;
      const phaseDir = path.join(phasesDir, phaseEntry.name);

      const phaseFiles = fs.readdirSync(phaseDir);
      const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md'));

      for (const planFileName of planFiles) {
        // Derive expected summary name: same prefix, swap -PLAN.md for -SUMMARY.md
        const prefix = planFileName.replace(/-PLAN\.md$/, '');
        const summaryFileName = `${prefix}-SUMMARY.md`;

        const planFile = path.join(phaseDir, planFileName);
        const summaryFile = path.join(phaseDir, summaryFileName);

        if (!fs.existsSync(summaryFile)) continue;

        const summaryContent = fs.readFileSync(summaryFile, 'utf-8');
        const summaryFm = extractFrontmatter(summaryContent);

        if (summaryFm.status !== 'complete') continue;

        results.push({ milestoneVersion, planFile, summaryFile, summaryFm });
      }
    }
  }

  return results;
}

// --- Benchmark joiner ---
// benchmarks: parsed JSONL array; phase, plan: string or number
// Returns { correction_count, gate_fire_count } using highest correction_count entry
function joinBenchmark(benchmarks, phase, plan) {
  const matches = benchmarks.filter(
    b => String(b.phase) === String(phase) && String(b.plan) === String(plan)
  );

  if (matches.length === 0) return { correction_count: 0, gate_fire_count: 0 };

  // Pick entry with highest correction_count
  const best = matches.reduce((acc, b) => {
    return (b.correction_count ?? 0) > (acc.correction_count ?? 0) ? b : acc;
  }, matches[0]);

  return {
    correction_count: best.correction_count ?? 0,
    gate_fire_count: best.gate_fire_count ?? 0,
  };
}

// --- Main build function ---
function buildIndex(cwd) {
  throw new Error('not implemented');
}

// --- Refresh (alias for buildIndex, used by milestone hook) ---
function refreshIndex(cwd) { return buildIndex(cwd); }

module.exports = { buildIndex, refreshIndex };
