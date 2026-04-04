// Auto-apply engine: evaluates pending skill refinement suggestions through
// five ordered safety gates and calls acceptSuggestion() when all gates pass.
// Silent failure convention — never throws; always returns a summary object.
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { acceptSuggestion } = require('./refine-skill.cjs');

const CONTROVERSIAL_CATEGORIES = [
  'code.over_engineering',
  'code.scope_drift',
  'process.planning_error',
];

const RATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Append a single JSONL entry to the audit log.
 * Creates the .planning/patterns/ directory if it does not exist.
 *
 * @param {object} entry
 * @param {string} cwd
 */
function appendAuditEntry(entry, cwd) {
  const auditPath = path.join(cwd, '.planning', 'patterns', 'auto-applied.jsonl');
  fs.mkdirSync(path.join(cwd, '.planning', 'patterns'), { recursive: true });
  fs.appendFileSync(auditPath, JSON.stringify(entry) + '\n');
}

/**
 * RATE GATE — blocks a suggestion when the same skill has an 'applied' entry
 * within the last 7 days in auto-applied.jsonl.
 *
 * @param {string} skillName
 * @param {string} cwd
 * @returns {{ pass: boolean, reason?: string, last_applied?: string }}
 */
function checkRateGate(skillName, cwd) {
  const auditPath = path.join(cwd, '.planning', 'patterns', 'auto-applied.jsonl');
  if (!fs.existsSync(auditPath)) {
    return { pass: true };
  }

  const now = Date.now();
  const lines = fs.readFileSync(auditPath, 'utf-8').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.skill === skillName && entry.action === 'applied') {
      const entryTime = new Date(entry.timestamp).getTime();
      if (!isNaN(entryTime) && (now - entryTime) < RATE_WINDOW_MS) {
        return { pass: false, reason: 'rate_limit', last_applied: entry.timestamp };
      }
    }
  }
  return { pass: true };
}

/**
 * QUALITY GATE — blocks a suggestion when the skill's attribution confidence is 'high'.
 * Fails open (returns pass: true) when metrics are unavailable.
 *
 * @param {string} skillName
 * @param {string} cwd
 * @returns {{ pass: boolean, reason?: string, quality?: string }}
 */
function checkQualityGate(skillName, cwd) {
  const metricsPath = path.join(cwd, '.planning', 'patterns', 'skill-metrics.json');
  if (!fs.existsSync(metricsPath)) {
    return { pass: true };
  }

  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
  } catch {
    return { pass: true };
  }

  // skill-metrics.json structure: { metadata: {}, skills: { [skillName]: { attribution_confidence, ... } } }
  const skills = doc.skills || {};
  const skillEntry = skills[skillName];
  if (!skillEntry) {
    return { pass: true };
  }

  // Use pre-computed attribution_confidence if available
  let confidence = skillEntry.attribution_confidence;

  // If not pre-computed, compute it from counts (mirrors skill-metrics.cjs logic)
  if (!confidence) {
    const correctionCount = skillEntry.correction_count || 0;
    const sessionCount = skillEntry.session_count || 0;
    if (sessionCount >= 10 && correctionCount > 0) {
      confidence = 'high';
    } else if (sessionCount >= 3) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
  }

  if (confidence === 'high') {
    return { pass: false, reason: 'quality_gate', quality: 'high' };
  }
  return { pass: true };
}

/**
 * CONFIDENCE GATE — blocks suggestions with confidence <= 0.95 or controversial categories.
 *
 * @param {object} suggestion
 * @returns {{ pass: boolean, reason?: string, confidence?: number, category?: string }}
 */
function checkConfidenceGate(suggestion) {
  if (typeof suggestion.confidence !== 'number' || suggestion.confidence <= 0.95) {
    return { pass: false, reason: 'confidence_too_low', confidence: suggestion.confidence };
  }
  if (CONTROVERSIAL_CATEGORIES.includes(suggestion.category)) {
    return { pass: false, reason: 'controversial_category', category: suggestion.category };
  }
  return { pass: true };
}

/**
 * SIZE GATE — blocks suggestions where the added bullet content would be >= 20%
 * of the current SKILL.md character length.
 *
 * @param {object} suggestion
 * @param {string} cwd
 * @returns {{ pass: boolean, reason?: string, change_percent?: number }}
 */
function checkSizeGate(suggestion, cwd) {
  const skillPath = path.join(cwd, '.claude', 'skills', suggestion.target_skill, 'SKILL.md');
  if (!fs.existsSync(skillPath)) {
    return { pass: false, reason: 'skill_missing' };
  }

  const content = fs.readFileSync(skillPath, 'utf-8');
  const originalLength = content.length;

  if (originalLength === 0) {
    return { pass: true, change_percent: 0 };
  }

  // Replicate exact bullet formatting from refine-skill.cjs lines 38-55
  const bullets = (suggestion.sample_corrections || [])
    .filter(c => c && c.trim() !== '')
    .map(c => `- [${suggestion.category}] ${c}`);

  if (bullets.length === 0) {
    return { pass: true, change_percent: 0 };
  }

  const learnedPatternsHeading = '## Learned Patterns';
  let addedLength;

  if (content.includes(learnedPatternsHeading)) {
    // Appending bullets after the existing heading
    const newBullets = '\n' + bullets.join('\n');
    addedLength = newBullets.length;
  } else {
    // Adding a new section: separator + heading + bullets
    const separator = content.endsWith('\n') ? '\n' : '\n\n';
    const newSection = separator + learnedPatternsHeading + '\n' + bullets.join('\n') + '\n';
    addedLength = newSection.length;
  }

  const changePercent = addedLength / originalLength;

  if (changePercent >= 0.20) {
    return { pass: false, reason: 'size_too_large', change_percent: changePercent };
  }
  return { pass: true, change_percent: changePercent };
}

/**
 * Main auto-apply engine. Evaluates pending suggestions through five safety gates
 * in order (CONFIG → RATE → QUALITY → CONFIDENCE → SIZE) and calls acceptSuggestion()
 * when all gates pass.
 *
 * @param {{ cwd: string }} options
 * @returns {{ applied: number, skipped: number, reason?: string, error?: string }}
 */
function runAutoApply({ cwd }) {
  try {
    const resolvedCwd = cwd || process.cwd();

    // CONFIG GATE — check adaptive_learning.auto_apply in config.json
    const configPath = path.join(resolvedCwd, '.planning', 'config.json');
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
      return { skipped: 0, applied: 0, reason: 'auto_apply_disabled' };
    }

    const autoApplyEnabled =
      config &&
      config.adaptive_learning &&
      config.adaptive_learning.auto_apply === true;

    if (!autoApplyEnabled) {
      return { skipped: 0, applied: 0, reason: 'auto_apply_disabled' };
    }

    // Load suggestions
    const suggestionsPath = path.join(resolvedCwd, '.planning', 'patterns', 'suggestions.json');
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(suggestionsPath, 'utf-8'));
    } catch {
      return { skipped: 0, applied: 0, reason: 'no_suggestions' };
    }

    const pendingSuggestions = (doc.suggestions || []).filter(s => s.status === 'pending');

    if (pendingSuggestions.length === 0) {
      return { skipped: 0, applied: 0, reason: 'no_suggestions' };
    }

    let applied = 0;
    let skipped = 0;
    let hadGateFailure = false;
    const now = new Date().toISOString();

    for (const suggestion of pendingSuggestions) {
      const skillName = suggestion.target_skill;

      // RATE GATE
      const rateResult = checkRateGate(skillName, resolvedCwd);
      if (!rateResult.pass) {
        appendAuditEntry({
          action: 'skipped',
          suggestion_id: suggestion.id,
          skill: skillName,
          gate: 'rate',
          reason: rateResult.reason,
          timestamp: now,
        }, resolvedCwd);
        suggestion.auto_apply_failed = true;
        suggestion.failed_gate = 'rate';
        hadGateFailure = true;
        skipped++;
        continue;
      }

      // QUALITY GATE
      const qualityResult = checkQualityGate(skillName, resolvedCwd);
      if (!qualityResult.pass) {
        appendAuditEntry({
          action: 'skipped',
          suggestion_id: suggestion.id,
          skill: skillName,
          gate: 'quality',
          reason: qualityResult.reason,
          timestamp: now,
        }, resolvedCwd);
        suggestion.auto_apply_failed = true;
        suggestion.failed_gate = 'quality';
        hadGateFailure = true;
        skipped++;
        continue;
      }

      // CONFIDENCE GATE
      const confidenceResult = checkConfidenceGate(suggestion);
      if (!confidenceResult.pass) {
        appendAuditEntry({
          action: 'skipped',
          suggestion_id: suggestion.id,
          skill: skillName,
          gate: 'confidence',
          reason: confidenceResult.reason,
          timestamp: now,
        }, resolvedCwd);
        suggestion.auto_apply_failed = true;
        suggestion.failed_gate = 'confidence';
        hadGateFailure = true;
        skipped++;
        continue;
      }

      // SIZE GATE
      const sizeResult = checkSizeGate(suggestion, resolvedCwd);
      if (!sizeResult.pass) {
        appendAuditEntry({
          action: 'skipped',
          suggestion_id: suggestion.id,
          skill: skillName,
          gate: 'size',
          reason: sizeResult.reason,
          timestamp: now,
        }, resolvedCwd);
        suggestion.auto_apply_failed = true;
        suggestion.failed_gate = 'size';
        hadGateFailure = true;
        skipped++;
        continue;
      }

      // All gates passed — apply the suggestion
      const applyResult = acceptSuggestion({ suggestionId: suggestion.id, cwd: resolvedCwd });

      if (applyResult.ok) {
        // Capture commit SHA (acceptSuggestion commits synchronously before returning)
        let commitSha = '';
        try {
          commitSha = execSync('git rev-parse HEAD', { cwd: resolvedCwd }).toString().trim();
        } catch {
          commitSha = '';
        }

        // Capture before/after diff
        const skillPath = path.join(resolvedCwd, '.claude', 'skills', skillName, 'SKILL.md');
        let beforeDiff = '';
        try {
          beforeDiff = execSync(
            'git diff HEAD~1 -- ' + JSON.stringify(skillPath),
            { cwd: resolvedCwd }
          ).toString();
        } catch {
          beforeDiff = '';
        }

        appendAuditEntry({
          action: 'applied',
          suggestion_id: suggestion.id,
          skill: skillName,
          skill_path: skillPath,
          commit_sha: commitSha,
          confidence: suggestion.confidence,
          change_percent: sizeResult.change_percent,
          source_corrections: suggestion.source_corrections || [],
          before_diff: beforeDiff,
          reversal_instructions: 'git revert ' + commitSha,
          timestamp: now,
        }, resolvedCwd);
        applied++;
      } else {
        appendAuditEntry({
          action: 'skipped',
          suggestion_id: suggestion.id,
          skill: skillName,
          gate: 'apply',
          reason: applyResult.reason || 'apply_failed',
          timestamp: now,
        }, resolvedCwd);
        suggestion.auto_apply_failed = true;
        suggestion.failed_gate = 'apply';
        hadGateFailure = true;
        skipped++;
      }
    }

    // Write back suggestions.json if any suggestion gained gate-failure flags
    if (hadGateFailure) {
      const tmpPath = suggestionsPath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2));
      fs.renameSync(tmpPath, suggestionsPath);
    }

    return { applied, skipped };
  } catch (e) {
    return { applied: 0, skipped: 0, reason: 'error', error: e.message };
  }
}

module.exports = { runAutoApply };
