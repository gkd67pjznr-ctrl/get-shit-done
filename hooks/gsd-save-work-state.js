#!/usr/bin/env node
'use strict';
// GSD SessionEnd hook: record session end timestamp in STATE.md
// Lightweight -- just updates last_updated if .planning/STATE.md exists

const fs = require('fs');
const path = require('path');

try {
  const statePath = path.join(process.cwd(), '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) process.exit(0);

  let content = fs.readFileSync(statePath, 'utf8');
  const now = new Date().toISOString();
  // Update last_updated field in YAML frontmatter if present
  content = content.replace(/^last_updated: .*$/m, `last_updated: "${now}"`);
  fs.writeFileSync(statePath, content, 'utf8');
} catch (e) {
  // Silent failure -- never block session end
}
