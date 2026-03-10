'use strict';
// SessionStart hook: injects correction and preference recall into Claude's context.
// Reads corrections and preferences from .planning/patterns/, filters active entries,
// applies dedup and token budget, outputs formatted reminder to stdout.
// Silent on errors -- never blocks session start.

const path = require('path');

try {
  const { readCorrections } = require('./lib/write-correction.cjs');
  const { readPreferences } = require('./lib/write-preference.cjs');

  const cwd = process.cwd();

  // Load active preferences (highest signal -- promoted from 3+ corrections)
  const allPreferences = readPreferences({ status: 'active' }, { cwd });

  // Load active corrections
  const allCorrections = readCorrections({ status: 'active' }, { cwd });

  // Dedup: build Set of category+scope from preferences
  const promotedKeys = new Set(allPreferences.map(p => p.category + ':' + p.scope));

  // Filter corrections: exclude those already captured as a preference
  const filteredCorrections = allCorrections.filter(
    c => !promotedKeys.has(c.diagnosis_category + ':' + c.scope)
  );

  // Slot allocation: preferences get priority, then corrections fill remaining slots
  const MAX_ENTRIES = 10;
  const selectedPrefs = allPreferences.slice(0, MAX_ENTRIES);
  const remainingSlots = MAX_ENTRIES - selectedPrefs.length;
  const selectedCorrs = filteredCorrections.slice(0, remainingSlots);

  // Exit silently if nothing to show
  if (selectedPrefs.length === 0 && selectedCorrs.length === 0) {
    process.exit(0);
  }

  // Token budget assembly
  const MAX_TOKENS = 3000;
  const FOOTER_RESERVE = 20;

  function estimateTokens(text) {
    return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
  }

  let tokenCount = 0;
  let skipped = 0;
  const prefLines = [];
  const corrLines = [];

  const headerText = '<system-reminder>\n## Correction Recall\n\nPreferences (learned):';
  tokenCount += estimateTokens(headerText);

  for (const p of selectedPrefs) {
    const line = '- [' + p.category + '] ' + p.preference_text;
    const cost = estimateTokens(line);
    if (tokenCount + cost + FOOTER_RESERVE > MAX_TOKENS) { skipped++; continue; }
    prefLines.push(line);
    tokenCount += cost;
  }

  const corrHeader = '\nRecent corrections:';
  tokenCount += estimateTokens(corrHeader);

  for (const c of selectedCorrs) {
    const line = '- [' + c.diagnosis_category + '] ' + c.correction_to;
    const cost = estimateTokens(line);
    if (tokenCount + cost + FOOTER_RESERVE > MAX_TOKENS) { skipped++; continue; }
    corrLines.push(line);
    tokenCount += cost;
  }

  // Build final output
  let body = headerText + '\n' + prefLines.join('\n') + corrHeader + '\n' + corrLines.join('\n');
  if (skipped > 0) {
    body += '\n\n(+' + skipped + ' more corrections not shown -- see corrections.jsonl)';
  }
  body += '\n</system-reminder>';

  const output = body.trim();
  if (output) {
    process.stdout.write(output + '\n');
  }
} catch (e) {
  // Silent failure -- never block session start
}
