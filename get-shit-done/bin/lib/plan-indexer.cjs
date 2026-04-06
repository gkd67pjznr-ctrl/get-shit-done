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
  const N = entries.length;
  if (N === 0) return {};

  // Document frequency: how many entries contain each token
  const df = {};
  for (const entry of entries) {
    const uniqueTokens = [...new Set(entry.tokens)];
    for (const t of uniqueTokens) {
      df[t] = (df[t] || 0) + 1;
    }
  }

  // IDF: log(N / df[t])
  const idf = {};
  for (const [t, freq] of Object.entries(df)) {
    idf[t] = Math.log(N / freq);
  }

  // TF-IDF vector per entry
  for (const entry of entries) {
    const vec = {};
    const tokenCount = entry.tokens.length;
    if (tokenCount === 0) { entry.tfidf_vector = {}; continue; }
    for (const t of entry.tokens) {
      const tf = 1 / tokenCount; // uniform TF (token frequency within doc)
      vec[t] = tf * (idf[t] || 0);
    }
    entry.tfidf_vector = vec;
  }

  return idf;
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

// 8 canonical task types (per IDX-02 / TASK-01 spec)
const TASK_TYPE_PATTERNS = [
  { type: 'test-setup',  keywords: ['test', 'stub', 'fixture', 'spec', 'mock'] },
  { type: 'lib-module',  keywords: ['lib', 'module', 'implement', 'create', 'build', 'indexer', 'scanner', 'extractor'] },
  { type: 'cli-wiring',  keywords: ['cli', 'command', 'subcommand', 'route', 'wire', 'routing', 'case'] },
  { type: 'schema',      keywords: ['schema', 'type', 'interface', 'model', 'struct', 'format', 'json'] },
  { type: 'hook',        keywords: ['hook', 'trigger', 'callback', 'event', 'milestone', 'complete'] },
  { type: 'integration', keywords: ['integration', 'e2e', 'end-to-end', 'workflow', 'inject', 'join'] },
  { type: 'docs',        keywords: ['doc', 'readme', 'comment', 'gitignore', 'changelog'] },
  { type: 'refactor',    keywords: ['refactor', 'rename', 'move', 'extract', 'split', 'cleanup', 'staleness'] },
];

function classifyTaskType(title) {
  const lower = title.toLowerCase();
  for (const { type, keywords } of TASK_TYPE_PATTERNS) {
    if (keywords.some(k => lower.includes(k))) return type;
  }
  return 'lib-module'; // default
}

// --- Main build function ---
function buildIndex(cwd) {
  // 1. Scan all completed plans across milestone dirs
  const scanResults = scanMilestonePlans(cwd);

  // 2. Load benchmarks once
  const benchmarkPath = path.join(cwd, '.planning', 'patterns', 'phase-benchmarks.jsonl');
  const benchmarks = parseJsonlFile(benchmarkPath);

  // 3. Extract entries
  const entries = [];
  for (const { milestoneVersion, planFile, summaryFm } of scanResults) {
    const planContent = fs.readFileSync(planFile, 'utf-8');
    const fm = extractFrontmatter(planContent);

    // Skip if missing required fields
    if (fm.phase === undefined || fm.phase === null || fm.plan === undefined || fm.plan === null) {
      process.stderr.write(`plan-indexer: skipping ${planFile} — missing phase or plan in frontmatter\n`);
      continue;
    }

    const phaseStr = String(fm.phase).padStart(2, '0');
    const planStr = String(fm.plan).padStart(2, '0');
    const planId = `${phaseStr}-${planStr}`;

    // Extract task_pattern from <task> blocks in plan body
    const taskTitles = [];
    const taskTitleRe = /<title>([^<]+)<\/title>/g;
    let m;
    while ((m = taskTitleRe.exec(planContent)) !== null) {
      taskTitles.push(m[1].trim());
    }
    const taskPattern = taskTitles.map(t => classifyTaskType(t));

    // file_patterns: glob-style patterns derived from files_modified
    const filesModified = Array.isArray(fm.files_modified) ? fm.files_modified : [];
    const filePatterns = [...new Set(filesModified.map(f => {
      const dir = path.dirname(f);
      const ext = path.extname(f);
      return ext ? `${dir}/*${ext}` : `${dir}/*`;
    }))];

    // Tokens: phase_goal words + tags + task types
    const phaseGoal = (fm.phase_goal || fm.title || '').toLowerCase();
    const tags = Array.isArray(fm.tags) ? fm.tags : [];
    const rawTokens = [
      ...tokenize(phaseGoal),
      ...tags.map(t => t.toLowerCase()),
      ...taskPattern,
    ];

    // Benchmark join
    const bench = joinBenchmark(benchmarks, fm.phase, fm.plan);
    const correctionRate = bench.correction_count > 0
      ? bench.correction_count / Math.max(taskPattern.length, 1)
      : 0;

    // Age weight — use summary's completed_at
    const completedAt = summaryFm.completed_at || null;
    const ageWeight = calcAgeWeight(completedAt);

    entries.push({
      plan_id: planId,
      milestone: milestoneVersion,
      phase_goal: phaseGoal,
      phase_slug: path.basename(path.dirname(planFile)).replace(/^\d+-/, ''),
      task_pattern: taskPattern,
      file_patterns: filePatterns,
      files_modified: filesModified,
      tags,
      requirement_count: Array.isArray(fm.requirements) ? fm.requirements.length : 0,
      correction_count: bench.correction_count,
      gate_fire_count: bench.gate_fire_count,
      correction_rate: correctionRate,
      tokens: rawTokens,
      tfidf_vector: {}, // populated by buildTfIdfIndex below
      age_weight: ageWeight,
      superseded_by: fm.superseded_by || null,
      completed: completedAt,
    });
  }

  // 4. Build TF-IDF vectors
  const idf = buildTfIdfIndex(entries);

  // 5. Atomic write
  const indexFile = path.join(cwd, '.planning', 'plan-index.json');
  const indexData = {
    built_at: new Date().toISOString(),
    plan_count: entries.length,
    idf,
    plans: entries,
  };
  const tmpPath = indexFile + '.tmp';
  fs.mkdirSync(path.dirname(indexFile), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(indexData, null, 2));
  fs.renameSync(tmpPath, indexFile);

  return indexData;
}

// --- Refresh (alias for buildIndex, used by milestone hook) ---
function refreshIndex(cwd) { return buildIndex(cwd); }

// --- Search (reads pre-built index from disk; never triggers rebuild) ---
const STALENESS_DAYS = 14;

function searchIndex(cwd, query) {
  const indexFile = path.join(cwd, '.planning', 'plan-index.json');

  if (!fs.existsSync(indexFile)) {
    process.stdout.write('plan-indexer: plan-index.json not found — run `gsd plan-index --rebuild` to build\n');
    return [];
  }

  let indexData;
  try {
    indexData = JSON.parse(fs.readFileSync(indexFile, 'utf-8'));
  } catch {
    process.stdout.write('plan-indexer: plan-index.json is corrupted — run `gsd plan-index --rebuild`\n');
    return [];
  }

  // Staleness check
  if (indexData.built_at) {
    const ageMs = Date.now() - new Date(indexData.built_at).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > STALENESS_DAYS) {
      process.stdout.write(`plan-indexer: index is ${Math.floor(ageDays)} days old — consider rebuilding with \`gsd plan-index --rebuild\`\n`);
    }
  }

  return indexData.plans || [];
}

// --- CLI handler for plan-index subcommand ---
function cmdPlanIndex(cwd, options, raw) {
  if (options.rebuild) {
    const result = buildIndex(cwd);
    if (raw) {
      process.stdout.write(JSON.stringify({ ok: true, plan_count: result.plan_count, built_at: result.built_at }) + '\n');
    } else {
      process.stdout.write(`plan-index: rebuilt ${result.plan_count} plans (${result.built_at})\n`);
    }
  } else {
    process.stdout.write('Usage: plan-index --rebuild\n');
  }
}

module.exports = { buildIndex, refreshIndex, searchIndex, cmdPlanIndex };
