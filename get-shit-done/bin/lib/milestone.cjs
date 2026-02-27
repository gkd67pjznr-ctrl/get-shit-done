/**
 * Milestone — Milestone and requirements lifecycle operations
 */

const fs = require('fs');
const path = require('path');
const { output, error, escapeRegex, planningRoot } = require('./core.cjs');
const { extractFrontmatter } = require('./frontmatter.cjs');

function cmdRequirementsMarkComplete(cwd, reqIdsRaw, raw) {
  if (!reqIdsRaw || reqIdsRaw.length === 0) {
    error('requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02');
  }

  // Accept comma-separated, space-separated, or bracket-wrapped: [REQ-01, REQ-02]
  const reqIds = reqIdsRaw
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    error('no valid requirement IDs found');
  }

  const reqPath = path.join(cwd, '.planning', 'REQUIREMENTS.md');
  if (!fs.existsSync(reqPath)) {
    output({ updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds }, raw, 'no requirements file');
    return;
  }

  let reqContent = fs.readFileSync(reqPath, 'utf-8');
  const updated = [];
  const notFound = [];

  for (const reqId of reqIds) {
    let found = false;

    // Update checkbox: - [ ] **REQ-ID** → - [x] **REQ-ID**
    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqId}\\*\\*)`, 'gi');
    if (checkboxPattern.test(reqContent)) {
      reqContent = reqContent.replace(checkboxPattern, '$1x$2');
      found = true;
    }

    // Update traceability table: | REQ-ID | Phase N | Pending | → | REQ-ID | Phase N | Complete |
    const tablePattern = new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    if (tablePattern.test(reqContent)) {
      // Re-read since test() advances lastIndex for global regex
      reqContent = reqContent.replace(
        new RegExp(`(\\|\\s*${reqId}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi'),
        '$1 Complete $2'
      );
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      notFound.push(reqId);
    }
  }

  if (updated.length > 0) {
    fs.writeFileSync(reqPath, reqContent, 'utf-8');
  }

  output({
    updated: updated.length > 0,
    marked_complete: updated,
    not_found: notFound,
    total: reqIds.length,
  }, raw, `${updated.length}/${reqIds.length} requirements marked complete`);
}

function cmdMilestoneComplete(cwd, version, options, raw, milestoneScope) {
  if (!version) {
    error('version required for milestone complete (e.g., v1.0)');
  }

  const root = planningRoot(cwd, milestoneScope);
  const roadmapPath = path.join(root, 'ROADMAP.md');
  const reqPath = path.join(root, 'REQUIREMENTS.md');
  const statePath = path.join(root, 'STATE.md');
  const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
  const archiveDir = path.join(cwd, '.planning', 'milestones');
  const phasesDir = path.join(root, 'phases');
  const today = new Date().toISOString().split('T')[0];
  const milestoneName = options.name || version;

  // Ensure archive directory exists
  fs.mkdirSync(archiveDir, { recursive: true });

  // Gather stats from phases
  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments = [];

  try {
    const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

    for (const dir of dirs) {
      phaseCount++;
      const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
      const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      // Extract one-liners from summaries
      for (const s of summaries) {
        try {
          const content = fs.readFileSync(path.join(phasesDir, dir, s), 'utf-8');
          const fm = extractFrontmatter(content);
          if (fm['one-liner']) {
            accomplishments.push(fm['one-liner']);
          }
          // Count tasks
          const taskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
          totalTasks += taskMatches.length;
        } catch {}
      }
    }
  } catch {}

  // Finalize milestone workspace ROADMAP before archiving (FLOW-02)
  const workspaceDir = path.join(archiveDir, version);
  const workspaceRoadmap = path.join(workspaceDir, 'ROADMAP.md');
  if (fs.existsSync(workspaceRoadmap)) {
    let wsContent = fs.readFileSync(workspaceRoadmap, 'utf-8');

    // Gather phase completion data from phases directory and update workspace ROADMAP
    try {
      const entries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();

      for (const dir of dirs) {
        const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
        if (!dm) continue;

        const pNum = dm[1];
        const phaseFiles = fs.readdirSync(path.join(phasesDir, dir));
        const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
        const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

        if (summaries.length >= plans.length && plans.length > 0) {
          const pEscaped = escapeRegex(pNum);

          // Flip phase-level checkbox
          const phaseCheckbox = new RegExp(
            `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${pEscaped}[:\\s][^\\n]*)`, 'i'
          );
          wsContent = wsContent.replace(phaseCheckbox, `$1x$2`);

          // Flip plan-level checkboxes
          for (const planFile of plans) {
            const planPattern = new RegExp(
              `(-\\s*\\[)[ ](\\]\\s*${escapeRegex(planFile)})`, 'gi'
            );
            wsContent = wsContent.replace(planPattern, '$1x$2');
          }

          // Update progress table row
          const tablePattern = new RegExp(
            `(\\|\\s*${pEscaped}\\.?\\s[^|]*\\|)[^|]*(\\|)\\s*[^|]*(\\|)\\s*[^|]*(\\|)`, 'i'
          );
          wsContent = wsContent.replace(
            tablePattern,
            `$1 ${summaries.length}/${plans.length} $2 Complete    $3 ${today} $4`
          );

          // Update plan count text
          const planCountPat = new RegExp(
            `(#{2,4}\\s*Phase\\s+${pEscaped}[\\s\\S]*?\\*\\*Plans:\\*\\*\\s*)[^\\n]+`, 'i'
          );
          wsContent = wsContent.replace(planCountPat, `$1${summaries.length}/${plans.length} plans complete`);
        }
      }
    } catch (e) {
      // If phases dir doesn't exist or is unreadable, skip finalization silently
    }

    fs.writeFileSync(workspaceRoadmap, wsContent, 'utf-8');
  }

  // Archive ROADMAP.md
  if (fs.existsSync(roadmapPath)) {
    const roadmapContent = fs.readFileSync(roadmapPath, 'utf-8');
    fs.writeFileSync(path.join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  // Archive REQUIREMENTS.md
  if (fs.existsSync(reqPath)) {
    const reqContent = fs.readFileSync(reqPath, 'utf-8');
    const archiveHeader = `# Requirements Archive: ${version} ${milestoneName}\n\n**Archived:** ${today}\n**Status:** SHIPPED\n\nFor current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    fs.writeFileSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  // Archive audit file if exists
  const auditFile = path.join(cwd, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (fs.existsSync(auditFile)) {
    fs.renameSync(auditFile, path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  // Create/append MILESTONES.md entry
  const accomplishmentsList = accomplishments.map(a => `- ${a}`).join('\n');
  const milestoneEntry = `## ${version} ${milestoneName} (Shipped: ${today})\n\n**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (fs.existsSync(milestonesPath)) {
    const existing = fs.readFileSync(milestonesPath, 'utf-8');
    fs.writeFileSync(milestonesPath, existing + '\n' + milestoneEntry, 'utf-8');
  } else {
    fs.writeFileSync(milestonesPath, `# Milestones\n\n${milestoneEntry}`, 'utf-8');
  }

  // Update STATE.md
  if (fs.existsSync(statePath)) {
    let stateContent = fs.readFileSync(statePath, 'utf-8');
    stateContent = stateContent.replace(
      /(\*\*Status:\*\*\s*).*/,
      `$1${version} milestone complete`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity:\*\*\s*).*/,
      `$1${today}`
    );
    stateContent = stateContent.replace(
      /(\*\*Last Activity Description:\*\*\s*).*/,
      `$1${version} milestone completed and archived`
    );
    fs.writeFileSync(statePath, stateContent, 'utf-8');
  }

  // Archive phase directories if requested
  let phasesArchived = false;
  if (options.archivePhases) {
    try {
      const phaseArchiveDir = path.join(archiveDir, `${version}-phases`);
      fs.mkdirSync(phaseArchiveDir, { recursive: true });

      const phaseEntries = fs.readdirSync(phasesDir, { withFileTypes: true });
      const phaseDirNames = phaseEntries.filter(e => e.isDirectory()).map(e => e.name);
      for (const dir of phaseDirNames) {
        fs.renameSync(path.join(phasesDir, dir), path.join(phaseArchiveDir, dir));
      }
      phasesArchived = phaseDirNames.length > 0;
    } catch {}
  }

  // Mark workspace conflict.json as complete (WKSP-04)
  const workspaceConflict = path.join(cwd, '.planning', 'milestones', version, 'conflict.json');
  let conflictMarkedComplete = false;
  if (fs.existsSync(workspaceConflict)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(workspaceConflict, 'utf-8'));
      manifest.status = 'complete';
      manifest.completed_at = today;
      fs.writeFileSync(workspaceConflict, JSON.stringify(manifest, null, 2), 'utf-8');
      conflictMarkedComplete = true;
    } catch {
      conflictMarkedComplete = false;
    }
  }

  const result = {
    version,
    name: milestoneName,
    date: today,
    phases: phaseCount,
    plans: totalPlans,
    tasks: totalTasks,
    accomplishments,
    archived: {
      roadmap: fs.existsSync(path.join(archiveDir, `${version}-ROADMAP.md`)),
      requirements: fs.existsSync(path.join(archiveDir, `${version}-REQUIREMENTS.md`)),
      audit: fs.existsSync(path.join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
      phases: phasesArchived,
    },
    milestones_updated: true,
    state_updated: fs.existsSync(statePath),
    conflict_marked_complete: conflictMarkedComplete,
  };

  output(result, raw);
}

function cmdMilestoneNewWorkspace(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone new-workspace (e.g., v2.0)');
  }

  const today = new Date().toISOString().split('T')[0];
  const workspaceDir = path.join(cwd, '.planning', 'milestones', version);
  const phasesDir = path.join(workspaceDir, 'phases');
  const researchDir = path.join(workspaceDir, 'research');

  // Create directory tree
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.mkdirSync(phasesDir, { recursive: true });
  fs.mkdirSync(researchDir, { recursive: true });

  const files = [];
  const dirs = ['phases', 'research'];

  // Create scaffold files only if not already present (idempotency)
  const statePath = path.join(workspaceDir, 'STATE.md');
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(
      statePath,
      `# Project State — Milestone ${version}\n\n**Created:** ${today}\n**Status:** Initializing\n`,
      'utf-8'
    );
    files.push('STATE.md');
  }

  const roadmapPath = path.join(workspaceDir, 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    fs.writeFileSync(
      roadmapPath,
      `# Roadmap — Milestone ${version}\n\n*Created: ${today}*\n`,
      'utf-8'
    );
    files.push('ROADMAP.md');
  }

  const reqPath = path.join(workspaceDir, 'REQUIREMENTS.md');
  if (!fs.existsSync(reqPath)) {
    fs.writeFileSync(
      reqPath,
      `# Requirements — Milestone ${version}\n\n*Created: ${today}*\n`,
      'utf-8'
    );
    files.push('REQUIREMENTS.md');
  }

  const conflictPath = path.join(workspaceDir, 'conflict.json');
  if (!fs.existsSync(conflictPath)) {
    fs.writeFileSync(
      conflictPath,
      JSON.stringify({ version, created_at: today, status: 'active', files_touched: [] }, null, 2),
      'utf-8'
    );
    files.push('conflict.json');
  }

  const result = {
    version,
    workspace_dir: workspaceDir,
    created: files.length > 0,
    files,
    dirs,
  };

  output(result, raw);
}

function cmdMilestoneUpdateManifest(cwd, version, files, raw) {
  if (!version) {
    error('version required for milestone update-manifest (e.g., v2.0)');
  }

  const conflictPath = path.join(cwd, '.planning', 'milestones', version, 'conflict.json');
  if (!fs.existsSync(conflictPath)) {
    error(`conflict.json not found for milestone ${version} — run milestone new-workspace first`);
  }

  const conflict = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
  const existingFiles = conflict.files_touched || [];
  const merged = [...new Set([...existingFiles, ...files])];
  const added = merged.length - existingFiles.length;

  conflict.files_touched = merged;
  fs.writeFileSync(conflictPath, JSON.stringify(conflict, null, 2), 'utf-8');

  output({ version, files_touched: merged, added }, raw);
}

function cmdMilestoneWriteStatus(cwd, version, options, raw) {
  if (!version) {
    error('version required for milestone write-status (e.g., v2.0)');
  }

  const workspaceDir = path.join(cwd, '.planning', 'milestones', version);
  const statusPath = path.join(workspaceDir, 'STATUS.md');
  const today = new Date().toISOString().split('T')[0];

  const content = [
    `# Status — Milestone ${version}`,
    '',
    `**Updated:** ${today}`,
    `**Phase:** ${options.phase || '?'}`,
    `**Plan:** ${options.plan || '?'}`,
    `**Checkpoint:** ${options.checkpoint || 'unknown'}`,
    `**Progress:** ${options.progress || '?'}`,
    `**Status:** ${options.status || 'In Progress'}`,
    '',
  ].join('\n');

  fs.writeFileSync(statusPath, content, 'utf-8');

  // DASH-03: Update MILESTONES.md section as live dashboard side effect
  try {
    const milestonesPath = path.join(cwd, '.planning', 'MILESTONES.md');
    if (fs.existsSync(milestonesPath)) {
      let mdContent = fs.readFileSync(milestonesPath, 'utf-8');
      const sectionContent = [
        `## ${version}`,
        '',
        `**Phase:** ${options.phase || '?'} | **Plan:** ${options.plan || '?'} | **Status:** ${options.status || 'In Progress'}`,
        `**Progress:** ${options.progress || '?'}`,
        `**Updated:** ${today}`,
      ].join('\n');

      const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const sectionPattern = new RegExp(
        `## ${escapedVersion}[^\\n]*\\n[\\s\\S]*?(?=\\n## |$)`
      );
      if (sectionPattern.test(mdContent)) {
        mdContent = mdContent.replace(sectionPattern, sectionContent);
      } else {
        mdContent = mdContent.trimEnd() + '\n\n' + sectionContent + '\n';
      }
      fs.writeFileSync(milestonesPath, mdContent, 'utf-8');
    }
  } catch { /* MILESTONES.md update is non-fatal */ }

  output({ version, written: true, path: statusPath }, raw);
}

function cmdManifestCheck(cwd, raw) {
  const milestonesDir = path.join(cwd, '.planning', 'milestones');
  const manifests = [];

  try {
    const entries = fs.readdirSync(milestonesDir, { withFileTypes: true });
    for (const entry of entries.filter(e => e.isDirectory())) {
      const conflictPath = path.join(milestonesDir, entry.name, 'conflict.json');
      if (fs.existsSync(conflictPath)) {
        const manifest = JSON.parse(fs.readFileSync(conflictPath, 'utf-8'));
        if (manifest.status === 'active') {
          manifests.push({ version: manifest.version, files: manifest.files_touched || [] });
        }
      }
    }
  } catch { /* graceful degrade — no milestones dir */ }

  // Find overlaps: for each pair of milestones, find common files_touched
  const conflicts = [];
  for (let i = 0; i < manifests.length; i++) {
    for (let j = i + 1; j < manifests.length; j++) {
      const a = manifests[i];
      const b = manifests[j];
      const overlap = a.files.filter(f => b.files.includes(f));
      if (overlap.length > 0) {
        conflicts.push({ milestones: [a.version, b.version], files: overlap });
      }
    }
  }

  // CNFL-04: Always advisory — exit 0 regardless
  output({
    has_conflicts: conflicts.length > 0,
    conflicts,
    manifests_checked: manifests.length,
  }, raw);
}

module.exports = {
  cmdRequirementsMarkComplete,
  cmdMilestoneComplete,
  cmdMilestoneNewWorkspace,
  cmdMilestoneUpdateManifest,
  cmdMilestoneWriteStatus,
  cmdManifestCheck,
};
