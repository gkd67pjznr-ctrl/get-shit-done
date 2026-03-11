import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/analyze-patterns.cjs');

// Creates a minimal valid correction entry
function makeCorrection(overrides: Record<string, unknown> = {}) {
  return {
    correction_from: 'Old approach',
    correction_to: 'Better approach',
    diagnosis_category: 'code.style_mismatch',
    diagnosis_text: 'Should use const.',
    scope: 'file:src/foo.ts',
    phase: '25',
    timestamp: new Date().toISOString(),
    session_id: 'test-session-001',
    source: 'self_report',
    ...overrides,
  };
}

// Creates a minimal valid preference entry
function makePref(overrides: Record<string, unknown> = {}) {
  return {
    category: 'code.style_mismatch',
    scope: 'file:src/foo.ts',
    preference_text: 'Use const',
    confidence: 0.6,
    source_count: 3,
    last_correction_ts: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retired_at: null,
    ...overrides,
  };
}

// Creates a temp project directory with optional config overrides
function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-patterns-test-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  const config = {
    adaptive_learning: {
      observation: { retention_days: 90, max_entries: 1000, capture_corrections: true },
      suggestions: { min_occurrences: 3, cooldown_days: 7, auto_dismiss_after_days: 30 },
    },
  };
  fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify(config));
  return dir;
}

// Writes N correction entries to corrections.jsonl
function writeNCorrections(dir: string, n: number, overrides: Record<string, unknown> = {}): void {
  const patternsDir = path.join(dir, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  const lines = Array.from({ length: n }, () => JSON.stringify(makeCorrection(overrides)));
  fs.writeFileSync(path.join(patternsDir, 'corrections.jsonl'), lines.join('\n') + '\n');
}

// Writes preference entries to preferences.jsonl
function writePreferences(dir: string, prefs: object[]): void {
  const patternsDir = path.join(dir, '.planning', 'patterns');
  fs.mkdirSync(patternsDir, { recursive: true });
  const lines = prefs.map(p => JSON.stringify(p));
  fs.writeFileSync(path.join(patternsDir, 'preferences.jsonl'), lines.join('\n') + '\n');
}

// Reads suggestions.json from the temp dir
function readSuggestions(dir: string): { metadata: Record<string, unknown>; suggestions: unknown[] } | null {
  const filePath = path.join(dir, '.planning', 'patterns', 'suggestions.json');
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

// Creates a fake .claude/skills/<name> directory
function createSkillDir(dir: string, skillName: string): void {
  fs.mkdirSync(path.join(dir, '.claude', 'skills', skillName), { recursive: true });
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

// ─── Suite: basic ──────────────────────────────────────────────────────────────

describe('analyzePatterns — basic', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('returns { analyzed: true, suggestions_written: 0 } when no corrections exist', () => {
    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.suggestions_written).toBe(0);
  });

  it('creates .planning/patterns/ directory if missing', () => {
    // Remove the patterns dir that createTempDir may not have created yet
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    if (fs.existsSync(patternsDir)) {
      fs.rmSync(patternsDir, { recursive: true, force: true });
    }
    analyzePatterns({ cwd: tmpDir });
    expect(fs.existsSync(patternsDir)).toBe(true);
  });

  it('creates suggestions.json when patterns meet threshold', () => {
    writeNCorrections(tmpDir, 3);
    analyzePatterns({ cwd: tmpDir });
    const suggestionsPath = path.join(tmpDir, '.planning', 'patterns', 'suggestions.json');
    expect(fs.existsSync(suggestionsPath)).toBe(true);
  });

  it('suggestions.json has metadata and suggestions array', () => {
    writeNCorrections(tmpDir, 3);
    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    expect(doc).not.toBeNull();
    expect(doc).toHaveProperty('metadata');
    expect(doc).toHaveProperty('suggestions');
    expect(Array.isArray(doc!.suggestions)).toBe(true);
  });
});

// ─── Suite: threshold ──────────────────────────────────────────────────────────

describe('analyzePatterns — threshold', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('generates suggestion when correction count >= 3', () => {
    writeNCorrections(tmpDir, 3);
    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.suggestions_written).toBeGreaterThanOrEqual(1);
    const doc = readSuggestions(tmpDir);
    expect(doc!.suggestions.length).toBeGreaterThanOrEqual(1);
  });

  it('does not generate suggestion when correction count < 3', () => {
    writeNCorrections(tmpDir, 2);
    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.analyzed).toBe(true);
    expect(result.suggestions_written).toBe(0);
    const doc = readSuggestions(tmpDir);
    expect(doc!.suggestions.length).toBe(0);
  });

  it('counts corrections across different scopes for the same category', () => {
    // 1 correction in scope A, 1 in scope B, 1 in scope C — same category
    // Cross-scope aggregation means all 3 count toward the same suggestion
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const corrections = [
      makeCorrection({ diagnosis_category: 'code.style_mismatch', scope: 'file:src/a.ts' }),
      makeCorrection({ diagnosis_category: 'code.style_mismatch', scope: 'file:src/b.ts' }),
      makeCorrection({ diagnosis_category: 'code.style_mismatch', scope: 'file:src/c.ts' }),
    ];
    fs.writeFileSync(
      path.join(patternsDir, 'corrections.jsonl'),
      corrections.map(c => JSON.stringify(c)).join('\n') + '\n'
    );

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBeGreaterThanOrEqual(1);
    const doc = readSuggestions(tmpDir);
    const suggestion = (doc!.suggestions as Array<Record<string, unknown>>).find(
      s => s.category === 'code.style_mismatch'
    );
    expect(suggestion).toBeDefined();
    expect(suggestion!.correction_count).toBe(3);
  });
});

// ─── Suite: dedup against preferences ─────────────────────────────────────────

describe('analyzePatterns — dedup against preferences', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('skips corrections that have a matching active preference (category:scope)', () => {
    // Write 3 corrections
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file:src/foo.ts',
    });
    // Write a matching active preference (same category+scope)
    writePreferences(tmpDir, [
      makePref({
        category: 'code.style_mismatch',
        scope: 'file:src/foo.ts',
        retired_at: null,
      }),
    ]);

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBe(0);
  });

  it('includes corrections that have no matching preference', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file:src/bar.ts',
    });
    // A preference for a DIFFERENT scope — should not block
    writePreferences(tmpDir, [
      makePref({
        category: 'code.style_mismatch',
        scope: 'file:src/OTHER.ts',
        retired_at: null,
      }),
    ]);

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBeGreaterThanOrEqual(1);
  });

  it('includes corrections with a retired preference (not active)', () => {
    writeNCorrections(tmpDir, 3, {
      diagnosis_category: 'code.style_mismatch',
      scope: 'file:src/foo.ts',
    });
    // A RETIRED preference — should not block
    writePreferences(tmpDir, [
      makePref({
        category: 'code.style_mismatch',
        scope: 'file:src/foo.ts',
        retired_at: '2026-01-01T00:00:00.000Z',
      }),
    ]);

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBeGreaterThanOrEqual(1);
  });
});

// ─── Suite: watermark ─────────────────────────────────────────────────────────

describe('analyzePatterns — watermark', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('processes corrections with timestamp > last_analyzed_at', () => {
    const futureTs = new Date(Date.now() + 60000).toISOString(); // 1 minute in the future
    const pastWatermark = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

    writeNCorrections(tmpDir, 3, { timestamp: futureTs });

    // Pre-write suggestions.json with a watermark BEFORE the correction timestamps
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const existingDoc = {
      metadata: { last_analyzed_at: pastWatermark, version: 1, skipped_suggestions: [] },
      suggestions: [],
    };
    fs.writeFileSync(path.join(patternsDir, 'suggestions.json'), JSON.stringify(existingDoc, null, 2));

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBeGreaterThanOrEqual(1);
  });

  it('skips corrections with timestamp <= last_analyzed_at', () => {
    const oldTs = '2026-01-01T00:00:00.000Z';
    const newerWatermark = '2026-06-01T00:00:00.000Z';

    writeNCorrections(tmpDir, 3, { timestamp: oldTs });

    // Pre-write suggestions.json with a watermark AFTER the correction timestamps
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const existingDoc = {
      metadata: { last_analyzed_at: newerWatermark, version: 1, skipped_suggestions: [] },
      suggestions: [],
    };
    fs.writeFileSync(path.join(patternsDir, 'suggestions.json'), JSON.stringify(existingDoc, null, 2));

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBe(0);
  });

  it('updates last_analyzed_at in metadata after each run', () => {
    const before = new Date().toISOString();
    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const watermark = doc!.metadata.last_analyzed_at as string;
    expect(watermark).toBeTruthy();
    expect(watermark >= before).toBe(true);
  });
});

// ─── Suite: skill mapping ─────────────────────────────────────────────────────

describe('analyzePatterns — skill mapping', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('maps correction category to target skill via CATEGORY_SKILL_MAP', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });
    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const suggestion = (doc!.suggestions as Array<Record<string, unknown>>).find(
      s => s.category === 'code.style_mismatch'
    );
    expect(suggestion).toBeDefined();
    // code.style_mismatch maps to 'typescript-patterns'
    expect(suggestion!.target_skill).toBe('typescript-patterns');
  });

  it('sets type to refine_skill when target skill directory exists', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });
    // Create the skill directory so it 'exists'
    createSkillDir(tmpDir, 'typescript-patterns');
    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const suggestion = (doc!.suggestions as Array<Record<string, unknown>>).find(
      s => s.category === 'code.style_mismatch'
    );
    expect(suggestion!.type).toBe('refine_skill');
  });

  it('sets type to new_skill_needed when target skill directory does not exist', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });
    // Do NOT create the skill directory
    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const suggestion = (doc!.suggestions as Array<Record<string, unknown>>).find(
      s => s.category === 'code.style_mismatch'
    );
    expect(suggestion!.type).toBe('new_skill_needed');
  });
});

// ─── Suite: guardrails ────────────────────────────────────────────────────────

describe('analyzePatterns — guardrails', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('enforces 3-correction minimum — no suggestion below threshold', () => {
    writeNCorrections(tmpDir, 2);
    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBe(0);
    const doc = readSuggestions(tmpDir);
    expect(doc!.suggestions.length).toBe(0);
  });

  it('enforces 7-day cooldown — skips category if skill was accepted within 7 days', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });

    // Pre-write a suggestions.json with an accepted suggestion for 'typescript-patterns'
    // accepted within the last 7 days (today)
    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const recentAccepted = new Date().toISOString();
    const existingDoc = {
      metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] },
      suggestions: [
        {
          id: 'sug-0000000001-001',
          type: 'refine_skill',
          target_skill: 'typescript-patterns',
          category: 'code.style_mismatch',
          scope_summary: '1 scope: file:src/foo.ts',
          correction_count: 3,
          sample_corrections: [],
          status: 'accepted',
          created_at: recentAccepted,
          accepted_at: recentAccepted, // accepted today = within cooldown
          dismissed_at: null,
        },
      ],
    };
    fs.writeFileSync(path.join(patternsDir, 'suggestions.json'), JSON.stringify(existingDoc, null, 2));

    const result = analyzePatterns({ cwd: tmpDir });
    expect(result.suggestions_written).toBe(0);
  });

  it('logs skipped_suggestions in metadata when guardrail blocks a suggestion', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });

    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const recentAccepted = new Date().toISOString();
    const existingDoc = {
      metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] },
      suggestions: [
        {
          id: 'sug-0000000001-001',
          type: 'refine_skill',
          target_skill: 'typescript-patterns',
          category: 'code.style_mismatch',
          scope_summary: '1 scope: file:src/foo.ts',
          correction_count: 3,
          sample_corrections: [],
          status: 'accepted',
          created_at: recentAccepted,
          accepted_at: recentAccepted,
          dismissed_at: null,
        },
      ],
    };
    fs.writeFileSync(path.join(patternsDir, 'suggestions.json'), JSON.stringify(existingDoc, null, 2));

    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const skipped = doc!.metadata.skipped_suggestions as unknown[];
    expect(skipped.length).toBeGreaterThanOrEqual(1);
  });

  it('does not duplicate pending suggestions for same category on second run', () => {
    writeNCorrections(tmpDir, 3, { diagnosis_category: 'code.style_mismatch' });

    // First run — creates a pending suggestion
    analyzePatterns({ cwd: tmpDir });
    const docAfterFirst = readSuggestions(tmpDir);
    const pendingAfterFirst = (docAfterFirst!.suggestions as Array<Record<string, unknown>>).filter(
      s => s.status === 'pending' && s.category === 'code.style_mismatch'
    );
    expect(pendingAfterFirst.length).toBe(1);

    // Write more corrections (same category) to simulate new data
    writeNCorrections(tmpDir, 5, { diagnosis_category: 'code.style_mismatch' });

    // Second run — must NOT create a duplicate pending suggestion
    analyzePatterns({ cwd: tmpDir });
    const docAfterSecond = readSuggestions(tmpDir);
    const pendingAfterSecond = (docAfterSecond!.suggestions as Array<Record<string, unknown>>).filter(
      s => s.status === 'pending' && s.category === 'code.style_mismatch'
    );
    expect(pendingAfterSecond.length).toBe(1);
  });
});

// ─── Suite: auto-dismiss ──────────────────────────────────────────────────────

describe('analyzePatterns — auto-dismiss', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('marks pending suggestions older than 30 days as dismissed with reason auto_expired', () => {
    const oldCreatedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(); // 31 days ago

    const patternsDir = path.join(tmpDir, '.planning', 'patterns');
    fs.mkdirSync(patternsDir, { recursive: true });
    const existingDoc = {
      metadata: { last_analyzed_at: null, version: 1, skipped_suggestions: [] },
      suggestions: [
        {
          id: 'sug-0000000001-001',
          type: 'refine_skill',
          target_skill: 'typescript-patterns',
          category: 'code.style_mismatch',
          scope_summary: '1 scope: file:src/foo.ts',
          correction_count: 3,
          sample_corrections: [],
          status: 'pending',
          created_at: oldCreatedAt,
          accepted_at: null,
          dismissed_at: null,
        },
      ],
    };
    fs.writeFileSync(path.join(patternsDir, 'suggestions.json'), JSON.stringify(existingDoc, null, 2));

    analyzePatterns({ cwd: tmpDir });
    const doc = readSuggestions(tmpDir);
    const suggestion = (doc!.suggestions as Array<Record<string, unknown>>)[0];
    expect(suggestion.status).toBe('dismissed');
    expect(suggestion.dismiss_reason).toBe('auto_expired');
    expect(suggestion.dismissed_at).toBeTruthy();
  });
});

// ─── Suite: error handling ────────────────────────────────────────────────────

describe('analyzePatterns — error handling', () => {
  let analyzePatterns: (opts?: { cwd?: string }) => { analyzed: boolean; suggestions_written?: number; reason?: string; error?: string };

  beforeEach(() => {
    try {
      const mod = require(LIBRARY_PATH);
      analyzePatterns = mod.analyzePatterns;
    } catch {
      analyzePatterns = () => ({ analyzed: false, reason: 'module_not_found' });
    }
  });

  it('returns { analyzed: false, reason: "error" } on unrecoverable error', () => {
    // Pass a non-existent and unwritable cwd to trigger an error
    // Use a path that will fail directory creation (null byte in path)
    const result = analyzePatterns({ cwd: '/dev/null/nonexistent\x00invalid' });
    expect(result.analyzed).toBe(false);
    expect(result.reason).toBe('error');
    expect(result.error).toBeTruthy();
  });

  it('is silent — never throws', () => {
    // Should not throw under any circumstances
    expect(() => {
      analyzePatterns({ cwd: '/dev/null/nonexistent\x00invalid' });
    }).not.toThrow();
  });
});
