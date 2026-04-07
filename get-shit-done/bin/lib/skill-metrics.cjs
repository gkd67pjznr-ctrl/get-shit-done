'use strict';
const fs = require('fs');
const path = require('path');
const { learningsWrite } = require('./learnings.cjs');

const CATEGORY_SKILL_MAP = {
  'code.wrong_pattern': 'typescript-patterns',
  'code.missing_context': 'code-review',
  'code.stale_knowledge': 'typescript-patterns',
  'code.over_engineering': 'code-review',
  'code.under_engineering': 'code-review',
  'code.style_mismatch': 'typescript-patterns',
  'code.scope_drift': 'gsd-workflow',
  'process.planning_error': 'gsd-workflow',
  'process.research_gap': 'gsd-workflow',
  'process.implementation_bug': 'code-review',
  'process.integration_miss': 'code-review',
  'process.convention_violation': 'session-awareness',
  'process.requirement_misread': 'gsd-workflow',
  'process.regression': 'code-review',
};

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  return lines
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function loadCorrections(cwd, milestoneScope) {
  const milestonePath = milestoneScope
    ? path.join(cwd, '.planning', 'milestones', milestoneScope, 'patterns', 'corrections.jsonl')
    : null;
  const fallbackPath = path.join(cwd, '.planning', 'patterns', 'corrections.jsonl');
  const filePath = (milestonePath && fs.existsSync(milestonePath)) ? milestonePath : fallbackPath;
  return parseJsonlFile(filePath);
}

function loadSessions(cwd) {
  const filePath = path.join(cwd, '.planning', 'patterns', 'sessions.jsonl');
  return parseJsonlFile(filePath);
}

function computeAttributionConfidence(correctionCount, sessionCount) {
  if (sessionCount >= 10 && correctionCount > 0) return 'high';
  if (sessionCount >= 3) return 'medium';
  return 'low';
}

function computeSkillMetrics(corrections, sessions) {
  // Step 1: Attribute active corrections to skills via CATEGORY_SKILL_MAP
  const correctionsBySkill = {};
  const lastCorrectionBySkill = {};
  const categoriesBySkill = {};
  let unmappedCount = 0;

  for (const c of corrections) {
    const skill = CATEGORY_SKILL_MAP[c.diagnosis_category];
    if (!skill) { unmappedCount++; continue; }
    correctionsBySkill[skill] = (correctionsBySkill[skill] || 0) + 1;
    if (!lastCorrectionBySkill[skill] || c.timestamp > lastCorrectionBySkill[skill]) {
      lastCorrectionBySkill[skill] = c.timestamp;
    }
    if (!categoriesBySkill[skill]) categoriesBySkill[skill] = {};
    categoriesBySkill[skill][c.diagnosis_category] = (categoriesBySkill[skill][c.diagnosis_category] || 0) + 1;
  }

  // Step 2: Count session appearances per skill from skills_loaded arrays
  const sessionsBySkill = {};
  for (const s of sessions) {
    for (const skill of (s.skills_loaded || [])) {
      sessionsBySkill[skill] = (sessionsBySkill[skill] || 0) + 1;
    }
  }

  // Step 3: Build entries for all skills with any data (corrections OR sessions)
  const allSkills = new Set([...Object.keys(correctionsBySkill), ...Object.keys(sessionsBySkill)]);
  const skillEntries = {};

  for (const skill of allSkills) {
    const correctionCount = correctionsBySkill[skill] || 0;
    const sessionCount = sessionsBySkill[skill] || 0;
    const cats = categoriesBySkill[skill] || {};
    const topCategories = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(e => e[0]);

    skillEntries[skill] = {
      correction_count: correctionCount,
      session_count: sessionCount,
      correction_rate: sessionCount > 0
        ? Math.round((correctionCount / sessionCount) * 1000) / 1000
        : null,
      attribution_confidence: computeAttributionConfidence(correctionCount, sessionCount),
      top_categories: topCategories,
      last_correction_at: lastCorrectionBySkill[skill] || null,
    };
  }

  return { skillEntries, unmappedCount };
}

function cmdSkillMetricsCompute(cwd, opts, raw) {
  const milestoneScope = (opts || {}).milestone_scope || null;
  const allCorrections = loadCorrections(cwd, milestoneScope);
  const activeCorrections = allCorrections.filter(c => !c.retired_at);
  const sessions = loadSessions(cwd);

  const { skillEntries, unmappedCount } = computeSkillMetrics(activeCorrections, sessions);

  const doc = {
    metadata: {
      computed_at: new Date().toISOString(),
      total_active_corrections: activeCorrections.length,
      total_sessions_with_skills: sessions.filter(s => (s.skills_loaded || []).length > 0).length,
      attribution_method: 'CATEGORY_SKILL_MAP',
      unmapped_correction_count: unmappedCount,
    },
    skills: skillEntries,
  };

  const patternsDir = path.join(cwd, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  const outPath = path.join(patternsDir, 'skill-metrics.json');
  const tmpPath = outPath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2));
  fs.renameSync(tmpPath, outPath);

  if (raw) {
    process.stdout.write(JSON.stringify(doc) + '\n');
  } else {
    console.log(`Skill metrics computed: ${Object.keys(skillEntries).length} skills`);
    console.log(`  Active corrections: ${activeCorrections.length} (${unmappedCount} unmapped)`);
    console.log(`  Sessions with skills: ${doc.metadata.total_sessions_with_skills}`);
    console.log(`  Written to: ${outPath}`);
  }
}

function cmdSkillMetricsShow(cwd, raw) {
  const filePath = path.join(cwd, '.planning', 'patterns', 'skill-metrics.json');
  if (!fs.existsSync(filePath)) {
    if (raw) {
      process.stdout.write(JSON.stringify({ error: 'not_found' }) + '\n');
    } else {
      console.log('No skill metrics found. Run: gsd-tools skill-metrics compute');
    }
    return;
  }
  const doc = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (raw) {
    process.stdout.write(JSON.stringify(doc) + '\n');
    return;
  }
  // Formatted table output — sorted by correction_count descending
  const skills = Object.entries(doc.skills)
    .sort((a, b) => b[1].correction_count - a[1].correction_count);
  console.log('| Skill | Corrections | Sessions | Rate | Confidence |');
  console.log('|-------|-------------|----------|------|------------|');
  for (const [skill, m] of skills) {
    const rate = m.correction_rate !== null
      ? `${(m.correction_rate * 100).toFixed(1)}%`
      : '—';
    console.log(`| ${skill} | ${m.correction_count} | ${m.session_count} | ${rate} | ${m.attribution_confidence} |`);
  }
}

/**
 * Bridge: when a suggestion is accepted/refined, also write it as a global learning.
 * Called by the /gsd:suggest workflow after updating suggestions.json.
 *
 * @param {string} cwd - Project root
 * @param {object} suggestion - The accepted suggestion object
 * @param {string} suggestion.target_skill - Skill being refined
 * @param {string} suggestion.category - Correction category
 * @param {number} suggestion.correction_count - How many corrections triggered this
 * @param {string[]} suggestion.sample_corrections - Sample correction descriptions
 */
function bridgeSuggestionToLearning(cwd, suggestion, raw) {
  const projectName = path.basename(cwd);
  const learning = `Skill "${suggestion.target_skill}" needed refinement for ${suggestion.category} pattern (${suggestion.correction_count} corrections). ` +
    `Samples: ${(suggestion.sample_corrections || []).slice(0, 2).join('; ')}`;

  const result = learningsWrite({
    source_project: projectName,
    learning,
    context: `Promoted from skill refinement suggestion in ${projectName}`,
    tags: ['skill-refinement', suggestion.category, suggestion.target_skill],
  });

  if (raw) {
    process.stdout.write(JSON.stringify({ bridged: true, learning_id: result.id, created: result.created }) + '\n');
  } else if (result.created) {
    console.log(`Learning created: ${result.id} (bridged from suggestion for ${suggestion.target_skill})`);
  } else {
    console.log(`Learning already exists (deduplicated): ${result.id}`);
  }
}

module.exports = { cmdSkillMetricsCompute, cmdSkillMetricsShow, bridgeSuggestionToLearning };
