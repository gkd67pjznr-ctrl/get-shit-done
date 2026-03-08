#!/usr/bin/env node
/**
 * Copy GSD hooks to dist for installation.
 */

const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const DIST_DIR = path.join(HOOKS_DIR, 'dist');

// Hooks to copy (pure Node.js, no bundling needed)
const HOOKS_TO_COPY = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-statusline.js',
  // Session hooks (HOOK-01)
  'gsd-restore-work-state.js',
  'gsd-save-work-state.js',
  'gsd-inject-snapshot.js',
  'gsd-snapshot-session.js',
  // Session state shell hook
  'session-state.sh',
  // Validation hooks (HOOK-02, HOOK-03)
  'validate-commit.sh',
  'phase-boundary-check.sh',
];

function build() {
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Copy hooks to dist
  for (const hook of HOOKS_TO_COPY) {
    const src = path.join(HOOKS_DIR, hook);
    const dest = path.join(DIST_DIR, hook);

    if (!fs.existsSync(src)) {
      console.warn(`Warning: ${hook} not found, skipping`);
      continue;
    }

    console.log(`Copying ${hook}...`);
    fs.copyFileSync(src, dest);
    console.log(`  → ${dest}`);
  }

  console.log('\nBuild complete.');
}

build();
