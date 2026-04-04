'use strict';

/**
 * Debt — Tech debt tracking operations
 *
 * Creates and manages DEBT.md at .planning/DEBT.md (project-level, NOT milestone-scoped).
 * DEBT.md is intentionally project-level per STATE.md design decision:
 * debt entries carry source_phase/source_plan for provenance instead of path scoping.
 */

const fs = require('fs');
const path = require('path');
const { output, error, escapeRegex } = require('./core.cjs');

/**
 * Parse the highest existing TD-NNN ID and return the next one.
 * Uses TD-\d+ pattern which self-filters the separator row (|---|---).
 *
 * @param {string} content - Full DEBT.md file content
 * @returns {string} Next ID like 'TD-001', 'TD-002', etc.
 */
function getNextDebtId(content) {
  const matches = [...content.matchAll(/\|\s*(TD-(\d+))\s*\|/g)];
  if (matches.length === 0) return 'TD-001';
  const maxN = Math.max(...matches.map(m => parseInt(m[2], 10)));
  return 'TD-' + String(maxN + 1).padStart(3, '0');
}

/**
 * Parse all data rows from DEBT.md content into objects.
 * Finds header by '| id |', skips separator row, parses remaining rows.
 *
 * @param {string} content - Full DEBT.md file content
 * @returns {Array<Object>} Array of debt entry objects with 10 fields each
 */
function parseDebtRows(content) {
  const entries = [];
  const lines = content.split('\n');
  // Find header line with column names
  const headerIdx = lines.findIndex(l => l.includes('| id |'));
  if (headerIdx === -1) return entries;
  // Data rows start 2 lines after header (skip separator line)
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line.slice(1, -1).split('|').map(c => c.trim());
    if (cells.length < 10) continue;
    entries.push({
      id: cells[0],
      type: cells[1],
      severity: cells[2],
      component: cells[3],
      description: cells[4],
      date_logged: cells[5],
      logged_by: cells[6],
      status: cells[7],
      source_phase: cells[8],
      source_plan: cells[9],
    });
  }
  return entries;
}

/**
 * Log a new tech debt entry to DEBT.md.
 * Creates DEBT.md with header if it does not exist.
 * Uses fs.appendFileSync (O_APPEND) for atomic single-row writes.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - { type, severity, component, description, logged_by, source_phase, source_plan }
 * @param {boolean} raw - Raw output mode
 */
function cmdDebtLog(cwd, opts, raw) {
  // DEBT.md is project-level: intentionally hardcoded, not milestone-scoped.
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');

  // Initialize file with header if it does not exist
  if (!fs.existsSync(debtPath)) {
    const header = [
      '# DEBT.md — Tech Debt Register',
      '',
      'Project-level tracker for structured tech debt. Entries logged by `gsd-tools debt log`.',
      '',
      '| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |',
      '|----|------|----------|-----------|-------------|-------------|-----------|--------|--------------|-------------|',
      '',
    ].join('\n');
    fs.writeFileSync(debtPath, header, 'utf-8');
  }

  const content = fs.readFileSync(debtPath, 'utf-8');
  const id = getNextDebtId(content);
  const date = new Date().toISOString().split('T')[0];

  // Sanitize pipe characters from all free-text fields (pipe is the table delimiter)
  const sanitize = (v) => (v || '').replace(/\|/g, '/');

  const row = `| ${id} | ${sanitize(opts.type)} | ${sanitize(opts.severity)} | ${sanitize(opts.component)} | ${sanitize(opts.description)} | ${date} | ${sanitize(opts.logged_by)} | open | ${sanitize(opts.source_phase)} | ${sanitize(opts.source_plan)} |\n`;

  fs.appendFileSync(debtPath, row, 'utf-8');
  output({ id, logged: true }, raw, id);
}

/**
 * List debt entries from DEBT.md with optional filtering.
 * Returns { entries: [], total: 0 } gracefully if DEBT.md does not exist.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - { status, severity, type } — all optional filters
 * @param {boolean} raw - Raw output mode
 */
function cmdDebtList(cwd, opts, raw) {
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  if (!fs.existsSync(debtPath)) {
    output({ entries: [], total: 0 }, raw, '[]');
    return;
  }
  const content = fs.readFileSync(debtPath, 'utf-8');
  let entries = parseDebtRows(content);

  if (opts.status) entries = entries.filter(e => e.status === opts.status);
  if (opts.severity) entries = entries.filter(e => e.severity === opts.severity);
  if (opts.type) entries = entries.filter(e => e.type === opts.type);

  output({ entries, total: entries.length }, raw, JSON.stringify(entries));
}

/**
 * Transition a debt entry's status field in-place.
 * Returns { updated: false } gracefully when ID is not found.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - { id, status } — both required
 * @param {boolean} raw - Raw output mode
 */
function cmdDebtResolve(cwd, opts, raw) {
  if (!opts.id) error('--id required for debt resolve');
  if (!opts.status) error('--status required for debt resolve');

  const validStatuses = ['open', 'in-progress', 'resolved', 'deferred'];
  if (!validStatuses.includes(opts.status)) {
    error(`Invalid status "${opts.status}". Must be: ${validStatuses.join(', ')}`);
  }

  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  if (!fs.existsSync(debtPath)) error('DEBT.md not found — run debt log first');

  let content = fs.readFileSync(debtPath, 'utf-8');
  const idEscaped = escapeRegex(opts.id);

  // Match the row with this ID and replace the status column (8th pipe-delimited cell).
  // Row format: | TD-NNN | type | severity | component | description | date | logged_by | STATUS | source_phase | source_plan |
  // Use [^|]* (not .*) for each cell to avoid matching across cell boundaries.
  const rowPattern = new RegExp(
    `(\\|\\s*${idEscaped}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|)\\s*[^|]+\\s*(\\|[^|]*\\|[^|]*\\|)`,
    'i'
  );

  if (!rowPattern.test(content)) {
    output({ updated: false, reason: `${opts.id} not found in DEBT.md` }, raw, 'false');
    return;
  }

  content = content.replace(rowPattern, `$1 ${opts.status} $2`);
  fs.writeFileSync(debtPath, content, 'utf-8');
  output({ id: opts.id, status: opts.status, updated: true }, raw, 'true');
}

/**
 * Compute debt impact by joining DEBT.md entries with corrections.jsonl.
 * Read-only — never modifies DEBT.md.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - {} (no required options; future: --status filter)
 * @param {boolean} raw - Raw output mode
 */
function cmdDebtImpact(cwd, opts, raw) {
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  if (!fs.existsSync(debtPath)) {
    output({ entries: [], total: 0 }, raw, '[]');
    return;
  }

  const debtContent = fs.readFileSync(debtPath, 'utf-8');
  const debtEntries = parseDebtRows(debtContent);

  // Load active corrections
  const correctionsPath = path.join(cwd, '.planning', 'patterns', 'corrections.jsonl');
  let corrections = [];
  if (fs.existsSync(correctionsPath)) {
    const lines = fs.readFileSync(correctionsPath, 'utf-8')
      .split('\n')
      .filter(l => l.trim() !== '');
    corrections = lines
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(c => c && !c.retired_at);
  }

  // For each debt entry, count matching corrections
  const results = debtEntries.map(entry => {
    // Primary signal: source_phase correlation
    const phaseMatches = corrections.filter(
      c => String(c.phase) === String(entry.source_phase)
    );

    // Secondary signal: component substring match (case-insensitive)
    // Only applies if corrections have a 'component' field
    const componentMatches = corrections.filter(c => {
      if (!c.component || !entry.component) return false;
      return c.component.toLowerCase().includes(entry.component.toLowerCase()) ||
        entry.component.toLowerCase().includes(c.component.toLowerCase());
    });

    // Union of both signals, deduplicate by object identity
    const allMatched = [...phaseMatches];
    componentMatches.forEach(c => {
      if (!allMatched.includes(c)) allMatched.push(c);
    });

    const correction_count = allMatched.length;
    let link_confidence;
    if (correction_count >= 3) link_confidence = 'high';
    else if (correction_count >= 1) link_confidence = 'medium';
    else link_confidence = 'low';

    return {
      id: entry.id,
      type: entry.type,
      severity: entry.severity,
      component: entry.component,
      description: entry.description,
      source_phase: entry.source_phase,
      correction_count,
      link_confidence,
      matched_corrections: allMatched.map(c => ({
        phase: c.phase,
        category: c.diagnosis_category,
        component: c.component || null,
      })),
    };
  });

  // Sort by correction_count descending, then id ascending as tiebreaker
  results.sort((a, b) => {
    if (b.correction_count !== a.correction_count) return b.correction_count - a.correction_count;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  output({ entries: results, total: results.length }, raw, JSON.stringify(results));
}

module.exports = { cmdDebtLog, cmdDebtList, cmdDebtResolve, cmdDebtImpact };
