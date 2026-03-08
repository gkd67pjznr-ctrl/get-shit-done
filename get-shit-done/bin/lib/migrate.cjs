'use strict';

/**
 * Migrate — GSD planning directory migration tool
 *
 * Two modes of operation:
 *
 * 1. Basic scaffold (no --version): ensures missing dirs/files exist
 *    - MIGR-01: --dry-run inspects layout and reports what would change
 *    - MIGR-02: --apply performs additive-only changes and writes migrate-undo.json
 *    - MIGR-03: Idempotent — re-running --apply with existing files takes 0 actions
 *
 * 2. Full conversion (--version <label>): converts legacy → milestone-scoped
 *    - MIGR-04: Restructures flat milestone archives to nested directories
 *    - MIGR-05: Moves active phases into milestone workspace
 *    - MIGR-06: Converts root ROADMAP.md/STATE.md to coordinator stubs
 *    - MIGR-07: Sets concurrent: true in config.json
 *    - Backs up modified files with .pre-migration suffix
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

// ── Layout detection (local to migrate, removed from core in v3.1) ───────────

function detectLayoutStyle(cwd) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  let hasValidConfig = false;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    hasValidConfig = true;
    if (parsed.concurrent === true) {
      return 'milestone-scoped';
    }
  } catch {}
  try {
    const milestonesDir = path.join(cwd, '.planning', 'milestones');
    const dirs = fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^v\d/.test(e.name));
    const hasWorkspace = dirs.some(d =>
      fs.existsSync(path.join(milestonesDir, d.name, 'STATE.md'))
    );
    if (hasWorkspace) return 'milestone-scoped';
  } catch {}
  return hasValidConfig ? 'legacy' : 'uninitialized';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect milestones from ROADMAP.md content.
 * Looks for ✅/🚧/⬜ **vX.Y Name** patterns.
 */
function detectMilestones(roadmapContent) {
  const milestones = [];
  const pattern = /(✅|🚧|⬜)\s*\*\*(v[\d.]+)\s+([^*]+)\*\*/g;
  let match;
  while ((match = pattern.exec(roadmapContent)) !== null) {
    const status = match[1] === '✅' ? 'completed' : match[1] === '🚧' ? 'active' : 'planned';
    milestones.push({ version: match[2], name: match[3].trim(), status });
  }
  return milestones;
}

/**
 * Detect flat milestone archives at milestones/ level.
 * Flat pattern: milestones/v1.0-phases/, milestones/v1.0-ROADMAP.md
 * Nested pattern: milestones/v1.0/ (with phases/, ROADMAP.md inside)
 */
function detectFlatArchives(milestonesDir) {
  if (!fs.existsSync(milestonesDir)) return [];
  const entries = fs.readdirSync(milestonesDir);
  const versions = new Set();

  for (const entry of entries) {
    const match = entry.match(/^(v[\d.]+)-/);
    if (match) versions.add(match[1]);
  }

  return [...versions].map(v => {
    const hasPhases = fs.existsSync(path.join(milestonesDir, `${v}-phases`));
    const hasRoadmap = fs.existsSync(path.join(milestonesDir, `${v}-ROADMAP.md`));
    const hasRequirements = fs.existsSync(path.join(milestonesDir, `${v}-REQUIREMENTS.md`));
    const hasAudit = fs.existsSync(path.join(milestonesDir, `${v}-MILESTONE-AUDIT.md`));
    const hasNested = fs.existsSync(path.join(milestonesDir, v));
    return { version: v, hasPhases, hasRoadmap, hasRequirements, hasAudit, hasNested };
  });
}

/**
 * Generate a coordinator stub for root ROADMAP.md.
 */
function generateRoadmapStub(projectName, milestones) {
  const lines = [`# Roadmap: ${projectName}`, '',
    'This project uses **milestone-scoped layout**. Each milestone has its own ROADMAP.md.', '',
    '## Milestones', ''];

  for (const ms of milestones) {
    const icon = ms.status === 'completed' ? '✅' : ms.status === 'active' ? '🚧' : '⬜';
    lines.push(`- ${icon} **${ms.version} ${ms.name}**`);
  }

  lines.push('', '## Completed Milestones', '',
    '| Milestone | Archive |', '|-----------|---------|');
  for (const ms of milestones.filter(m => m.status === 'completed')) {
    lines.push(`| ${ms.version} ${ms.name} | \`milestones/${ms.version}/ROADMAP.md\` |`);
  }

  lines.push('', 'See `.planning/MILESTONES.md` for detailed milestone history.', '', '---', '');
  return lines.join('\n');
}

/**
 * Generate a coordinator stub for root STATE.md.
 */
function generateStateStub(milestones) {
  const active = milestones.filter(m => m.status === 'active');
  const completed = milestones.filter(m => m.status === 'completed');

  const lines = ['# Project State — Coordinator', '', '## Active Milestones', ''];
  if (active.length === 0) {
    lines.push('(None — next milestone to be defined with `/gsd:new-milestone`)');
  } else {
    lines.push('| Milestone | Workspace |', '|-----------|-----------|');
    for (const ms of active) {
      lines.push(`| ${ms.version} ${ms.name} | \`milestones/${ms.version}/\` |`);
    }
  }

  lines.push('', '## Completed Milestones', '');
  if (completed.length === 0) {
    lines.push('None yet.');
  } else {
    lines.push('| Milestone | Shipped |', '|-----------|---------|');
    for (const ms of completed) {
      lines.push(`| ${ms.version} ${ms.name} | - |`);
    }
  }

  lines.push('', '## Layout', '',
    'This project uses **milestone-scoped layout** (`concurrent: true` in config.json).',
    '', 'Each milestone has its own workspace under `.planning/milestones/<version>/` containing:',
    '- `STATE.md` — milestone-specific state',
    '- `ROADMAP.md` — milestone-specific roadmap',
    '- `REQUIREMENTS.md` — milestone-specific requirements',
    '- `phases/` — phase directories', '',
    '## Session Continuity', '',
    `Last activity: ${new Date().toISOString().slice(0, 10)} — Migrated to milestone-scoped layout`, '');

  return lines.join('\n');
}

// ── Basic scaffold inspection (existing behavior) ────────────────────────────

/**
 * Inspect .planning/ for missing basic structural elements.
 * Used when no --version flag is provided.
 */
function inspectLayout(cwd) {
  const planningDir = path.join(cwd, '.planning');

  if (!fs.existsSync(planningDir)) {
    error('Cannot migrate: .planning/ directory does not exist. Run gsd-tools config-ensure-section to initialize.');
  }

  const layout = detectLayoutStyle(cwd);
  const changes = [];

  const phasesDir = path.join(planningDir, 'phases');
  if (!fs.existsSync(phasesDir)) {
    changes.push({ type: 'create_dir', path: phasesDir, reason: 'Required .planning/phases/ directory is missing' });
  }

  const configPath = path.join(planningDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    changes.push({
      type: 'create_file', path: configPath,
      content: JSON.stringify({ model_profile: 'balanced', commit_docs: true }, null, 2),
      reason: 'config.json missing — required for GSD operations',
    });
  }

  for (const [name, desc] of [['ROADMAP.md', 'phase descriptions'], ['STATE.md', 'current project state'], ['PROJECT.md', 'project description']]) {
    const p = path.join(planningDir, name);
    if (!fs.existsSync(p)) {
      changes.push({ type: 'manual_action', path: p, reason: `${name} missing — requires user-written ${desc}; create manually` });
    }
  }

  // FIX-04: Check for missing DEBT.md — create automatically during migrate --apply
  const debtPath = path.join(planningDir, 'DEBT.md');
  if (!fs.existsSync(debtPath)) {
    changes.push({
      type: 'create_file',
      path: debtPath,
      content: [
        '# DEBT.md \u2014 Tech Debt Register',
        '',
        'Project-level tracker for structured tech debt. Entries logged by `gsd-tools debt log`.',
        '',
        '| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |',
        '|----|------|----------|-----------|-------------|-------------|-----------|--------|--------------|-------------|',
        '',
      ].join('\n'),
      reason: 'DEBT.md missing \u2014 required for tech debt tracking',
    });
  }

  // FIX-05: Flag stale TO-DOS.md at .planning/ root — never consumed by any workflow
  const staleTodosPath = path.join(planningDir, 'TO-DOS.md');
  if (fs.existsSync(staleTodosPath)) {
    changes.push({
      type: 'remove_stale',
      path: staleTodosPath,
      reason: 'Stale TO-DOS.md at .planning/ root \u2014 proper todo path is .planning/todos/pending/; this file was never consumed by any workflow',
    });
  }

  const manualActions = changes.filter(c => c.type === 'manual_action');
  return {
    layout, changes,
    summary: { layout, changes_needed: changes.filter(c => c.type !== 'manual_action').length, manual_actions: manualActions.length },
  };
}

// ── Full conversion inspection ───────────────────────────────────────────────

/**
 * Plan the full legacy → milestone-scoped conversion.
 * Generates a list of changes needed to restructure the project.
 */
function inspectConversion(cwd, targetVersion) {
  const planningDir = path.join(cwd, '.planning');

  if (!fs.existsSync(planningDir)) {
    error('Cannot migrate: .planning/ directory does not exist.');
  }

  const layout = detectLayoutStyle(cwd);

  // Already milestone-scoped — nothing to convert
  if (layout === 'milestone-scoped') {
    return {
      layout, conversion_needed: false, changes: [],
      summary: { layout, conversion: 'already-milestone-scoped', changes_count: 0 },
    };
  }

  const changes = [];
  const milestonesDir = path.join(planningDir, 'milestones');

  // ── 1. Detect milestones from ROADMAP.md ───────────────────────────────────

  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  let milestones = [];
  if (fs.existsSync(roadmapPath)) {
    milestones = detectMilestones(fs.readFileSync(roadmapPath, 'utf-8'));
  }

  // Auto-detect active milestone if not specified
  const activeVersion = targetVersion || (milestones.find(m => m.status === 'active') || {}).version;
  if (!activeVersion) {
    error('Cannot detect active milestone. Use --version <label> to specify (e.g., --version v1.1)');
  }

  // ── 2. config.json — add concurrent: true ──────────────────────────────────

  const configPath = path.join(planningDir, 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.concurrent) {
      changes.push({ type: 'update_config', path: configPath, reason: 'Add concurrent: true to config.json' });
    }
  } else {
    changes.push({
      type: 'create_file', path: configPath,
      content: JSON.stringify({ concurrent: true, model_profile: 'balanced', commit_docs: true }, null, 2),
      reason: 'Create config.json with concurrent: true',
    });
  }

  // ── 3. Restructure flat milestone archives → nested ────────────────────────

  const flatArchives = detectFlatArchives(milestonesDir);
  for (const archive of flatArchives) {
    if (archive.hasNested) continue; // Already has nested dir

    const nestedDir = path.join(milestonesDir, archive.version);
    changes.push({ type: 'create_dir', path: nestedDir, reason: `Create nested directory for ${archive.version}` });

    if (archive.hasPhases) {
      changes.push({
        type: 'move_dir',
        from: path.join(milestonesDir, `${archive.version}-phases`),
        to: path.join(nestedDir, 'phases'),
        reason: `Restructure ${archive.version} phases: flat → nested`,
      });
    }

    for (const suffix of ['ROADMAP.md', 'REQUIREMENTS.md', 'MILESTONE-AUDIT.md']) {
      const flatFile = path.join(milestonesDir, `${archive.version}-${suffix}`);
      if (fs.existsSync(flatFile)) {
        changes.push({
          type: 'move_file',
          from: flatFile,
          to: path.join(nestedDir, suffix),
          reason: `Move ${archive.version} ${suffix} into nested directory`,
        });
      }
    }
  }

  // ── 4. Create active milestone workspace ───────────────────────────────────

  if (!fs.existsSync(milestonesDir)) {
    changes.push({ type: 'create_dir', path: milestonesDir, reason: 'Create milestones/ directory' });
  }

  const msDir = path.join(milestonesDir, activeVersion);
  if (!fs.existsSync(msDir)) {
    changes.push({ type: 'create_dir', path: msDir, reason: `Create milestone workspace for ${activeVersion}` });
  }

  const msPhasesDir = path.join(msDir, 'phases');
  if (!fs.existsSync(msPhasesDir)) {
    changes.push({ type: 'create_dir', path: msPhasesDir, reason: `Create phases/ for ${activeVersion}` });
  }

  // ── 5. Move active phases from root phases/ → milestone phases/ ────────────

  const rootPhasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(rootPhasesDir)) {
    const entries = fs.readdirSync(rootPhasesDir)
      .filter(e => {
        const stat = fs.statSync(path.join(rootPhasesDir, e));
        return stat.isDirectory() && !e.startsWith('.');
      });
    for (const entry of entries) {
      changes.push({
        type: 'move_dir',
        from: path.join(rootPhasesDir, entry),
        to: path.join(msPhasesDir, entry),
        reason: `Move active phase ${entry} → ${activeVersion} milestone`,
      });
    }
  }

  // ── 6. Create milestone docs ───────────────────────────────────────────────

  // Move root ROADMAP.md → milestone ROADMAP.md (preserves all phase details)
  if (fs.existsSync(roadmapPath) && !fs.existsSync(path.join(msDir, 'ROADMAP.md'))) {
    changes.push({
      type: 'move_file', from: roadmapPath, to: path.join(msDir, 'ROADMAP.md'),
      reason: `Move root ROADMAP.md to ${activeVersion} milestone (preserves phase details)`,
    });
  }

  // Move root STATE.md → milestone STATE.md
  const statePath = path.join(planningDir, 'STATE.md');
  if (fs.existsSync(statePath) && !fs.existsSync(path.join(msDir, 'STATE.md'))) {
    changes.push({
      type: 'move_file', from: statePath, to: path.join(msDir, 'STATE.md'),
      reason: `Move root STATE.md to ${activeVersion} milestone`,
    });
  }

  // Copy REQUIREMENTS.md → milestone (keep root copy too)
  const reqPath = path.join(planningDir, 'REQUIREMENTS.md');
  if (fs.existsSync(reqPath) && !fs.existsSync(path.join(msDir, 'REQUIREMENTS.md'))) {
    changes.push({
      type: 'copy_file', from: reqPath, to: path.join(msDir, 'REQUIREMENTS.md'),
      reason: `Copy REQUIREMENTS.md to ${activeVersion} milestone`,
    });
  }

  // ── 7. Create coordinator stubs for root ───────────────────────────────────

  // Root ROADMAP.md → coordinator stub (after moving original to milestone)
  changes.push({
    type: 'create_stub', target: 'roadmap',
    path: roadmapPath,
    milestones: milestones,
    reason: 'Create coordinator stub ROADMAP.md at project root',
  });

  // Root STATE.md → coordinator stub (after moving original to milestone)
  changes.push({
    type: 'create_stub', target: 'state',
    path: statePath,
    milestones: milestones,
    reason: 'Create coordinator stub STATE.md at project root',
  });

  return {
    layout,
    conversion_needed: true,
    active_milestone: activeVersion,
    detected_milestones: milestones,
    flat_archives: flatArchives,
    changes,
    summary: {
      layout,
      conversion: 'legacy-to-milestone-scoped',
      active_milestone: activeVersion,
      changes_count: changes.length,
      moves: changes.filter(c => c.type === 'move_dir' || c.type === 'move_file').length,
      creates: changes.filter(c => c.type === 'create_dir' || c.type === 'create_file' || c.type === 'create_stub').length,
      copies: changes.filter(c => c.type === 'copy_file').length,
      config_updates: changes.filter(c => c.type === 'update_config').length,
    },
  };
}

// ── Command handlers ─────────────────────────────────────────────────────────

function cmdMigrateDryRun(cwd, opts, raw) {
  const version = opts && opts.version;

  if (version) {
    // Full conversion dry-run
    const plan = inspectConversion(cwd, version);
    const rawValue = plan.conversion_needed ? 'conversion-needed' : 'up-to-date';
    output({ dry_run: true, ...plan }, raw, rawValue);
  } else {
    // Basic scaffold dry-run (existing behavior)
    const inspection = inspectLayout(cwd);
    const layout = inspection.layout;

    // If legacy, hint that --version is available for full conversion
    const conversionHint = layout === 'legacy'
      ? { hint: 'Legacy layout detected. Use --version <label> to plan full conversion to milestone-scoped layout.' }
      : {};

    const hasAutomatableChanges = inspection.changes.some(c => c.type !== 'manual_action');
    const rawValue = hasAutomatableChanges ? 'changes-needed' : 'up-to-date';

    output({ dry_run: true, changes: inspection.changes, summary: inspection.summary, ...conversionHint }, raw, rawValue);
  }
}

function cmdMigrateApply(cwd, opts, raw) {
  const version = opts && opts.version;

  if (version) {
    // Full conversion apply
    applyConversion(cwd, version, raw);
  } else {
    // Basic scaffold apply (existing behavior)
    applyBasic(cwd, raw);
  }
}

/**
 * Apply basic scaffold fixes (existing behavior preserved).
 */
function applyBasic(cwd, raw) {
  const inspection = inspectLayout(cwd);
  const actions = [];
  const skippedManual = [];

  for (const change of inspection.changes) {
    if (change.type === 'create_dir') {
      if (!fs.existsSync(change.path)) {
        fs.mkdirSync(change.path, { recursive: true });
        actions.push({ type: 'created_dir', path: change.path });
      }
    } else if (change.type === 'create_file') {
      if (!fs.existsSync(change.path)) {
        fs.writeFileSync(change.path, change.content, 'utf-8');
        actions.push({ type: 'created_file', path: change.path });
      }
    } else if (change.type === 'remove_stale') {
      if (fs.existsSync(change.path)) {
        fs.unlinkSync(change.path);
        actions.push({ type: 'removed_stale', path: change.path });
      }
    } else if (change.type === 'manual_action') {
      skippedManual.push(change);
    }
  }

  const manifestPath = path.join(cwd, '.planning', 'migrate-undo.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ applied: new Date().toISOString(), actions }, null, 2), 'utf-8');

  const rawValue = actions.length === 0 ? 'already-up-to-date' : `applied-${actions.length}-changes`;
  output({ applied: true, actions_taken: actions.length, actions, manifest_path: manifestPath, skipped_manual: skippedManual }, raw, rawValue);
}

/**
 * Apply full legacy → milestone-scoped conversion.
 */
function applyConversion(cwd, targetVersion, raw) {
  const plan = inspectConversion(cwd, targetVersion);

  if (!plan.conversion_needed) {
    const manifestPath = path.join(cwd, '.planning', 'migrate-undo.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ applied: new Date().toISOString(), actions: [], conversion: 'already-milestone-scoped' }, null, 2), 'utf-8');
    output({ applied: true, actions_taken: 0, actions: [], manifest_path: manifestPath, conversion: 'already-milestone-scoped' }, raw, 'already-up-to-date');
    return;
  }

  const planningDir = path.join(cwd, '.planning');
  const actions = [];

  // Extract project name from ROADMAP.md or PROJECT.md
  let projectName = 'Project';
  const projectPath = path.join(planningDir, 'PROJECT.md');
  if (fs.existsSync(projectPath)) {
    const content = fs.readFileSync(projectPath, 'utf-8');
    const match = content.match(/^#\s+(.+)/m);
    if (match) projectName = match[1].replace(/^Project:\s*/i, '').trim();
  }

  for (const change of plan.changes) {
    switch (change.type) {
      case 'create_dir': {
        if (!fs.existsSync(change.path)) {
          fs.mkdirSync(change.path, { recursive: true });
          actions.push({ type: 'created_dir', path: change.path });
        }
        break;
      }

      case 'create_file': {
        if (!fs.existsSync(change.path)) {
          fs.writeFileSync(change.path, change.content, 'utf-8');
          actions.push({ type: 'created_file', path: change.path });
        }
        break;
      }

      case 'update_config': {
        const config = JSON.parse(fs.readFileSync(change.path, 'utf-8'));
        // Backup
        const backup = change.path + '.pre-migration';
        if (!fs.existsSync(backup)) {
          fs.writeFileSync(backup, JSON.stringify(config, null, 2), 'utf-8');
          actions.push({ type: 'backup', path: backup, original: change.path });
        }
        // Update
        config.concurrent = true;
        if (!config.quality) {
          config.quality = {
            level: 'fast',
            test_exemptions: ['.md', '.json', 'templates/**', '.planning/**'],
            context7_token_cap: 2000,
          };
        }
        fs.writeFileSync(change.path, JSON.stringify(config, null, 2), 'utf-8');
        actions.push({ type: 'updated_config', path: change.path, added: ['concurrent: true'] });
        break;
      }

      case 'move_dir': {
        if (fs.existsSync(change.from) && !fs.existsSync(change.to)) {
          fs.renameSync(change.from, change.to);
          actions.push({ type: 'moved_dir', from: change.from, to: change.to });
        }
        break;
      }

      case 'move_file': {
        if (fs.existsSync(change.from) && !fs.existsSync(change.to)) {
          // Ensure parent dir exists
          const dir = path.dirname(change.to);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.renameSync(change.from, change.to);
          actions.push({ type: 'moved_file', from: change.from, to: change.to });
        }
        break;
      }

      case 'copy_file': {
        if (fs.existsSync(change.from) && !fs.existsSync(change.to)) {
          const dir = path.dirname(change.to);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.copyFileSync(change.from, change.to);
          actions.push({ type: 'copied_file', from: change.from, to: change.to });
        }
        break;
      }

      case 'create_stub': {
        let content;
        if (change.target === 'roadmap') {
          content = generateRoadmapStub(projectName, change.milestones);
        } else if (change.target === 'state') {
          content = generateStateStub(change.milestones);
        }
        if (content) {
          fs.writeFileSync(change.path, content, 'utf-8');
          actions.push({ type: 'created_stub', path: change.path, target: change.target });
        }
        break;
      }
    }
  }

  // Write undo manifest
  const manifestPath = path.join(planningDir, 'migrate-undo.json');
  fs.writeFileSync(manifestPath, JSON.stringify({
    applied: new Date().toISOString(),
    conversion: 'legacy-to-milestone-scoped',
    target_version: targetVersion,
    actions,
  }, null, 2), 'utf-8');

  const rawValue = actions.length === 0 ? 'already-up-to-date' : `converted-${actions.length}-actions`;

  output({
    applied: true,
    conversion: 'legacy-to-milestone-scoped',
    target_version: targetVersion,
    actions_taken: actions.length,
    actions,
    manifest_path: manifestPath,
    detected_milestones: plan.detected_milestones,
  }, raw, rawValue);
}

// ── Cleanup: remove stale flat duplicates ────────────────────────────────────

/**
 * Inspect for stale flat-pattern files where a nested directory already exists.
 * e.g., milestones/v3.0-ROADMAP.md is stale if milestones/v3.0/ROADMAP.md exists.
 */
function inspectCleanup(cwd) {
  const planningDir = path.join(cwd, '.planning');
  if (!fs.existsSync(planningDir)) {
    error('Cannot cleanup: .planning/ directory does not exist.');
  }

  const milestonesDir = path.join(planningDir, 'milestones');
  if (!fs.existsSync(milestonesDir)) {
    return { stale_files: [], stale_dirs: [], summary: { stale_count: 0 } };
  }

  const entries = fs.readdirSync(milestonesDir);
  const staleFiles = [];
  const staleDirs = [];

  for (const entry of entries) {
    const match = entry.match(/^(v[\d.]+)-(.+)/);
    if (!match) continue;

    const version = match[1];
    const suffix = match[2];
    const flatPath = path.join(milestonesDir, entry);
    const nestedDir = path.join(milestonesDir, version);

    // Only flag as stale if the nested directory exists
    if (!fs.existsSync(nestedDir)) continue;

    const stat = fs.statSync(flatPath);
    if (stat.isDirectory()) {
      // e.g., v3.0-phases/ is stale if v3.0/phases/ exists
      const nestedEquiv = path.join(nestedDir, suffix === 'phases' ? 'phases' : suffix);
      if (fs.existsSync(nestedEquiv)) {
        staleDirs.push({ path: flatPath, version, suffix, nested: nestedEquiv, reason: `Stale flat directory — nested ${version}/${suffix} exists` });
      }
    } else {
      // e.g., v3.0-ROADMAP.md is stale if v3.0/ROADMAP.md exists
      const nestedEquiv = path.join(nestedDir, suffix);
      if (fs.existsSync(nestedEquiv)) {
        staleFiles.push({ path: flatPath, version, suffix, nested: nestedEquiv, reason: `Stale flat file — nested ${version}/${suffix} exists` });
      }
    }
  }

  return {
    stale_files: staleFiles,
    stale_dirs: staleDirs,
    summary: { stale_count: staleFiles.length + staleDirs.length },
  };
}

function cmdMigrateCleanup(cwd, opts, raw) {
  const dryRun = opts && opts.dryRun;
  const inspection = inspectCleanup(cwd);

  if (inspection.summary.stale_count === 0) {
    output({ cleanup: true, dry_run: !!dryRun, removed: [], summary: { stale_count: 0 } }, raw, 'clean');
    return;
  }

  if (dryRun) {
    output({
      cleanup: true, dry_run: true,
      stale_files: inspection.stale_files,
      stale_dirs: inspection.stale_dirs,
      summary: inspection.summary,
    }, raw, `${inspection.summary.stale_count}-stale`);
    return;
  }

  // Apply cleanup — remove stale items
  const removed = [];

  for (const item of inspection.stale_files) {
    if (fs.existsSync(item.path)) {
      fs.unlinkSync(item.path);
      removed.push({ type: 'removed_file', path: item.path, reason: item.reason });
    }
  }

  for (const item of inspection.stale_dirs) {
    if (fs.existsSync(item.path)) {
      fs.rmSync(item.path, { recursive: true });
      removed.push({ type: 'removed_dir', path: item.path, reason: item.reason });
    }
  }

  const rawValue = removed.length === 0 ? 'clean' : `cleaned-${removed.length}`;
  output({ cleanup: true, dry_run: false, removed, summary: { removed_count: removed.length } }, raw, rawValue);
}

// ── Config migration: skill-creator.json → adaptive_learning key ─────────────

/**
 * Merge a standalone skill-creator.json into config.json under the
 * `adaptive_learning` key.  Safe to call repeatedly (idempotent).
 *
 * Three states handled:
 *  1. No skill-creator.json present        → skip (nothing to migrate)
 *  2. adaptive_learning already in config  → skip (already migrated)
 *  3. skill-creator.json exists and key missing → merge, backup, remove
 *
 * @param {string} planningDir - Absolute path to the .planning/ directory
 */
function migrateSkillCreatorConfig(planningDir) {
  const scPath = path.join(planningDir, 'skill-creator.json');
  const cfgPath = path.join(planningDir, 'config.json');

  // Nothing to migrate
  if (!fs.existsSync(scPath)) return;

  const config = fs.existsSync(cfgPath)
    ? JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    : {};

  // Already migrated — idempotent skip
  if (config.adaptive_learning) return;

  const scConfig = JSON.parse(fs.readFileSync(scPath, 'utf8'));
  config.adaptive_learning = scConfig;

  // Write merged config
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n');

  // Backup and remove standalone file
  fs.copyFileSync(scPath, scPath + '.bak');
  fs.unlinkSync(scPath);
}

module.exports = { cmdMigrateDryRun, cmdMigrateApply, cmdMigrateCleanup, inspectConversion, inspectCleanup, detectMilestones, detectFlatArchives, detectLayoutStyle, migrateSkillCreatorConfig };
