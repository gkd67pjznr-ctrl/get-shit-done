'use strict';
// Retirement library for the suggestion pipeline.
// Retires corrections and preferences matching a diagnosis category after a
// skill refinement is confirmed. Non-destructive: adds retired_at + retired_by
// fields without deleting JSONL entries.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by hooks.
// Zero external dependencies — built-in Node.js fs and path only.

const fs = require('fs');
const path = require('path');

/**
 * Marks all active corrections and preferences matching `category` as retired,
 * and updates the matching suggestion in suggestions.json to status 'refined'.
 *
 * Processes corrections.jsonl AND all corrections-*.jsonl archive files.
 * Writes atomically using tmp+rename pattern.
 * Never throws — all errors caught silently.
 *
 * @param {string} category - diagnosis_category value to match (e.g. 'code.style_mismatch')
 * @param {string} suggestionId - ID of the accepted suggestion (written to retired_by)
 * @param {{ cwd?: string }} [options]
 */
function retireByCategory(category, suggestionId, options) {
  const cwd = (options && options.cwd) ? options.cwd : process.cwd();
  const patternsDir = path.join(cwd, '.planning', 'patterns');
  const now = new Date().toISOString();

  // --- Retire corrections (active file + all archive files) ---
  const corrFiles = ['corrections.jsonl'];
  try {
    const dirFiles = fs.readdirSync(patternsDir);
    for (const f of dirFiles) {
      if (f.startsWith('corrections-') && f.endsWith('.jsonl')) {
        corrFiles.push(f);
      }
    }
  } catch (e) {
    // patterns dir missing or unreadable — nothing to retire
    return;
  }

  for (const fileName of corrFiles) {
    const filePath = path.join(patternsDir, fileName);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      let changed = false;
      const updated = lines.map(line => {
        try {
          const entry = JSON.parse(line);
          if (entry.diagnosis_category === category && !entry.retired_at) {
            entry.retired_at = now;
            entry.retired_by = suggestionId;
            changed = true;
            return JSON.stringify(entry);
          }
          return line;
        } catch (e) {
          return line; // malformed line — pass through unchanged
        }
      });
      if (changed) {
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, updated.join('\n') + '\n');
        fs.renameSync(tmpPath, filePath);
      }
    } catch (e) {
      // file missing or unreadable — skip
    }
  }

  // --- Retire preferences ---
  const prefPath = path.join(patternsDir, 'preferences.jsonl');
  try {
    const content = fs.readFileSync(prefPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    let changed = false;
    const updated = lines.map(line => {
      try {
        const entry = JSON.parse(line);
        // preferences use 'category', not 'diagnosis_category'
        if (entry.category === category && !entry.retired_at) {
          entry.retired_at = now;
          entry.retired_by = suggestionId;
          changed = true;
          return JSON.stringify(entry);
        }
        return line;
      } catch (e) {
        return line;
      }
    });
    if (changed) {
      const tmpPath = prefPath + '.tmp';
      fs.writeFileSync(tmpPath, updated.join('\n') + '\n');
      fs.renameSync(tmpPath, prefPath);
    }
  } catch (e) {
    // no preferences file or unreadable — skip
  }

  // --- Update suggestions.json: mark suggestion as refined ---
  const suggestionsPath = path.join(patternsDir, 'suggestions.json');
  try {
    const content = fs.readFileSync(suggestionsPath, 'utf-8');
    const doc = JSON.parse(content);
    if (!doc || !Array.isArray(doc.suggestions)) return;
    let changed = false;
    for (const s of doc.suggestions) {
      if (s.id === suggestionId && s.status !== 'refined') {
        s.status = 'refined';
        s.refined_at = now;
        changed = true;
      }
    }
    if (changed) {
      const tmpPath = suggestionsPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2));
      fs.renameSync(tmpPath, suggestionsPath);
    }
  } catch (e) {
    // no suggestions.json or malformed — skip
  }
}

module.exports = { retireByCategory };

// CLI invocation: node retire.cjs <category> <suggestionId> [cwd]
if (require.main === module) {
  const category = process.argv[2];
  const suggestionId = process.argv[3];
  const cwd = process.argv[4] || process.cwd();
  if (category && suggestionId) {
    retireByCategory(category, suggestionId, { cwd });
  }
  process.exit(0);
}
