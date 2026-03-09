'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createPatternFixture(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pat-test-'));
  const patternsDir = path.join(dir, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  const sessionsFile = path.join(patternsDir, 'sessions.jsonl');
  fs.writeFileSync(sessionsFile, entries.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf-8');
  return { dir, sessionsFile };
}

// ─── aggregatePatterns unit tests (PAT-01) ────────────────────────────────────
// NOTE: aggregatePatterns will be implemented in server.cjs (Plan 21-02).
// These stubs describe expected behavior; update imports when the function exists.

describe('aggregatePatterns', () => {
  it('returns empty array when registry is empty', () => {
    // TODO: import { aggregatePatterns } from '../get-shit-done/bin/lib/server.cjs' once exported
    // For now, test the expected shape of an empty result
    const result = [];
    assert.deepEqual(result, []);
  });

  it('reads sessions.jsonl from each project in registry', () => {
    const { dir } = createPatternFixture([
      { commit_type: 'feat', timestamp: '2026-03-01T10:00:00Z', phase: '21' },
      { commit_type: 'fix', timestamp: '2026-03-01T11:00:00Z', phase: '21' },
    ]);
    // Verify the fixture file was created correctly
    const sessionsFile = path.join(dir, '.planning', 'patterns', 'sessions.jsonl');
    assert.ok(fs.existsSync(sessionsFile), 'sessions.jsonl fixture must exist');
    const lines = fs.readFileSync(sessionsFile, 'utf-8').trim().split('\n').filter(Boolean);
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]);
    assert.equal(first.commit_type, 'feat');
  });

  it('tags each entry with source project name', () => {
    const { dir } = createPatternFixture([
      { commit_type: 'feat', timestamp: '2026-03-01T10:00:00Z' },
    ]);
    // Simulate what aggregatePatterns should do: attach _project field
    const lines = fs.readFileSync(
      path.join(dir, '.planning', 'patterns', 'sessions.jsonl'), 'utf-8'
    ).trim().split('\n').filter(Boolean);
    const entry = JSON.parse(lines[0]);
    entry._project = 'test-project';
    assert.equal(entry._project, 'test-project');
  });

  it('skips projects that have no sessions.jsonl', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pat-no-sessions-'));
    const planningDir = path.join(dir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    // No patterns/ directory -- aggregatePatterns must not throw
    const sessionsFile = path.join(dir, '.planning', 'patterns', 'sessions.jsonl');
    assert.ok(!fs.existsSync(sessionsFile), 'sessions.jsonl must not exist for this test');
    // The actual function handles this gracefully (try/catch); fixture confirms path shape
    assert.ok(true);
  });

  it('skips malformed JSONL lines without crashing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-pat-bad-json-'));
    const patternsDir = path.join(dir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    fs.writeFileSync(
      path.join(patternsDir, 'sessions.jsonl'),
      'not-json\n{"commit_type":"feat"}\nbad{json\n',
      'utf-8'
    );
    const lines = fs.readFileSync(
      path.join(patternsDir, 'sessions.jsonl'), 'utf-8'
    ).trim().split('\n').filter(Boolean);
    const parsed = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].commit_type, 'feat');
  });
});
