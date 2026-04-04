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

module.exports = {
  cmdBrainstormCheckEval,
  cmdBrainstormAppendIdea,
  cmdBrainstormReadIdeas,
};
