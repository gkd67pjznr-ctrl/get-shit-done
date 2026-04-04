'use strict';

/**
 * Brainstorm — Mechanical enforcement for divergent thinking sessions
 *
 * Provides eval detection, append-only idea storage, SCAMPER cycling,
 * perspective shifts, quantity floors, saturation detection, and seed
 * brief building. Called by the brainstorm workflow (Phase 47).
 */

const fs = require('fs');
const path = require('path');

const EVAL_PATTERNS = [
  "won't work",
  "bad idea",
  "not feasible",
  "unrealistic",
  "too risky",
  "too complex",
  "too expensive",
  "not worth",
  "already tried",
  "everyone knows",
  "clearly wrong",
  "probably shouldn't",
  "might not",
  "unlikely to",
  "the problem with",
  "the issue is",
  "the downside",
  "more practical to",
  "better to just",
  "simpler to",
  "not sure this",
  "i don't think",
  "that said",
];

const WILD_EXTRA_PATTERNS = [
  "might",
  "could potentially",
  "probably",
  "i'm not sure",
  "on the other hand",
  "the challenge is",
  "realistically",
];

const CONSTRUCTIVE_OVERRIDES = [
  "what if",
  "could also",
  "building on",
  "combined with",
  "unless we",
  "even if",
  "imagine if",
  "and then",
];

const SCAMPER_LENSES = [
  { id: "substitute", prompt: "What components, materials, or processes could be substituted?" },
  { id: "combine", prompt: "What could be combined or merged to create something new?" },
  { id: "adapt", prompt: "What could be adapted, adjusted, or modified from another context?" },
  { id: "modify", prompt: "What could be modified, magnified, minified, or altered?" },
  { id: "put-to-another-use", prompt: "How could this be put to another use or repurposed?" },
  { id: "eliminate", prompt: "What could be eliminated, removed, or simplified?" },
  { id: "reverse", prompt: "What could be reversed, inverted, or rearranged?" },
];

const PERSPECTIVES = [
  { id: "competitor", prompt: "You are the most aggressive competitor who wants to eat this product's lunch. What would you build?" },
  { id: "user-who-hates", prompt: "You are the most frustrated user who hates everything about the current solution. What do you demand?" },
  { id: "alien-engineer", prompt: "You are an alien engineer with no knowledge of human conventions or constraints. What do you design?" },
  { id: "absurdist", prompt: "You take every idea to its most ridiculous extreme. What insane version exists?" },
  { id: "minimalist", prompt: "You believe the answer is always to remove things. What do you strip away entirely?" },
  { id: "time-traveler", prompt: "You arrive from 20 years in the future where this problem is solved. What did you build?" },
  { id: "chaos-monkey", prompt: "You randomly break assumptions and invert every requirement. What emerges?" },
];

const QUANTITY_FLOORS = { freeform: 15, scamper_per_lens: 2, starburst: 3, perspective: 3 };

/**
 * Check text for evaluative language that should be banned during brainstorming.
 *
 * @param {string} text - The idea text to check
 * @param {boolean} wildMode - When true, also flag hedging language from WILD_EXTRA_PATTERNS
 * @returns {{ clean: boolean, violations: string[], suggestion: string }}
 */
function cmdBrainstormCheckEval(text, wildMode) {
  const lower = text.toLowerCase();

  // Check for constructive overrides first
  const hasOverride = CONSTRUCTIVE_OVERRIDES.some(p => lower.includes(p));
  if (hasOverride) {
    return { clean: true, violations: [], suggestion: "" };
  }

  const patterns = wildMode
    ? [...EVAL_PATTERNS, ...WILD_EXTRA_PATTERNS]
    : EVAL_PATTERNS;

  const violations = patterns.filter(p => lower.includes(p));

  if (violations.length === 0) {
    return { clean: true, violations: [], suggestion: "" };
  }

  return {
    clean: false,
    violations,
    suggestion: "Rephrase as a possibility or building block — remove evaluative language and state the idea neutrally.",
  };
}

/**
 * Append a single idea record to <sessionDir>/ideas.jsonl.
 * This is an append-only store — there is no update or delete path.
 *
 * @param {string} sessionDir - Absolute path to session directory
 * @param {Object} idea - { content, source_technique?, perspective?, scamper_lens?, tags? }
 * @returns {{ id: number, count: number }}
 */
function cmdBrainstormAppendIdea(sessionDir, idea) {
  const ideasPath = path.join(sessionDir, 'ideas.jsonl');

  // Count existing lines to determine next id
  let existingCount = 0;
  if (fs.existsSync(ideasPath)) {
    const content = fs.readFileSync(ideasPath, 'utf-8');
    existingCount = content.split('\n').filter(l => l.trim() !== '').length;
  }

  const id = existingCount + 1;
  const record = {
    id,
    content: idea.content,
    source_technique: idea.source_technique || "freeform",
    perspective: idea.perspective || "",
    scamper_lens: idea.scamper_lens || "",
    tags: idea.tags || [],
    timestamp: new Date().toISOString(),
  };

  fs.appendFileSync(ideasPath, JSON.stringify(record) + '\n', 'utf-8');

  return { id, count: id };
}

/**
 * Read all ideas from <sessionDir>/ideas.jsonl.
 * Returns all records with no filtering applied.
 *
 * @param {string} sessionDir - Absolute path to session directory
 * @returns {{ ideas: Array, count: number }}
 */
function cmdBrainstormReadIdeas(sessionDir) {
  const ideasPath = path.join(sessionDir, 'ideas.jsonl');

  if (!fs.existsSync(ideasPath)) {
    return { ideas: [], count: 0 };
  }

  const content = fs.readFileSync(ideasPath, 'utf-8');
  const ideas = content
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));

  return { ideas, count: ideas.length };
}

/**
 * Get a single SCAMPER lens by index.
 *
 * @param {number} lensIndex - Integer 0–6
 * @returns {{ id: string, prompt: string }}
 */
function cmdBrainstormGetScamperLens(lensIndex) {
  if (!Number.isInteger(lensIndex) || lensIndex < 0 || lensIndex > 6) {
    throw new Error('Invalid lens index: must be 0-6');
  }
  return SCAMPER_LENSES[lensIndex];
}

/**
 * Check whether all 7 SCAMPER lenses have at least one idea in the session.
 *
 * @param {string} sessionDir - Absolute path to session directory
 * @returns {{ complete: boolean, missingLenses: string[], coveredLenses: string[] }}
 */
function cmdBrainstormScamperComplete(sessionDir) {
  const { ideas } = cmdBrainstormReadIdeas(sessionDir);
  const allLensIds = SCAMPER_LENSES.map(l => l.id);
  const covered = new Set(ideas.map(i => i.scamper_lens).filter(Boolean));
  const coveredLenses = allLensIds.filter(id => covered.has(id));
  const missingLenses = allLensIds.filter(id => !covered.has(id));
  return {
    complete: missingLenses.length === 0,
    missingLenses,
    coveredLenses,
  };
}

/**
 * Check whether the quantity floor for a technique has been met.
 *
 * @param {string} technique - One of the keys in QUANTITY_FLOORS
 * @param {number} currentCount - Current number of ideas for this technique
 * @param {boolean} wildMode - When true, the floor doubles
 * @returns {{ met: boolean, remaining: number, floor: number }}
 */
function cmdBrainstormCheckFloor(technique, currentCount, wildMode) {
  if (!(technique in QUANTITY_FLOORS)) {
    throw new Error(`Unknown technique: ${technique}`);
  }
  const floor = QUANTITY_FLOORS[technique] * (wildMode ? 2 : 1);
  const met = currentCount >= floor;
  const remaining = Math.max(0, floor - currentCount);
  return { met, remaining, floor };
}

/**
 * Get a perspective by ID.
 *
 * @param {string} perspectiveId - The perspective ID to look up
 * @returns {{ id: string, prompt: string }}
 */
function cmdBrainstormGetPerspective(perspectiveId) {
  const p = PERSPECTIVES.find(p => p.id === perspectiveId);
  if (!p) {
    throw new Error(`Unknown perspective: ${perspectiveId}`);
  }
  return p;
}

/**
 * Return N unique perspectives chosen randomly from PERSPECTIVES.
 *
 * @param {number} count - Number of perspectives to return (capped at 7)
 * @returns {Array<{ id: string, prompt: string }>}
 */
function cmdBrainstormRandomPerspectives(count) {
  const cap = Math.min(count, PERSPECTIVES.length);
  const shuffled = [...PERSPECTIVES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, cap);
}

/**
 * Detect whether idea velocity has dropped (saturation signal).
 *
 * @param {string} sessionDir - Absolute path to session directory
 * @param {number} windowSize - Number of recent ideas to analyze
 * @returns {{ saturated: boolean, velocity: number|null, suggestion: string }}
 */
function cmdBrainstormCheckSaturation(sessionDir, windowSize) {
  const { ideas } = cmdBrainstormReadIdeas(sessionDir);
  const window = ideas.slice(-windowSize);

  if (window.length < 2) {
    return { saturated: false, velocity: null, suggestion: '' };
  }

  const timestamps = window.map(i => new Date(i.timestamp).getTime());
  const gaps = [];
  for (let i = 1; i < timestamps.length; i++) {
    gaps.push(timestamps[i] - timestamps[i - 1]);
  }

  const averageGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const lastGap = gaps[gaps.length - 1];

  const totalTimespan = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  const velocity = totalTimespan === 0 ? 0 : window.length / totalTimespan;

  const saturated = lastGap > 2 * averageGap;
  const suggestion = saturated
    ? 'Switch technique — idea velocity has dropped. Try a new angle or move to converge.'
    : '';

  return { saturated, velocity, suggestion };
}

/**
 * Build a seed context brief for starting a brainstorm session.
 *
 * Reads correction patterns, session history, open debt, and prior
 * brainstorm ideas from the planning root. Deliberately excludes
 * ROADMAP.md, STATE.md, and any phase plan/summary files.
 *
 * @param {string} planningRoot - Absolute path to the planning root directory
 * @returns {{ brief: string, sources: string[] }}
 */
function cmdBrainstormBuildSeedBrief(planningRoot) {
  const sources = [];
  const sections = [];

  // Section 1: Correction Patterns from corrections.jsonl
  const correctionsPath = path.join(planningRoot, 'corrections.jsonl');
  let correctionSection = '## Correction Patterns\n\nNone found.';
  if (fs.existsSync(correctionsPath)) {
    try {
      const raw = fs.readFileSync(correctionsPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim() !== '');
      const patterns = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.pattern) patterns.push(entry.pattern);
          else if (entry.description) patterns.push(entry.description);
        } catch (_) {
          // skip malformed lines
        }
      }
      if (patterns.length > 0) {
        correctionSection = '## Correction Patterns\n\n' + patterns.map(p => `- ${p}`).join('\n');
        sources.push(correctionsPath);
      } else {
        correctionSection = '## Correction Patterns\n\nNone found.';
        sources.push(correctionsPath);
      }
    } catch (_) {
      // skip on read error
    }
  }
  sections.push(correctionSection);

  // Section 2: Session History from sessions.jsonl
  const sessionsPath = path.join(planningRoot, 'sessions.jsonl');
  let sessionSection = '## Session History\n\nNone found.';
  if (fs.existsSync(sessionsPath)) {
    try {
      const raw = fs.readFileSync(sessionsPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim() !== '');
      const summaries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const parts = [];
          if (entry.phase) parts.push(`phase ${entry.phase}`);
          if (entry.plan) parts.push(`plan ${entry.plan}`);
          if (entry.timestamp) parts.push(entry.timestamp);
          if (entry.outcome) parts.push(`outcome: ${entry.outcome}`);
          if (parts.length > 0) summaries.push(parts.join(', '));
          else if (entry.summary) summaries.push(entry.summary);
        } catch (_) {
          // skip malformed lines
        }
      }
      if (summaries.length > 0) {
        sessionSection = '## Session History\n\n' + summaries.map(s => `- ${s}`).join('\n');
        sources.push(sessionsPath);
      } else {
        sessionSection = '## Session History\n\nNone found.';
        sources.push(sessionsPath);
      }
    } catch (_) {
      // skip on read error
    }
  }
  sections.push(sessionSection);

  // Section 3: Open Debt from DEBT.md
  const debtPath = path.join(planningRoot, 'DEBT.md');
  let debtSection = '## Open Debt\n\nNone found.';
  if (fs.existsSync(debtPath)) {
    try {
      const raw = fs.readFileSync(debtPath, 'utf-8');
      const excerpt = raw.slice(0, 1000);
      debtSection = `## Open Debt\n\n${excerpt}`;
      sources.push(debtPath);
    } catch (_) {
      // skip on read error
    }
  }
  sections.push(debtSection);

  // Section 4: Prior Brainstorm Ideas from quick/*/FEATURE-IDEAS.md
  let ideasSection = '## Prior Brainstorm Ideas\n\nNone found.';
  const quickDir = path.join(planningRoot, 'quick');
  const ideaExcerpts = [];
  if (fs.existsSync(quickDir) && fs.statSync(quickDir).isDirectory()) {
    try {
      const subdirs = fs.readdirSync(quickDir).filter(name => {
        const sub = path.join(quickDir, name);
        return fs.statSync(sub).isDirectory();
      });
      for (const sub of subdirs) {
        const ideaFile = path.join(quickDir, sub, 'FEATURE-IDEAS.md');
        if (fs.existsSync(ideaFile)) {
          try {
            const raw = fs.readFileSync(ideaFile, 'utf-8');
            const excerpt = raw.slice(0, 500);
            ideaExcerpts.push(`### ${sub}\n\n${excerpt}`);
            sources.push(ideaFile);
          } catch (_) {
            // skip on read error
          }
        }
      }
    } catch (_) {
      // skip on read error
    }
  }
  if (ideaExcerpts.length > 0) {
    ideasSection = '## Prior Brainstorm Ideas\n\n' + ideaExcerpts.join('\n\n');
  }
  sections.push(ideasSection);

  const brief = sections.join('\n\n');
  return { brief, sources };
}

const STOP_WORDS = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
  "is","it","this","that","be","are","was","were","has","have","do","we","i",
  "you","they","their","our","its","as","if","can","from","not","will",
]);

/**
 * Cluster ideas into 3–7 thematic groups using keyword frequency.
 * Every idea appears in exactly one cluster.
 *
 * @param {Array<{ id: number, content: string }>} ideas
 * @returns {{ clusters: Array<{ label: string, theme: string, idea_ids: number[] }>, count: number }}
 */
function cmdBrainstormCluster(ideas) {
  if (ideas.length === 0) {
    return { clusters: [], count: 0 };
  }

  // Extract keywords from a piece of content
  function extractKeywords(content) {
    return content
      .toLowerCase()
      .split(/[\s\W]+/)
      .filter(token => token.length >= 4 && !STOP_WORDS.has(token));
  }

  // Build keyword frequency map (how many ideas contain each keyword)
  const keywordFreq = new Map();
  for (const idea of ideas) {
    const keywords = new Set(extractKeywords(idea.content));
    for (const kw of keywords) {
      keywordFreq.set(kw, (keywordFreq.get(kw) || 0) + 1);
    }
  }

  // Determine N: clamped between 3 and min(7, ideas.length)
  const N = Math.min(7, Math.max(Math.min(3, ideas.length), Math.floor(ideas.length / 3)));

  // Select top N keywords by frequency
  const topKeywords = [...keywordFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, N)
    .map(([kw]) => kw);

  // Initialize clusters
  const clusters = topKeywords.map(label => ({ label, theme: label, idea_ids: [] }));

  // Assign each idea to a cluster
  for (const idea of ideas) {
    const content = idea.content.toLowerCase();
    let assigned = false;

    for (const cluster of clusters) {
      if (content.includes(cluster.label)) {
        cluster.idea_ids.push(idea.id);
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      // Round-robin to smallest cluster
      let minCluster = clusters[0];
      for (const cluster of clusters) {
        if (cluster.idea_ids.length < minCluster.idea_ids.length) {
          minCluster = cluster;
        }
      }
      minCluster.idea_ids.push(idea.id);
    }
  }

  return { clusters, count: clusters.length };
}

/**
 * Compute a composite score for a single idea from four dimension values.
 * Composite = (feasibility + impact + alignment) - risk. Range: -2 to 14.
 *
 * @param {{ id: number }} idea
 * @param {{ feasibility: number, impact: number, alignment: number, risk: number }} dimensions
 * @returns {{ id: number, feasibility: number, impact: number, alignment: number, risk: number, composite: number }}
 */
function cmdBrainstormScore(idea, dimensions) {
  const { feasibility, impact, alignment, risk } = dimensions;

  for (const [name, value] of [['feasibility', feasibility], ['impact', impact], ['alignment', alignment], ['risk', risk]]) {
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new Error('Invalid dimension value: must be integer 1-5');
    }
  }

  const composite = (feasibility + impact + alignment) - risk;
  return { id: idea.id, feasibility, impact, alignment, risk, composite };
}

/**
 * Filter ideas and scores to only the user-selected IDs.
 *
 * @param {Array} ideas - Full idea array
 * @param {Array} scores - Full scores array (each with id field)
 * @param {number[]} selectedIds - IDs chosen by the user
 * @returns {{ finalists: Array, scores: Array, count: number }}
 */
function cmdBrainstormSelectFinalists(ideas, scores, selectedIds) {
  const selectedSet = new Set(selectedIds);
  const finalists = ideas.filter(i => selectedSet.has(i.id));
  const filteredScores = scores.filter(s => selectedSet.has(s.id));
  return { finalists, scores: filteredScores, count: finalists.length };
}

module.exports = {
  cmdBrainstormCheckEval,
  cmdBrainstormAppendIdea,
  cmdBrainstormReadIdeas,
  cmdBrainstormGetScamperLens,
  cmdBrainstormScamperComplete,
  cmdBrainstormCheckFloor,
  cmdBrainstormGetPerspective,
  cmdBrainstormRandomPerspectives,
  cmdBrainstormCheckSaturation,
  cmdBrainstormBuildSeedBrief,
  cmdBrainstormCluster,
  cmdBrainstormScore,
  cmdBrainstormSelectFinalists,
};
