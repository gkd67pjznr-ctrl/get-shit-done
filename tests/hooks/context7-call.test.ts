import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/write-context7-call.cjs');
const { writeContext7Call } = require(LIBRARY_PATH);

// Valid entry fixture for reuse across tests
function makeValidEntry(overrides: Record<string, unknown> = {}) {
  return {
    library: '/vercel/next.js',
    query: 'schema validation',
    tokens_requested: 2000,
    token_cap: 2000,
    used: true,
    quality_level: 'standard',
    phase: '28',
    plan: '28-03',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Create a temp project dir with optional .planning/config.json content
function createTempDir(configOverrides?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'context7-call-test-'));
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

describe('writeContext7Call basic write', () => {
  it('writes a valid entry to context7-calls.jsonl', () => {
    const entry = makeValidEntry();
    writeContext7Call(entry, { cwd: tmpDir });
    const callsPath = path.join(tmpDir, '.planning', 'observations', 'context7-calls.jsonl');
    expect(fs.existsSync(callsPath)).toBe(true);
    const lines = fs.readFileSync(callsPath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.library).toBe(entry.library);
    expect(parsed.tokens_requested).toBe(entry.tokens_requested);
    expect(parsed.token_cap).toBe(entry.token_cap);
    expect(parsed.used).toBe(entry.used);
    expect(parsed.quality_level).toBe(entry.quality_level);
    expect(parsed.phase).toBe(entry.phase);
    expect(parsed.plan).toBe(entry.plan);
  });

  it('returns { written: true } on success', () => {
    const result = writeContext7Call(makeValidEntry(), { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });

  it('creates .planning/observations/ directory if missing', () => {
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    expect(fs.existsSync(observationsDir)).toBe(false);
    writeContext7Call(makeValidEntry(), { cwd: tmpDir });
    expect(fs.existsSync(observationsDir)).toBe(true);
  });

  it('omits query field when not provided (query is optional)', () => {
    const entry = makeValidEntry();
    delete (entry as Record<string, unknown>).query;
    writeContext7Call(entry, { cwd: tmpDir });
    const callsPath = path.join(tmpDir, '.planning', 'observations', 'context7-calls.jsonl');
    const line = fs.readFileSync(callsPath, 'utf-8').trim();
    const parsed = JSON.parse(line);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'query')).toBe(false);
  });
});

// ─── Suite: validation ────────────────────────────────────────────────────────

describe('writeContext7Call validation', () => {
  it("returns { written: false, reason: 'invalid_entry' } when library is missing", () => {
    const entry = makeValidEntry();
    delete (entry as Record<string, unknown>).library;
    const result = writeContext7Call(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it("returns invalid_entry when quality_level is 'fast'", () => {
    const entry = makeValidEntry({ quality_level: 'fast' });
    const result = writeContext7Call(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('returns invalid_entry when used is not a boolean', () => {
    const entry = makeValidEntry({ used: 'true' });
    const result = writeContext7Call(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('returns invalid_entry when tokens_requested is not a number', () => {
    const entry = makeValidEntry({ tokens_requested: '2000' });
    const result = writeContext7Call(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('accepts tokens_requested of 0 (valid — cap may be 0 in config)', () => {
    const entry = makeValidEntry({ tokens_requested: 0, token_cap: 0 });
    const result = writeContext7Call(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });
});

// ─── Suite: rotation ─────────────────────────────────────────────────────────

describe('writeContext7Call rotation', () => {
  it('rotates when line count reaches 2000', () => {
    // Pre-populate with exactly 2000 valid JSON lines
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });
    const filePath = path.join(observationsDir, 'context7-calls.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(2000));

    writeContext7Call(makeValidEntry(), { cwd: tmpDir });

    // Active file should now contain exactly 1 line (the new entry)
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);

    // An archive file should exist
    const files = fs.readdirSync(observationsDir);
    const archives = files.filter(f => f.startsWith('context7-calls-') && f.endsWith('.jsonl'));
    expect(archives.length).toBeGreaterThanOrEqual(1);
  });

  it('appends sequence number when archive name already exists', () => {
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });
    const filePath = path.join(observationsDir, 'context7-calls.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    const dateStr = new Date().toISOString().slice(0, 10);

    // First rotation: pre-populate and rotate
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(2000));
    writeContext7Call(makeValidEntry(), { cwd: tmpDir });

    // Manually ensure the dated archive exists (it should after first rotation)
    const firstArchive = path.join(observationsDir, `context7-calls-${dateStr}.jsonl`);
    if (!fs.existsSync(firstArchive)) {
      fs.writeFileSync(firstArchive, fakeLine + '\n');
    }

    // Second rotation: pre-populate active file to 2000 lines again
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(2000));
    writeContext7Call(makeValidEntry(), { cwd: tmpDir });

    // Should have created context7-calls-YYYY-MM-DD-1.jsonl
    const seqArchive = path.join(observationsDir, `context7-calls-${dateStr}-1.jsonl`);
    expect(fs.existsSync(seqArchive)).toBe(true);
  });
});

// ─── Suite: CLI invocation ────────────────────────────────────────────────────

describe('writeContext7Call CLI invocation', () => {
  it('exits 0 when called via CLI with valid JSON and cwd', () => {
    const entry = makeValidEntry();
    const result = spawnSync(process.execPath, [LIBRARY_PATH, JSON.stringify(entry), tmpDir], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    const callsPath = path.join(tmpDir, '.planning', 'observations', 'context7-calls.jsonl');
    expect(fs.existsSync(callsPath)).toBe(true);
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
