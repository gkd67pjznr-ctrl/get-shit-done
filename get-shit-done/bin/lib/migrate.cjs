'use strict';

/**
 * Migrate — GSD planning directory migration tool
 *
 * Inspects an existing .planning/ directory against the current GSD spec and
 * reports or applies additive-only structural changes.
 *
 * MIGR-01: --dry-run inspects layout and reports what would change
 * MIGR-02: --apply performs additive-only changes and writes migrate-undo.json
 * MIGR-03: Idempotent — re-running --apply with existing files takes 0 actions
 *
 * Additive-only contract: never deletes or modifies existing files.
 * Undo manifest at .planning/migrate-undo.json is overwritten on each --apply run.
 */

const fs = require('fs');
const path = require('path');
const { output, error, detectLayoutStyle } = require('./core.cjs');

/**
 * Inspect the .planning/ directory against the current GSD spec.
 * Shared by both dry-run and apply to guarantee consistent output (avoids Pitfall 3).
 *
 * Change types:
 *   create_dir    — directory missing, can be created automatically
 *   create_file   — file missing, can be created automatically (with default content)
 *   manual_action — file missing but requires user-supplied content; reported only, not applied
 *
 * @param {string} cwd - Working directory
 * @returns {{ layout: string, changes: Array, summary: Object }}
 */
function inspectLayout(cwd) {
  const planningDir = path.join(cwd, '.planning');

  // .planning/ root must exist — cannot migrate nothing
  if (!fs.existsSync(planningDir)) {
    error('Cannot migrate: .planning/ directory does not exist. Run gsd-tools config-ensure-section to initialize.');
  }

  const layout = detectLayoutStyle(cwd);
  const changes = [];

  // ── Required directories ──────────────────────────────────────────────────

  const phasesDir = path.join(planningDir, 'phases');
  if (!fs.existsSync(phasesDir)) {
    changes.push({
      type: 'create_dir',
      path: phasesDir,
      reason: 'Required .planning/phases/ directory is missing',
    });
  }

  // ── Required files (automatable) ─────────────────────────────────────────

  const configPath = path.join(planningDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    changes.push({
      type: 'create_file',
      path: configPath,
      content: JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2),
      reason: 'config.json missing — required for GSD operations',
    });
  }

  // ── Manual actions (user content required) ────────────────────────────────

  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    changes.push({
      type: 'manual_action',
      path: roadmapPath,
      reason: 'ROADMAP.md missing — requires user-written phase descriptions; create manually',
    });
  }

  const statePath = path.join(planningDir, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    changes.push({
      type: 'manual_action',
      path: statePath,
      reason: 'STATE.md missing — requires current project state; create manually',
    });
  }

  const projectPath = path.join(planningDir, 'PROJECT.md');
  if (!fs.existsSync(projectPath)) {
    changes.push({
      type: 'manual_action',
      path: projectPath,
      reason: 'PROJECT.md missing — requires user-written project description; create manually',
    });
  }

  const manualActions = changes.filter(c => c.type === 'manual_action');

  return {
    layout,
    changes,
    summary: {
      layout,
      changes_needed: changes.filter(c => c.type !== 'manual_action').length,
      manual_actions: manualActions.length,
    },
  };
}

/**
 * Inspect .planning/ layout and report what would change without applying anything.
 * MIGR-01 implementation.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - Options (currently unused)
 * @param {boolean} raw - Raw output mode
 */
function cmdMigrateDryRun(cwd, opts, raw) {
  const inspection = inspectLayout(cwd);
  const hasAutomatableChanges = inspection.changes.some(c => c.type !== 'manual_action');
  const rawValue = hasAutomatableChanges ? 'changes-needed' : 'up-to-date';

  output(
    {
      dry_run: true,
      changes: inspection.changes,
      summary: inspection.summary,
    },
    raw,
    rawValue
  );
}

/**
 * Apply additive-only structural changes to .planning/ and write undo manifest.
 * MIGR-02 + MIGR-03 implementation.
 *
 * Only applies create_dir and create_file changes. Skips manual_action items.
 * Gates every action on !fs.existsSync(path) — this is what makes MIGR-03 trivially true.
 * Writes migrate-undo.json unconditionally (overwrite, not append) on every run.
 *
 * @param {string} cwd - Working directory
 * @param {Object} opts - Options (currently unused)
 * @param {boolean} raw - Raw output mode
 */
function cmdMigrateApply(cwd, opts, raw) {
  const inspection = inspectLayout(cwd);
  const actions = [];
  const skippedManual = [];

  for (const change of inspection.changes) {
    if (change.type === 'create_dir') {
      // Existence guard — idempotency guarantee (MIGR-03)
      if (!fs.existsSync(change.path)) {
        fs.mkdirSync(change.path, { recursive: true });
        actions.push({ type: 'created_dir', path: change.path });
      }
    } else if (change.type === 'create_file') {
      // Existence guard — additive-only (MIGR-02), idempotency (MIGR-03)
      if (!fs.existsSync(change.path)) {
        fs.writeFileSync(change.path, change.content, 'utf-8');
        actions.push({ type: 'created_file', path: change.path });
      }
    } else if (change.type === 'manual_action') {
      // Report but do not apply
      skippedManual.push(change);
    }
  }

  // Write undo manifest unconditionally — overwrite on every run (not append, per Pitfall 2)
  const manifestPath = path.join(cwd, '.planning', 'migrate-undo.json');
  const manifest = {
    applied: new Date().toISOString(),
    actions,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  const rawValue = actions.length === 0 ? 'already-up-to-date' : `applied-${actions.length}-changes`;

  output(
    {
      applied: true,
      actions_taken: actions.length,
      actions,
      manifest_path: manifestPath,
      skipped_manual: skippedManual,
    },
    raw,
    rawValue
  );
}

module.exports = { cmdMigrateDryRun, cmdMigrateApply };
