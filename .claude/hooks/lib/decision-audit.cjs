'use strict';
// decision-audit.cjs — Parses Key Decisions from PROJECT.md and matches
// corrections against decisions using Jaccard token overlap. Detects tensions
// when 3+ corrections match a given decision.

const fs = require('fs');
const path = require('path');

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_TENSION_CORRECTIONS = 3;
const MIN_JACCARD = 0.05;

// ─── Tokenization (copied verbatim from get-shit-done/bin/lib/skill-scorer.cjs) ──

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'be', 'it', 'this', 'that', 'as',
  'by', 'from', 'not', 'use', 'used', 'when', 'any', 'all', 'also',
]);

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

// ─── parseDecisions ───────────────────────────────────────────────────────────

/**
 * Accepts the full text of PROJECT.md and returns an array of
 * { decision, rationale } objects from the Key Decisions table.
 *
 * @param {string} content - Full text of PROJECT.md
 * @returns {{ decision: string, rationale: string }[]}
 */
function parseDecisions(content) {
  const decisions = [];
  const sectionMatch = content.match(/## Key Decisions[\s\S]*?(?=\n## |\n$|$)/);
  if (!sectionMatch) return decisions;
  const section = sectionMatch[0];
  const lines = section.split('\n');
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim()).filter((_, i) => i > 0);
    if (cols.length < 3) continue;
    const [decision, rationale] = cols;
    if (!decision || !rationale) continue;
    if (decision === 'Decision' || decision.replace(/-/g, '').trim() === '') continue;
    decisions.push({ decision, rationale });
  }
  return decisions;
}

// ─── matchCorrectionsToDecision ───────────────────────────────────────────────

/**
 * Matches corrections against a single decision using Jaccard token overlap.
 * Returns an array of { correction, score } pairs where score >= MIN_JACCARD.
 *
 * @param {object[]} corrections - Array of correction objects
 * @param {{ decision: string, rationale: string }} decision
 * @returns {{ correction: object, score: number }[]}
 */
function matchCorrectionsToDecision(corrections, decision) {
  const decisionTokens = tokenize(decision.decision + ' ' + decision.rationale);
  const matches = [];
  for (const correction of corrections) {
    const corrText = (correction.correction_to || '') + ' ' + (correction.diagnosis_text || '');
    const corrTokens = tokenize(corrText);
    const score = jaccardScore(decisionTokens, corrTokens);
    if (score >= MIN_JACCARD) {
      matches.push({ correction, score });
    }
  }
  return matches;
}

// ─── detectTensions ───────────────────────────────────────────────────────────

/**
 * Reads PROJECT.md and corrections.jsonl, matches corrections to each decision,
 * and returns tensions where 3+ corrections match (DAUD-03 threshold).
 * Never throws — all errors caught and returned as [].
 *
 * @param {{ cwd?: string }} [options]
 * @returns {Array<{
 *   decision_text: string,
 *   rationale: string,
 *   matched_corrections: object[],
 *   confidence: number,
 *   correction_count: number
 * }>}
 */
function detectTensions(options) {
  try {
    const cwd = (options && options.cwd) ? options.cwd : process.cwd();

    // Read PROJECT.md
    const projectPath = path.join(cwd, '.planning', 'PROJECT.md');
    if (!fs.existsSync(projectPath)) return [];
    const content = fs.readFileSync(projectPath, 'utf-8');

    // Parse decisions
    const decisions = parseDecisions(content);
    if (decisions.length === 0) return [];

    // Read active corrections
    const { readCorrections } = require('./write-correction.cjs');
    const corrections = readCorrections({ status: 'active' }, { cwd });
    if (corrections.length === 0) return [];

    // Match corrections to each decision
    const tensions = [];
    for (const decision of decisions) {
      const matches = matchCorrectionsToDecision(corrections, decision);
      if (matches.length < MIN_TENSION_CORRECTIONS) continue;
      const avgScore = matches.reduce((sum, m) => sum + m.score, 0) / matches.length;
      tensions.push({
        decision_text: decision.decision,
        rationale: decision.rationale,
        matched_corrections: matches.map(m => m.correction),
        confidence: avgScore,
        correction_count: matches.length,
      });
    }

    return tensions;
  } catch (e) {
    return [];
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { parseDecisions, matchCorrectionsToDecision, detectTensions };

// ─── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const tensions = detectTensions({ cwd });
  process.stdout.write(JSON.stringify(tensions, null, 2) + '\n');
  process.exit(0);
}
