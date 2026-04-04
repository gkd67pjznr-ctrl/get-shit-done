'use strict';
const fs = require('fs');
const path = require('path');

const WRAPPER_TYPES = new Set(['wrapper_execution', 'wrapper_discussion', 'wrapper_planning', 'workflow']);

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function loadSessions(cwd, last) {
  const filePath = path.join(cwd, '.planning', 'patterns', 'sessions.jsonl');
  const entries = parseJsonlFile(filePath);
  return entries
    .filter(e => WRAPPER_TYPES.has(e.type))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, last);
}

function loadCorrections(cwd, milestoneScope) {
  const milestonePath = milestoneScope
    ? path.join(cwd, '.planning', 'milestones', milestoneScope, 'patterns', 'corrections.jsonl')
    : null;
  const fallbackPath = path.join(cwd, '.planning', 'patterns', 'corrections.jsonl');
  const filePath = (milestonePath && fs.existsSync(milestonePath)) ? milestonePath : fallbackPath;
  return parseJsonlFile(filePath);
}

function loadGateExecutions(cwd) {
  const filePath = path.join(cwd, '.planning', 'observations', 'gate-executions.jsonl');
  return parseJsonlFile(filePath);
}

function loadBenchmarks(cwd) {
  const filePath = path.join(cwd, '.planning', 'patterns', 'phase-benchmarks.jsonl');
  return parseJsonlFile(filePath);
}

function buildSessionRow(session, corrections, gateExecutions) {
  const phase = String(session.phase || '');
  const correctionCount = corrections.filter(c => String(c.phase) === phase && !c.retired_at).length;
  const gateCount = gateExecutions.filter(e => String(e.phase) === phase).length;
  const skills = Array.isArray(session.skills_loaded) ? session.skills_loaded : [];
  return {
    phase,
    timestamp: session.timestamp,
    type: session.type,
    correction_count: correctionCount,
    gate_fire_count: gateCount,
    skills,
  };
}

function computeBenchmarkTrends(benchmarks) {
  if (benchmarks.length === 0) return null;
  const avgCorrections = benchmarks.reduce((sum, b) => sum + (b.correction_count || 0), 0) / benchmarks.length;
  const avgGates = benchmarks.reduce((sum, b) => sum + (b.gate_fire_count || 0), 0) / benchmarks.length;
  const byType = {};
  for (const b of benchmarks) {
    const t = b.phase_type || 'unknown';
    if (!byType[t]) byType[t] = { count: 0, corrections: 0 };
    byType[t].count++;
    byType[t].corrections += (b.correction_count || 0);
  }
  return {
    avg_corrections: Math.round(avgCorrections * 100) / 100,
    avg_gates: Math.round(avgGates * 100) / 100,
    sample_count: benchmarks.length,
    by_phase_type: byType,
  };
}

function cmdSessionReport(cwd, opts, raw) {
  const last = (typeof opts.last === 'number' && opts.last > 0) ? opts.last : 10;
  const milestoneScope = opts.milestone_scope || null;

  const sessions = loadSessions(cwd, last);
  const corrections = loadCorrections(cwd, milestoneScope);
  const gateExecutions = loadGateExecutions(cwd);
  const benchmarks = loadBenchmarks(cwd);

  const sessionRows = sessions.map(s => buildSessionRow(s, corrections, gateExecutions));
  const trends = computeBenchmarkTrends(benchmarks);

  const result = {
    sessions: sessionRows,
    last,
    total_sessions_shown: sessionRows.length,
  };

  if (benchmarks.length > 0) {
    result.benchmarks = benchmarks;
    result.benchmark_trends = trends;
  }

  if (raw) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    console.log(`Session Report (last ${last} sessions)`);
    console.log('');
    console.log('| Phase | Timestamp | Type | Corrections | Gate Fires | Skills |');
    console.log('|-------|-----------|------|-------------|------------|--------|');
    for (const row of sessionRows) {
      const skillsStr = row.skills.length > 0 ? row.skills.join(', ') : 'none recorded';
      console.log(`| ${row.phase} | ${row.timestamp || '—'} | ${row.type || '—'} | ${row.correction_count} | ${row.gate_fire_count} | ${skillsStr} |`);
    }
    if (result.benchmark_trends) {
      console.log('');
      console.log(`Plan Performance Trends (${result.benchmark_trends.sample_count} plans):`);
      console.log(`  Avg corrections/plan: ${result.benchmark_trends.avg_corrections}`);
      console.log(`  Avg gate fires/plan:  ${result.benchmark_trends.avg_gates}`);
    }
  }
}

module.exports = { cmdSessionReport };
