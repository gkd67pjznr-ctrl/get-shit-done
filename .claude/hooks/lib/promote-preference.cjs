'use strict';
// Cross-project preference promotion library.
// Exports promoteToUserLevel() and readUserPreferences() for use by write-preference.cjs.
//
// Uses CommonJS (require/module.exports) so it can be require()-d by PostToolUse hooks.
// Zero external dependencies -- Node.js built-ins only (fs, path, os).

const fs = require('fs');
const path = require('path');
const os = require('os');

function getGsdHome() {
  return process.env.GSD_HOME || path.join(os.homedir(), '.gsd');
}

/**
 * Reads ~/.gsd/preferences.json (or GSD_HOME/preferences.json).
 * Returns { version: '1.0', preferences: [] } if the file is missing,
 * unreadable, or malformed.
 *
 * @returns {{ version: string, preferences: object[] }}
 */
function readUserPreferences() {
  const filePath = path.join(getGsdHome(), 'preferences.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(raw);
    return doc && doc.preferences ? doc : { version: '1.0', preferences: [] };
  } catch (e) {
    return { version: '1.0', preferences: [] };
  }
}

/**
 * Writes preferences doc to ~/.gsd/preferences.json atomically via tmp+rename.
 * Creates ~/.gsd/ directory if it does not exist.
 *
 * @param {{ version: string, preferences: object[] }} doc
 */
function writeUserPreferences(doc) {
  const gsdHome = getGsdHome();
  fs.mkdirSync(gsdHome, { recursive: true });
  const filePath = path.join(gsdHome, 'preferences.json');
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Checks if a preference should be promoted to user-level.
 * Called after a project-level preference is written by checkAndPromote().
 *
 * Tracks source_projects: when 3+ distinct projects contribute the same
 * category+scope pattern, the entry is marked as promoted (promoted_at set).
 *
 * @param {object} preference - { category, scope, preference_text, confidence }
 * @param {{ projectId: string }} options
 * @returns {{ promoted: boolean, projectCount?: number, reason?: string, error?: string }}
 */
function promoteToUserLevel(preference, options) {
  try {
    const projectId = options && options.projectId;
    if (!projectId || !preference.category || !preference.scope) {
      return { promoted: false, reason: 'missing_fields' };
    }

    const doc = readUserPreferences();
    const now = new Date().toISOString();

    let entry = doc.preferences.find(
      p => p.category === preference.category && p.scope === preference.scope
    );

    if (!entry) {
      entry = {
        category: preference.category,
        scope: preference.scope,
        preference_text: preference.preference_text || '',
        confidence: preference.confidence || 0.5,
        source_projects: [projectId],
        promoted_at: null,
        updated_at: now,
      };
      doc.preferences.push(entry);
    } else {
      // Add project to source list only if not already present
      if (!entry.source_projects.includes(projectId)) {
        entry.source_projects.push(projectId);
      }
      // Update text and confidence from latest project (take max confidence)
      entry.preference_text = preference.preference_text || entry.preference_text;
      entry.confidence = Math.max(entry.confidence || 0, preference.confidence || 0);
      entry.updated_at = now;
    }

    // Promote when 3+ distinct projects contribute this pattern
    if (entry.source_projects.length >= 3 && !entry.promoted_at) {
      entry.promoted_at = now;
    }

    writeUserPreferences(doc);

    return {
      promoted: entry.source_projects.length >= 3,
      projectCount: entry.source_projects.length,
    };
  } catch (e) {
    return { promoted: false, reason: 'error', error: e.message };
  }
}

module.exports = { promoteToUserLevel, readUserPreferences };
