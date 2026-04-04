'use strict';
// SessionStart hook: injects correction and preference recall into Claude's context.
// Reads corrections and preferences from .planning/patterns/, filters active entries,
// applies dedup and token budget, outputs formatted reminder to stdout.
// Silent on errors -- never blocks session start.

const path = require('path');
const fs = require('fs');

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

  // Load pending suggestions if suggest_on_session_start is enabled
  let pendingSuggestions = [];
  try {
    const configPath = path.join(cwd, '.planning', 'config.json');
    const configRaw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configRaw);
    const suggestOnStart = ((config.adaptive_learning || {}).integration || {}).suggest_on_session_start;

    if (suggestOnStart) {
      const suggestionsPath = path.join(cwd, '.planning', 'patterns', 'suggestions.json');
      const sugRaw = fs.readFileSync(suggestionsPath, 'utf-8');
      const sugDoc = JSON.parse(sugRaw);
      pendingSuggestions = (sugDoc.suggestions || []).filter(s => s.status === 'pending');
    }
  } catch (e) {
    // Silent failure -- suggestions are optional
  }

  // Exit silently if nothing to show
  if (selectedPrefs.length === 0 && selectedCorrs.length === 0 && pendingSuggestions.length === 0) {
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

  // Append pending suggestions section if any
  let sugLines = [];
  if (pendingSuggestions.length > 0) {
    const MAX_SUGGESTIONS = 5;
    for (const sug of pendingSuggestions.slice(0, MAX_SUGGESTIONS)) {
      const skillLabel = sug.target_skill || 'unknown skill';
      const changeHint = (sug.sample_corrections && sug.sample_corrections[0])
        ? sug.sample_corrections[0]
        : '(no sample available)';
      const countLabel = sug.correction_count ? ` (${sug.correction_count} occurrences)` : '';
      sugLines.push(`- [${sug.category}] Skill: ${skillLabel}${countLabel} — "${changeHint}"`);
    }
    if (pendingSuggestions.length > MAX_SUGGESTIONS) {
      sugLines.push(`(+${pendingSuggestions.length - MAX_SUGGESTIONS} more pending suggestions -- see suggestions.json)`);
    }
  }

  // Build final output
  let body = headerText + '\n' + prefLines.join('\n') + corrHeader + '\n' + corrLines.join('\n');
  if (skipped > 0) {
    body += '\n\n(+' + skipped + ' more corrections not shown -- see corrections.jsonl)';
  }
  if (sugLines.length > 0) {
    body += '\n\n## Pending Skill Suggestions\n\n' + sugLines.join('\n');
    body += '\n\nRun `/gsd:refine-skill <skill-name>` to accept or dismiss.';
  }
  // Auto-apply notification: surface new applied entries since last session
  try {
    const scanStatePath = path.join(cwd, '.planning', 'patterns', 'scan-state.json');
    let sessionBoundary = null;
    try {
      const scanStateRaw = fs.readFileSync(scanStatePath, 'utf-8');
      const scanState = JSON.parse(scanStateRaw);
      sessionBoundary = scanState.last_analyzed_at || null;
    } catch (e) {
      // scan-state.json missing or invalid -- use 24h fallback
    }

    const boundaryTime = sessionBoundary
      ? new Date(sessionBoundary).getTime()
      : Date.now() - 24 * 60 * 60 * 1000;

    const auditPath = path.join(cwd, '.planning', 'patterns', 'auto-applied.jsonl');
    if (fs.existsSync(auditPath)) {
      const lines = fs.readFileSync(auditPath, 'utf-8').split('\n');
      const newEntries = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry.action === 'applied') {
          const entryTime = new Date(entry.timestamp).getTime();
          if (!isNaN(entryTime) && entryTime > boundaryTime) {
            newEntries.push(entry);
          }
        }
      }

      if (newEntries.length > 0) {
        const MAX_SHOWN = 5;
        const shown = newEntries.slice(0, MAX_SHOWN);
        const autoApplyLines = shown.map(e =>
          '- ' + e.skill + ' (suggestion ' + e.suggestion_id + ', confidence ' + e.confidence + ')' +
          ' — revert with `/gsd:refine-skill revert ' + e.suggestion_id + '`'
        );
        if (newEntries.length > MAX_SHOWN) {
          autoApplyLines.push('(+' + (newEntries.length - MAX_SHOWN) + ' more — see .planning/patterns/auto-applied.jsonl)');
        }
        body += '\n\n## Auto-Applied Skill Refinements\n\n' +
          'The following skill refinements were applied automatically since your last session:\n' +
          autoApplyLines.join('\n');
      }
    }
  } catch (e) {
    // Silent failure -- auto-apply notification must not affect existing recall output
  }

  body += '\n</system-reminder>';

  const output = body.trim();
  if (output) {
    process.stdout.write(output + '\n');
  }
} catch (e) {
  // Silent failure -- never block session start
}
