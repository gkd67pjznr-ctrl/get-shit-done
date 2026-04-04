#!/usr/bin/env node
// Auto-restore work state on session start
// Called by SessionStart hook - loads previous session context
// Invokes: skill-creator orchestrator work-state restore

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Read hook input from stdin (Claude Code provides session context as JSON)
let input = '';
try {
  input = readFileSync('/dev/stdin', 'utf-8');
} catch (e) {}

let parsed = {};
try { parsed = JSON.parse(input); } catch (e) {}

const sessionId = parsed.session_id || 'unknown';
const cwd = parsed.cwd || process.cwd();

try {
  const result = execSync(
    'npx skill-creator orchestrator work-state restore --pretty',
    { cwd, timeout: 10000, encoding: 'utf-8' }
  );
  // Output to stdout for SessionStart context injection
  if (result && result.trim()) {
    process.stdout.write(result);
  }
} catch (e) {
  // Silent failure -- don't block session start
}

try {
  const gsdToolsPath = new URL('../../get-shit-done/bin/gsd-tools.cjs', import.meta.url).pathname;
  execSync(
    `node "${gsdToolsPath}" journal-emit session_start --session-id="${sessionId}" --raw`,
    { cwd, timeout: 5000, stdio: 'ignore' }
  );
} catch (e) {
  // Silent failure
}
