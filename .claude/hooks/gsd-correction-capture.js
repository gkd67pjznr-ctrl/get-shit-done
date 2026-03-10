'use strict';
// PostToolUse hook for automatic edit and revert detection.
// Detects two correction signals:
//   1. Edit detection: tracks files Claude writes, detects external mtime/size changes
//   2. Revert detection: watches Bash for git revert/reset/restore patterns
//
// Reads stdin JSON with: session_id, cwd, tool_name, tool_input, tool_response.
// Always exits 0 -- silent failure on all paths.

const fs = require('fs');
const path = require('path');

// ─── Section 1: stdin reading ─────────────────────────────────────────────────

let input = '';
try { input = fs.readFileSync('/dev/stdin', 'utf-8'); } catch (e) {}
let parsed = {};
try { parsed = JSON.parse(input); } catch (e) {}

const sessionId = parsed.session_id || 'unknown';
const cwd = parsed.cwd || process.cwd();
const toolName = parsed.tool_name || '';
const toolInput = parsed.tool_input || {};

// ─── Section 2: session tracking helpers ──────────────────────────────────────

function getTrackingFile() {
  return `/tmp/gsd-session-${sessionId}-files.json`;
}

function loadTrackedFiles() {
  try {
    const raw = fs.readFileSync(getTrackingFile(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

function saveTrackedFiles(map) {
  try {
    fs.writeFileSync(getTrackingFile(), JSON.stringify(map));
  } catch (e) {
    // Silent on error
  }
}

function getFileStat(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { mtime: stat.mtimeMs, size: stat.size };
  } catch (e) {
    return null;
  }
}

// ─── Section 5 helper: read phase and milestone from STATE.md ─────────────────

function getCurrentPhaseAndMilestone(projectCwd) {
  try {
    // Try milestone-scoped STATE.md first, then flat STATE.md
    const possiblePaths = [];

    // Look for milestone dirs under .planning/milestones/
    const milestonesDir = path.join(projectCwd, '.planning', 'milestones');
    try {
      const entries = fs.readdirSync(milestonesDir);
      // Sort descending to get newest milestone first
      const versionDirs = entries.filter(e => /^v\d/.test(e)).sort().reverse();
      for (const dir of versionDirs) {
        possiblePaths.push(path.join(milestonesDir, dir, 'STATE.md'));
      }
    } catch (e) {
      // No milestones dir
    }

    possiblePaths.push(path.join(projectCwd, '.planning', 'STATE.md'));

    for (const statePath of possiblePaths) {
      try {
        const content = fs.readFileSync(statePath, 'utf-8');
        const lines = content.split('\n');

        // Find phase: "Phase: 22 (1 of 6 in v6.0) ..."
        let phase = 0;
        let milestone = 'unknown';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('Phase:')) {
            // Extract integer before first space/parenthesis after "Phase:"
            const rest = trimmed.slice('Phase:'.length).trim();
            const match = rest.match(/^(\d+)/);
            if (match) {
              phase = parseInt(match[1], 10);
            }
          }
          // Extract milestone from "milestones/vX.Y" pattern in the file
          const milestoneMatch = trimmed.match(/milestones\/(v[\d.]+)/);
          if (milestoneMatch) {
            milestone = milestoneMatch[1];
          }
        }

        // If we found a non-zero phase, return it
        if (phase !== 0 || milestone !== 'unknown') {
          return { phase, milestone };
        }
      } catch (e) {
        // Try next path
      }
    }

    return { phase: 0, milestone: 'unknown' };
  } catch (e) {
    return { phase: 0, milestone: 'unknown' };
  }
}

// ─── Section 5b helper: read quality level from config ────────────────────────

function getQualityLevel(projectCwd) {
  try {
    const configPath = path.join(projectCwd, '.planning', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const level = (config.quality || {}).level;
    if (level === 'fast' || level === 'standard' || level === 'strict') return level;
    return 'fast'; // default to fast when not configured
  } catch (e) {
    return 'fast'; // default to fast on any error
  }
}

// ─── Main logic (wrapped in try/catch for silent failure) ─────────────────────

try {
  const { writeCorrection } = require(path.join(cwd, '.claude/hooks/lib/write-correction.cjs'));
  const qualityLevel = getQualityLevel(cwd);

  // ─── Section 3: on Write or Edit — record file ────────────────────────────

  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = toolInput.path || toolInput.file_path || '';
    if (filePath) {
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      const stat = getFileStat(absPath);
      if (stat) {
        const tracked = loadTrackedFiles();
        tracked[absPath] = stat;
        saveTrackedFiles(tracked);
      }
    }
  }

  // ─── Section 4: scan for external edits ──────────────────────────────────

  // On any tool call, check tracked files for external changes.
  // Skip: if current tool is Write/Edit writing the same file (that's Claude, not a user edit).
  const currentWritePath = (toolName === 'Write' || toolName === 'Edit')
    ? path.resolve(cwd, toolInput.path || toolInput.file_path || '')
    : null;

  const tracked = loadTrackedFiles();
  for (const [trackedPath, lastStat] of Object.entries(tracked)) {
    if (trackedPath === currentWritePath) continue; // skip current Claude write
    const currentStat = getFileStat(trackedPath);
    if (!currentStat) continue;
    if (currentStat.mtime !== lastStat.mtime || currentStat.size !== lastStat.size) {
      // External edit detected -- write correction and update tracking
      const { phase, milestone } = getCurrentPhaseAndMilestone(cwd);
      const fromMsg = `File ${path.basename(trackedPath)} was rewritten by user after Claude's edit`;
      writeCorrection({
        correction_from: fromMsg.slice(0, 200),
        correction_to: "User's manual edit preferred over Claude's output",
        diagnosis_category: 'process.convention_violation',
        secondary_category: null,
        diagnosis_text: "Did produce output the user manually edited. Should have matched user's style or intent more closely.",
        scope: 'file',
        phase,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        milestone,
        quality_level: qualityLevel,
        source: 'edit_detection',
      }, { cwd });
      // Update tracked stat so we don't re-fire on the same edit
      tracked[trackedPath] = currentStat;
    }
  }
  saveTrackedFiles(tracked);

  // ─── Section 6: revert detection ─────────────────────────────────────────

  if (toolName === 'Bash') {
    const cmd = toolInput.command || '';
    const revertPatterns = [
      /git\s+revert\b/,
      /git\s+reset\s+--hard\b/,
      /git\s+checkout\s+--\s+/,
      /git\s+restore\b/,
    ];
    const matchedPattern = revertPatterns.find(p => p.test(cmd));
    if (matchedPattern) {
      const { phase, milestone } = getCurrentPhaseAndMilestone(cwd);
      writeCorrection({
        correction_from: `Git revert/reset command executed: ${cmd.slice(0, 150)}`,
        correction_to: "User reverted Claude's commit or file changes",
        diagnosis_category: 'process.regression',
        secondary_category: null,
        diagnosis_text: 'Did produce output that user reverted via git. Should have verified correctness before committing.',
        scope: 'project',
        phase,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        milestone,
        quality_level: qualityLevel,
        source: 'revert_detection',
      }, { cwd });
    }
  }
} catch (e) {
  // Silent failure -- hook always exits 0
}

process.exit(0);
