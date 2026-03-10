'use strict';
// Library for persisting Context7 library lookup calls to .planning/observations/context7-calls.jsonl.
// Called by the gsd-executor during Step 2 (Context7 Lookup) in standard or strict mode.
// Fast mode never calls this — fast mode skips Context7 entirely (Step 2 is bypassed).
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks and scripts.

const fs = require('fs');
const path = require('path');

/**
 * Reads adaptive_learning.observation config from .planning/config.json.
 * Returns defaults on any error.
 *
 * @param {string} cwd - Project root directory
 * @returns {{ retentionDays: number, maxEntries: number }}
 */
function getObservationConfig(cwd) {
  const defaults = { retentionDays: 90, maxEntries: 2000 };
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const obs = (config.adaptive_learning || {}).observation || {};
    return {
      retentionDays: typeof obs.retention_days === 'number' ? obs.retention_days : defaults.retentionDays,
      maxEntries: defaults.maxEntries, // Context7 calls use fixed 2000 rotation threshold
    };
  } catch (e) {
    return defaults;
  }
}

/**
 * Deletes archive files in observationsDir older than retentionDays.
 * Silent on all errors.
 *
 * @param {string} observationsDir
 * @param {number} retentionDays
 */
function cleanupArchives(observationsDir, retentionDays) {
  try {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(observationsDir);
    for (const file of files) {
      if (!file.startsWith('context7-calls-') || !file.endsWith('.jsonl')) continue;
      const filePath = path.join(observationsDir, file);
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
 * Renames context7-calls.jsonl to a dated archive.
 * If the dated name already exists, appends -1, -2, etc. until a free name is found.
 * Calls cleanupArchives after renaming.
 *
 * @param {string} filePath - path to context7-calls.jsonl
 * @param {string} observationsDir
 * @param {number} retentionDays
 */
function rotateFile(filePath, observationsDir, retentionDays) {
  try {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    let archiveName = `context7-calls-${dateStr}.jsonl`;
    let archivePath = path.join(observationsDir, archiveName);

    // Find a free archive name
    let seq = 1;
    while (fs.existsSync(archivePath)) {
      archiveName = `context7-calls-${dateStr}-${seq}.jsonl`;
      archivePath = path.join(observationsDir, archiveName);
      seq++;
    }

    fs.renameSync(filePath, archivePath);
    cleanupArchives(observationsDir, retentionDays);
  } catch (e) {
    // Silent on rotation errors
  }
}

/**
 * Validates a Context7 call entry has all required fields with valid values.
 * quality_level must be 'standard' or 'strict' — never 'fast'.
 *
 * Required fields: library, tokens_requested, token_cap, used, quality_level, phase, plan, timestamp.
 * query is optional.
 *
 * @param {object} entry
 * @returns {boolean}
 */
function validateEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;

  // library must be a non-empty string
  if (typeof entry.library !== 'string' || entry.library === '') return false;

  // tokens_requested must be an integer >= 0
  if (typeof entry.tokens_requested !== 'number' || !Number.isInteger(entry.tokens_requested) || entry.tokens_requested < 0) return false;

  // token_cap must be an integer >= 0
  if (typeof entry.token_cap !== 'number' || !Number.isInteger(entry.token_cap) || entry.token_cap < 0) return false;

  // used must be a boolean
  if (typeof entry.used !== 'boolean') return false;

  // quality_level must be 'standard' or 'strict' — never 'fast'
  if (entry.quality_level !== 'standard' && entry.quality_level !== 'strict') return false;

  // phase, plan, timestamp must be non-empty strings
  const stringFields = ['phase', 'plan', 'timestamp'];
  for (const field of stringFields) {
    const val = entry[field];
    if (typeof val !== 'string' || val === '') return false;
  }

  return true;
}

/**
 * Writes a Context7 call entry to .planning/observations/context7-calls.jsonl.
 * Handles directory creation, rotation, and retention cleanup.
 * Never throws -- all errors are caught and returned as { written: false, reason, error }.
 *
 * @param {object} entry - Context7 call entry
 * @param {{ cwd?: string }} [options]
 * @returns {{ written: boolean, reason?: string, error?: string }}
 */
function writeContext7Call(entry, options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const { retentionDays, maxEntries } = getObservationConfig(cwd);

    if (!validateEntry(entry)) {
      return { written: false, reason: 'invalid_entry' };
    }

    const observationsDir = path.join(cwd, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });

    const filePath = path.join(observationsDir, 'context7-calls.jsonl');

    // Check line count; rotate if at or above maxEntries (2000)
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lineCount = content.split('\n').filter(l => l.trim() !== '').length;
      if (lineCount >= maxEntries) {
        rotateFile(filePath, observationsDir, retentionDays);
      }
    }

    // Build the entry object — omit query if not present
    const record = {
      library: entry.library,
      ...(typeof entry.query === 'string' && entry.query !== '' ? { query: entry.query } : {}),
      tokens_requested: entry.tokens_requested,
      token_cap: entry.token_cap,
      used: entry.used,
      quality_level: entry.quality_level,
      phase: entry.phase,
      plan: entry.plan,
      timestamp: entry.timestamp,
    };

    fs.appendFileSync(filePath, JSON.stringify(record) + '\n');

    return { written: true };
  } catch (e) {
    return { written: false, reason: 'error', error: e.message };
  }
}

module.exports = { writeContext7Call };

// CLI invocation: node write-context7-call.cjs '{"library":"/vercel/next.js",...}' '<cwd>'
if (require.main === module) {
  const arg = process.argv[2] || '';
  let entry = {};
  try { entry = JSON.parse(arg); } catch (e) {
    process.stderr.write('write-context7-call: invalid JSON argument\n');
    process.exit(0); // silent failure even in CLI mode
  }
  const cwd = process.argv[3] || process.cwd();
  const result = writeContext7Call(entry, { cwd });
  if (process.env.DEBUG_CONTEXT7_CALL) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
