'use strict';

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 500;

function rotateFile(filePath, dir) {
  const dateStr = new Date().toISOString().slice(0, 10);
  let archiveName = `phase-benchmarks-${dateStr}.jsonl`;
  let archivePath = path.join(dir, archiveName);
  let seq = 1;
  while (fs.existsSync(archivePath)) {
    archiveName = `phase-benchmarks-${dateStr}-${seq}.jsonl`;
    archivePath = path.join(dir, archiveName);
    seq++;
  }
  fs.renameSync(filePath, archivePath);
}

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function countCorrections(cwd, milestoneScope, phase) {
  const milestonePath = milestoneScope
    ? path.join(cwd, '.planning', 'milestones', milestoneScope, 'patterns', 'corrections.jsonl')
    : null;
  const fallbackPath = path.join(cwd, '.planning', 'patterns', 'corrections.jsonl');
  const filePath = (milestonePath && fs.existsSync(milestonePath)) ? milestonePath : fallbackPath;
  const entries = parseJsonlFile(filePath);
  return entries.filter(
    c => String(c.phase) === String(phase) && !c.retired_at
  ).length;
}

function countGateFires(cwd, phase, plan) {
  const filePath = path.join(cwd, '.planning', 'observations', 'gate-executions.jsonl');
  const entries = parseJsonlFile(filePath);
  return entries.filter(
    e => String(e.phase) === String(phase) && String(e.plan) === String(plan)
  ).length;
}

function cmdBenchmarkPlan(cwd, opts, raw) {
  const patternsDir = path.join(cwd, '.planning', 'patterns');
  if (!fs.existsSync(patternsDir)) {
    fs.mkdirSync(patternsDir, { recursive: true });
  }

  const filePath = path.join(patternsDir, 'phase-benchmarks.jsonl');

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lineCount = content.split('\n').filter(l => l.trim() !== '').length;
    if (lineCount >= MAX_ENTRIES) {
      rotateFile(filePath, patternsDir);
    }
  }

  const correction_count = countCorrections(cwd, opts.milestone_scope || null, opts.phase);
  const gate_fire_count = countGateFires(cwd, opts.phase, opts.plan);

  const test_count = opts.test_count != null ? Number(opts.test_count) : null;

  let test_delta = null;
  if (test_count !== null && Number.isFinite(test_count)) {
    const existingEntries = parseJsonlFile(filePath);
    for (let i = existingEntries.length - 1; i >= 0; i--) {
      const prior = existingEntries[i];
      if (prior && prior.test_count != null && Number.isFinite(Number(prior.test_count))) {
        test_delta = test_count - Number(prior.test_count);
        break;
      }
    }
  }

  const entry = {
    phase: opts.phase,
    plan: opts.plan,
    phase_type: opts.phase_type || 'unknown',
    quality_level: opts.quality_level || 'standard',
    correction_count,
    gate_fire_count,
    duration_min: opts.duration_min != null ? Number(opts.duration_min) : null,
    test_count: test_count,
    test_delta: test_delta,
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8');

  if (raw) {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console.log(`Benchmark recorded: phase=${entry.phase} plan=${entry.plan} corrections=${entry.correction_count} gates=${entry.gate_fire_count}`);
  }
}

module.exports = { cmdBenchmarkPlan };
