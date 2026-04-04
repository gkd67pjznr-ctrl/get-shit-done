'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'be', 'it', 'this', 'that', 'as',
  'by', 'from', 'not', 'use', 'used', 'when', 'any', 'all', 'also',
]);

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const COLD_START_FLOOR = 0.3;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DECAY_RATE = 0.10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  return lines
    .filter(l => l.trim())
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function loadSessions(cwd) {
  return parseJsonlFile(path.join(cwd, '.planning', 'patterns', 'sessions.jsonl'));
}

function extractSkillDescription(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatterMatch) return '';
  const yaml = frontmatterMatch[1];

  // Case 1: block scalar — description: >\n  indented lines
  const blockMatch = yaml.match(/^description: >\n((?:[ \t]{2}[^\n]*\n?)+)/m);
  if (blockMatch) {
    return blockMatch[1].replace(/^[ \t]{2}/gm, '').trim();
  }

  // Case 2: inline quoted — description: "some text"
  const inlineMatch = yaml.match(/^description:\s+"([^"]+)"/m);
  if (inlineMatch) return inlineMatch[1].trim();

  // Case 3: bare value — description: some text
  const bareMatch = yaml.match(/^description:\s+(.+)/m);
  if (bareMatch) return bareMatch[1].trim();

  return '';
}

function tokenize(text) {
  return new Set(
    text.toLowerCase()
      .split(/[\s\-_.,;:!?()\[\]{}'"\/\\]+/)
      .filter(t => t.length > 1 && !STOP_WORDS.has(t))
  );
}

function jaccardScore(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

function getSkillAgeMs(skillDir) {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const stat = fs.statSync(skillMdPath);
  // Take the earlier of birthtime and mtime; if birthtime is 0, fall back to mtime
  const createTime = (stat.birthtimeMs && stat.birthtimeMs !== stat.mtimeMs)
    ? Math.min(stat.birthtimeMs, stat.mtimeMs)
    : stat.mtimeMs;
  return Date.now() - createTime;
}

function computeDormancyWeeks(skillName, sessions) {
  let mostRecentLoad = null;
  for (const session of sessions) {
    if ((session.skills_loaded || []).includes(skillName)) {
      const ts = new Date(session.timestamp).getTime();
      if (!isNaN(ts) && (!mostRecentLoad || ts > mostRecentLoad)) {
        mostRecentLoad = ts;
      }
    }
  }
  if (mostRecentLoad === null) return 0; // No history — no penalty
  const weeksAgo = (Date.now() - mostRecentLoad) / ONE_WEEK_MS;
  return Math.max(0, weeksAgo);
}

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

function isCacheEntryValid(cached, skillMdPath) {
  if (!cached || !cached.skill_content_hash) return false;
  const current = hashContent(fs.readFileSync(skillMdPath, 'utf-8'));
  return current === cached.skill_content_hash;
}

// ─── Core Scoring Pipeline ────────────────────────────────────────────────────

function scoreSkills(taskDescription, cwd) {
  const skillsDir = path.join(cwd, '.claude', 'skills');
  if (!fs.existsSync(skillsDir)) return [];

  const sessions = loadSessions(cwd);

  const cacheFile = path.join(cwd, '.planning', 'patterns', 'skill-scores.json');
  let cache = null;
  try {
    if (fs.existsSync(cacheFile)) {
      cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    }
  } catch { cache = null; }

  const taskHash = hashContent(taskDescription);
  const cacheValid = cache && cache.metadata && cache.metadata.task_hash === taskHash;

  const taskTokens = tokenize(taskDescription);
  const results = [];
  const newCacheSkills = {};

  const skillDirs = fs.readdirSync(skillsDir).filter(name => {
    try {
      return fs.statSync(path.join(skillsDir, name)).isDirectory();
    } catch { return false; }
  });

  for (const skillName of skillDirs) {
    const skillDir = path.join(skillsDir, skillName);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;

    const cachedEntry = cacheValid ? (cache.skills || {})[skillName] : null;
    const cacheEntryValid = cacheValid && isCacheEntryValid(cachedEntry, skillMdPath);

    let rawScore, finalScore, coldStartApplied, dormancyWeeks, contentHash;

    if (cacheEntryValid) {
      rawScore = cachedEntry.raw_score;
      finalScore = cachedEntry.final_score;
      coldStartApplied = cachedEntry.cold_start_applied;
      dormancyWeeks = cachedEntry.dormancy_weeks;
      contentHash = cachedEntry.skill_content_hash;
    } else {
      const skillContent = fs.readFileSync(skillMdPath, 'utf-8');
      contentHash = hashContent(skillContent);
      const descText = extractSkillDescription(skillContent);
      const skillTokens = tokenize(descText);
      rawScore = Math.round(jaccardScore(taskTokens, skillTokens) * 1000) / 1000;

      // Apply dormancy decay first
      dormancyWeeks = computeDormancyWeeks(skillName, sessions);
      const decayMultiplier = Math.pow(1 - DECAY_RATE, dormancyWeeks);
      let scoreAfterDecay = Math.round(rawScore * decayMultiplier * 1000) / 1000;

      // Apply cold-start floor AFTER decay (floor is safety net — last adjustment)
      const ageMs = getSkillAgeMs(skillDir);
      if (ageMs < FOURTEEN_DAYS_MS) {
        coldStartApplied = scoreAfterDecay < COLD_START_FLOOR;
        finalScore = Math.max(scoreAfterDecay, COLD_START_FLOOR);
      } else {
        coldStartApplied = false;
        finalScore = scoreAfterDecay;
      }
      finalScore = Math.round(finalScore * 1000) / 1000;
    }

    newCacheSkills[skillName] = {
      raw_score: rawScore,
      cold_start_applied: coldStartApplied,
      dormancy_weeks: Math.round(dormancyWeeks * 1000) / 1000,
      final_score: finalScore,
      skill_content_hash: contentHash,
      scored_at: new Date().toISOString(),
    };

    results.push({ skill: skillName, score: finalScore });
  }

  // Write updated cache atomically
  const newCache = {
    metadata: {
      computed_at: new Date().toISOString(),
      task_description: taskDescription,
      task_hash: taskHash,
    },
    skills: newCacheSkills,
  };
  const tmpPath = cacheFile + '.tmp';
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(newCache, null, 2));
  fs.renameSync(tmpPath, cacheFile);

  return results.sort((a, b) => b.score - a.score);
}

// ─── CLI Command ──────────────────────────────────────────────────────────────

function cmdSkillScore(cwd, taskDescription, raw) {
  const normalized = taskDescription.toLowerCase().trim().replace(/\s+/g, ' ');
  const ranked = scoreSkills(normalized, cwd);

  if (raw) {
    process.stdout.write(JSON.stringify(ranked) + '\n');
    return;
  }

  console.log(`Skill Relevance Scores for: "${taskDescription}"`);
  console.log('| Rank | Skill | Score |');
  console.log('|------|-------|-------|');
  ranked.forEach(({ skill, score }, i) => {
    console.log(`|  ${i + 1}   | ${skill} | ${score.toFixed(3)} |`);
  });
}

module.exports = { cmdSkillScore, scoreSkills };
