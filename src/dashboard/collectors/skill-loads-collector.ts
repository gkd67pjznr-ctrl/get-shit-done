/**
 * Skill-loads data collector.
 *
 * Reads skill-loads.jsonl and aggregates load counts per skill.
 * Fault-tolerant: returns empty result on ENOENT or parse errors, never throws.
 *
 * @module dashboard/collectors/skill-loads-collector
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  SkillLoadEntry,
  SkillLoadSummary,
  SkillLoadsCollectorResult,
  SkillLoadsCollectorOptions,
} from './types.js';

/** Default path to skill-loads.jsonl relative to cwd. */
const DEFAULT_LOADS_PATH = '.planning/patterns/skill-loads.jsonl';

/** Empty result returned on any failure. */
const EMPTY_RESULT: SkillLoadsCollectorResult = {
  skills: [],
  totalLoads: 0,
};

/**
 * Collect and aggregate skill load data from skill-loads.jsonl.
 *
 * Reads each line as a JSON object, aggregates load counts by skill name,
 * and returns the top results sorted by count descending.
 *
 * Fault-tolerant: returns empty result when the file is missing, empty,
 * or malformed. Never throws.
 *
 * @param options - Collector options (loadsPath override).
 * @returns Aggregated skill load summaries sorted by count desc.
 */
export async function collectSkillLoads(
  options: SkillLoadsCollectorOptions = {},
): Promise<SkillLoadsCollectorResult> {
  const loadsPath = options.loadsPath ?? join(process.cwd(), DEFAULT_LOADS_PATH);

  try {
    const raw = await readFile(loadsPath, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);

    const bySkill = new Map<string, { count: number; lastSeen: string }>();

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as SkillLoadEntry;
        if (!entry.skill || typeof entry.skill !== 'string') continue;

        const existing = bySkill.get(entry.skill);
        if (existing) {
          existing.count += 1;
          // Keep most recent timestamp
          if (entry.ts && entry.ts > existing.lastSeen) {
            existing.lastSeen = entry.ts;
          }
        } else {
          bySkill.set(entry.skill, {
            count: 1,
            lastSeen: entry.ts ?? '',
          });
        }
      } catch {
        // Skip malformed lines
      }
    }

    const skills: SkillLoadSummary[] = Array.from(bySkill.entries())
      .map(([skill, data]) => ({ skill, count: data.count, lastSeen: data.lastSeen }))
      .sort((a, b) => b.count - a.count);

    const totalLoads = skills.reduce((sum, s) => sum + s.count, 0);

    return { skills, totalLoads };
  } catch {
    // ENOENT or any other error → empty result
    return EMPTY_RESULT;
  }
}
