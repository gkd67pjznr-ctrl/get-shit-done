#!/usr/bin/env node
'use strict';
// GSD SessionStart hook: restore work state context
// Reads .planning/STATE.md and outputs head for session orientation

const fs = require('fs');
const path = require('path');

try {
  const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) process.exit(0);

  const content = fs.readFileSync(statePath, 'utf8');
  const lines = content.split('\n').slice(0, 30).join('\n');
  if (lines.trim()) {
    process.stdout.write('## Work State\n' + lines + '\n');
  }
} catch (e) {
  // Silent failure
}
