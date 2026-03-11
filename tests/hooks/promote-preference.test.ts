import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const LIBRARY_PATH = path.join(process.cwd(), '.claude/hooks/lib/promote-preference.cjs');

let tmpDir: string;
let mod: { promoteToUserLevel: Function; readUserPreferences: Function };

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promote-pref-test-'));
  process.env.GSD_HOME = tmpDir;
  // Re-require after setting GSD_HOME -- module reads env at call time via getGsdHome()
  mod = require(LIBRARY_PATH);
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
  delete process.env.GSD_HOME;
});

// ─── Suite: readUserPreferences ────────────────────────────────────────────────

describe('readUserPreferences', () => {
  it('returns empty doc when file does not exist', () => {
    const result = mod.readUserPreferences();
    expect(result).toEqual({ version: '1.0', preferences: [] });
    expect(Array.isArray(result.preferences)).toBe(true);
  });

  it('returns empty doc when file is malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'preferences.json'), 'not-json');
    const result = mod.readUserPreferences();
    expect(result).toEqual({ version: '1.0', preferences: [] });
  });

  it('returns parsed doc when file is valid', () => {
    const doc = {
      version: '1.0',
      preferences: [
        {
          category: 'code.style_mismatch',
          scope: 'file',
          preference_text: 'use const',
          confidence: 0.8,
          source_projects: ['proj-a'],
          promoted_at: null,
          updated_at: new Date().toISOString(),
        },
      ],
    };
    fs.writeFileSync(path.join(tmpDir, 'preferences.json'), JSON.stringify(doc));
    const result = mod.readUserPreferences();
    expect(result.version).toBe('1.0');
    expect(result.preferences.length).toBe(1);
    expect(result.preferences[0].category).toBe('code.style_mismatch');
  });
});

// ─── Suite: promoteToUserLevel ─────────────────────────────────────────────────

describe('promoteToUserLevel', () => {
  const pref = {
    category: 'process.convention_violation',
    scope: 'file',
    preference_text: 'always check docs first',
    confidence: 0.8,
  };

  it('returns missing_fields when category is missing', () => {
    const result = mod.promoteToUserLevel({}, {});
    expect(result.reason).toBe('missing_fields');
    expect(result.promoted).toBe(false);
  });

  it('returns missing_fields when projectId is missing', () => {
    const result = mod.promoteToUserLevel(pref, {});
    expect(result.reason).toBe('missing_fields');
    expect(result.promoted).toBe(false);
  });

  it('creates new entry on first call', () => {
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    const prefsPath = path.join(tmpDir, 'preferences.json');
    expect(fs.existsSync(prefsPath)).toBe(true);
    const doc = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
    expect(doc.preferences.length).toBe(1);
    expect(doc.preferences[0].category).toBe(pref.category);
    expect(doc.preferences[0].source_projects).toEqual(['proj-a']);
  });

  it('adds projectId to source_projects on subsequent calls', () => {
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    mod.promoteToUserLevel(pref, { projectId: 'proj-b' });
    const doc = JSON.parse(fs.readFileSync(path.join(tmpDir, 'preferences.json'), 'utf-8'));
    expect(doc.preferences[0].source_projects).toContain('proj-a');
    expect(doc.preferences[0].source_projects).toContain('proj-b');
    expect(doc.preferences[0].source_projects.length).toBe(2);
  });

  it('does not duplicate projectId when called twice with same project', () => {
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    const doc = JSON.parse(fs.readFileSync(path.join(tmpDir, 'preferences.json'), 'utf-8'));
    expect(doc.preferences[0].source_projects.length).toBe(1);
  });

  it('sets promoted_at when source_projects reaches 3', () => {
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    mod.promoteToUserLevel(pref, { projectId: 'proj-b' });
    const result = mod.promoteToUserLevel(pref, { projectId: 'proj-c' });

    expect(result.promoted).toBe(true);
    expect(result.projectCount).toBe(3);

    const doc = JSON.parse(fs.readFileSync(path.join(tmpDir, 'preferences.json'), 'utf-8'));
    expect(doc.preferences[0].promoted_at).not.toBeNull();
    expect(typeof doc.preferences[0].promoted_at).toBe('string');
  });

  it('does not reset promoted_at on 4th project', () => {
    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    mod.promoteToUserLevel(pref, { projectId: 'proj-b' });
    mod.promoteToUserLevel(pref, { projectId: 'proj-c' });

    const docAfter3 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'preferences.json'), 'utf-8'));
    const promotedAt3 = docAfter3.preferences[0].promoted_at;
    expect(promotedAt3).not.toBeNull();

    mod.promoteToUserLevel(pref, { projectId: 'proj-d' });

    const docAfter4 = JSON.parse(fs.readFileSync(path.join(tmpDir, 'preferences.json'), 'utf-8'));
    // promoted_at should still be set (not null, not reset)
    expect(docAfter4.preferences[0].promoted_at).not.toBeNull();
    expect(docAfter4.preferences[0].source_projects.length).toBe(4);
  });

  it('creates ~/.gsd dir if missing', () => {
    // Use a nested temp path that does not exist yet
    const nestedDir = path.join(tmpDir, 'nested', 'gsd-home');
    process.env.GSD_HOME = nestedDir;
    expect(fs.existsSync(nestedDir)).toBe(false);

    const result = mod.promoteToUserLevel(pref, { projectId: 'proj-a' });
    // Should not return error -- directory creation succeeded
    expect(result.reason).toBeUndefined();
    expect(fs.existsSync(nestedDir)).toBe(true);
    expect(fs.existsSync(path.join(nestedDir, 'preferences.json'))).toBe(true);
  });

  it('uses GSD_HOME env var instead of homedir', () => {
    const realHomePrefPath = path.join(os.homedir(), '.gsd', 'preferences.json');
    const tmpPrefPath = path.join(tmpDir, 'preferences.json');

    mod.promoteToUserLevel(pref, { projectId: 'proj-a' });

    // File should exist in tmpDir (GSD_HOME), not in real ~/.gsd
    expect(fs.existsSync(tmpPrefPath)).toBe(true);
    // The real homedir preferences.json should NOT have been written
    // (we cannot assert it doesn't exist because it might already exist from other use,
    // but we can assert the content was NOT written by this test by checking tmpDir file)
    const doc = JSON.parse(fs.readFileSync(tmpPrefPath, 'utf-8'));
    expect(doc.preferences.length).toBe(1);
    expect(doc.preferences[0].source_projects).toContain('proj-a');
  });
});
