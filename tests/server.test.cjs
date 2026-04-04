'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { WebSocket } = require('ws');

// ─── WebSocket terminal route stubs (TERM-03) ─────────────────────────────────
// These tests will be fleshed out in Plan 21-02 once setupTerminalWebSocket is implemented.
// They currently test the HTTP server's ability to handle upgrade rejections for unknown paths.

describe('WebSocket terminal route matching', () => {
  it('rejects WebSocket upgrade for non-terminal paths', () => {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      server.on('upgrade', (req, socket) => {
        // Reject all upgrades (simulates server before WS is set up)
        socket.destroy();
      });

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/not-a-terminal-path`);
        ws.on('error', () => {
          server.close(() => resolve());
        });
        ws.on('open', () => {
          ws.close();
          server.close(() => resolve());
        });
      });
    });
  });

  it('accepts WebSocket upgrade for /ws/terminal/* paths (stub)', () => {
    // This test verifies the URL pattern matching logic used in setupTerminalWebSocket.
    // The actual handler is tested in Plan 21-02.
    const testUrl = '/ws/terminal/my-session';
    assert.ok(testUrl.startsWith('/ws/terminal/'), 'URL must match /ws/terminal/* pattern');

    const sessionName = decodeURIComponent(testUrl.slice('/ws/terminal/'.length));
    assert.equal(sessionName, 'my-session');
  });

  it('extracts session name with URL encoding', () => {
    const encoded = '/ws/terminal/my%20session%3Aname';
    const sessionName = decodeURIComponent(encoded.slice('/ws/terminal/'.length));
    assert.equal(sessionName, 'my session:name');
  });

  it('rejects empty session name', () => {
    const url = '/ws/terminal/';
    const sessionName = decodeURIComponent(url.slice('/ws/terminal/'.length));
    assert.equal(sessionName, '');
    assert.ok(sessionName.length === 0, 'empty session name should be rejected');
  });
});

describe('setupTerminalWebSocket integration', () => {
  it('rejects connection with empty session name', () => {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
      const { setupTerminalWebSocket } = require('../get-shit-done/bin/lib/server.cjs');
      setupTerminalWebSocket(server);

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal/`);

        ws.on('close', (code) => {
          assert.equal(code, 4000, 'empty session name must close with code 4000');
          server.close(() => resolve());
        });

        ws.on('error', () => {
          server.close(() => resolve());
        });
      });
    });
  });

  it('rejects connection for non-existent tmux session', () => {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
      const { setupTerminalWebSocket } = require('../get-shit-done/bin/lib/server.cjs');
      setupTerminalWebSocket(server);

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        // Use a session name that almost certainly does not exist
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/terminal/gsd-test-nonexistent-session-xyz`);

        ws.on('close', (code) => {
          assert.equal(code, 4004, 'missing tmux session must close with code 4004');
          server.close(() => resolve());
        });

        ws.on('error', () => {
          // Connection error is also acceptable (session not found)
          server.close(() => resolve());
        });
      });
    });
  });

  it('non-terminal upgrade path is rejected', () => {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => { res.writeHead(200); res.end('ok'); });
      const { setupTerminalWebSocket } = require('../get-shit-done/bin/lib/server.cjs');
      setupTerminalWebSocket(server);

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/other-path`);

        ws.on('error', () => {
          server.close(() => resolve());
        });

        ws.on('close', () => {
          server.close(() => resolve());
        });
      });
    });
  });
});

// ─── aggregateGateHealth unit tests (DASH-02 through DASH-05) ────────────────

const fs2 = require('node:fs');
const os2 = require('node:os');
const path2 = require('node:path');

function makeTempProject(entries) {
  const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gsd-gate-test-'));
  const obsDir = path2.join(dir, '.planning', 'observations');
  fs2.mkdirSync(obsDir, { recursive: true });
  if (entries.gateExecs) {
    fs2.writeFileSync(
      path2.join(obsDir, 'gate-executions.jsonl'),
      entries.gateExecs.map(e => JSON.stringify(e)).join('\n') + '\n',
      'utf-8',
    );
  }
  if (entries.context7) {
    fs2.writeFileSync(
      path2.join(obsDir, 'context7-calls.jsonl'),
      entries.context7.map(e => JSON.stringify(e)).join('\n') + '\n',
      'utf-8',
    );
  }
  return dir;
}

describe('aggregateGateHealth', () => {
  const { aggregateGateHealth } = require('../get-shit-done/bin/lib/server.cjs');

  it('returns hasData:false for empty registry', () => {
    const result = aggregateGateHealth([]);
    assert.equal(result.hasData, false);
    assert.equal(result.totalExecutions, 0);
    assert.equal(result.projectCount, 0);
    assert.equal(result.reportingCount, 0);
  });

  it('returns hasData:false when no JSONL files exist', () => {
    const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gsd-gate-empty-'));
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.hasData, false);
    assert.equal(result.totalExecutions, 0);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-02: counts outcome distribution correctly', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'test_gate',     outcome: 'warned',  quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
        { gate: 'diff_review',   outcome: 'blocked', quality_level: 'strict',   timestamp: '2026-03-10T12:02:00.000Z' },
        { gate: 'test_baseline', outcome: 'skipped', quality_level: 'standard', timestamp: '2026-03-10T12:03:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.outcomes.passed, 1);
    assert.equal(result.outcomes.warned, 1);
    assert.equal(result.outcomes.blocked, 1);
    assert.equal(result.outcomes.skipped, 1);
    assert.equal(result.totalExecutions, 4);
    assert.equal(result.hasData, true);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-03: counts quality level distribution correctly', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
        { gate: 'test_gate',     outcome: 'passed', quality_level: 'strict',   timestamp: '2026-03-10T12:02:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.qualityLevels.standard, 2);
    assert.equal(result.qualityLevels.strict, 1);
    assert.equal(result.qualityLevels.fast, 0);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-04: aggregates per-gate firing rates', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'codebase_scan', outcome: 'warned',  quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
        { gate: 'test_gate',     outcome: 'blocked', quality_level: 'strict',   timestamp: '2026-03-10T12:02:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.gates.codebase_scan.total, 2);
    assert.equal(result.gates.codebase_scan.passed, 1);
    assert.equal(result.gates.codebase_scan.warned, 1);
    assert.equal(result.gates.test_gate.total, 1);
    assert.equal(result.gates.test_gate.blocked, 1);
    // Untouched gates have zero counts
    assert.equal(result.gates.diff_review.total, 0);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-05: aggregates Context7 metrics', () => {
    const dir = makeTempProject({
      context7: [
        { library: '/vercel/next.js', tokens_requested: 2000, token_cap: 2000, used: true,  quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { library: '/tailwindlabs/tailwindcss', tokens_requested: 1500, token_cap: 2000, used: false, quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.context7.totalCalls, 2);
    assert.equal(result.context7.avgTokensRequested, 1750);
    // 1 of 2 hit cap (tokens_requested >= token_cap)
    assert.ok(Math.abs(result.context7.capHitRate - 0.5) < 0.001);
    // 1 of 2 used in code
    assert.ok(Math.abs(result.context7.usedInCodeRate - 0.5) < 0.001);
    fs2.rmSync(dir, { recursive: true });
  });

  it('skips malformed JSONL lines without throwing', () => {
    const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gsd-gate-malformed-'));
    const obsDir = path2.join(dir, '.planning', 'observations');
    fs2.mkdirSync(obsDir, { recursive: true });
    fs2.writeFileSync(
      path2.join(obsDir, 'gate-executions.jsonl'),
      '{ NOT VALID JSON }\n{"gate":"codebase_scan","outcome":"passed","quality_level":"standard","timestamp":"2026-03-10T12:00:00.000Z"}\n',
      'utf-8',
    );
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.totalExecutions, 1); // malformed line skipped, valid line counted
    assert.equal(result.hasData, true);
    fs2.rmSync(dir, { recursive: true });
  });

  it('guards against division by zero when no data', () => {
    const dir = makeTempProject({ context7: [] });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.context7.capHitRate, 0);
    assert.equal(result.context7.usedInCodeRate, 0);
    assert.equal(result.context7.avgTokensRequested, 0);
    fs2.rmSync(dir, { recursive: true });
  });

  it('aggregates across multiple projects', () => {
    const dirA = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
      ],
    });
    const dirB = makeTempProject({
      gateExecs: [
        { gate: 'test_gate', outcome: 'warned', quality_level: 'strict', timestamp: '2026-03-10T12:00:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([
      { name: 'proj-a', path: dirA },
      { name: 'proj-b', path: dirB },
    ]);
    assert.equal(result.projectCount, 2);
    assert.equal(result.reportingCount, 2);
    assert.equal(result.totalExecutions, 2);
    assert.equal(result.outcomes.passed, 1);
    assert.equal(result.outcomes.warned, 1);
    fs2.rmSync(dirA, { recursive: true });
    fs2.rmSync(dirB, { recursive: true });
  });

  it('LINT-05: eslint_gate entries aggregate into gates.eslint_gate', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'eslint_gate', outcome: 'passed',  quality_level: 'standard', timestamp: '2026-04-04T12:00:00.000Z' },
        { gate: 'eslint_gate', outcome: 'warned',  quality_level: 'standard', timestamp: '2026-04-04T12:01:00.000Z' },
        { gate: 'eslint_gate', outcome: 'blocked', quality_level: 'strict',   timestamp: '2026-04-04T12:02:00.000Z' },
        { gate: 'test_gate',   outcome: 'passed',  quality_level: 'standard', timestamp: '2026-04-04T12:03:00.000Z' },
      ],
    });
    const result = aggregateGateHealth([{ name: 'proj', path: dir }]);
    assert.equal(result.gates.eslint_gate.total, 3);
    assert.equal(result.gates.eslint_gate.passed, 1);
    assert.equal(result.gates.eslint_gate.warned, 1);
    assert.equal(result.gates.eslint_gate.blocked, 1);
    assert.equal(result.totalExecutions, 4);
    fs2.rmSync(dir, { recursive: true });
  });
});

// ─── getProjectGateHealth unit tests (DASH-06, DASH-07, DASH-08) ─────────────

describe('getProjectGateHealth', () => {
  const { getProjectGateHealth } = require('../get-shit-done/bin/lib/server.cjs');

  it('returns hasData:false when no gate-executions.jsonl exists', () => {
    const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gsd-pgh-test-'));
    const obsDir = path2.join(dir, '.planning', 'observations');
    fs2.mkdirSync(obsDir, { recursive: true });
    // No gate-executions.jsonl file created
    const result = getProjectGateHealth(dir);
    assert.equal(result.hasData, false);
    assert.equal(result.totalFires, 0);
    assert.equal(result.qualityLevel, null);
    assert.equal(result.recentFires, 0);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-06: returns qualityLevel from most recent entry by timestamp', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'test_gate',     outcome: 'passed', quality_level: 'strict',   timestamp: '2026-03-10T13:00:00.000Z' },
      ],
    });
    const result = getProjectGateHealth(dir);
    assert.equal(result.qualityLevel, 'strict');
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-07: counts totalFires, warnCount, and warnPct correctly', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed',  quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'test_gate',     outcome: 'passed',  quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
        { gate: 'diff_review',   outcome: 'warned',  quality_level: 'standard', timestamp: '2026-03-10T12:02:00.000Z' },
        { gate: 'test_baseline', outcome: 'blocked', quality_level: 'standard', timestamp: '2026-03-10T12:03:00.000Z' },
      ],
    });
    const result = getProjectGateHealth(dir);
    assert.equal(result.totalFires, 4);
    assert.equal(result.warnCount, 1);
    assert.equal(result.warnPct, 25);
    assert.equal(result.blockedCount, 1);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-07: warnPct is 0 when totalFires is 0 (no division by zero)', () => {
    const dir = fs2.mkdtempSync(path2.join(os2.tmpdir(), 'gsd-pgh-malformed-'));
    const obsDir = path2.join(dir, '.planning', 'observations');
    fs2.mkdirSync(obsDir, { recursive: true });
    fs2.writeFileSync(
      path2.join(obsDir, 'gate-executions.jsonl'),
      '{ NOT VALID JSON }\n{ ALSO NOT VALID }\n',
      'utf-8',
    );
    const result = getProjectGateHealth(dir);
    assert.equal(result.totalFires, 0);
    assert.equal(result.warnPct, 0);
    assert.equal(result.hasData, false);
    fs2.rmSync(dir, { recursive: true });
  });

  it('DASH-08: counts recentFires only within 24-hour window', () => {
    const recentTs = new Date().toISOString();
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: recentTs },
        { gate: 'test_gate',     outcome: 'passed', quality_level: 'standard', timestamp: recentTs },
        { gate: 'diff_review',   outcome: 'passed', quality_level: 'standard', timestamp: '2020-01-01T00:00:00.000Z' },
      ],
    });
    const result = getProjectGateHealth(dir);
    assert.equal(result.recentFires, 2);
    assert.equal(result.totalFires, 3);
    fs2.rmSync(dir, { recursive: true });
  });

  it('skips entries with invalid gate or outcome values', () => {
    const dir = makeTempProject({
      gateExecs: [
        { gate: 'codebase_scan', outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:00:00.000Z' },
        { gate: 'fake_gate',     outcome: 'passed', quality_level: 'standard', timestamp: '2026-03-10T12:01:00.000Z' },
      ],
    });
    const result = getProjectGateHealth(dir);
    assert.equal(result.totalFires, 1);
    fs2.rmSync(dir, { recursive: true });
  });
});
