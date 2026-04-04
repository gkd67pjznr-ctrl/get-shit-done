'use strict';
// SessionEnd hook: runs pattern analysis and writes watermark to scan-state.json.
// Silent on errors -- never blocks session end.

const path = require('path');
const fs = require('fs');

try {
  const cwd = process.cwd();
  const { analyzePatterns } = require('./lib/analyze-patterns.cjs');

  const result = analyzePatterns({ cwd });

  // Run auto-apply engine after pattern analysis
  let autoApplyResult;
  try {
    const { runAutoApply } = require('./lib/auto-apply.cjs');
    autoApplyResult = runAutoApply({ cwd });
  } catch (e) {
    // Silent failure -- auto-apply must not block session end
  }

  // Write watermark to scan-state.json regardless of whether new suggestions were written.
  // This confirms analysis ran even when no new patterns met thresholds.
  const scanStatePath = path.join(cwd, '.planning', 'patterns', 'scan-state.json');
  let scanState = {};
  try {
    const raw = fs.readFileSync(scanStatePath, 'utf-8');
    scanState = JSON.parse(raw);
  } catch (e) {
    // File missing or invalid JSON -- start fresh
  }

  scanState.last_analyzed_at = new Date().toISOString();
  scanState.last_analysis_result = result;
  if (autoApplyResult) {
    scanState.last_auto_apply_result = autoApplyResult;
  }

  const tmpPath = scanStatePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(scanState, null, 2));
  fs.renameSync(tmpPath, scanStatePath);
} catch (e) {
  // Silent failure -- never block session end
}
