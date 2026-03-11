# Phase 26: Enhanced Digest and Skill Refinement - Research

**Researched:** 2026-03-11
**Domain:** Slash command enhancement, JSONL mutation, skill file editing workflow
**Confidence:** HIGH

## Summary

Phase 26 completes the correction-to-skill-refinement loop by enhancing `/gsd:digest` with a correction analysis section and enhancing `/gsd:suggest` with a collaborative skill refinement workflow. The existing `/gsd:digest` (in `commands/gsd/digest.md`) and `/gsd:suggest` (in `commands/gsd/suggest.md`) are the canonical locations -- no `/sc:` namespace files exist to remove (they were already consolidated or never created separately).

The implementation requires three distinct capabilities: (1) reading and grouping corrections by diagnosis category for display in the digest, (2) a multi-step interactive workflow in `/gsd:suggest` that reads a SKILL.md, proposes diffs, and gets user confirmation, and (3) a retirement mechanism that mutates JSONL files to set `retired_at` on corrections and preferences matching a refined category.

**Primary recommendation:** Build a `retireByCategory()` function in a shared library (write-correction.cjs or a new retire.cjs) that handles the JSONL rewrite for both corrections and preferences, then wire it into the suggest command's refinement workflow.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Group corrections by diagnosis category (the 7-category taxonomy from Phase 22)
- Table format: category, count, last seen, target skill -- consistent with existing digest table style
- Categories at or above the 3-correction threshold shown in bold with a callout: "3+ corrections -- skill refinement available"
- Corrections only -- no preference data in the digest section
- Table sorted by count descending
- Triggered via /gsd:suggest -- digest shows callout pointing users to `/gsd:suggest`
- Refinement means editing SKILL.md directly -- Claude reads target skill, drafts edits, shows before/after diff, user confirms
- 20% max change guardrail enforced: if proposed edits exceed 20% of skill file content, warn and ask user to confirm override
- Retirement happens after skill edit is confirmed and written -- not at suggestion acceptance time
- Set `retired_at` timestamp + `retired_by` (suggestion ID) on each correction/preference entry in JSONL -- non-destructive, auditable
- Retire ALL active corrections matching suggestion's diagnosis_category (category-wide sweep)
- Also retire any preferences matching the same category
- Mark suggestion as 'refined' status in suggestions.json -- new status beyond accepted/dismissed
- Merge existing /sc:digest into new /gsd:digest (but /sc:digest files do not currently exist -- only /gsd:digest and /gsd:suggest exist)
- Enhance /gsd:suggest to handle the refinement workflow when user accepts a suggestion

### Claude's Discretion
- Exact placement of the correction analysis section within the digest output (before or after existing sections)
- How to measure the 20% change threshold (line count, character count, or word count)
- Implementation of the JSONL mutation for retirement (rewrite full file or append-style)
- Test structure and organization
- How to port existing /sc:digest functionality into /gsd:digest (copy and adapt vs refactor)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLY-01 | Enhanced `/gsd:digest` includes correction analysis section -- groups by diagnosis category, shows trends, identifies skills being contradicted | Existing `readCorrections()` API supports status-filtered reads; `CATEGORY_SKILL_MAP` maps categories to skills; digest.md Step 3 can be extended with a new 3g section |
| ANLY-02 | `/gsd:digest` initiates collaborative skill refinement workflow via AskUserQuestion when corrections consistently contradict a specific skill (3+ corrections) | Digest shows callout with pointer to `/gsd:suggest`; suggest.md enhanced with refinement flow (read SKILL.md, propose diff, confirm); SKILL.md files are 42-193 lines -- manageable for diff display |
| ANLY-03 | Skill refinement step retires source corrections/preferences from active recall after baking changes into skill | New `retireByCategory()` function rewrites JSONL files adding `retired_at` + `retired_by`; `readCorrections()` and `readPreferences()` already filter by `retired_at` |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | JSONL read/write, SKILL.md read/write | Zero-dependency pattern used by all hooks |
| Node.js path | built-in | File path construction | Consistent with existing codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-correction.cjs | existing | `readCorrections()` for correction analysis | Reading corrections for digest and retirement |
| write-preference.cjs | existing | `readPreferences()` for preference retirement | Reading preferences for retirement |
| analyze-patterns.cjs | existing | `CATEGORY_SKILL_MAP`, `loadSuggestions()`, `writeSuggestionsAtomic()` | Mapping categories to skills, updating suggestion status |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Full JSONL rewrite for retirement | Append-only with separate retirement log | Append avoids rewrite risk but complicates reads; rewrite is simpler, already used by `upsertPreference()` |
| Line-count for 20% threshold | Character-count or word-count | Line-count is simplest, matches how SKILL.md files are structured (prose lines), and `wc -l` is intuitive for users |

## Architecture Patterns

### Recommended Approach

The phase modifies two slash command markdown files and adds one library function. No new files are needed beyond the retirement utility.

### File Modifications
```
commands/gsd/digest.md          # Add correction analysis section (Step 3g)
commands/gsd/suggest.md         # Add refinement workflow after acceptance
.claude/hooks/lib/              # Add retireByCategory() -- either in existing module or new retire.cjs
```

### Pattern 1: Correction Analysis in Digest (ANLY-01)

**What:** Add a new Step 3g to `digest.md` that reads corrections, groups by `diagnosis_category`, and displays a table.

**When to use:** During `/gsd:digest` execution, after existing analysis steps.

**Implementation approach:**
```
Step 3g: Correction Analysis

Read corrections using readCorrections({ status: 'active' }).
Group by diagnosis_category.
For each category, compute: count, last_seen (max timestamp), target_skill (from CATEGORY_SKILL_MAP).
Display table sorted by count descending.
Bold categories with count >= 3.
Add callout: "3+ corrections -- run /gsd:suggest to review skill refinement suggestions"
```

**Placement recommendation:** After Step 3f (Plan vs Summary Diffs) and before Step 4 (Activation History). The correction analysis is a natural extension of the pattern analysis section, and placing it last in Step 3 keeps it adjacent to the recommendation section where the /gsd:suggest pointer appears.

### Pattern 2: Skill Refinement Workflow in Suggest (ANLY-02)

**What:** When user accepts a suggestion in `/gsd:suggest`, instead of just marking it accepted, trigger a refinement workflow.

**Flow:**
1. User accepts suggestion (existing behavior marks `status: accepted`, `accepted_at: timestamp`)
2. NEW: Claude reads the target SKILL.md file (path: `.claude/skills/{target_skill}/SKILL.md`)
3. Claude analyzes the sample corrections and all active corrections for that category
4. Claude drafts specific edits to the SKILL.md content
5. Claude computes the 20% change threshold and warns if exceeded
6. Claude shows before/after diff to user
7. User confirms via AskUserQuestion (confirm / reject / modify)
8. If confirmed: Write the edited SKILL.md
9. Call `retireByCategory()` for the suggestion's diagnosis_category
10. Update suggestion status to `refined` with `refined_at` timestamp

**20% threshold measurement (discretion decision):** Use line count. Count lines in original SKILL.md, count lines that differ in the proposed version (added + removed + changed), and if `changed_lines / original_lines > 0.20`, trigger the warning. Line count is the most intuitive metric for markdown files and aligns with how diffs are naturally displayed.

### Pattern 3: JSONL Retirement (ANLY-03)

**What:** Non-destructive retirement of corrections and preferences by adding `retired_at` and `retired_by` fields.

**Implementation (discretion decision):** Use full-file rewrite with atomic tmp+rename, consistent with `upsertPreference()` in write-preference.cjs.

```javascript
// retireByCategory(category, suggestionId, { cwd })
// 1. Read corrections.jsonl line by line
// 2. For each line: if diagnosis_category matches AND retired_at is falsy,
//    set retired_at = now, retired_by = suggestionId
// 3. Write to corrections.jsonl.tmp, rename to corrections.jsonl
// 4. Repeat for preferences.jsonl (matching on category field)
// 5. Update suggestions.json: set status = 'refined', refined_at = now
```

**Key detail:** The retirement sweeps ALL active corrections matching the category, not just the counted ones. This is a category-wide operation. Also retires preferences matching the same category.

### Anti-Patterns to Avoid
- **Modifying corrections in-place without atomic write:** JSONL corruption risk if process crashes mid-write. Always use tmp+rename.
- **Retiring before skill edit confirmation:** The CONTEXT explicitly states retirement happens AFTER the skill edit is written, not at acceptance time.
- **Mixing preference data into digest:** CONTEXT explicitly excludes preferences from the correction analysis section.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading active corrections | Custom JSONL parser | `readCorrections({ status: 'active' })` | Already handles archives, filtering, sorting |
| Reading active preferences | Custom parser | `readPreferences({ status: 'active' })` | Already handles filtering |
| Category-to-skill mapping | Hardcoded map in command | `CATEGORY_SKILL_MAP` from analyze-patterns.cjs | Single source of truth for the mapping |
| Atomic file writes | Direct `writeFileSync` | tmp+rename pattern from `upsertPreference` / `writeSuggestionsAtomic` | Crash-safe writes |
| Suggestion ID generation | Manual ID creation | `generateSuggestionId()` from analyze-patterns.cjs | Guarantees uniqueness |

**Key insight:** The existing library modules (`write-correction.cjs`, `write-preference.cjs`, `analyze-patterns.cjs`) already provide all the read/query APIs needed. The new work is primarily (a) a display formatting concern in digest.md, (b) an interactive workflow concern in suggest.md, and (c) a single new mutation function for retirement.

## Common Pitfalls

### Pitfall 1: Forgetting Archive Files During Retirement
**What goes wrong:** Retiring only corrections.jsonl but not corrections-*.jsonl archive files.
**Why it happens:** `readCorrections()` reads both active and archive files, but a naive retirement function might only process the main file.
**How to avoid:** The retirement function must scan the same set of files that `readCorrections()` scans -- corrections.jsonl plus all corrections-*.jsonl archives.
**Warning signs:** Retired corrections reappearing in future digests.

### Pitfall 2: Suggestion Status Lifecycle
**What goes wrong:** Not handling the new 'refined' status correctly in existing code paths.
**Why it happens:** Existing code checks for 'pending', 'accepted', 'dismissed' -- the new 'refined' status must not break these filters.
**How to avoid:** 'refined' is a terminal status like 'dismissed'. The existing filter in suggest.md (`status === 'pending'`) will naturally skip refined suggestions. Verify that `checkGuardrails()` in analyze-patterns.cjs handles 'refined' correctly -- it currently checks `status === 'accepted'` for cooldown, and 'refined' should also trigger cooldown (since it means the skill was actually modified).
**Warning signs:** Cooldown not applying after a suggestion is refined.

### Pitfall 3: SKILL.md Path Resolution
**What goes wrong:** Hardcoding `.claude/skills/{name}/SKILL.md` without verifying the skill directory exists.
**How to avoid:** `analyze-patterns.cjs` already does `fs.existsSync(path.join(cwd, '.claude', 'skills', targetSkill))` -- use the same check. For `type: 'new_skill_needed'` suggestions, the refinement workflow should not attempt to read a nonexistent file.
**Warning signs:** Crash when skill directory doesn't exist.

### Pitfall 4: 20% Threshold on Small Files
**What goes wrong:** A 42-line SKILL.md (code-review) has a threshold of ~8 lines. Even minor edits could trigger the warning.
**Why it happens:** Small files hit percentage thresholds easily.
**How to avoid:** Consider a minimum absolute threshold (e.g., at least 5 changed lines) before applying the percentage check, or document that small-file warnings are expected.
**Warning signs:** Users getting warned on every refinement of small skills.

### Pitfall 5: Cooldown Check for 'refined' Status
**What goes wrong:** After a suggestion is refined, the cooldown in `checkGuardrails()` only checks `status === 'accepted'`, missing 'refined' suggestions.
**Why it happens:** The cooldown code was written before the 'refined' status existed.
**How to avoid:** Update `checkGuardrails()` to also consider suggestions with `status === 'refined'` and check their `refined_at` timestamp against the cooldown window.
**Warning signs:** New suggestions immediately appearing for a category that was just refined.

## Code Examples

### Correction Grouping for Digest (ANLY-01)
```javascript
// In digest.md Step 3g instructions:
// Read active corrections
const corrections = readCorrections({ status: 'active' }, { cwd });

// Group by diagnosis_category
const groups = {};
for (const c of corrections) {
  const cat = c.diagnosis_category;
  if (!cat) continue;
  if (!groups[cat]) groups[cat] = { count: 0, lastSeen: null, corrections: [] };
  groups[cat].count++;
  groups[cat].corrections.push(c);
  if (!groups[cat].lastSeen || c.timestamp > groups[cat].lastSeen) {
    groups[cat].lastSeen = c.timestamp;
  }
}

// Sort by count descending, map to target skill
const sorted = Object.entries(groups)
  .map(([cat, g]) => ({ category: cat, count: g.count, lastSeen: g.lastSeen, targetSkill: CATEGORY_SKILL_MAP[cat] }))
  .sort((a, b) => b.count - a.count);
```

### JSONL Retirement Function (ANLY-03)
```javascript
// retireByCategory(category, suggestionId, options)
function retireByCategory(category, suggestionId, options) {
  const cwd = (options && options.cwd) ? options.cwd : process.cwd();
  const patternsDir = path.join(cwd, '.planning', 'patterns');
  const now = new Date().toISOString();

  // Retire corrections (all files: active + archives)
  const corrFiles = ['corrections.jsonl'];
  try {
    const dirFiles = fs.readdirSync(patternsDir);
    for (const f of dirFiles) {
      if (f.startsWith('corrections-') && f.endsWith('.jsonl')) corrFiles.push(f);
    }
  } catch (e) { /* no archives */ }

  for (const file of corrFiles) {
    const filePath = path.join(patternsDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() !== '');
      let changed = false;
      const updated = lines.map(line => {
        try {
          const entry = JSON.parse(line);
          if (entry.diagnosis_category === category && !entry.retired_at) {
            entry.retired_at = now;
            entry.retired_by = suggestionId;
            changed = true;
            return JSON.stringify(entry);
          }
          return line;
        } catch (e) { return line; }
      });
      if (changed) {
        const tmpPath = filePath + '.tmp';
        fs.writeFileSync(tmpPath, updated.join('\n') + '\n');
        fs.renameSync(tmpPath, filePath);
      }
    } catch (e) { /* skip unreadable */ }
  }

  // Retire preferences
  const prefPath = path.join(patternsDir, 'preferences.jsonl');
  try {
    const content = fs.readFileSync(prefPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() !== '');
    let changed = false;
    const updated = lines.map(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.category === category && !entry.retired_at) {
          entry.retired_at = now;
          entry.retired_by = suggestionId;
          changed = true;
          return JSON.stringify(entry);
        }
        return line;
      } catch (e) { return line; }
    });
    if (changed) {
      const tmpPath = prefPath + '.tmp';
      fs.writeFileSync(tmpPath, updated.join('\n') + '\n');
      fs.renameSync(tmpPath, prefPath);
    }
  } catch (e) { /* no preferences file */ }
}
```

### 20% Change Threshold Check
```javascript
// Line-count based threshold
function checkChangeThreshold(originalContent, proposedContent, threshold = 0.20) {
  const origLines = originalContent.split('\n');
  const propLines = proposedContent.split('\n');
  const origCount = origLines.length;

  // Simple diff: count lines that differ
  let changedCount = 0;
  const maxLen = Math.max(origLines.length, propLines.length);
  for (let i = 0; i < maxLen; i++) {
    if ((origLines[i] || '') !== (propLines[i] || '')) changedCount++;
  }

  const ratio = changedCount / origCount;
  return {
    exceeds: ratio > threshold,
    ratio,
    changedLines: changedCount,
    totalLines: origCount,
    percentage: Math.round(ratio * 100)
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| /sc:digest + /sc:suggest (separate namespace) | /gsd:digest + /gsd:suggest (unified GSD namespace) | Phase 25 (v6.0) | sc namespace already consolidated; only /gsd: commands exist |
| Suggestions accepted but no action taken | Suggestions drive skill refinement with diff review | Phase 26 (this phase) | Closes the learning loop end-to-end |
| Corrections accumulate indefinitely | Corrections retired after skill refinement | Phase 26 (this phase) | Prevents stale data from inflating analysis |

**Current state of existing commands:**
- `/gsd:digest` exists at `commands/gsd/digest.md` (257 lines) -- fully functional, needs correction analysis section added
- `/gsd:suggest` exists at `commands/gsd/suggest.md` (125 lines) -- fully functional, needs refinement workflow added after acceptance
- No `/sc:digest` or `/sc:suggest` files exist -- the sc namespace consolidation already happened

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest, configured in project) |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run tests/hooks/analyze-patterns.test.ts --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLY-01 | Digest correction analysis groups corrections by category | manual-only | N/A -- slash command output is markdown text, not programmatic | N/A |
| ANLY-02 | Suggest refinement workflow reads skill, proposes diff, confirms | manual-only | N/A -- interactive AskUserQuestion workflow | N/A |
| ANLY-03 | retireByCategory sets retired_at on matching corrections/preferences | unit | `npx vitest run tests/hooks/retire-by-category.test.ts --reporter=verbose` | No -- Wave 0 |
| ANLY-03 | Refined suggestion status recorded in suggestions.json | unit | `npx vitest run tests/hooks/retire-by-category.test.ts --reporter=verbose` | No -- Wave 0 |
| Pitfall-5 | checkGuardrails considers 'refined' status for cooldown | unit | `npx vitest run tests/hooks/analyze-patterns.test.ts --reporter=verbose` | Yes -- needs new test case |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/hooks/ --reporter=verbose`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/hooks/retire-by-category.test.ts` -- covers ANLY-03 retirement logic (retireByCategory function)
- [ ] New test case in `tests/hooks/analyze-patterns.test.ts` -- covers Pitfall-5 (checkGuardrails handling 'refined' status)

## Open Questions

1. **Should `retireByCategory()` live in a new file or be added to an existing module?**
   - What we know: write-correction.cjs exports `readCorrections`, write-preference.cjs exports `readPreferences`. The retirement function touches both files.
   - What's unclear: Whether it belongs in one of these or in a new `retire.cjs`
   - Recommendation: Add to a new `retire.cjs` in `.claude/hooks/lib/` since it cross-cuts both modules. Import `readCorrections` and file scanning patterns from write-correction.cjs.

2. **Should `checkGuardrails()` in analyze-patterns.cjs be updated in this phase or left for a follow-up?**
   - What we know: Pitfall-5 identifies that 'refined' status is not currently considered in cooldown checks
   - What's unclear: Whether this is blocking or just a nice-to-have
   - Recommendation: Fix in this phase -- it is a small change (add `|| s.status === 'refined'` to the filter, check `refined_at` timestamp) and prevents immediate re-suggestion after refinement.

## Sources

### Primary (HIGH confidence)
- Direct code reading: `analyze-patterns.cjs` (293 lines), `write-correction.cjs` (301 lines), `write-preference.cjs` (248 lines)
- Direct code reading: `commands/gsd/digest.md` (257 lines), `commands/gsd/suggest.md` (125 lines)
- Direct code reading: `.planning/patterns/corrections.jsonl`, `preferences.jsonl`, `suggestions.json` (live data)
- Direct code reading: `.claude/skills/*/SKILL.md` file sizes (42-193 lines)

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions (user-locked choices for implementation approach)
- Existing test patterns from `tests/hooks/analyze-patterns.test.ts` (574 lines), `correction-capture.test.ts` (589 lines), `preference-tracking.test.ts` (655 lines)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use in the codebase
- Architecture: HIGH - extending existing commands and library modules with well-understood patterns
- Pitfalls: HIGH - identified from direct code reading of existing implementations

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- internal tooling, no external dependency churn)
