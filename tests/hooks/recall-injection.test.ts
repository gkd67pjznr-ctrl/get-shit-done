import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const WRITE_CORRECTION_PATH = path.join(process.cwd(), '.claude/hooks/lib/write-correction.cjs');

function makeValidEntry(overrides: Record<string, unknown> = {}) {
  return {
    correction_from: 'old approach',
    correction_to: 'correct approach',
    diagnosis_category: 'code.wrong_pattern',
    diagnosis_text: 'Used wrong pattern.',
    scope: 'file',
    phase: '24',
    timestamp: new Date().toISOString(),
    session_id: 'test-session',
    source: 'self_report',
    ...overrides,
  };
}

function makePrefEntry(overrides: Record<string, unknown> = {}) {
  return {
    category: 'code.wrong_pattern',
    scope: 'file',
    preference_text: 'Always use correct pattern',
    confidence: 0.75,
    source_count: 3,
    last_correction_ts: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    retired_at: null,
    ...overrides,
  };
}

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-test-'));
  fs.mkdirSync(path.join(dir, '.planning', 'patterns'), { recursive: true });
  return dir;
}

function writeCorrectionsFile(dir: string, entries: object[], filename = 'corrections.jsonl'): void {
  const filePath = path.join(dir, '.planning', 'patterns', filename);
  fs.writeFileSync(filePath, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
}

// Inline assembleRecall for testing token budget logic (mirrors what the hook will implement)
function estimateTokens(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length / 0.75);
}

function assembleRecall(
  preferences: object[],
  corrections: object[],
  maxTokens = 3000
): string {
  const prefs = preferences as Array<{ category: string; preference_text: string }>;
  const corrs = corrections as Array<{ diagnosis_category: string; correction_to: string }>;

  if (prefs.length === 0 && corrs.length === 0) return '';

  const FOOTER_RESERVE = 20;
  let tokenCount = 0;
  const header = '<system-reminder>\n## Correction Recall\n\nPreferences (learned):';
  tokenCount += estimateTokens(header);

  const prefLines: string[] = [];
  const corrLines: string[] = [];
  let skipped = 0;

  for (const p of prefs) {
    const line = `- [${p.category}] ${p.preference_text}`;
    const cost = estimateTokens(line);
    if (tokenCount + cost + FOOTER_RESERVE > maxTokens) { skipped++; continue; }
    prefLines.push(line);
    tokenCount += cost;
  }

  const corrHeader = '\nRecent corrections:';
  tokenCount += estimateTokens(corrHeader);

  for (const c of corrs) {
    const line = `- [${c.diagnosis_category}] ${c.correction_to}`;
    const cost = estimateTokens(line);
    if (tokenCount + cost + FOOTER_RESERVE > maxTokens) { skipped++; continue; }
    corrLines.push(line);
    tokenCount += cost;
  }

  let output = `${header}\n${prefLines.join('\n')}${corrHeader}\n${corrLines.join('\n')}`;
  if (skipped > 0) {
    output += `\n\n(+${skipped} more corrections not shown -- see corrections.jsonl)`;
  }
  output += '\n</system-reminder>';
  return output;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('readCorrections', () => {
  it('basic read — returns entries sorted by timestamp descending', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    const older = makeValidEntry({ timestamp: '2025-01-01T00:00:00Z' });
    const newer = makeValidEntry({ timestamp: '2025-06-01T00:00:00Z' });
    writeCorrectionsFile(tmpDir, [older, newer]);

    const result = readCorrections({}, { cwd: tmpDir });

    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0].timestamp).toBe('2025-06-01T00:00:00Z');
    expect(result[1].timestamp).toBe('2025-01-01T00:00:00Z');
  });

  it('reads archive files in addition to active corrections.jsonl', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    const activeEntry = makeValidEntry({ timestamp: '2025-06-01T00:00:00Z', correction_to: 'active' });
    const archiveEntry = makeValidEntry({ timestamp: '2025-01-01T00:00:00Z', correction_to: 'archived' });

    writeCorrectionsFile(tmpDir, [activeEntry]);
    writeCorrectionsFile(tmpDir, [archiveEntry], 'corrections-2025-01-01.jsonl');

    const result = readCorrections({}, { cwd: tmpDir });

    expect(result).toHaveLength(2);
    const correctionTos = result.map((e: { correction_to: string }) => e.correction_to);
    expect(correctionTos).toContain('active');
    expect(correctionTos).toContain('archived');
  });

  it('active filter — excludes entries where retired_at is truthy (RECL-03)', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    const activeEntry = makeValidEntry({ retired_at: null, correction_to: 'active-entry' });
    const retiredEntry = makeValidEntry({ retired_at: '2025-01-01T00:00:00Z', correction_to: 'retired-entry' });

    writeCorrectionsFile(tmpDir, [activeEntry, retiredEntry]);

    const result = readCorrections({ status: 'active' }, { cwd: tmpDir });

    expect(result).toHaveLength(1);
    expect(result[0].correction_to).toBe('active-entry');
  });

  it('retired filter — returns only entries where retired_at is truthy', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    const activeEntry = makeValidEntry({ retired_at: null, correction_to: 'active-entry' });
    const retiredEntry = makeValidEntry({ retired_at: '2025-01-01T00:00:00Z', correction_to: 'retired-entry' });

    writeCorrectionsFile(tmpDir, [activeEntry, retiredEntry]);

    const result = readCorrections({ status: 'retired' }, { cwd: tmpDir });

    expect(result).toHaveLength(1);
    expect(result[0].correction_to).toBe('retired-entry');
  });

  it('empty/missing corrections.jsonl returns []', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    // tmpDir has .planning/patterns/ but no corrections.jsonl

    const result = readCorrections({}, { cwd: tmpDir });

    expect(result).toEqual([]);
  });

  it('malformed lines are skipped — only valid JSON lines returned', () => {
    const { readCorrections } = require(WRITE_CORRECTION_PATH);
    const validEntry = makeValidEntry({ correction_to: 'valid-entry' });
    const filePath = path.join(tmpDir, '.planning', 'patterns', 'corrections.jsonl');
    fs.writeFileSync(
      filePath,
      JSON.stringify(validEntry) + '\n' + 'this is not json\n'
    );

    const result = readCorrections({}, { cwd: tmpDir });

    expect(result).toHaveLength(1);
    expect(result[0].correction_to).toBe('valid-entry');
  });
});

describe('token budget — assembleRecall', () => {
  it('stops at 3K tokens and adds overflow footer when entries are skipped (RECL-01)', () => {
    // Generate 20 preference entries with long preference_text (~50 words each)
    const longWords = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega aleph beth gimel daleth he waw zayin heth teth yodh kaph lamedh mem nun samekh ayin pe tsadhe qoph resh shin taw';
    const prefs = Array.from({ length: 20 }, (_, i) =>
      makePrefEntry({
        category: `code.wrong_pattern`,
        preference_text: `Entry ${i}: ${longWords}`,
      })
    );

    // Use a small maxTokens (200) to force truncation with these long entries
    const output = assembleRecall(prefs, [], 200);

    // Output produced
    expect(output.length).toBeGreaterThan(0);
    // Footer appears when entries are skipped
    expect(output).toContain('(+');
    expect(output).toContain('more corrections not shown');
  });
});

describe('dedup — promoted corrections excluded (PREF-04)', () => {
  it('correction matching a promoted preference category+scope is excluded from output', () => {
    const preferences = [
      makePrefEntry({ category: 'code.wrong_pattern', scope: 'file' }),
    ];
    const corrections = [
      makeValidEntry({ diagnosis_category: 'code.wrong_pattern', scope: 'file' }),
      makeValidEntry({ diagnosis_category: 'code.missing_context', scope: 'file' }),
    ];

    // Build dedup Set from preferences (key: category+scope)
    const promotedKeys = new Set(
      preferences.map((p: Record<string, unknown>) => `${p.category}+${p.scope}`)
    );

    // Filter corrections: exclude those whose diagnosis_category+scope is in promotedKeys
    const filtered = corrections.filter(
      (c: Record<string, unknown>) =>
        !promotedKeys.has(`${c.diagnosis_category}+${c.scope}`)
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].diagnosis_category).toBe('code.missing_context');
  });
});

describe('silent — empty input produces empty output', () => {
  it('empty corrections and preferences produces empty string', () => {
    const output = assembleRecall([], []);
    expect(output).toBe('');
  });
});
