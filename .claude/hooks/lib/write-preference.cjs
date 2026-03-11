'use strict';
// Preference promotion library for the correction-to-preference pipeline.
// Exports checkAndPromote() and readPreferences() for use by write-correction.cjs
// and Phase 24 recall consumers.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by PostToolUse hooks.
// Zero external dependencies — built-in Node.js fs and path only.

const fs = require('fs');
const path = require('path');

/**
 * Scans all correction files (active + archived) and counts entries matching
 * both diagnosis_category and scope. Also tracks the latest timestamp and
 * correction_to text among all matching entries.
 *
 * @param {string} patternsDir
 * @param {string} category - diagnosis_category to match
 * @param {string} scope - scope to match
 * @returns {{ count: number, latestTs: string|null, latestText: string|null }}
 */
function countMatchingCorrections(patternsDir, category, scope) {
  try {
    let count = 0;
    let latestTs = null;
    let latestText = null;

    // Gather all correction files: active + archives
    const files = ['corrections.jsonl'];
    try {
      const dirFiles = fs.readdirSync(patternsDir);
      for (const f of dirFiles) {
        if (f.startsWith('corrections-') && f.endsWith('.jsonl')) {
          files.push(f);
        }
      }
    } catch (e) {
      // No archive files or patternsDir doesn't exist yet — proceed with just active file
    }

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(patternsDir, file), 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (entry.diagnosis_category === category && entry.scope === scope) {
              count++;
              if (!latestTs || entry.timestamp > latestTs) {
                latestTs = entry.timestamp;
                latestText = entry.correction_to;
              }
            }
          } catch (e) {
            // Skip malformed lines silently
          }
        }
      } catch (e) {
        // Skip unreadable files silently
      }
    }

    return { count, latestTs, latestText };
  } catch (e) {
    return { count: 0, latestTs: null, latestText: null };
  }
}

/**
 * Upserts a preference entry into preferences.jsonl using temp-file-swap
 * for atomic writes. Finds existing entry by category+scope; updates in-place
 * or appends new entry if not found. Preserves created_at and retired_at from
 * the existing entry unless the new preference object explicitly provides them.
 *
 * @param {string} patternsDir
 * @param {object} preference - Preference fields to write/update
 * @returns {{ upserted: boolean, reason?: string, error?: string }}
 */
function upsertPreference(patternsDir, preference) {
  try {
    const filePath = path.join(patternsDir, 'preferences.jsonl');
    const tmpPath = filePath + '.tmp';
    const now = new Date().toISOString();

    // Read existing lines
    let rawLines = [];
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      rawLines = content.split('\n').filter(l => l.trim() !== '');
    } catch (e) {
      if (e.code !== 'ENOENT') {
        // Unexpected error reading existing file
        return { upserted: false, reason: 'error', error: e.message };
      }
      // ENOENT: file doesn't exist yet — start fresh
    }

    // Parse existing entries
    let found = false;
    const updatedLines = rawLines.map(line => {
      try {
        const existing = JSON.parse(line);
        if (existing.category === preference.category && existing.scope === preference.scope) {
          found = true;
          // Merge: spread existing first (preserves created_at, retired_at),
          // then spread new preference (updates confidence, etc.), then set updated_at
          return JSON.stringify({ ...existing, ...preference, updated_at: now });
        }
        return line;
      } catch (e) {
        // Preserve malformed lines as-is (don't lose data on parse errors)
        return line;
      }
    });

    if (!found) {
      // New entry — set created_at, updated_at, retired_at
      const newEntry = {
        ...preference,
        created_at: now,
        updated_at: now,
        retired_at: null,
      };
      updatedLines.push(JSON.stringify(newEntry));
    }

    // Write to temp file then rename (atomic on most filesystems)
    fs.writeFileSync(tmpPath, updatedLines.join('\n') + '\n');
    fs.renameSync(tmpPath, filePath);

    return { upserted: true };
  } catch (e) {
    return { upserted: false, reason: 'error', error: e.message };
  }
}

/**
 * Checks if a correction entry's category+scope pattern has met the promotion
 * threshold (3 occurrences). If so, upserts a preference entry in preferences.jsonl.
 * Silent failure on all errors — never throws.
 *
 * @param {object} entry - Correction entry (must have diagnosis_category and scope)
 * @param {{ cwd?: string }} [options]
 * @returns {{ promoted: boolean, reason?: string, count?: number, confidence?: number, error?: string }}
 */
function checkAndPromote(entry, options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const patternsDir = path.join(cwd, '.planning', 'patterns');

    // Validate entry has required fields
    if (!entry ||
        typeof entry.diagnosis_category !== 'string' || entry.diagnosis_category === '' ||
        typeof entry.scope !== 'string' || entry.scope === '') {
      return { promoted: false, reason: 'invalid_entry' };
    }

    const { count, latestTs, latestText } = countMatchingCorrections(
      patternsDir,
      entry.diagnosis_category,
      entry.scope
    );

    if (count < 3) {
      return { promoted: false, reason: 'below_threshold', count };
    }

    // Build preference object
    const preference = {
      category: entry.diagnosis_category,
      scope: entry.scope,
      preference_text: latestText || entry.correction_to || '',
      confidence: count / (count + 2),
      source_count: count,
      last_correction_ts: latestTs || entry.timestamp || new Date().toISOString(),
    };

    upsertPreference(patternsDir, preference);

    // Cross-project promotion (non-critical -- silent failure)
    try {
      const { promoteToUserLevel } = require('./promote-preference.cjs');
      const projectId = path.basename(cwd);
      promoteToUserLevel(preference, { projectId });
    } catch (e) {
      // Silent failure -- cross-project promotion must never break project-level writes
    }

    return { promoted: true, count, confidence: preference.confidence };
  } catch (e) {
    return { promoted: false, reason: 'error', error: e.message };
  }
}

/**
 * Reads and filters preferences.jsonl by scope and/or status.
 * Returns parsed preference objects. Silent failure on all errors.
 *
 * @param {{ scope?: string, status?: 'active'|'retired' }} [filters]
 * @param {{ cwd?: string }} [options]
 * @returns {object[]}
 */
function readPreferences(filters, options) {
  try {
    const f = filters || {};
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();
    const filePath = path.join(cwd, '.planning', 'patterns', 'preferences.jsonl');

    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      return []; // ENOENT or unreadable — return empty
    }

    let entries = content
      .split('\n')
      .filter(l => l.trim() !== '')
      .map(l => {
        try { return JSON.parse(l); } catch (e) { return null; }
      })
      .filter(e => e !== null);

    // Apply filters
    if (f.scope) {
      entries = entries.filter(e => e.scope === f.scope);
    }
    if (f.status === 'active') {
      entries = entries.filter(e => !e.retired_at);
    } else if (f.status === 'retired') {
      entries = entries.filter(e => !!e.retired_at);
    }

    return entries;
  } catch (e) {
    return [];
  }
}

module.exports = { checkAndPromote, readPreferences };

// CLI invocation: node write-preference.cjs '{"diagnosis_category":"...","scope":"..."}' '<cwd>'
if (require.main === module) {
  const arg = process.argv[2] || '';
  let entry = {};
  try { entry = JSON.parse(arg); } catch (e) {
    process.stderr.write('write-preference: invalid JSON argument\n');
    process.exit(0); // silent failure even in CLI mode
  }
  const cwd = process.argv[3] || process.cwd();
  const result = checkAndPromote(entry, { cwd });
  if (process.env.DEBUG_PREFERENCES) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
