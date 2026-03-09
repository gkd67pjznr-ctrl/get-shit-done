'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const server = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'server.cjs'));
const {
  _parseTmuxOutput: parseTmuxOutput,
  _mapPanesToProjects: mapPanesToProjects,
  _tmuxStateHash: tmuxStateHash,
  _computeHealthScore: computeHealthScore,
  _pollTmux: pollTmux,
} = server;

// ─── parseTmuxOutput tests ─────────────────────────────────────────────────────

describe('parseTmuxOutput', () => {
  it('returns empty array for empty input', () => {
    const result = parseTmuxOutput('');
    assert.deepEqual(result, []);
  });

  it('returns empty array for whitespace-only input', () => {
    const result = parseTmuxOutput('   \n   ');
    assert.deepEqual(result, []);
  });

  it('parses single pane line with cc session prefix -- isClaude is true', () => {
    // Format: sessionName|paneIndex|paneCwd|paneTitle|paneCmd|sessionWindows|windowPanes|windowActivity|panePid
    const raw = 'cc-myproject|0|/Users/me/project|bash|bash|1|1|1704067200|12345';
    const result = parseTmuxOutput(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].sessionName, 'cc-myproject');
    assert.equal(result[0].isClaude, true);
    assert.equal(result[0].lastActivity, 1704067200 * 1000);
  });

  it('parses single pane line with non-cc session -- isClaude is false', () => {
    const raw = 'main|0|/Users/me/project|bash|bash|1|1|1704067200|12345';
    const result = parseTmuxOutput(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].isClaude, false);
  });

  it('parses two pane lines and returns array of two objects', () => {
    const raw = [
      'cc-proj|0|/Users/me/a|bash|bash|1|2|1704067200|11111',
      'main|1|/Users/me/b|zsh|zsh|1|1|1704067300|22222',
    ].join('\n');
    const result = parseTmuxOutput(raw);
    assert.equal(result.length, 2);
    assert.equal(result[0].sessionName, 'cc-proj');
    assert.equal(result[1].sessionName, 'main');
  });

  it('handles line with missing fields gracefully -- produces NaN for numeric fields, does not throw', () => {
    const raw = 'sessionOnly';
    let result;
    assert.doesNotThrow(() => {
      result = parseTmuxOutput(raw);
    });
    assert.equal(result.length, 1);
    assert.equal(isNaN(result[0].paneIndex), true);
  });

  it('converts windowActivity seconds to milliseconds', () => {
    const activitySec = 1700000000;
    const raw = `cc-test|0|/path|title|cmd|1|1|${activitySec}|9999`;
    const result = parseTmuxOutput(raw);
    assert.equal(result[0].lastActivity, activitySec * 1000);
  });
});

// ─── mapPanesToProjects tests ──────────────────────────────────────────────────

describe('mapPanesToProjects', () => {
  it('returns empty Map for empty pane array', () => {
    const cache = new Map([
      ['myproject', { path: '/Users/me/project', name: 'myproject' }],
    ]);
    const result = mapPanesToProjects([], cache);
    assert.equal(result.size, 0);
  });

  it('maps pane with cwd exactly matching project path', () => {
    const cache = new Map([
      ['myproject', { path: '/Users/me/project', name: 'myproject' }],
    ]);
    const panes = [{ sessionName: 'cc-1', cwd: '/Users/me/project', lastActivity: 1000, paneIndex: 0, isClaude: true }];
    const result = mapPanesToProjects(panes, cache);
    assert.equal(result.has('myproject'), true);
    assert.equal(result.get('myproject').panes.length, 1);
  });

  it('maps pane with cwd that is a subdirectory of a project path', () => {
    const cache = new Map([
      ['myproject', { path: '/Users/me/project', name: 'myproject' }],
    ]);
    const panes = [{ sessionName: 'cc-1', cwd: '/Users/me/project/src/components', lastActivity: 1000, paneIndex: 0, isClaude: true }];
    const result = mapPanesToProjects(panes, cache);
    assert.equal(result.has('myproject'), true);
  });

  it('does not map pane whose cwd matches no registered project path', () => {
    const cache = new Map([
      ['myproject', { path: '/Users/me/project', name: 'myproject' }],
    ]);
    const panes = [{ sessionName: 'cc-1', cwd: '/Users/other/work', lastActivity: 1000, paneIndex: 0, isClaude: true }];
    const result = mapPanesToProjects(panes, cache);
    assert.equal(result.size, 0);
  });

  it('maps pane to most specific (longer) project path when two projects registered', () => {
    const cache = new Map([
      ['parent', { path: '/Users/me/projects', name: 'parent' }],
      ['child', { path: '/Users/me/projects/myapp', name: 'child' }],
    ]);
    const panes = [{ sessionName: 'cc-1', cwd: '/Users/me/projects/myapp/src', lastActivity: 1000, paneIndex: 0, isClaude: true }];
    const result = mapPanesToProjects(panes, cache);
    assert.equal(result.has('child'), true);
    assert.equal(result.has('parent'), false);
  });

  it('groups sessions correctly for a matched project', () => {
    const cache = new Map([
      ['myproject', { path: '/Users/me/project', name: 'myproject' }],
    ]);
    const panes = [
      { sessionName: 'cc-1', cwd: '/Users/me/project', lastActivity: 1000, paneIndex: 0, isClaude: true },
      { sessionName: 'cc-2', cwd: '/Users/me/project/src', lastActivity: 2000, paneIndex: 1, isClaude: true },
    ];
    const result = mapPanesToProjects(panes, cache);
    const entry = result.get('myproject');
    assert.equal(entry.sessions.size, 2);
    assert.equal(entry.panes.length, 2);
  });
});

// ─── tmuxStateHash tests ───────────────────────────────────────────────────────

describe('tmuxStateHash', () => {
  it('returns empty string for null input', () => {
    assert.equal(tmuxStateHash(null), '');
  });

  it('returns empty string for undefined input', () => {
    assert.equal(tmuxStateHash(undefined), '');
  });

  it('two calls with identical data return same hash', () => {
    const entry = {
      sessions: new Set(['cc-1', 'cc-2']),
      panes: [
        { sessionName: 'cc-1', paneIndex: 0, lastActivity: 1000 },
        { sessionName: 'cc-2', paneIndex: 1, lastActivity: 2000 },
      ],
    };
    const hash1 = tmuxStateHash(entry);
    const hash2 = tmuxStateHash(entry);
    assert.equal(hash1, hash2);
  });

  it('different session sets produce different hashes', () => {
    const entry1 = {
      sessions: new Set(['cc-1']),
      panes: [{ sessionName: 'cc-1', paneIndex: 0, lastActivity: 1000 }],
    };
    const entry2 = {
      sessions: new Set(['cc-2']),
      panes: [{ sessionName: 'cc-2', paneIndex: 0, lastActivity: 1000 }],
    };
    assert.notEqual(tmuxStateHash(entry1), tmuxStateHash(entry2));
  });

  it('produces deterministic hash regardless of Set insertion order', () => {
    const entryA = {
      sessions: new Set(['cc-1', 'cc-2']),
      panes: [
        { sessionName: 'cc-1', paneIndex: 0, lastActivity: 1000 },
        { sessionName: 'cc-2', paneIndex: 1, lastActivity: 2000 },
      ],
    };
    const entryB = {
      sessions: new Set(['cc-2', 'cc-1']),
      panes: [
        { sessionName: 'cc-1', paneIndex: 0, lastActivity: 1000 },
        { sessionName: 'cc-2', paneIndex: 1, lastActivity: 2000 },
      ],
    };
    assert.equal(tmuxStateHash(entryA), tmuxStateHash(entryB));
  });
});

// ─── computeHealthScore tests ──────────────────────────────────────────────────

describe('computeHealthScore', () => {
  it('returns Healthy for recent activity and low debt', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHealthScore({
      state: { last_activity: `${today} -- did some work`, status: 'executing' },
      debt: { open: 2 },
      milestones: [{ active: true, state: { status: 'executing' } }],
    });
    assert.equal(result.label, 'Healthy');
    assert.equal(result.level, 'success');
  });

  it('returns Needs Attention for debt between 6 and 10', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHealthScore({
      state: { last_activity: `${today} -- recent work`, status: 'executing' },
      debt: { open: 8 },
      milestones: [],
    });
    assert.equal(result.label, 'Needs Attention');
    assert.equal(result.level, 'warning');
  });

  it('returns At Risk for debt > 10', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHealthScore({
      state: { last_activity: `${today} -- recent work`, status: 'executing' },
      debt: { open: 15 },
      milestones: [],
    });
    assert.equal(result.label, 'At Risk');
    assert.equal(result.level, 'error');
  });

  it('returns New/Unknown for null state and empty milestones', () => {
    const result = computeHealthScore({
      state: null,
      milestones: [],
    });
    assert.equal(result.label, 'New/Unknown');
    assert.equal(result.level, 'neutral');
  });

  it('worst-factor-wins: debt > 10 returns At Risk even with recent activity', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = computeHealthScore({
      state: { last_activity: `${today} -- recent`, status: 'executing' },
      debt: { open: 12 },
      milestones: [],
    });
    assert.equal(result.label, 'At Risk');
    assert.equal(result.level, 'error');
  });

  it('does not throw when called with empty object', () => {
    let result;
    assert.doesNotThrow(() => {
      result = computeHealthScore({});
    });
    assert.ok(result);
    assert.ok(result.label);
  });

  it('returns At Risk for very stale activity (> 30 days)', () => {
    const staleDate = '2020-01-01';
    const result = computeHealthScore({
      state: { last_activity: `${staleDate} -- old work`, status: 'planning' },
      debt: { open: 0 },
      milestones: [],
    });
    assert.equal(result.label, 'At Risk');
  });

  it('returns Needs Attention for stale in-progress project (> 7 days)', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = computeHealthScore({
      state: { last_activity: `${oldDate} -- some work`, status: 'executing' },
      debt: { open: 0 },
      milestones: [],
    });
    assert.equal(result.label, 'Needs Attention');
  });
});

// ─── pollTmux tests ────────────────────────────────────────────────────────────

describe('pollTmux', () => {
  it('returns an array (may be empty if tmux not running, but must not throw)', () => {
    let result;
    assert.doesNotThrow(() => {
      result = pollTmux();
    });
    assert.ok(Array.isArray(result));
  });
});
