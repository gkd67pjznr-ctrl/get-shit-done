'use strict';
// Shared correction write library for correction capture channels.
// All three detection channels (self-report, edit detection, revert detection)
// call writeCorrection() to persist entries to .planning/patterns/corrections.jsonl.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by PostToolUse hooks.

const fs = require('fs');
const path = require('path');

// Valid quality levels for the quality_level field on correction entries
const VALID_QUALITY_LEVELS = new Set(['fast', 'standard', 'strict']);

// 14-category correction taxonomy (two-tier, dot-notation)
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
 * Reads adaptive_learning.observation config from .planning/config.json.
 * Returns defaults on any error.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ retentionDays: number, maxEntries: number, captureCorrections: boolean }}
 */
function getObservationConfig(cwd) {
  const defaults = { retentionDays: 90, maxEntries: 1000, captureCorrections: true };
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const obs = (config.adaptive_learning || {}).observation || {};
    return {
      retentionDays: typeof obs.retention_days === 'number' ? obs.retention_days : defaults.retentionDays,
      maxEntries: typeof obs.max_entries === 'number' ? obs.max_entries : defaults.maxEntries,
      captureCorrections: typeof obs.capture_corrections === 'boolean' ? obs.capture_corrections : defaults.captureCorrections,
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * Deletes archive files in patternsDir older than retentionDays.
 * Silent on all errors.
 *
 * @param {string} patternsDir
 * @param {number} retentionDays
 */
function cleanupArchives(patternsDir, retentionDays) {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(patternsDir);
    for (const file of files) {
      if (!file.startsWith('corrections-') || !file.endsWith('.jsonl')) continue;
      const filePath = path.join(patternsDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Silent on individual file errors
      }
    }
  } catch (e) {
    // Silent on directory read errors
  }
}

/**
 * Renames corrections.jsonl to a dated archive.
 * If the dated name already exists, appends -1, -2, etc. until a free name is found.
 * Calls cleanupArchives after renaming.
 *
 * @param {string} filePath - path to corrections.jsonl
 * @param {string} patternsDir
 * @param {number} retentionDays
 */
function rotateFile(filePath, patternsDir, retentionDays) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    let archiveName = `corrections-${dateStr}.jsonl`;
    let archivePath = path.join(patternsDir, archiveName);

    // Find a free archive name
    let seq = 1;
    while (fs.existsSync(archivePath)) {
      archiveName = `corrections-${dateStr}-${seq}.jsonl`;
      archivePath = path.join(patternsDir, archiveName);
      seq++;
    }

    fs.renameSync(filePath, archivePath);
    cleanupArchives(patternsDir, retentionDays);
  } catch (e) {
    // Silent on rotation errors
  }
}

/**
 * Validates a correction entry has all required fields with non-empty values,
 * diagnosis_category is in the 14-category taxonomy,
 * and diagnosis_text does not exceed 100 tokens (word-count proxy).
 *
 * Required fields: correction_from, correction_to, diagnosis_category,
 * diagnosis_text, scope, phase, timestamp, session_id, source.
 * secondary_category is optional (may be null or absent).
 *
 * @param {object} entry
 * @returns {boolean}
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;

  const requiredFields = [
    'correction_from',
    'correction_to',
    'diagnosis_category',
    'diagnosis_text',
    'scope',
    'phase',
    'timestamp',
    'session_id',
    'source',
  ];

  for (const field of requiredFields) {
    const val = entry[field];
    if (val === undefined || val === null || val === '') return false;
  }

  // Validate diagnosis_category is in the 14-category taxonomy
  if (!VALID_CATEGORIES.has(entry.diagnosis_category)) return false;

  // Validate diagnosis_text does not exceed 100 tokens (word-count proxy)
  const wordCount = String(entry.diagnosis_text).trim().split(/\s+/).length;
  if (wordCount > 100) return false;

  return true;
}

/**
 * Writes a correction entry to .planning/patterns/corrections.jsonl.
 * Handles directory creation, field truncation, rotation, and retention cleanup.
 * Never throws -- all errors are caught and returned as { written: false, reason, error }.
 *
 * @param {object} entry - Correction entry object
 * @param {{ cwd?: string }} [options]
 * @returns {{ written: boolean, reason?: string, error?: string }}
 */
function writeCorrection(entry, options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const { retentionDays, maxEntries, captureCorrections } = getObservationConfig(cwd);

    if (!captureCorrections) {
      return { written: false, reason: 'capture_disabled' };
    }

    if (!validateEntry(entry)) {
      return { written: false, reason: 'invalid_entry' };
    }

    // Truncate long fields (create a shallow copy to avoid mutating caller's object)
    const safeEntry = Object.assign({}, entry);

    // Strip invalid quality_level values silently
    if (safeEntry.quality_level !== undefined && !VALID_QUALITY_LEVELS.has(safeEntry.quality_level)) {
      delete safeEntry.quality_level;
    }

    if (typeof safeEntry.correction_from === 'string' && safeEntry.correction_from.length > 200) {
      safeEntry.correction_from = safeEntry.correction_from.slice(0, 200);
    }
    if (typeof safeEntry.correction_to === 'string' && safeEntry.correction_to.length > 200) {
      safeEntry.correction_to = safeEntry.correction_to.slice(0, 200);
    }

    const patternsDir = path.join(cwd, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });

    const filePath = path.join(patternsDir, 'corrections.jsonl');

    // Check line count; rotate if at or above maxEntries
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').filter(l => l.trim() !== '').length;
      if (lineCount >= maxEntries) {
        rotateFile(filePath, patternsDir, retentionDays);
      }
    }

    fs.appendFileSync(filePath, JSON.stringify(safeEntry) + '\n');

    // Trigger preference promotion check (fire-and-forget, silent failure)
    try {
      const { checkAndPromote } = require('./write-preference.cjs');
      checkAndPromote(safeEntry, { cwd });
    } catch (e) {
      // Silent -- preference promotion failure must not affect correction capture
    }

    return { written: true };
  } catch (e) {
    return { written: false, reason: 'error', error: e.message };
  }
}

module.exports = { writeCorrection };

// CLI invocation: node write-correction.cjs '{"correction_from":"...","correction_to":"...",...}' '<cwd>'
if (require.main === module) {
  const arg = process.argv[2] || '';
  let entry = {};
  try { entry = JSON.parse(arg); } catch (e) {
    process.stderr.write('write-correction: invalid JSON argument\n');
    process.exit(0); // silent failure even in CLI mode
  }
  const cwd = process.argv[3] || process.cwd();
  const result = writeCorrection(entry, { cwd });
  if (process.env.DEBUG_CORRECTIONS) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
