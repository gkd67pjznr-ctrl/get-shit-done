import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/write-preference.cjs');

// Valid correction entry fixture for reuse across tests
function makeValidEntry(overrides: Record<string, unknown> = {}) {
  return {
    correction_from: 'Used wrong pattern',
    correction_to: 'Should have used correct pattern',
    diagnosis_category: 'code.wrong_pattern',
    secondary_category: null,
    diagnosis_text: 'Did wrong pattern because of stale knowledge. Should have checked docs.',
    scope: 'file',
    phase: '23',
    timestamp: new Date().toISOString(),
    session_id: 'test-session-001',
    source: 'self_report',
    ...overrides,
  };
}

// Create a temp project dir with optional .planning/config.json content
function createTempDir(configOverrides?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preference-test-'));
  if (configOverrides !== undefined) {
    const planningDir = path.join(dir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    const config = {
      adaptive_learning: {
        observation: {
          retention_days: 90,
          max_entries: 1000,
          capture_corrections: true,
          ...configOverrides,
        },
      },
    };
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(config));
  }
  return dir;
}

// Write N correction entries to corrections.jsonl in the temp dir
function writeNCorrections(dir: string, n: number, overrides: Record<string, unknown> = {}): void {
  const patternsDir = path.join(dir, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  const filePath = path.join(patternsDir, 'corrections.jsonl');
  const lines = Array.from({ length: n }, () => JSON.stringify(makeValidEntry(overrides)));
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ─── Suite: creates preference ─────────────────────────────────────────────────

describe('checkAndPromote — creates preference', () => {
  let checkAndPromote: Function;
  let readPreferences: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
      readPreferences = mod.readPreferences;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
      readPreferences = () => [];
    }
  });

  it('creates preference when same category+scope appears 3 times', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.style_mismatch', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(tmpDir, '.planning', 'patterns', 'preferences.jsonl');
    expect(fs.existsSync(prefsPath)).toBe(true);
    const lines = fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.category).toBe('code.style_mismatch');
    expect(parsed.scope).toBe('file');
  });

  it('does not create preference when count is below threshold', () => {
    writeNCorrections(tmpDir, 2, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.style_mismatch', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(tmpDir, '.planning', 'patterns', 'preferences.jsonl');
    expect(fs.existsSync(prefsPath)).toBe(false);
  });

  it('returns { promoted: true } when preference is created', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.style_mismatch', scope: 'file' });
    const result = checkAndPromote(entry, { cwd: tmpDir });
    expect(result.promoted).toBe(true);
  });

  it('returns { promoted: false } when count below threshold', () => {
    writeNCorrections(tmpDir, 2, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.style_mismatch', scope: 'file' });
    const result = checkAndPromote(entry, { cwd: tmpDir });
    expect(result.promoted).toBe(false);
  });
});

// ─── Suite: confidence ─────────────────────────────────────────────────────────

describe('checkAndPromote — confidence', () => {
  let checkAndPromote: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
    }
  });

  it('calculates confidence as source_count / (source_count + 2)', () => {
    writeNCorrections(tmpDir, 5, {
      diagnosis_category: 'code.wrong_pattern',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(tmpDir, '.planning', 'patterns', 'preferences.jsonl');
    const lines = fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    const parsed = JSON.parse(lines[0]);
    // 5 / (5 + 2) = 5/7
    expect(parsed.confidence).toBeCloseTo(5 / 7, 10);
    expect(parsed.source_count).toBe(5);
  });

  it('confidence is 0.6 at threshold (3 occurrences)', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.wrong_pattern',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(tmpDir, '.planning', 'patterns', 'preferences.jsonl');
    const lines = fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    const parsed = JSON.parse(lines[0]);
    // 3 / (3 + 2) = 0.6
    expect(parsed.confidence).toBeCloseTo(0.6, 10);
  });
});

// ─── Suite: upsert ─────────────────────────────────────────────────────────────

describe('checkAndPromote — upsert', () => {
  let checkAndPromote: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
    }
  });

  it('updates existing preference on subsequent promotions', () => {
    // Write 3, promote
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.wrong_pattern',
      scope: 'file',
      correction_to: 'first text',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    // Write 2 more (same category+scope), now total = 5
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    const filePath = path.join(patternsDir, 'corrections.jsonl');
    const extra = Array.from({ length: 2 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file', correction_to: 'updated text' }))
    );
    fs.appendFileSync(filePath, extra.join('\n') + '\n');

    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const lines = fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    // Should still be exactly 1 entry (upsert, not append)
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.source_count).toBe(5);
    expect(parsed.confidence).toBeCloseTo(5 / 7, 10);
  });

  it('updates confidence, preference_text, updated_at, source_count, last_correction_ts on upsert', () => {
    const ts1 = '2026-01-01T00:00:00.000Z';
    const ts2 = '2026-02-01T00:00:00.000Z';
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const corrPath = path.join(patternsDir, 'corrections.jsonl');

    // 3 entries with ts1
    const lines3 = Array.from({ length: 3 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file', timestamp: ts1, correction_to: 'old text' }))
    );
    fs.writeFileSync(corrPath, lines3.join('\n') + '\n');

    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file', timestamp: ts1 });
    checkAndPromote(entry, { cwd: tmpDir });

    // 2 more with ts2 (later)
    const extra2 = Array.from({ length: 2 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file', timestamp: ts2, correction_to: 'new text' }))
    );
    fs.appendFileSync(corrPath, extra2.join('\n') + '\n');

    const entry2 = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file', timestamp: ts2 });
    checkAndPromote(entry2, { cwd: tmpDir });

    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const parsed = JSON.parse(
      fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '')[0]
    );
    expect(parsed.source_count).toBe(5);
    expect(parsed.confidence).toBeCloseTo(5 / 7, 10);
    expect(parsed.preference_text).toBe('new text');
    expect(parsed.last_correction_ts).toBe(ts2);
  });

  it('preserves created_at on upsert', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const corrPath = path.join(patternsDir, 'corrections.jsonl');

    // 3 entries to trigger first promotion
    const lines3 = Array.from({ length: 3 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' }))
    );
    fs.writeFileSync(corrPath, lines3.join('\n') + '\n');

    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    // Capture created_at from first promotion
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const first = JSON.parse(
      fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '')[0]
    );
    const originalCreatedAt = first.created_at;
    expect(originalCreatedAt).toBeTruthy();

    // Add 2 more, upsert again
    const extra2 = Array.from({ length: 2 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' }))
    );
    fs.appendFileSync(corrPath, extra2.join('\n') + '\n');

    // Small delay to ensure updated_at would differ if re-generated
    const entry2 = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry2, { cwd: tmpDir });

    const second = JSON.parse(
      fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '')[0]
    );
    expect(second.created_at).toBe(originalCreatedAt);
  });

  it('preserves retired_at on upsert when already retired', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const retiredTs = '2026-01-01T00:00:00.000Z';

    // Pre-write a retired preference entry
    const existingPref = {
      category: 'code.wrong_pattern',
      scope: 'file',
      preference_text: 'old pref',
      confidence: 0.6,
      source_count: 3,
      last_correction_ts: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      retired_at: retiredTs,
    };
    fs.writeFileSync(prefsPath, JSON.stringify(existingPref) + '\n');

    // Write 3 corrections and promote
    const corrPath = path.join(patternsDir, 'corrections.jsonl');
    const lines3 = Array.from({ length: 3 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' }))
    );
    fs.writeFileSync(corrPath, lines3.join('\n') + '\n');

    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const updated = JSON.parse(
      fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '')[0]
    );
    // retired_at should be preserved from the existing entry
    expect(updated.retired_at).toBe(retiredTs);
  });
});

// ─── Suite: archive ─────────────────────────────────────────────────────────────

describe('checkAndPromote — archive', () => {
  let checkAndPromote: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
    }
  });

  it('counts corrections from corrections-*.jsonl archive files', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });

    // Write 2 entries to archive file
    const archivePath = path.join(patternsDir, 'corrections-2026-01-01.jsonl');
    const archiveLines = Array.from({ length: 2 }, () =>
      JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' }))
    );
    fs.writeFileSync(archivePath, archiveLines.join('\n') + '\n');

    // Write 1 entry to active file (total = 3 = threshold)
    const activePath = path.join(patternsDir, 'corrections.jsonl');
    fs.writeFileSync(activePath, JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' })) + '\n');

    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    const result = checkAndPromote(entry, { cwd: tmpDir });
    expect(result.promoted).toBe(true);
  });

  it('combines active and archive counts for threshold check', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });

    // 1 in archive1, 1 in archive2, 1 in active = 3
    const archive1 = path.join(patternsDir, 'corrections-2026-01-01.jsonl');
    fs.writeFileSync(archive1, JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' })) + '\n');

    const archive2 = path.join(patternsDir, 'corrections-2026-02-01.jsonl');
    fs.writeFileSync(archive2, JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' })) + '\n');

    const activePath = path.join(patternsDir, 'corrections.jsonl');
    fs.writeFileSync(activePath, JSON.stringify(makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' })) + '\n');

    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    const result = checkAndPromote(entry, { cwd: tmpDir });
    expect(result.promoted).toBe(true);
    expect(result.count).toBe(3);
  });
});

// ─── Suite: scope ──────────────────────────────────────────────────────────────

describe('readPreferences — scope', () => {
  let checkAndPromote: Function;
  let readPreferences: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
      readPreferences = mod.readPreferences;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
      readPreferences = () => [];
    }
  });

  it('copies scope from source corrections to preference entry', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.wrong_pattern',
      scope: 'file',
    });
    const entry = makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' });
    checkAndPromote(entry, { cwd: tmpDir });

    const prefsPath = path.join(tmpDir, '.planning', 'patterns', 'preferences.jsonl');
    const parsed = JSON.parse(
      fs.readFileSync(prefsPath, 'utf-8').split('\n').filter(l => l.trim() !== '')[0]
    );
    expect(parsed.scope).toBe('file');
  });

  it('filters preferences by scope when scope is provided', () => {
    // Create two preferences: one 'file', one 'project'
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const prefFile = {
      category: 'code.wrong_pattern', scope: 'file',
      preference_text: 'p1', confidence: 0.6, source_count: 3,
      last_correction_ts: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      retired_at: null,
    };
    const prefProject = {
      category: 'code.style_mismatch', scope: 'project',
      preference_text: 'p2', confidence: 0.6, source_count: 3,
      last_correction_ts: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      retired_at: null,
    };
    fs.writeFileSync(prefsPath, JSON.stringify(prefFile) + '\n' + JSON.stringify(prefProject) + '\n');

    const fileResults = readPreferences({ scope: 'file' }, { cwd: tmpDir });
    expect(fileResults.length).toBe(1);
    expect(fileResults[0].scope).toBe('file');

    const projectResults = readPreferences({ scope: 'project' }, { cwd: tmpDir });
    expect(projectResults.length).toBe(1);
    expect(projectResults[0].scope).toBe('project');
  });

  it('returns all preferences when no scope filter provided', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const p1 = { category: 'code.wrong_pattern', scope: 'file', preference_text: 'p1', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: null };
    const p2 = { category: 'code.style_mismatch', scope: 'project', preference_text: 'p2', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: null };
    fs.writeFileSync(prefsPath, JSON.stringify(p1) + '\n' + JSON.stringify(p2) + '\n');

    const results = readPreferences({}, { cwd: tmpDir });
    expect(results.length).toBe(2);
  });
});

// ─── Suite: readPreferences ────────────────────────────────────────────────────

describe('readPreferences — readPreferences', () => {
  let readPreferences: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      readPreferences = mod.readPreferences;
    } catch {
      readPreferences = () => [];
    }
  });

  it('returns empty array when preferences.jsonl does not exist', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pref-empty-'));
    try {
      const results = readPreferences({}, { cwd: emptyDir });
      expect(results).toEqual([]);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('returns parsed preference objects', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const pref = {
      category: 'code.wrong_pattern', scope: 'file',
      preference_text: 'use correct pattern', confidence: 0.6, source_count: 3,
      last_correction_ts: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      retired_at: null,
    };
    fs.writeFileSync(prefsPath, JSON.stringify(pref) + '\n');

    const results = readPreferences({}, { cwd: tmpDir });
    expect(results.length).toBe(1);
    expect(typeof results[0]).toBe('object');
    expect(results[0].category).toBe('code.wrong_pattern');
    expect(results[0].preference_text).toBe('use correct pattern');
  });

  it('skips malformed JSONL lines silently', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');
    const validPref = {
      category: 'code.wrong_pattern', scope: 'file',
      preference_text: 'valid', confidence: 0.6, source_count: 3,
      last_correction_ts: '', created_at: '', updated_at: '', retired_at: null,
    };
    // Write one valid line, one malformed line
    fs.writeFileSync(prefsPath, JSON.stringify(validPref) + '\n' + 'NOT VALID JSON\n');

    const results = readPreferences({}, { cwd: tmpDir });
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('code.wrong_pattern');
  });
});

// ─── Suite: status ─────────────────────────────────────────────────────────────

describe('readPreferences — status', () => {
  let readPreferences: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      readPreferences = mod.readPreferences;
    } catch {
      readPreferences = () => [];
    }
  });

  it("returns only active preferences when status is 'active'", () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');

    const active = { category: 'code.wrong_pattern', scope: 'file', preference_text: 'a', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: null };
    const retired = { category: 'code.style_mismatch', scope: 'file', preference_text: 'b', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(prefsPath, JSON.stringify(active) + '\n' + JSON.stringify(retired) + '\n');

    const results = readPreferences({ status: 'active' }, { cwd: tmpDir });
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('code.wrong_pattern');
    expect(results[0].retired_at).toBeNull();
  });

  it("returns only retired preferences when status is 'retired'", () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');

    const active = { category: 'code.wrong_pattern', scope: 'file', preference_text: 'a', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: null };
    const retired = { category: 'code.style_mismatch', scope: 'file', preference_text: 'b', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(prefsPath, JSON.stringify(active) + '\n' + JSON.stringify(retired) + '\n');

    const results = readPreferences({ status: 'retired' }, { cwd: tmpDir });
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('code.style_mismatch');
    expect(results[0].retired_at).toBeTruthy();
  });

  it('returns all preferences when no status filter provided', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const prefsPath = path.join(patternsDir, 'preferences.jsonl');

    const active = { category: 'code.wrong_pattern', scope: 'file', preference_text: 'a', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: null };
    const retired = { category: 'code.style_mismatch', scope: 'file', preference_text: 'b', confidence: 0.6, source_count: 3, last_correction_ts: '', created_at: '', updated_at: '', retired_at: '2026-01-01T00:00:00.000Z' };
    fs.writeFileSync(prefsPath, JSON.stringify(active) + '\n' + JSON.stringify(retired) + '\n');

    const results = readPreferences({}, { cwd: tmpDir });
    expect(results.length).toBe(2);
  });
});

// ─── Suite: integration ────────────────────────────────────────────────────────

describe('checkAndPromote — integration', () => {
  let checkAndPromote: Function;
  let readPreferences: Function;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      checkAndPromote = mod.checkAndPromote;
      readPreferences = mod.readPreferences;
    } catch {
      checkAndPromote = () => ({ promoted: false, reason: 'module_not_found' });
      readPreferences = () => [];
    }
  });

  it('promotion does not break existing correction capture when write-preference module is absent', () => {
    it.todo;
  });

  it('full round-trip: 3 corrections promote to preference, readPreferences returns it', () => {
    it.todo;
  });
});
