import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/attribute-gates.cjs');

// Creates a minimal valid gate execution entry
function makeGateEntry(overrides: Record<string, unknown> = {}) {
  return {
    gate: 'codebase_scan',
    outcome: 'passed',
    quality_level: 'standard',
    phase: '28',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Creates a minimal valid correction entry
function makeCorrection(overrides: Record<string, unknown> = {}) {
  return {
    diagnosis_category: 'code.wrong_pattern',
    diagnosis_text: 'Used wrong pattern',
    correction_from: 'old',
    correction_to: 'new',
    phase: '28',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Creates a temp dir with .planning/observations/ and .planning/patterns/ subdirectories
function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-attribution-test-'));
  fs.mkdirSync(path.join(dir, '.planning', 'observations'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.planning', 'patterns'), { recursive: true });
  return dir;
}

// Writes gate entries as JSONL to dir/.planning/observations/gate-executions.jsonl
function writeGateEntries(dir: string, entries: object[]): void {
  const filePath = path.join(dir, '.planning', 'observations', 'gate-executions.jsonl');
  fs.writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// Writes corrections as JSONL to dir/.planning/patterns/corrections.jsonl
function writeCorrections(dir: string, corrections: object[]): void {
  const filePath = path.join(dir, '.planning', 'patterns', 'corrections.jsonl');
  fs.writeFileSync(filePath, corrections.map(c => JSON.stringify(c)).join('\n') + '\n');
}

// Reads dir/.planning/observations/gate-attribution.jsonl and returns parsed objects
function readAttribution(dir: string): object[] {
  const filePath = path.join(dir, '.planning', 'observations', 'gate-attribution.jsonl');
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split('\n')
    .filter(l => l.trim() !== '')
    .map(l => JSON.parse(l));
}

let tmpDir: string;
let attributeGates: (opts?: { cwd?: string }) => { analyzed: boolean; attributions?: number; reason?: string; error?: string };

beforeEach(() => {
  tmpDir = createTempDir();
  try {
    const mod = require(LIBRARY_PATH);
    attributeGates = mod.attributeGates;
  } catch {
    attributeGates = () => ({ analyzed: false, reason: 'module_not_found' });
  }
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ─── Suite: basic ──────────────────────────────────────────────────────────────

describe('attributeGates — basic', () => {
  it('returns { analyzed: true, attributions: 0 } when no corrections exist', () => {
    const result = attributeGates({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.attributions).toBe(0);
  });
});

// ─── Suite: produces attributions ────────────────────────────────────────────

describe('attributeGates — produces attributions', () => {
  it('produces attributions from matched correction categories', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.stale_knowledge', diagnosis_text: 'Used stale knowledge' }),
      makeCorrection({ diagnosis_category: 'code.stale_knowledge', diagnosis_text: 'Outdated API usage' }),
      makeCorrection({ diagnosis_category: 'code.stale_knowledge', diagnosis_text: 'Deprecated pattern' }),
    ]);
    const result = attributeGates({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.attributions).toBeGreaterThanOrEqual(1);
    expect(readAttribution(tmpDir).length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite: maps all categories ───────────────────────────────────────────────

describe('attributeGates — maps all categories', () => {
  it('maps all 14 correction categories to a gate', () => {
    const allCategories = [
      'code.wrong_pattern',
      'code.missing_context',
      'code.stale_knowledge',
      'code.over_engineering',
      'code.under_engineering',
      'code.style_mismatch',
      'code.scope_drift',
      'process.planning_error',
      'process.research_gap',
      'process.implementation_bug',
      'process.integration_miss',
      'process.convention_violation',
      'process.requirement_misread',
      'process.regression',
    ];

    writeCorrections(
      tmpDir,
      allCategories.map(cat => makeCorrection({ diagnosis_category: cat, diagnosis_text: `Correction for ${cat}` }))
    );

    attributeGates({ cwd: tmpDir });
    const entries = readAttribution(tmpDir) as Array<Record<string, unknown>>;

    const outputCategories = new Set(entries.map(e => e.correction_category));
    for (const cat of allCategories) {
      expect(outputCategories.has(cat), `Category ${cat} should appear in output`).toBe(true);
    }
  });
});

// ─── Suite: confidence ───────────────────────────────────────────────────────

describe('attributeGates — confidence', () => {
  it('assigns confidence 1.0 to direct causal mappings', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.stale_knowledge', diagnosis_text: 'Stale knowledge issue' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const entries = readAttribution(tmpDir) as Array<Record<string, unknown>>;
    const entry = entries.find(e => e.correction_category === 'code.stale_knowledge');
    expect(entry).toBeDefined();
    expect(entry!.confidence).toBe(1.0);
  });

  it('assigns confidence 0.7 to strong correlation mappings', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.wrong_pattern', diagnosis_text: 'Wrong pattern used' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const entries = readAttribution(tmpDir) as Array<Record<string, unknown>>;
    const entry = entries.find(e => e.correction_category === 'code.wrong_pattern');
    expect(entry).toBeDefined();
    expect(entry!.confidence).toBe(0.7);
  });

  it('assigns confidence 0.4 to indirect mappings', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.over_engineering', diagnosis_text: 'Over-engineered solution' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const entries = readAttribution(tmpDir) as Array<Record<string, unknown>>;
    const entry = entries.find(e => e.correction_category === 'code.over_engineering');
    expect(entry).toBeDefined();
    expect(entry!.confidence).toBe(0.4);
  });
});

// ─── Suite: writes output ────────────────────────────────────────────────────

describe('attributeGates — writes output', () => {
  it('writes gate-attribution.jsonl to .planning/observations/', () => {
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.wrong_pattern', diagnosis_text: 'Wrong pattern' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const filePath = path.join(tmpDir, '.planning', 'observations', 'gate-attribution.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('overwrites gate-attribution.jsonl on each run', () => {
    // First run: 1 correction
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.wrong_pattern', diagnosis_text: 'First run correction' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const afterFirst = readAttribution(tmpDir).length;

    // Second run: 2 corrections with different category
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'process.regression', diagnosis_text: 'Regression found' }),
      makeCorrection({ diagnosis_category: 'process.research_gap', diagnosis_text: 'Research gap' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const afterSecond = readAttribution(tmpDir).length;

    // Second run should not accumulate first run's results
    expect(afterSecond).toBe(2);
    expect(afterFirst).toBe(1);
  });
});

// ─── Suite: structured entries ────────────────────────────────────────────────

describe('attributeGates — structured entries', () => {
  it('each entry has correction_category, gate, confidence, correction_count, gate_outcome_distribution, phases_observed, sample_corrections, timestamp', () => {
    writeGateEntries(tmpDir, [
      makeGateEntry({ gate: 'codebase_scan', outcome: 'passed', phase: '28' }),
    ]);
    writeCorrections(tmpDir, [
      makeCorrection({ diagnosis_category: 'code.wrong_pattern', diagnosis_text: 'Wrong pattern', phase: '28' }),
    ]);
    attributeGates({ cwd: tmpDir });
    const entries = readAttribution(tmpDir) as Array<Record<string, unknown>>;
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const entry = entries[0];
    expect(entry).toHaveProperty('correction_category');
    expect(entry).toHaveProperty('gate');
    expect(entry).toHaveProperty('confidence');
    expect(entry).toHaveProperty('correction_count');
    expect(entry).toHaveProperty('gate_outcome_distribution');
    expect(entry).toHaveProperty('phases_observed');
    expect(entry).toHaveProperty('sample_corrections');
    expect(entry).toHaveProperty('timestamp');
  });
});

// ─── Suite: empty ────────────────────────────────────────────────────────────

describe('attributeGates — empty', () => {
  it('empty corrections returns { analyzed: true, attributions: 0 }', () => {
    writeCorrections(tmpDir, []);
    const result = attributeGates({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.attributions).toBe(0);
  });

  it('empty corrections writes an empty gate-attribution.jsonl', () => {
    writeCorrections(tmpDir, []);
    attributeGates({ cwd: tmpDir });
    const filePath = path.join(tmpDir, '.planning', 'observations', 'gate-attribution.jsonl');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(readAttribution(tmpDir).length).toBe(0);
  });

  it('never throws on empty data', () => {
    expect(() => {
      attributeGates({ cwd: tmpDir });
    }).not.toThrow();
  });
});
