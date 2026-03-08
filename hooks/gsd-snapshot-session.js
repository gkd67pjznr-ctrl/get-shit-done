#!/usr/bin/env node
'use strict';
// GSD SessionEnd hook: append session snapshot to patterns/sessions.jsonl
// Records basic session metadata for pattern analysis

const fs = require('fs');
const path = require('path');

try {
  const patternsDir = path.join(process.cwd(), '.planning', 'patterns');
  if (!fs.existsSync(patternsDir)) process.exit(0);

  const sessionsFile = path.join(patternsDir, 'sessions.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    event: 'SessionEnd',
    cwd: process.cwd(),
  };
  fs.appendFileSync(sessionsFile, JSON.stringify(entry) + '\n', 'utf8');
} catch (e) {
  // Silent failure -- never block session end
}
