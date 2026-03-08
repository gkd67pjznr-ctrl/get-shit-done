#!/usr/bin/env node
'use strict';
// GSD SessionStart hook: inject latest session snapshot as context
// Reads the most recent snapshot from .planning/patterns/sessions.jsonl
// Falls back silently if patterns directory does not exist

const fs = require('fs');
const path = require('path');

try {
  const sessionsFile = path.join(process.cwd(), '.planning', 'patterns', 'sessions.jsonl');
  if (!fs.existsSync(sessionsFile)) process.exit(0);

  const lines = fs.readFileSync(sessionsFile, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) process.exit(0);

  // Get the last (most recent) session entry
  const lastEntry = JSON.parse(lines[lines.length - 1]);
  if (lastEntry && lastEntry.summary) {
    process.stdout.write('## Last Session\n' + lastEntry.summary + '\n');
  }
} catch (e) {
  // Silent failure -- never block session start
}
