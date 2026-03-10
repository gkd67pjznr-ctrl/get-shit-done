import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/write-gate-execution.cjs');
const { writeGateExecution } = require(LIBRARY_PATH);

// Valid entry fixture for reuse across tests
function makeValidEntry(overrides: Record<string, unknown> = {}) {
  return {
    gate: 'codebase_scan',
    task: 1,
    outcome: 'passed',
    detail: '2 reuse candidates evaluated',
    quality_level: 'standard',
    phase: '28',
    plan: '28-01',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Create a temp project dir with optional .planning/config.json content
function createTempDir(configOverrides?: Record<string, unknown>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-execution-test-'));
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

describe('writeGateExecution basic write', () => {
  it('writes a valid entry to gate-executions.jsonl', () => {
    const entry = makeValidEntry();
    writeGateExecution(entry, { cwd: tmpDir });
    const gatePath = path.join(tmpDir, '.planning', 'observations', 'gate-executions.jsonl');
    expect(fs.existsSync(gatePath)).toBe(true);
    const lines = fs.readFileSync(gatePath, 'utf-8').split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.gate).toBe(entry.gate);
    expect(parsed.task).toBe(entry.task);
    expect(parsed.outcome).toBe(entry.outcome);
    expect(parsed.quality_level).toBe(entry.quality_level);
    expect(parsed.phase).toBe(entry.phase);
    expect(parsed.plan).toBe(entry.plan);
  });

  it('returns { written: true } on success', () => {
    const result = writeGateExecution(makeValidEntry(), { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });

  it('creates .planning/observations/ directory if missing', () => {
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    expect(fs.existsSync(observationsDir)).toBe(false);
    writeGateExecution(makeValidEntry(), { cwd: tmpDir });
    expect(fs.existsSync(observationsDir)).toBe(true);
  });
});

// ─── Suite: validation ────────────────────────────────────────────────────────

describe('writeGateExecution validation', () => {
  it("returns { written: false, reason: 'invalid_entry' } when required field missing (gate missing)", () => {
    const entry = makeValidEntry();
    delete (entry as Record<string, unknown>).gate;
    const result = writeGateExecution(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('returns invalid_entry when gate is not one of the 5 valid names', () => {
    const entry = makeValidEntry({ gate: 'invalid_gate' });
    const result = writeGateExecution(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('returns invalid_entry when outcome is not one of the 4 valid outcomes', () => {
    const entry = makeValidEntry({ outcome: 'unknown_outcome' });
    const result = writeGateExecution(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it("returns invalid_entry when quality_level is 'fast'", () => {
    const entry = makeValidEntry({ quality_level: 'fast' });
    const result = writeGateExecution(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: false, reason: 'invalid_entry' });
  });

  it('allows task to be 0 (sentinel entry before first task)', () => {
    const entry = makeValidEntry({ task: 0 });
    const result = writeGateExecution(entry, { cwd: tmpDir });
    expect(result).toEqual({ written: true });
  });
});

// ─── Suite: rotation ─────────────────────────────────────────────────────────

describe('writeGateExecution rotation', () => {
  it('rotates when line count reaches 5000', () => {
    // Pre-populate with exactly 5000 valid JSON lines
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });
    const filePath = path.join(observationsDir, 'gate-executions.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(5000));

    writeGateExecution(makeValidEntry(), { cwd: tmpDir });

    // Active file should now contain exactly 1 line (the new entry)
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    expect(lines.length).toBe(1);

    // An archive file should exist
    const files = fs.readdirSync(observationsDir);
    const archives = files.filter(f => f.startsWith('gate-executions-') && f.endsWith('.jsonl'));
    expect(archives.length).toBeGreaterThanOrEqual(1);
  });

  it('appends sequence number when archive name already exists', () => {
    const observationsDir = path.join(tmpDir, '.planning', 'observations');
    fs.mkdirSync(observationsDir, { recursive: true });
    const filePath = path.join(observationsDir, 'gate-executions.jsonl');
    const fakeLine = JSON.stringify({ x: 1 });
    const dateStr = new Date().toISOString().slice(0, 10);

    // First rotation: pre-populate and rotate
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(5000));
    writeGateExecution(makeValidEntry(), { cwd: tmpDir });

    // Manually ensure the dated archive exists (it should after first rotation)
    const firstArchive = path.join(observationsDir, `gate-executions-${dateStr}.jsonl`);
    if (!fs.existsSync(firstArchive)) {
      fs.writeFileSync(firstArchive, fakeLine + '\n');
    }

    // Second rotation: pre-populate active file to 5000 lines again
    fs.writeFileSync(filePath, (fakeLine + '\n').repeat(5000));
    writeGateExecution(makeValidEntry(), { cwd: tmpDir });

    // Should have created gate-executions-YYYY-MM-DD-1.jsonl
    const seqArchive = path.join(observationsDir, `gate-executions-${dateStr}-1.jsonl`);
    expect(fs.existsSync(seqArchive)).toBe(true);
  });
});

// ─── Suite: CLI invocation ────────────────────────────────────────────────────

describe('writeGateExecution CLI invocation', () => {
  it('exits 0 when called via CLI with valid JSON and cwd', () => {
    const entry = makeValidEntry();
    const result = spawnSync(process.execPath, [LIBRARY_PATH, JSON.stringify(entry), tmpDir], {
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(result.status).toBe(0);
    const gatePath = path.join(tmpDir, '.planning', 'observations', 'gate-executions.jsonl');
    expect(fs.existsSync(gatePath)).toBe(true);
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
