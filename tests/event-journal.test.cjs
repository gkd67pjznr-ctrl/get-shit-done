'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createTempProject, cleanup } = require('./helpers.cjs');
const { emitEvent, readEvents } = require('../get-shit-done/bin/lib/event-journal.cjs');

// ─── Test 1: emitEvent creates workflow.jsonl with correct fields ─────────────

test('emitEvent creates workflow.jsonl with correct fields', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', { phase: 84, plan: '01', task: 'T1', session_id: 'sess-1' }, { foo: 'bar' }, tmp);

    const journalPath = path.join(tmp, '.planning', 'observations', 'workflow.jsonl');
    assert.ok(fs.existsSync(journalPath), 'workflow.jsonl should exist');

    const content = fs.readFileSync(journalPath, 'utf-8').trim();
    const event = JSON.parse(content);

    assert.strictEqual(event.type, 'gate_fired');
    assert.ok(typeof event.timestamp === 'string' && event.timestamp.length > 0, 'timestamp should be a non-empty string');
    assert.strictEqual(String(event.phase), '84');
    assert.strictEqual(String(event.plan), '01');
    assert.strictEqual(event.task, 'T1');
    assert.strictEqual(event.session_id, 'sess-1');
    assert.deepStrictEqual(event.data, { foo: 'bar' });
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 2: emitEvent appends multiple events ────────────────────────────────

test('emitEvent appends multiple events', () => {
  const tmp = createTempProject();
  try {
    emitEvent('phase_started', { phase: 1 }, null, tmp);
    emitEvent('gate_fired', { phase: 2 }, null, tmp);
    emitEvent('session_end', { phase: 3 }, null, tmp);

    const journalPath = path.join(tmp, '.planning', 'observations', 'workflow.jsonl');
    const lines = fs.readFileSync(journalPath, 'utf-8')
      .split('\n')
      .filter(l => l.trim() !== '');

    assert.strictEqual(lines.length, 3, 'should have 3 lines');
    lines.forEach(line => {
      const parsed = JSON.parse(line);
      assert.ok(parsed && typeof parsed.type === 'string', 'each line should be valid JSON with a type field');
    });
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 3: readEvents returns all events when no filter ─────────────────────

test('readEvents returns all events when no filter', () => {
  const tmp = createTempProject();
  try {
    emitEvent('event_a', {}, null, tmp);
    emitEvent('event_b', {}, null, tmp);

    const events = readEvents({}, tmp);
    assert.strictEqual(events.length, 2, 'should return 2 events with empty filter');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 4: readEvents filters by phase ─────────────────────────────────────

test('readEvents filters by phase', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', { phase: 84 }, null, tmp);
    emitEvent('gate_fired', { phase: 85 }, null, tmp);
    emitEvent('gate_fired', { phase: 84 }, null, tmp);

    const events = readEvents({ phase: 84 }, tmp);
    assert.strictEqual(events.length, 2, 'should return only phase-84 events');
    events.forEach(e => assert.strictEqual(String(e.phase), '84'));
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 5: readEvents filters by type ──────────────────────────────────────

test('readEvents filters by type', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', {}, null, tmp);
    emitEvent('session_start', {}, null, tmp);
    emitEvent('gate_fired', {}, null, tmp);

    const events = readEvents({ type: 'gate_fired' }, tmp);
    assert.strictEqual(events.length, 2, 'should return 2 gate_fired events');
    events.forEach(e => assert.strictEqual(e.type, 'gate_fired'));
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 6: readEvents filters by from/to timestamps ────────────────────────

test('readEvents filters by from/to timestamps', () => {
  const tmp = createTempProject();
  try {
    // Manually write two events with known timestamps
    const obsDir = path.join(tmp, '.planning', 'observations');
    fs.mkdirSync(obsDir, { recursive: true });
    const journalPath = path.join(obsDir, 'workflow.jsonl');

    const event1 = { type: 'early', timestamp: '2026-01-01T00:00:00.000Z', phase: null, plan: null, task: null, session_id: 'unknown', data: null };
    const event2 = { type: 'late', timestamp: '2026-06-01T00:00:00.000Z', phase: null, plan: null, task: null, session_id: 'unknown', data: null };
    fs.writeFileSync(journalPath, JSON.stringify(event1) + '\n' + JSON.stringify(event2) + '\n', 'utf-8');

    const events = readEvents({ from: '2026-03-01T00:00:00.000Z' }, tmp);
    assert.strictEqual(events.length, 1, 'should exclude event before from timestamp');
    assert.strictEqual(events[0].type, 'late');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 7: rotation triggers at threshold ───────────────────────────────────

test('rotation triggers at threshold', () => {
  const tmp = createTempProject();
  try {
    // Write config with threshold of 3
    fs.writeFileSync(
      path.join(tmp, '.planning', 'config.json'),
      JSON.stringify({ journal: { max_entries: 3 } }),
      'utf-8'
    );

    emitEvent('event_1', {}, null, tmp);
    emitEvent('event_2', {}, null, tmp);
    emitEvent('event_3', {}, null, tmp);
    // 4th emit should trigger rotation (count >= 3 before write)
    emitEvent('event_4', {}, null, tmp);

    const journalPath = path.join(tmp, '.planning', 'observations', 'workflow.jsonl');
    const lines = fs.readFileSync(journalPath, 'utf-8')
      .split('\n')
      .filter(l => l.trim() !== '');
    assert.strictEqual(lines.length, 1, 'workflow.jsonl should have only the 4th event after rotation');
    assert.strictEqual(JSON.parse(lines[0]).type, 'event_4');

    // Check that an archive file exists
    const obsDir = path.join(tmp, '.planning', 'observations');
    const files = fs.readdirSync(obsDir);
    const archiveFiles = files.filter(f => f.startsWith('workflow-') && f !== 'workflow.jsonl');
    assert.ok(archiveFiles.length >= 1, 'an archive file should exist after rotation');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 8: emitEvent is silent on bad cwd ───────────────────────────────────

test('emitEvent is silent on bad cwd', () => {
  assert.doesNotThrow(() => {
    emitEvent('gate_fired', {}, null, '/this/path/does/not/exist/anywhere');
  }, 'emitEvent should not throw on non-existent cwd');
});

// ─── Test 9: readEvents returns [] for missing file ───────────────────────────

test('readEvents returns empty array for missing workflow.jsonl', () => {
  const tmp = createTempProject();
  try {
    const events = readEvents({}, tmp);
    assert.ok(Array.isArray(events), 'should return an array');
    assert.strictEqual(events.length, 0, 'should be empty when no journal exists');
  } finally {
    cleanup(tmp);
  }
});
