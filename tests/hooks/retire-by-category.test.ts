import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/retire.cjs');

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'retire-test-'));
  fs.mkdirSync(path.join(dir, '.planning', 'patterns'), { recursive: true });
  return dir;
}

// Writes corrections.jsonl with the given entries
function writeCorrections(dir: string, entries: object[]): void {
  const p = path.join(dir, '.planning', 'patterns', 'corrections.jsonl');
  fs.writeFileSync(p, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// Writes preferences.jsonl with the given entries
function writePreferences(dir: string, entries: object[]): void {
  const p = path.join(dir, '.planning', 'patterns', 'preferences.jsonl');
  fs.writeFileSync(p, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// Reads corrections.jsonl and parses each line
function readCorrections(dir: string): Record<string, unknown>[] {
  const p = path.join(dir, '.planning', 'patterns', 'corrections.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// Reads preferences.jsonl and parses each line
function readPreferences(dir: string): Record<string, unknown>[] {
  const p = path.join(dir, '.planning', 'patterns', 'preferences.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// Reads suggestions.json
function readSuggestions(dir: string): { metadata: Record<string, unknown>; suggestions: Record<string, unknown>[] } | null {
  const p = path.join(dir, '.planning', 'patterns', 'suggestions.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

// Writes suggestions.json
function writeSuggestions(dir: string, doc: object): void {
  const p = path.join(dir, '.planning', 'patterns', 'suggestions.json');
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
}

function makeCorrection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    diagnosis_category: 'code.style_mismatch',
    correction_from: 'old',
    correction_to: 'new',
    scope: 'file:src/foo.ts',
    timestamp: new Date().toISOString(),
    retired_at: null,
    ...overrides,
  };
}

function makePref(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    category: 'code.style_mismatch',
    scope: 'file:src/foo.ts',
    preference_text: 'use const',
    retired_at: null,
    ...overrides,
  };
}

function makeSuggestion(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'sug-test-001',
    status: 'accepted',
    target_skill: 'typescript-patterns',
    category: 'code.style_mismatch',
    accepted_at: new Date().toISOString(),
    dismissed_at: null,
    refined_at: null,
    ...overrides,
  };
}

let tmpDir: string;

beforeEach(() => { tmpDir = createTempDir(); });
afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ─── Suite: corrections ───────────────────────────────────────────────────────

describe('retireByCategory — corrections', () => {
  let retireByCategory: (category: string, suggestionId: string, options?: { cwd?: string }) => void;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      retireByCategory = mod.retireByCategory;
    } catch {
      retireByCategory = () => { /* module not found */ };
    }
  });

  it('sets retired_at and retired_by on active corrections matching the category', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null }),
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const corrections = readCorrections(tmpDir);
    expect(corrections.length).toBe(2);
    for (const c of corrections) {
      expect(c.retired_at).toBeTruthy();
      expect(c.retired_by).toBe('sug-test-001');
    }
  });

  it('does not modify corrections with a different category', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null }),
      makeCorrection({ diagnosis_category: 'process.planning_error', retired_at: null }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const corrections = readCorrections(tmpDir);
    const planning = corrections.find(c => c.diagnosis_category === 'process.planning_error');
    expect(planning).toBeDefined();
    expect(planning!.retired_at).toBeNull();
    expect(planning!.retired_by).toBeUndefined();
  });

  it('does not re-retire already retired corrections (retired_at already set)', () => {
    const originalTs = '2026-01-01T00:00:00.000Z';
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: originalTs, retired_by: 'sug-old-001' }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const corrections = readCorrections(tmpDir);
    expect(corrections[0].retired_at).toBe(originalTs);
    expect(corrections[0].retired_by).toBe('sug-old-001');
  });

  it('retires corrections in archive files (corrections-*.jsonl), not just active file', () => {
    // Write to both corrections.jsonl and an archive file
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null }),
    ]);
    const archivePath = path.join(tmpDir, '.planning', 'patterns', 'corrections-2026-01-01.jsonl');
    fs.writeFileSync(archivePath,
      JSON.stringify(makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null })) + '\n'
    );

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    // Check active file
    const corrections = readCorrections(tmpDir);
    expect(corrections[0].retired_at).toBeTruthy();

    // Check archive file
    const archiveLines = fs.readFileSync(archivePath, 'utf-8').split('\n').filter(l => l.trim());
    const archiveEntry = JSON.parse(archiveLines[0]);
    expect(archiveEntry.retired_at).toBeTruthy();
    expect(archiveEntry.retired_by).toBe('sug-test-001');
  });

  it('writes atomically — corrections.jsonl.tmp is removed after rename', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', retired_at: null }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const tmpFilePath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl.tmp');
    expect(fs.existsSync(tmpFilePath)).toBe(false);
  });
});

// ─── Suite: preferences ───────────────────────────────────────────────────────

describe('retireByCategory — preferences', () => {
  let retireByCategory: (category: string, suggestionId: string, options?: { cwd?: string }) => void;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      retireByCategory = mod.retireByCategory;
    } catch {
      retireByCategory = () => { /* module not found */ };
    }
  });

  it('sets retired_at and retired_by on active preferences matching the category', () => {
    writePreferences(tmpDir, [
      makePref({ category: 'code.style_mismatch', retired_at: null }),
      makePref({ category: 'code.style_mismatch', retired_at: null }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const prefs = readPreferences(tmpDir);
    expect(prefs.length).toBe(2);
    for (const p of prefs) {
      expect(p.retired_at).toBeTruthy();
      expect(p.retired_by).toBe('sug-test-001');
    }
  });

  it('does not modify preferences with a different category', () => {
    writePreferences(tmpDir, [
      makePref({ category: 'code.style_mismatch', retired_at: null }),
      makePref({ category: 'process.planning_error', retired_at: null }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const prefs = readPreferences(tmpDir);
    const planning = prefs.find(p => p.category === 'process.planning_error');
    expect(planning).toBeDefined();
    expect(planning!.retired_at).toBeNull();
  });

  it('does not re-retire already retired preferences', () => {
    const originalTs = '2026-01-01T00:00:00.000Z';
    writePreferences(tmpDir, [
      makePref({ category: 'code.style_mismatch', retired_at: originalTs, retired_by: 'sug-old-001' }),
    ]);

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const prefs = readPreferences(tmpDir);
    expect(prefs[0].retired_at).toBe(originalTs);
    expect(prefs[0].retired_by).toBe('sug-old-001');
  });

  it('handles missing preferences.jsonl gracefully (no error)', () => {
    // No preferences file written — should not throw
    expect(() => {
      retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });
    }).not.toThrow();
  });
});

// ─── Suite: suggestions.json ──────────────────────────────────────────────────

describe('retireByCategory — suggestions.json', () => {
  let retireByCategory: (category: string, suggestionId: string, options?: { cwd?: string }) => void;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      retireByCategory = mod.retireByCategory;
    } catch {
      retireByCategory = () => { /* module not found */ };
    }
  });

  it('sets status to refined and refined_at on the matching suggestion ID', () => {
    writeSuggestions(tmpDir, {
      metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] },
      suggestions: [makeSuggestion({ id: 'sug-test-001', status: 'accepted', refined_at: null })],
    });

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const doc = readSuggestions(tmpDir);
    expect(doc).not.toBeNull();
    const sug = doc!.suggestions[0];
    expect(sug.status).toBe('refined');
    expect(sug.refined_at).toBeTruthy();
  });

  it('does not modify suggestions with a different ID', () => {
    writeSuggestions(tmpDir, {
      metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] },
      suggestions: [
        makeSuggestion({ id: 'sug-test-001', status: 'accepted' }),
        makeSuggestion({ id: 'sug-other-002', status: 'accepted' }),
      ],
    });

    retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });

    const doc = readSuggestions(tmpDir);
    const other = doc!.suggestions.find(s => s.id === 'sug-other-002');
    expect(other).toBeDefined();
    expect(other!.status).toBe('accepted');
  });

  it('handles missing suggestions.json gracefully (no error)', () => {
    expect(() => {
      retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });
    }).not.toThrow();
  });
});

// ─── Suite: error handling ────────────────────────────────────────────────────

describe('retireByCategory — error handling', () => {
  let retireByCategory: (category: string, suggestionId: string, options?: { cwd?: string }) => void;

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      retireByCategory = mod.retireByCategory;
    } catch {
      retireByCategory = () => { /* module not found */ };
    }
  });

  it('never throws when patterns directory does not exist', () => {
    expect(() => {
      retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: '/nonexistent/path/that/does/not/exist' });
    }).not.toThrow();
  });

  it('never throws when corrections.jsonl is missing or empty', () => {
    expect(() => {
      retireByCategory('code.style_mismatch', 'sug-test-001', { cwd: tmpDir });
    }).not.toThrow();
  });
});
