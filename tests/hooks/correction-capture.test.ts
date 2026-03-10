import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/write-correction.cjs');
const { writeCorrection } = require(LIBRARY_PATH);

// Valid entry fixture for reuse across tests
function makeValidEntry(overrides: Record<string, unknown> = {}) {
  return {
    correction_from: 'Used wrong pattern',
    correction_to: 'Should have used correct pattern',
    diagnosis_category: 'code.wrong_pattern',
    secondary_category: null,
    diagnosis_text: 'Did wrong pattern because of stale knowledge. Should have checked docs.',
    scope: 'file',
    phase: '22',
    timestamp: new Date().toISOString(),
    session_id: 'test-session-001',
    source: 'self_report',
    ...overrides,
  };
}

// Create a temp project dir with optional .planning/config.json content
function createTempDir(configOverrides?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'correction-test-'));
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

// ─── Suite: basic write ───────────────────────────────────────────────────────

describe('writeCorrection basic write', () => {
  it('writes a valid entry to corrections.jsonl', () => {
    const entry = makeValidEntry();
    writeCorrection(entry, { cwd: tmpDir });
    const correctionsPath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl');
    expect(fs.existsSync(correctionsPath)).toBe(true);
    const lines = fs.readFileSync(correctionsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.correction_from).toBe(entry.correction_from);
    expect(parsed.correction_to).toBe(entry.correction_to);
    expect(parsed.diagnosis_category).toBe(entry.diagnosis_category);
    expect(parsed.diagnosis_text).toBe(entry.diagnosis_text);
    expect(parsed.source).toBe(entry.source);
  });

  it('returns { written: true } on success', () => {
    const result = writeCorrection(makeValidEntry(), { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });

  it('creates .planning/patterns/ directory if missing', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    expect(fs.existsSync(patternsDir)).toBe(false);
    writeCorrection(makeValidEntry(), { cwd: tmpDir });
    expect(fs.existsSync(patternsDir)).toBe(true);
  });
});

// ─── Suite: field truncation ──────────────────────────────────────────────────

describe('writeCorrection field truncation', () => {
  it('truncates correction_from to 200 chars', () => {
    const longStr = 'a'.repeat(300);
    const entry = makeValidEntry({ correction_from: longStr });
    writeCorrection(entry, { cwd: tmpDir });
    const correctionsPath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl');
    const line = fs.readFileSync(correctionsPath, 'utf-8').trim();
    const parsed = JSON.parse(line);
    expect(parsed.correction_from.length).toBe(200);
  });

  it('truncates correction_to to 200 chars', () => {
    const longStr = 'b'.repeat(300);
    const entry = makeValidEntry({ correction_to: longStr });
    writeCorrection(entry, { cwd: tmpDir });
    const correctionsPath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl');
    const line = fs.readFileSync(correctionsPath, 'utf-8').trim();
    const parsed = JSON.parse(line);
    expect(parsed.correction_to.length).toBe(200);
  });
});

// ─── Suite: validation ────────────────────────────────────────────────────────

describe('writeCorrection validation', () => {
  it("returns { written: false, reason: 'invalid_entry' } when required field missing", () => {
    const entry = makeValidEntry();
    delete (entry as Record<string, unknown>).diagnosis_category;
    const result = writeCorrection(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('allows secondary_category to be null', () => {
    const entry = makeValidEntry({ secondary_category: null });
    const result = writeCorrection(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });

  it("returns invalid_entry when diagnosis_category is not one of the 14 valid categories", () => {
    const entry = makeValidEntry({ diagnosis_category: 'invalid.category' });
    const result = writeCorrection(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('returns invalid_entry when diagnosis_text exceeds 100 tokens', () => {
    // 120 space-separated words — clearly over 100 tokens
    const longText = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
    const entry = makeValidEntry({ diagnosis_text: longText });
    const result = writeCorrection(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });
});

// ─── Suite: capture_corrections bypass ───────────────────────────────────────

describe('writeCorrection capture_corrections bypass', () => {
  it("returns { written: false, reason: 'capture_disabled' } when capture_corrections is false", () => {
    const dir = createTempDir({ capture_corrections: false });
    try {
      const result = writeCorrection(makeValidEntry(), { cwd: dir });
      expect(result).toEqual({ written: false, reason: 'capture_disabled' });
      // Verify no corrections.jsonl was created
      const correctionsPath = path.join(dir, '.planning', 'patterns', 'corrections.jsonl');
      expect(fs.existsSync(correctionsPath)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── Suite: rotation ─────────────────────────────────────────────────────────

describe('writeCorrection rotation', () => {
  it('rotates when line count reaches maxEntries', () => {
    // Pre-populate with exactly 1000 valid JSON lines
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const filePath = path.join(patternsDir, 'corrections.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(1000));

    writeCorrection(makeValidEntry(), { cwd: tmpDir });

    // Active file should now contain exactly 1 line (the new entry)
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);

    // An archive file should exist
    const files = fs.readdirSync(patternsDir);
    const archives = files.filter(f => f.startsWith('corrections-') && f.endsWith('.jsonl'));
    expect(archives.length).toBeGreaterThanOrEqual(1);
  });

  it('appends sequence number when archive name already exists', () => {
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const filePath = path.join(patternsDir, 'corrections.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    const dateStr = new Date().toISOString().slice(0, 10);

    // First rotation: pre-populate and rotate
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(1000));
    writeCorrection(makeValidEntry(), { cwd: tmpDir });

    // Manually ensure the dated archive exists (it should after first rotation)
    const firstArchive = path.join(patternsDir, `corrections-${dateStr}.jsonl`);
    if (!fs.existsSync(firstArchive)) {
      fs.writeFileSync(firstArchive, fakeLine + '\n');
    }

    // Second rotation: pre-populate active file to 1000 lines again
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(1000));
    writeCorrection(makeValidEntry(), { cwd: tmpDir });

    // Should have created corrections-YYYY-MM-DD-1.jsonl
    const seqArchive = path.join(patternsDir, `corrections-${dateStr}-1.jsonl`);
    expect(fs.existsSync(seqArchive)).toBe(true);
  });
});

// ─── Suite: retention cleanup ─────────────────────────────────────────────────

describe('writeCorrection retention cleanup', () => {
  it('deletes archives older than retention_days', () => {
    const dir = createTempDir({ retention_days: 90 });
    try {
      const patternsDir = path.join(dir, '.planning', 'patterns');
      fs.mkdirSync(patternsDir, { recursive: true });

      // Create an old archive file (91 days ago)
      const oldArchive = path.join(patternsDir, 'corrections-2000-01-01.jsonl');
      fs.writeFileSync(oldArchive, '{"old":true}\n');
      const oldTime = (Date.now() - 91 * 24 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(oldArchive, oldTime, oldTime);

      // Pre-populate active file to trigger rotation
      const filePath = path.join(patternsDir, 'corrections.jsonl');
      fs.writeFileSync(filePath, (JSON.stringify({ x: 1 }) + '\n').repeat(1000));
      writeCorrection(makeValidEntry(), { cwd: dir });

      // Old archive should be deleted
      expect(fs.existsSync(oldArchive)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps archives within retention_days', () => {
    const dir = createTempDir({ retention_days: 90 });
    try {
      const patternsDir = path.join(dir, '.planning', 'patterns');
      fs.mkdirSync(patternsDir, { recursive: true });

      // Create a recent archive file (30 days ago)
      const recentArchive = path.join(patternsDir, 'corrections-2025-01-01.jsonl');
      fs.writeFileSync(recentArchive, '{"recent":true}\n');
      const recentTime = (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000;
      fs.utimesSync(recentArchive, recentTime, recentTime);

      // Pre-populate active file to trigger rotation
      const filePath = path.join(patternsDir, 'corrections.jsonl');
      fs.writeFileSync(filePath, (JSON.stringify({ x: 1 }) + '\n').repeat(1000));
      writeCorrection(makeValidEntry(), { cwd: dir });

      // Recent archive should still exist
      expect(fs.existsSync(recentArchive)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── Suite: CLI invocation ────────────────────────────────────────────────────

describe('write-correction CLI invocation', () => {
  it('exits 0 when called via CLI with valid JSON and cwd', () => {
    const entry = makeValidEntry();
    const result = spawnSync(process.execPath, [LIBRARY_PATH, JSON.stringify(entry), tmpDir], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    const correctionsPath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl');
    expect(fs.existsSync(correctionsPath)).toBe(true);
  });

  it('exits 0 with invalid JSON argument', () => {
    const result = spawnSync(process.execPath, [LIBRARY_PATH, 'not json'], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result.status).toBe(0);
  });

  it('exits 0 with no arguments', () => {
    const result = spawnSync(process.execPath, [LIBRARY_PATH], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result.status).toBe(0);
  });
});
