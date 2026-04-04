'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const path = require('path');

const {
  classifyTask,
  getMcpServers,
} = require('../get-shit-done/bin/lib/mcp-classifier.cjs');

const TOOLS_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

// ─── Unit Tests ───────────────────────────────────────────────────────────────

test('classifyTask — database keywords', () => {
  assert.strictEqual(classifyTask('add postgres migration', []), 'database');
  assert.strictEqual(classifyTask('sqlite table schema', []), 'database');
});

test('classifyTask — library-integration keywords', () => {
  assert.strictEqual(classifyTask('npm install lodash', []), 'library-integration');
  assert.strictEqual(classifyTask('yarn add react-query', []), 'library-integration');
});

test('classifyTask — api-integration keywords', () => {
  assert.strictEqual(classifyTask('create REST endpoint for users', []), 'api-integration');
  assert.strictEqual(classifyTask('add axios http client', []), 'api-integration');
});

test('classifyTask — ui-component via file extension', () => {
  assert.strictEqual(classifyTask('update styles', ['.tsx']), 'ui-component');
  assert.strictEqual(classifyTask('fix layout', ['.jsx']), 'ui-component');
});

test('classifyTask — ui-component via description keyword', () => {
  assert.strictEqual(classifyTask('create react component for header', []), 'ui-component');
});

test('classifyTask — file-restructuring keywords', () => {
  assert.strictEqual(classifyTask('reorganize directory structure', []), 'file-restructuring');
  assert.strictEqual(classifyTask('rename all component files', []), 'file-restructuring');
});

test('classifyTask — unknown for unrecognized input', () => {
  assert.strictEqual(classifyTask('do something vague', []), 'unknown');
  assert.strictEqual(classifyTask('', []), 'unknown');
});

test('classifyTask — database keyword takes priority over .tsx extension', () => {
  assert.strictEqual(classifyTask('postgres migration in react app', ['.tsx']), 'database');
});

test('getMcpServers — known type returns non-empty array of strings', () => {
  const result = getMcpServers('database');
  assert.ok(Array.isArray(result), 'result should be an array');
  assert.ok(result.length > 0, 'array should be non-empty');
  for (const entry of result) {
    assert.strictEqual(typeof entry, 'string', 'each element should be a string');
  }
});

test('getMcpServers — unknown type returns empty array without throwing', () => {
  assert.deepStrictEqual(getMcpServers('unknown'), []);
  assert.deepStrictEqual(getMcpServers('nonexistent'), []);
});

test('CLI round-trip: mcp-classify --task "add postgres table" --raw', () => {
  const stdout = execSync(
    `node ${TOOLS_PATH} mcp-classify --task "add postgres table" --raw`,
    { cwd: process.cwd(), encoding: 'utf-8' }
  );
  const result = JSON.parse(stdout.trim());
  assert.strictEqual(result.task_type, 'database', 'task_type should be database');
  assert.ok(Array.isArray(result.servers), 'servers should be an array');
  assert.ok(result.servers.length > 0, 'servers should be non-empty');
});
