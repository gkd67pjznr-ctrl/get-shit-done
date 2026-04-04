'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Parse a JSONL file, returning an array of parsed objects.
 * Lines that fail to parse are silently dropped.
 */
function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  return lines
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

/**
 * Measure the token cost of a single skill directory.
 *
 * @param {string} skillName - e.g. "gsd-workflow"
 * @param {string} projectRoot - absolute path to project root
 * @returns {{ skill: string, char_count: number, token_estimate: number }}
 */
function measureSkillTokenCost(skillName, projectRoot) {
  try {
    const skillDir = path.join(projectRoot, '.claude', 'skills', skillName);
    if (!fs.existsSync(skillDir) || !fs.statSync(skillDir).isDirectory()) {
      return { skill: skillName, char_count: 0, token_estimate: 0 };
    }

    // Collect all files recursively (Node 18+)
    const entries = fs.readdirSync(skillDir, { recursive: true });
    let totalChars = 0;
    for (const entry of entries) {
      const fullPath = path.join(skillDir, entry);
      try {
        if (fs.statSync(fullPath).isFile()) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          totalChars += content.length;
        }
      } catch {
        // Skip unreadable files
      }
    }

    const tokenEstimate = Math.ceil(totalChars / 4);
    return { skill: skillName, char_count: totalChars, token_estimate: tokenEstimate };
  } catch {
    return { skill: skillName, char_count: 0, token_estimate: 0 };
  }
}

/**
 * Measure token costs for all skills under .claude/skills/.
 *
 * @param {string} projectRoot - absolute path to project root
 * @returns {{ [skillName: string]: number }} map of skill name -> token_estimate
 */
function measureAllSkillTokenCosts(projectRoot) {
  try {
    const skillsDir = path.join(projectRoot, '.claude', 'skills');
    if (!fs.existsSync(skillsDir) || !fs.statSync(skillsDir).isDirectory()) {
      return {};
    }

    const entries = fs.readdirSync(skillsDir);
    const result = {};
    for (const entry of entries) {
      const fullPath = path.join(skillsDir, entry);
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          const { token_estimate } = measureSkillTokenCost(entry, projectRoot);
          result[entry] = token_estimate;
        }
      } catch {
        // Skip unreadable entries
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Aggregate skill token costs across sessions.
 *
 * @param {object[]} sessions - array of parsed session objects
 * @param {object|null|undefined} skillScores - the `skills` sub-object from skill-scores.json
 * @returns {Array<{ skill: string, avg_cost: number, load_count: number, cost_per_fire: number }>}
 */
function aggregateSkillBudget(sessions, skillScores) {
  const totalCost = {};
  const loadCount = {};

  for (const session of sessions) {
    if (!session || typeof session.skill_token_cost !== 'object' || session.skill_token_cost === null) {
      continue;
    }
    for (const [skill, cost] of Object.entries(session.skill_token_cost)) {
      totalCost[skill] = (totalCost[skill] || 0) + cost;
      loadCount[skill] = (loadCount[skill] || 0) + 1;
    }
  }

  const skills = Object.keys(totalCost);
  if (skills.length === 0) return [];

  const scores = skillScores || {};
  const result = skills.map(skill => {
    const avgCost = totalCost[skill] / loadCount[skill];
    const finalScore = scores[skill]?.final_score ?? 0;
    const denominator = finalScore <= 0 ? 0.001 : finalScore;
    const costPerFire = Math.round((avgCost / denominator) * 100) / 100;
    return {
      skill,
      avg_cost: avgCost,
      load_count: loadCount[skill],
      cost_per_fire: costPerFire,
    };
  });

  // Sort by avg_cost descending
  result.sort((a, b) => b.avg_cost - a.avg_cost);
  return result;
}

/**
 * CLI: skill-budget measure --skill <name> [--raw]
 */
function cmdSkillBudgetMeasure(cwd, skillName, raw) {
  const result = measureSkillTokenCost(skillName, cwd);
  if (raw) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    console.log(`${result.skill}: ${result.char_count} chars (~${result.token_estimate} tokens)`);
  }
}

/**
 * CLI: skill-budget aggregate [--raw]
 */
function cmdSkillBudgetAggregate(cwd, raw) {
  const sessionsPath = path.join(cwd, '.planning', 'patterns', 'sessions.jsonl');
  const sessions = parseJsonlFile(sessionsPath);

  let skillScores = {};
  try {
    const scoresPath = path.join(cwd, '.planning', 'patterns', 'skill-scores.json');
    if (fs.existsSync(scoresPath)) {
      const scoresDoc = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
      skillScores = scoresDoc.skills || {};
    }
  } catch {
    // Default to empty
  }

  const result = aggregateSkillBudget(sessions, skillScores);

  if (raw) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    console.log(`Skill Budget Aggregate (${sessions.length} sessions analyzed):`);
    if (result.length === 0) {
      console.log('  No skill_token_cost data found in sessions.');
      return;
    }
    console.log('skill              avg_cost  loads  cost_per_fire');
    for (const entry of result) {
      const skillPad = entry.skill.padEnd(18);
      const costPad = String(Math.round(entry.avg_cost)).padEnd(9);
      const loadsPad = String(entry.load_count).padEnd(6);
      console.log(`${skillPad} ${costPad} ${loadsPad} ${entry.cost_per_fire}`);
    }
  }
}

module.exports = {
  parseJsonlFile,
  measureSkillTokenCost,
  measureAllSkillTokenCosts,
  aggregateSkillBudget,
  cmdSkillBudgetMeasure,
  cmdSkillBudgetAggregate,
};
