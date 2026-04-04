'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const { createTempProject, cleanup, TOOLS_PATH } = require('./helpers.cjs');
const { emitEvent, readEvents } = require('../get-shit-done/bin/lib/event-journal.cjs');

// ─── Test 1: gate_fired event appears after gate execution ───────────────────

test('gate_fired event appears after gate execution', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', { phase: 84, plan: '01', session_id: 'test-session' }, { gate: 'test_gate', outcome: 'passed' }, tmp);

    const results = readEvents({ type: 'gate_fired' }, tmp);
    assert.strictEqual(results.length, 1, 'should have 1 gate_fired event');
    assert.strictEqual(results[0].type, 'gate_fired');
    assert.strictEqual(results[0].data.gate, 'test_gate');
    assert.strictEqual(results[0].data.outcome, 'passed');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 2: correction_captured event appears ───────────────────────────────

test('correction_captured event appears', () => {
  const tmp = createTempProject();
  try {
    emitEvent('correction_captured', { phase: 84, plan: '02', session_id: 'test-session-2' }, { source: 'edit_detection' }, tmp);

    const results = readEvents({ type: 'correction_captured' }, tmp);
    assert.strictEqual(results.length, 1, 'should have 1 correction_captured event');
    assert.strictEqual(results[0].type, 'correction_captured');
    assert.strictEqual(results[0].data.source, 'edit_detection');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 3: session_start and session_end events ────────────────────────────

test('session_start and session_end events both appear in unfiltered query', () => {
  const tmp = createTempProject();
  try {
    emitEvent('session_start', { session_id: 'sess-start-end' }, null, tmp);
    emitEvent('session_end', { session_id: 'sess-start-end' }, null, tmp);

    const results = readEvents({}, tmp);
    const types = results.map(e => e.type);
    assert.ok(types.includes('session_start'), 'should contain session_start event');
    assert.ok(types.includes('session_end'), 'should contain session_end event');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 4: readEvents filters phase+plan combination ───────────────────────

test('readEvents filters phase+plan combination correctly', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', { phase: 84, plan: '01', session_id: 'filter-test' }, null, tmp);
    emitEvent('gate_fired', { phase: 84, plan: '02', session_id: 'filter-test' }, null, tmp);
    emitEvent('gate_fired', { phase: 85, plan: '01', session_id: 'filter-test' }, null, tmp);

    const results = readEvents({ phase: 84, plan: '01' }, tmp);
    assert.strictEqual(results.length, 1, 'should return only 1 event matching phase=84 plan=01');
    assert.strictEqual(String(results[0].phase), '84');
    assert.strictEqual(String(results[0].plan), '01');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 5: journal-query CLI with phase+plan filter ────────────────────────

test('journal-query CLI with phase+plan filter returns correct events', () => {
  const tmp = createTempProject();
  try {
    emitEvent('gate_fired', { phase: 84, plan: '01', session_id: 'cli-test' }, { gate: 'lint' }, tmp);
    emitEvent('session_start', { phase: 84, plan: '02', session_id: 'cli-test' }, null, tmp);

    const result = spawnSync('node', [TOOLS_PATH, 'journal-query', '--phase', '84', '--plan', '01', '--raw', '--cwd', tmp], {
      encoding: 'utf-8',
    });

    assert.strictEqual(result.status, 0, `journal-query should exit 0; stderr: ${result.stderr}`);

    const parsed = JSON.parse(result.stdout.trim());
    assert.strictEqual(parsed.total, 1, 'should return 1 event matching phase=84 plan=01');
    assert.strictEqual(String(parsed.events[0].plan), '01', 'event plan should be 01');
    assert.strictEqual(String(parsed.events[0].phase), '84', 'event phase should be 84');
  } finally {
    cleanup(tmp);
  }
});

// ─── Test 6: empty journal returns zero events ───────────────────────────────

test('empty journal returns zero events without error', () => {
  const tmp = createTempProject();
  try {
    const results = readEvents({}, tmp);
    assert.ok(Array.isArray(results), 'readEvents should return an array');
    assert.strictEqual(results.length, 0, 'should return 0 events when no workflow.jsonl exists');
  } finally {
    cleanup(tmp);
  }
});
