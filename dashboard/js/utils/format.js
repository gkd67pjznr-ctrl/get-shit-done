// Extract percentage from progress string like "[████░░░░░░] 40%"
export function parseProgress(progressStr) {
  if (!progressStr) return null;
  const match = progressStr.match(/(\d+(?:\.\d+)?)%/);
  return match ? parseFloat(match[1]) : null;
}

// Format percentage for display
export function fmtPct(n) {
  if (n === null || n === undefined) return '—';
  return `${Math.round(n)}%`;
}

// Infer workflow step from STATE.md status string
export function inferWorkflowStep(status) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s.includes('discuss')) return 'discuss';
  if (s.includes('plan') && !s.includes('planning')) return 'plan';
  if (s.includes('execut') || s.includes('in-progress') || s.includes('building')) return 'execute';
  if (s.includes('verif') || s.includes('complet') || s.includes('done')) return 'verify';
  return null;
}

// Map config quality level to display string (nested at config.quality.level)
export function fmtQuality(config) {
  if (!config) return null;
  return config.quality?.level || config.quality_level || null;
}

// Map status string to CSS class
export function statusClass(status) {
  if (!status) return 'status-not-started';
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 'status-complete';
  if (s.includes('block')) return 'status-blocked';
  if (s.includes('active') || s.includes('in-progress')) return 'status-active';
  if (s.includes('stale') || s.includes('warning')) return 'status-attention';
  return 'status-not-started';
}

// Get the active milestone from milestones array
export function getActiveMilestone(milestones) {
  if (!milestones || milestones.length === 0) return null;
  return milestones.find(m => m.active) || milestones[milestones.length - 1];
}

// Count completed milestones
export function countCompletedMilestones(milestones) {
  if (!milestones) return 0;
  return milestones.filter(m => !m.active && m.state && m.state.status &&
    m.state.status.toLowerCase().includes('complet')).length;
}

// Return the human-readable health label string
export function healthLabel(health) {
  if (!health) return null;
  return health.label; // 'Healthy', 'Needs Attention', 'At Risk', 'New/Unknown'
}

// Map health level to signal CSS class name
export function healthClass(health) {
  if (!health) return '';
  const map = {
    success: 'status-active',
    warning: 'status-attention',
    error: 'status-blocked',
    neutral: 'status-not-started',
  };
  return map[health.level] || 'status-not-started';
}

// Format millisecond timestamp as human-readable idle duration
export function fmtIdleDuration(lastActivityMs) {
  if (!lastActivityMs || isNaN(lastActivityMs)) return 'unknown';
  const seconds = Math.floor((Date.now() - lastActivityMs) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// Format cost as $X.XX (returns null if no value)
export function fmtCost(total) {
  if (total == null || total === 0) return null;
  return '$' + total.toFixed(2);
}

// Format lines changed as +N/-N (returns null if no values)
export function fmtLinesChanged(added, removed) {
  if (added == null && removed == null) return null;
  const a = added || 0;
  const r = removed || 0;
  if (a === 0 && r === 0) return null;
  return `+${a}/-${r}`;
}

// Format duration in ms to "Xh Ym" or "Xm" (returns null if under 1 minute)
export function fmtSessionDuration(ms) {
  if (ms == null || ms < 60000) return null;
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// Compute shimmer animation class based on tmux pane activity
export function computeShimmerClass(project) {
  // Returns: 'shimmer-active' (blue), 'shimmer-amber' (waiting), or '' (idle/no sessions)
  if (!project || !project.tracking) return '';
  const tmux = project.tmux;
  if (!tmux || !tmux.available || !tmux.panes || tmux.panes.length === 0) return '';
  const now = Date.now();
  const claudePanes = tmux.panes.filter(p => p.isClaude);
  if (claudePanes.length === 0) return '';
  const WORKING_THRESHOLD = 10 * 1000;
  const WAITING_THRESHOLD = 5 * 60 * 1000;
  const hasWorking = claudePanes.some(p => p.lastActivity && (now - p.lastActivity) < WORKING_THRESHOLD);
  if (hasWorking) return 'shimmer-active';
  const hasWaiting = claudePanes.some(p => p.lastActivity && (now - p.lastActivity) < WAITING_THRESHOLD);
  if (hasWaiting) return 'shimmer-amber';
  return '';
}
