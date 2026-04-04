// Skill refinement library: accept or dismiss a pending suggestion.
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { retireByCategory } = require('./retire.cjs');

/**
 * Accept a pending suggestion: write sample corrections to the target SKILL.md,
 * commit the change, and retire matching corrections via retire.cjs.
 *
 * @param {{ suggestionId: string, cwd?: string }} options
 * @returns {{ ok: boolean, skillPath?: string, committed?: boolean, reason?: string, error?: string }}
 */
function acceptSuggestion({ suggestionId, cwd }) {
  try {
    const resolvedCwd = cwd || process.cwd();
    const suggestionsPath = path.join(resolvedCwd, '.planning', 'patterns', 'suggestions.json');

    const suggestionsContent = fs.readFileSync(suggestionsPath, 'utf-8');
    const doc = JSON.parse(suggestionsContent);

    const suggestion = doc.suggestions.find(s => s.id === suggestionId && s.status === 'pending');
    if (!suggestion) {
      return { ok: false, reason: 'not_found' };
    }

    const skillPath = path.join(resolvedCwd, '.claude', 'skills', suggestion.target_skill, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
      return { ok: false, reason: 'skill_file_missing', path: skillPath };
    }

    let content = fs.readFileSync(skillPath, 'utf-8');

    // Build bullets from sample_corrections (skip empty strings)
    const bullets = (suggestion.sample_corrections || [])
      .filter(c => c && c.trim() !== '')
      .map(c => `- [${suggestion.category}] ${c}`);

    if (bullets.length > 0) {
      const learnedPatternsHeading = '## Learned Patterns';
      if (content.includes(learnedPatternsHeading)) {
        // Append bullets after the existing heading
        const insertPos = content.indexOf(learnedPatternsHeading) + learnedPatternsHeading.length;
        const after = content.slice(insertPos);
        // Find the next blank line or next heading after the section
        const newBullets = '\n' + bullets.join('\n');
        content = content.slice(0, insertPos) + newBullets + after;
      } else {
        // Append a new section at the end
        const separator = content.endsWith('\n') ? '\n' : '\n\n';
        content = content + separator + learnedPatternsHeading + '\n' + bullets.join('\n') + '\n';
      }
    }

    fs.writeFileSync(skillPath, content);

    execSync('git add -f ' + JSON.stringify(skillPath), { cwd: resolvedCwd });
    execSync(
      'git commit -m ' + JSON.stringify(
        'refine(skill/' + suggestion.target_skill + '): apply correction pattern from suggestion ' + suggestionId
      ),
      { cwd: resolvedCwd }
    );

    // Capture diff after commit so HEAD~1 shows exactly what changed
    const diff = execSync(
      'git diff HEAD~1 -- ' + JSON.stringify(skillPath),
      { cwd: resolvedCwd }
    ).toString();
    appendSkillHistory(resolvedCwd, skillPath, suggestion, diff);

    retireByCategory(suggestion.category, suggestionId, { cwd: resolvedCwd });

    return { ok: true, skillPath, committed: true };
  } catch (e) {
    return { ok: false, reason: 'error', error: e.message };
  }
}

/**
 * Dismiss a pending suggestion: mark it dismissed in suggestions.json.
 * No skill files are modified and no git commit is created.
 *
 * @param {{ suggestionId: string, cwd?: string }} options
 * @returns {{ ok: boolean, dismissed?: boolean, reason?: string, error?: string }}
 */
function dismissSuggestion({ suggestionId, cwd }) {
  try {
    const resolvedCwd = cwd || process.cwd();
    const suggestionsPath = path.join(resolvedCwd, '.planning', 'patterns', 'suggestions.json');

    const suggestionsContent = fs.readFileSync(suggestionsPath, 'utf-8');
    const doc = JSON.parse(suggestionsContent);

    const suggestion = doc.suggestions.find(s => s.id === suggestionId && s.status === 'pending');
    if (!suggestion) {
      return { ok: false, reason: 'not_found' };
    }

    suggestion.status = 'dismissed';
    suggestion.dismissed_at = new Date().toISOString();
    suggestion.dismiss_reason = 'user_dismissed';

    const tmpPath = suggestionsPath + '.tmp';
    fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2));
    fs.renameSync(tmpPath, suggestionsPath);

    return { ok: true, dismissed: true };
  } catch (e) {
    return { ok: false, reason: 'error', error: e.message };
  }
}

/**
 * Revert a previously auto-applied suggestion by running git revert on its commit SHA.
 * Appends a 'reverted' marker entry to auto-applied.jsonl on success.
 *
 * @param {{ suggestionId: string, cwd?: string }} options
 * @returns {{ ok: boolean, reverted?: boolean, skill?: string, commit_sha?: string, reason?: string, error?: string }}
 */
function revertAutoApply({ suggestionId, cwd }) {
  const resolvedCwd = cwd || process.cwd();
  const auditPath = path.join(resolvedCwd, '.planning', 'patterns', 'auto-applied.jsonl');

  if (!fs.existsSync(auditPath)) {
    return { ok: false, reason: 'audit_log_missing' };
  }

  const lines = fs.readFileSync(auditPath, 'utf-8').split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  // Find the LAST 'applied' entry for this suggestion_id
  let foundEntry = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].suggestion_id === suggestionId && entries[i].action === 'applied') {
      foundEntry = entries[i];
      break;
    }
  }

  if (!foundEntry) {
    return { ok: false, reason: 'not_found' };
  }

  // Check if already reverted
  const alreadyReverted = entries.some(
    e => e.suggestion_id === suggestionId && e.action === 'reverted'
  );
  if (alreadyReverted) {
    return { ok: false, reason: 'already_reverted' };
  }

  const commit_sha = foundEntry.commit_sha;
  if (!commit_sha) {
    return { ok: false, reason: 'no_commit_sha' };
  }

  try {
    execSync('git revert --no-edit ' + commit_sha, { cwd: resolvedCwd });
  } catch (e) {
    return { ok: false, reason: 'git_revert_failed', error: e.message };
  }

  // Append reverted marker inline (avoid circular dep with auto-apply.cjs)
  const revertEntry = {
    action: 'reverted',
    suggestion_id: suggestionId,
    skill: foundEntry.skill,
    reverted_commit_sha: commit_sha,
    reverted_at: new Date().toISOString(),
  };
  fs.appendFileSync(auditPath, JSON.stringify(revertEntry) + '\n');

  return { ok: true, reverted: true, skill: foundEntry.skill, commit_sha };
}

/**
 * Append a structured history entry to SKILL-HISTORY.md in the skill directory.
 * Rotates to an archive file (SKILL-HISTORY-YYYY-MM.md) when entry count reaches 50.
 *
 * @param {string} cwd - Project root (unused but kept for API consistency)
 * @param {string} skillPath - Absolute path to SKILL.md
 * @param {{ id: string, category: string, rationale?: string }} suggestion
 * @param {string} diff - Unified diff string from git diff HEAD~1
 */
function appendSkillHistory(cwd, skillPath, suggestion, diff) {
  const skillDir = path.dirname(skillPath);
  const historyPath = path.join(skillDir, 'SKILL-HISTORY.md');

  // Read existing content (or empty string)
  const existing = fs.existsSync(historyPath)
    ? fs.readFileSync(historyPath, 'utf-8')
    : '';

  // Count existing entries by header pattern
  const entryCount = (existing.match(/^## Entry \d+/gm) || []).length;

  // Rotate if at or above 50 entries
  if (entryCount >= 50) {
    const dateStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    const archiveName = `SKILL-HISTORY-${dateStr}.md`;
    let archivePath = path.join(skillDir, archiveName);
    // Avoid collision: increment suffix if archive exists
    let seq = 1;
    while (fs.existsSync(archivePath)) {
      archivePath = path.join(skillDir, `SKILL-HISTORY-${dateStr}-${seq}.md`);
      seq++;
    }
    fs.writeFileSync(archivePath, existing, 'utf-8');
    fs.writeFileSync(historyPath, '', 'utf-8');
  }

  // Re-read after possible rotation
  const current = fs.existsSync(historyPath)
    ? fs.readFileSync(historyPath, 'utf-8')
    : '';
  const currentCount = (current.match(/^## Entry \d+/gm) || []).length;
  const nextEntry = currentCount + 1;

  const dateStr = new Date().toISOString().slice(0, 10);
  const entry = [
    `## Entry ${String(nextEntry).padStart(3, '0')} — ${dateStr}`,
    '',
    `**Suggestion:** ${suggestion.id}`,
    `**Category:** ${suggestion.category}`,
    `**Rationale:** ${suggestion.rationale || '(none)'}`,
    '',
    '```diff',
    diff.trim(),
    '```',
    '',
  ].join('\n');

  fs.appendFileSync(historyPath, entry + '\n', 'utf-8');
}

module.exports = { acceptSuggestion, dismissSuggestion, appendSkillHistory, revertAutoApply };

// CLI invocation:
//   node refine-skill.cjs accept <suggestionId> [cwd]
//   node refine-skill.cjs dismiss <suggestionId> [cwd]
//   node refine-skill.cjs revert <suggestionId> [cwd]
if (require.main === module) {
  const action = process.argv[2];
  const suggestionId = process.argv[3];
  const cwd = process.argv[4] || process.cwd();

  if (!action || !suggestionId) {
    console.error('Usage: node refine-skill.cjs <accept|dismiss|revert> <suggestionId> [cwd]');
    process.exit(1);
  }

  let result;
  if (action === 'accept') {
    result = acceptSuggestion({ suggestionId, cwd });
  } else if (action === 'dismiss') {
    result = dismissSuggestion({ suggestionId, cwd });
  } else if (action === 'revert') {
    result = revertAutoApply({ suggestionId, cwd });
  } else {
    console.error('Unknown action: ' + action);
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
