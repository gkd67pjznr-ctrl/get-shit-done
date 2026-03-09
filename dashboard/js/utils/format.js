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

// Map config.quality_level to display string
export function fmtQuality(config) {
  if (!config) return null;
  return config.quality_level || config.mode || null;
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
