# Phase 27: Cross-Project Inheritance and Skill Loading - Research

**Researched:** 2026-03-11
**Domain:** Cross-project preference promotion, skill injection into workflow commands and subagent contexts
**Confidence:** HIGH

## Summary

Phase 27 closes the v6.0 milestone by addressing two distinct capabilities: (1) cross-project preference inheritance -- when the same preference appears in 3+ different projects, it gets promoted to a user-level store at `~/.gsd/preferences.json`, and (2) learned skill loading -- all GSD workflow commands and spawned subagents load relevant learned skills (corrections, preferences, suggestions) into their execution context.

The cross-project inheritance requires a new promotion mechanism. Currently, preferences live at `.planning/patterns/preferences.jsonl` per-project. The promotion path is: read preferences from the current project, compare against `~/.gsd/preferences.json` (which tracks source projects), and promote when the same category+scope pattern appears across 3+ distinct projects. This is analogous to the existing per-project `checkAndPromote()` function in `write-preference.cjs`, but operating at the user level.

The skill loading requirement means enhancing 6 workflow files (execute-phase, plan-phase, verify-work, discuss-phase, quick, diagnose-issues) plus 5 agent files (gsd-executor, gsd-verifier, gsd-planner, gsd-orchestrator, observer) to include learned skills in their context. Currently, the `execute-phase.md` workflow already includes `.claude/skills/` in the subagent `<files_to_read>` block, and the `gsd-executor.md` agent references `skill-integration` in its frontmatter. The gap is that (a) learned preferences/corrections are not loaded alongside skills, and (b) other workflows and agents do not have skill-loading steps.

**Primary recommendation:** Build a `promote-preference.cjs` library module for cross-project promotion (PREF-03), then add a "load learned context" step to each workflow and agent file that reads active preferences and recent corrections (LOAD-01, LOAD-02).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PREF-03 | Cross-project preference inheritance -- user-level preferences stored at `~/.gsd/preferences.json`, promoted when a preference appears in 3+ projects | New `promote-preference.cjs` module; `~/.gsd/` directory already exists with `defaults.json` and `dashboard.json`; promotion triggered during `checkAndPromote()` after project-level preference is written |
| LOAD-01 | All GSD workflow commands load relevant learned skills into their execution context | 6 workflow files need a "load learned context" step; existing `readPreferences()` and `readCorrections()` APIs provide the data; token budget enforcement via existing `adaptive_learning.token_budget` config |
| LOAD-02 | All GSD agents and subagents inherit learned skills in their spawned context | `execute-phase.md` already passes `.claude/skills/` to subagent `<files_to_read>`; needs to also pass learned preferences/corrections; same pattern extends to verify-work subagents |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | Read/write `~/.gsd/preferences.json`, read project preferences | Zero-dependency pattern used by all hooks |
| Node.js path | built-in | Cross-platform path construction for `~/.gsd/` | Consistent with existing codebase |
| Node.js os | built-in | `os.homedir()` for resolving `~/.gsd/` path | Already used by init.cjs for GSD_HOME |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-preference.cjs | existing | `readPreferences()`, `checkAndPromote()` | Reading project-level preferences for promotion check |
| write-correction.cjs | existing | `readCorrections()` | Reading corrections for context injection |
| analyze-patterns.cjs | existing | `CATEGORY_SKILL_MAP` | Mapping preferences to relevant skills |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON for user-level preferences | JSONL (matching project-level) | JSON is simpler for a single aggregated file; JSONL is better for append-heavy project-level stores. User-level is read-heavy (check on every promotion), so JSON is the better fit. |
| Inline preference text in workflow prompts | External file reference for subagents | Inline avoids extra file reads but costs context tokens; external reference is cheaper but requires subagent to read. Inline is better for preferences (small, 1-5 entries relevant per phase). |

## Architecture Patterns

### Recommended File Structure
```
~/.gsd/
  defaults.json           # Already exists -- user config defaults
  dashboard.json          # Already exists -- dashboard server config
  preferences.json        # NEW -- user-level cross-project preferences

.claude/hooks/lib/
  promote-preference.cjs  # NEW -- cross-project promotion logic

get-shit-done/workflows/
  execute-phase.md        # MODIFY -- add learned context loading step
  plan-phase.md           # MODIFY -- add learned context loading step
  verify-work.md          # MODIFY -- add learned context loading step
  discuss-phase.md        # MODIFY -- add learned context loading step
  quick.md                # MODIFY -- add learned context loading step
  diagnose-issues.md      # MODIFY -- add learned context loading step

.claude/agents/
  gsd-executor.md         # MODIFY -- document learned context inheritance
  gsd-verifier.md         # MODIFY -- document learned context inheritance
  gsd-planner.md          # MODIFY -- add learned context awareness
  gsd-orchestrator.md     # MODIFY -- add learned context awareness
  observer.md             # MODIFY -- add learned context awareness
```

### Pattern 1: Cross-Project Preference Promotion (PREF-03)

**What:** When `checkAndPromote()` writes a project-level preference, it also checks whether that preference category+scope pattern appears in 3+ projects at the user level.

**Mechanism:**
```
~/.gsd/preferences.json shape:
{
  "version": "1.0",
  "preferences": [
    {
      "category": "process.convention_violation",
      "scope": "file",
      "preference_text": "User's manual edit preferred over Claude's output",
      "confidence": 0.95,
      "source_projects": ["gsdup", "project-b", "project-c"],
      "promoted_at": "2026-03-11T...",
      "updated_at": "2026-03-11T..."
    }
  ]
}
```

**Flow:**
1. `checkAndPromote()` successfully writes a project-level preference
2. After upsert, call `promoteToUserLevel(entry, { cwd, projectId })`
3. `promoteToUserLevel` reads `~/.gsd/preferences.json`
4. Finds entry matching `category + scope`, updates `source_projects` list
5. If `source_projects.length >= 3`, marks as promoted
6. Writes back with atomic tmp+rename

**Project identification:** Use the project directory basename (e.g., `gsdup`) as the project ID. This matches how the dashboard identifies projects. Could also use the `name` field from `package.json` if present.

### Pattern 2: Learned Context Loading in Workflows (LOAD-01)

**What:** Each workflow command reads active preferences and relevant corrections at the start, formatting them as a compact context block.

**Where to insert:** After the `init_context` step in each workflow, before any subagent spawning or main execution begins.

**Implementation approach:**
```markdown
<step name="load_learned_context">
Read `.planning/patterns/preferences.jsonl` using the Read tool.
Read `~/.gsd/preferences.json` using the Read tool.
Read `.planning/patterns/corrections.jsonl` using the Read tool (last 20 lines).

Format as compact context block:
- Active preferences (project-level): show category, preference_text
- Active preferences (user-level): show category, preference_text, mark as "user-wide"
- Recent corrections (last 5 active): show category, correction_to

Display:
### Learned Context
| Source | Category | Preference |
|--------|----------|------------|
| project | process.convention_violation | User's manual edit preferred |
| user | code.style_mismatch | Always use const over let |

Store in context for reference during execution.

Token budget check: if total learned context exceeds adaptive_learning.token_budget.max_percent,
trim oldest preferences first, keeping corrections (higher signal).
</step>
```

**Key constraint:** This step must be lightweight. Read files once, format compactly, stay under token budget. It is NOT loading SKILL.md files (those are already loaded via the existing `.claude/skills/` mechanism) -- it is loading the learned patterns (preferences, corrections) that supplement skills.

### Pattern 3: Subagent Learned Context Inheritance (LOAD-02)

**What:** When spawning executor or verifier subagents, include learned context in the `<files_to_read>` block.

**Current state:** `execute-phase.md` already includes `.claude/skills/` in its subagent `<files_to_read>`. The enhancement adds:
```
- .planning/patterns/preferences.jsonl (Learned preferences, if exists)
- .planning/patterns/corrections.jsonl (Recent corrections, if exists -- last 20 lines)
```

**For agents:** The agent `.md` files (gsd-executor, gsd-verifier, etc.) get updated Startup sections that explicitly mention reading learned context alongside skills.

### Anti-Patterns to Avoid
- **Loading all corrections into subagent context:** Corrections can be 1000+ lines. Only load the most recent active ones (last 20 lines, ~2K tokens max). The `readCorrections()` API already supports limiting.
- **Promoting preferences without project identification:** Without tracking which projects contributed a preference, you cannot count to 3. The `source_projects` array is essential.
- **Blocking workflow execution on missing ~/.gsd/:** If the directory or preferences.json does not exist, skip silently. This is the opt-in model used everywhere else.
- **Loading user-level preferences that conflict with project-level:** Project-level preferences always take precedence. If a user-level preference contradicts a project-level one with the same category+scope, the project-level wins.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading project preferences | Custom JSONL parser | `readPreferences({ status: 'active' })` | Already handles filtering, archives |
| Reading project corrections | Custom JSONL parser | `readCorrections({ status: 'active' })` | Already handles filtering, archives, limits |
| Atomic file writes | Direct writeFileSync | tmp+rename pattern from existing modules | Crash-safe writes |
| GSD_HOME path resolution | Hardcoded `~/.gsd` | `process.env.GSD_HOME \|\| path.join(os.homedir(), '.gsd')` | Test isolation via GSD_HOME env var (established pattern from v1.1) |
| Category-to-skill mapping | Duplicated map | `CATEGORY_SKILL_MAP` from analyze-patterns.cjs | Single source of truth |

**Key insight:** The new code for PREF-03 is a single new module (`promote-preference.cjs`). The LOAD-01 and LOAD-02 work is primarily markdown editing -- adding steps to workflow files and updating agent file documentation. No new CJS modules are needed for skill loading.

## Common Pitfalls

### Pitfall 1: GSD_HOME Test Isolation
**What goes wrong:** Tests that write to `~/.gsd/preferences.json` modify the real user directory.
**Why it happens:** Hardcoding `os.homedir()` path without the `GSD_HOME` override.
**How to avoid:** Always resolve the user-level directory as `process.env.GSD_HOME || path.join(os.homedir(), '.gsd')`. Tests set `GSD_HOME` to a temp directory. This pattern is already established in `init.cjs` for `defaults.json`.
**Warning signs:** Tests passing but creating files in the real `~/.gsd/` directory.

### Pitfall 2: Project Identification Across Machines
**What goes wrong:** The same project has different directory basenames on different machines (e.g., `gsdup` vs `gsd-fork`).
**Why it happens:** Using directory basename as project ID is machine-dependent.
**How to avoid:** Accept this limitation for v6.0 scope. The basename approach is simple and matches how the dashboard identifies projects. For future: could use git remote URL or a `project_id` field in config.json.
**Warning signs:** The same project counted as different projects on different clones.

### Pitfall 3: Token Budget Overflow from Learned Context
**What goes wrong:** Loading preferences + corrections + user-level preferences exceeds the 2-5% token budget reserved for skills.
**Why it happens:** Preferences grow over time; corrections accumulate.
**How to avoid:** Cap learned context separately from skill budget. Hard limit: max 10 preferences (project + user combined), max 5 recent corrections. Format compactly (one-line per entry). Estimated cost: ~500-1000 tokens for a full load, well within 2% of 200K context.
**Warning signs:** Subagent context getting bloated with hundreds of preference entries.

### Pitfall 4: Circular Dependency in checkAndPromote
**What goes wrong:** `checkAndPromote()` in `write-preference.cjs` calls `promoteToUserLevel()` in `promote-preference.cjs`, which might need to require `write-preference.cjs`.
**Why it happens:** The promotion module might seem to need preference-reading capabilities from the existing module.
**How to avoid:** `promote-preference.cjs` reads `~/.gsd/preferences.json` directly (it is a simple JSON file, not JSONL). No need to import `write-preference.cjs`. The call direction is one-way: `write-preference.cjs` calls `promote-preference.cjs`, never the reverse.
**Warning signs:** `require()` cycle errors at module load time.

### Pitfall 5: Modifying All 6 Workflows Creates Large Diffs
**What goes wrong:** Editing 6 workflow markdown files and 5 agent files in one plan makes review difficult.
**Why it happens:** LOAD-01 and LOAD-02 touch many files.
**How to avoid:** The changes to each file are small and repetitive (adding the same "load learned context" step pattern). Group all workflow modifications into one plan, agent modifications into another, and the promote-preference.cjs library into a third.
**Warning signs:** Plans with 15+ modified files and no clear grouping.

### Pitfall 6: Missing ~/.gsd Directory
**What goes wrong:** First-time promotion fails because `~/.gsd/` directory does not exist.
**Why it happens:** `~/.gsd/` is created by other GSD commands (new-project, settings) but may not exist yet.
**How to avoid:** `promoteToUserLevel` should `mkdirSync(gsdHome, { recursive: true })` before writing. This is idempotent and matches the pattern in `init.cjs`.
**Warning signs:** ENOENT errors on first cross-project promotion.

## Code Examples

### Cross-Project Promotion Function (PREF-03)
```javascript
// promote-preference.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

function getGsdHome() {
  return process.env.GSD_HOME || path.join(os.homedir(), '.gsd');
}

function readUserPreferences() {
  const filePath = path.join(getGsdHome(), 'preferences.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(raw);
    return doc && doc.preferences ? doc : { version: '1.0', preferences: [] };
  } catch (e) {
    return { version: '1.0', preferences: [] };
  }
}

function writeUserPreferences(doc) {
  const gsdHome = getGsdHome();
  fs.mkdirSync(gsdHome, { recursive: true });
  const filePath = path.join(gsdHome, 'preferences.json');
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(doc, null, 2) + '\n');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Checks if a preference should be promoted to user-level.
 * Called after a project-level preference is written.
 *
 * @param {object} preference - { category, scope, preference_text, confidence }
 * @param {{ projectId: string }} options
 * @returns {{ promoted: boolean, reason?: string }}
 */
function promoteToUserLevel(preference, options) {
  try {
    const projectId = options.projectId;
    if (!projectId || !preference.category || !preference.scope) {
      return { promoted: false, reason: 'missing_fields' };
    }

    const doc = readUserPreferences();
    const key = preference.category + ':' + preference.scope;

    let entry = doc.preferences.find(
      p => p.category === preference.category && p.scope === preference.scope
    );

    if (!entry) {
      entry = {
        category: preference.category,
        scope: preference.scope,
        preference_text: preference.preference_text || '',
        confidence: preference.confidence || 0.5,
        source_projects: [projectId],
        promoted_at: null,
        updated_at: new Date().toISOString(),
      };
      doc.preferences.push(entry);
    } else {
      // Add project to source list if not already present
      if (!entry.source_projects.includes(projectId)) {
        entry.source_projects.push(projectId);
      }
      // Update text and confidence from latest project
      entry.preference_text = preference.preference_text || entry.preference_text;
      entry.confidence = Math.max(entry.confidence || 0, preference.confidence || 0);
      entry.updated_at = new Date().toISOString();
    }

    // Promote when 3+ projects
    if (entry.source_projects.length >= 3 && !entry.promoted_at) {
      entry.promoted_at = new Date().toISOString();
    }

    writeUserPreferences(doc);

    return {
      promoted: entry.source_projects.length >= 3,
      projectCount: entry.source_projects.length,
    };
  } catch (e) {
    return { promoted: false, reason: 'error', error: e.message };
  }
}

module.exports = { promoteToUserLevel, readUserPreferences };
```

### Wiring Promotion into checkAndPromote (PREF-03)
```javascript
// In write-preference.cjs, after successful upsertPreference():
function checkAndPromote(entry, options) {
  // ... existing logic ...
  upsertPreference(patternsDir, preference);

  // NEW: attempt cross-project promotion
  try {
    const { promoteToUserLevel } = require('./promote-preference.cjs');
    const projectId = path.basename(cwd);
    promoteToUserLevel(preference, { projectId });
  } catch (e) {
    // Silent failure -- cross-project promotion is non-critical
  }

  return { promoted: true, count, confidence: preference.confidence };
}
```

### Learned Context Loading Step for Workflows (LOAD-01)
```markdown
<!-- Insert after init_context step in each workflow -->
<step name="load_learned_context">
Read `.planning/patterns/preferences.jsonl` using the Read tool (if exists).
Read `~/.gsd/preferences.json` using the Read tool (if exists).

Parse active preferences (project-level: entries where retired_at is null).
Parse user-level preferences (entries where promoted_at is not null).

If any preferences exist, display a compact "Learned Context" section:

### Learned Context

**Active Preferences:**
| Source | Category | Guidance |
|--------|----------|----------|
| project | {category} | {preference_text, truncated to 60 chars} |
| user | {category} | {preference_text, truncated to 60 chars} |

If no preferences exist, skip this section silently.

**Conflict resolution:** If project-level and user-level have the same category+scope,
show only the project-level entry (project overrides user).

**Budget:** Maximum 10 preference rows. If more exist, show top 10 by confidence.
</step>
```

### Subagent Learned Context Inheritance (LOAD-02)
```markdown
<!-- In execute-phase.md subagent spawn prompt, add to <files_to_read>: -->
<files_to_read>
- {phase_dir}/{plan_file} (Plan)
- .planning/STATE.md (State)
- .planning/config.json (Config, if exists)
- ./CLAUDE.md (Project instructions, if exists)
- .claude/skills/ or .agents/skills/ (Project skills, if either exists)
- .planning/patterns/preferences.jsonl (Learned preferences, if exists)
</files_to_read>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Preferences project-scoped only | Cross-project promotion to `~/.gsd/preferences.json` | Phase 27 (this phase) | User-level learning persists across all projects |
| Skills loaded only by gsd-executor | All workflows and agents load learned context | Phase 27 (this phase) | Every GSD operation benefits from learned preferences |
| `skills_loaded` always empty `[]` in observations | Workflows can populate `skills_loaded` with loaded preference categories | Phase 27 (this phase) | Observability of what learned context was active |

**Current state of `~/.gsd/`:**
- `defaults.json` exists (user config defaults, created by v1.1)
- `dashboard.json` exists (dashboard server config, created by v5.0)
- `preferences.json` does NOT exist yet (created by this phase)

**Current state of workflow skill loading:**
- `execute-phase.md` passes `.claude/skills/` to subagent `<files_to_read>` -- the only workflow with explicit skill loading
- All other workflows have NO skill loading step
- All observation entries have `skills_loaded: []` (never populated)
- The `skill-integration` SKILL.md describes a 6-stage loading pipeline, but this pipeline is aspirational -- it is not implemented as code, only as instructions for Claude to follow manually

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (configured in project) |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run tests/hooks/promote-preference.test.ts --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PREF-03 | promoteToUserLevel promotes at 3+ projects | unit | `npx vitest run tests/hooks/promote-preference.test.ts --reporter=verbose` | No -- Wave 0 |
| PREF-03 | readUserPreferences returns empty doc when file missing | unit | `npx vitest run tests/hooks/promote-preference.test.ts --reporter=verbose` | No -- Wave 0 |
| PREF-03 | GSD_HOME env var overrides homedir | unit | `npx vitest run tests/hooks/promote-preference.test.ts --reporter=verbose` | No -- Wave 0 |
| PREF-03 | checkAndPromote wiring calls promoteToUserLevel | unit | `npx vitest run tests/hooks/preference-tracking.test.ts --reporter=verbose` | Yes -- needs new test case |
| LOAD-01 | Workflow files contain load_learned_context step | manual-only | N/A -- markdown workflow inspection | N/A |
| LOAD-02 | Subagent prompt includes preferences.jsonl in files_to_read | manual-only | N/A -- markdown agent inspection | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/hooks/ --reporter=verbose`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/hooks/promote-preference.test.ts` -- covers PREF-03 promotion logic (promoteToUserLevel, readUserPreferences, GSD_HOME isolation)
- [ ] New test case in `tests/hooks/preference-tracking.test.ts` -- covers checkAndPromote wiring to promoteToUserLevel

## Open Questions

1. **Should learned context loading be a code module or inline markdown instructions?**
   - What we know: All current workflow "steps" are markdown instructions that Claude follows. There is no runtime code that injects context -- Claude reads the step and performs the actions.
   - What's unclear: Whether a `load-learned-context.cjs` CLI module would be more reliable than inline markdown instructions.
   - Recommendation: Stay with markdown instructions. The loading is simple (read 1-2 files, format a table) and does not need programmatic logic. A CLI module would add complexity with no benefit. The existing pattern of "Read tool" instructions in workflows works well.

2. **Which "7 GSD workflow commands" specifically need LOAD-01?**
   - What we know: 6 workflow files currently record observations: execute-phase, plan-phase, verify-work, discuss-phase, quick, diagnose-issues. The 7th is likely research-phase (used standalone) or session-start (already loads suggestions).
   - What's unclear: Whether session-start should also load learned preferences (it already loads suggestions).
   - Recommendation: Modify all 6 observation-recording workflows + session-start (which already has a relevant Step 4 for suggestions). Session-start should display user-level preferences in its briefing. That makes 7 total.

3. **Should `promoteToUserLevel` be called synchronously inside `checkAndPromote`?**
   - What we know: `checkAndPromote` is called from PostToolUse hooks which must complete quickly.
   - What's unclear: Whether reading/writing `~/.gsd/preferences.json` adds noticeable latency.
   - Recommendation: Yes, synchronous is fine. The file is small (JSON, not JSONL), and `readFileSync` + `writeFileSync` for a file under 10KB is sub-millisecond. This matches the pattern of all other hook library operations.

## Sources

### Primary (HIGH confidence)
- Direct code reading: `write-preference.cjs` (248 lines) -- existing promotion and read APIs
- Direct code reading: `write-correction.cjs` (301 lines) -- existing correction read APIs
- Direct code reading: `analyze-patterns.cjs` (293 lines) -- CATEGORY_SKILL_MAP
- Direct code reading: `execute-phase.md` (460+ lines) -- subagent spawn pattern with `<files_to_read>`
- Direct code reading: All 6 observation-recording workflows -- observation JSON format with `skills_loaded` field
- Direct code reading: `gsd-executor.md` -- agent frontmatter with skills list
- Direct code reading: `~/.gsd/defaults.json` -- established user-level config pattern
- Direct code reading: `skill-integration/SKILL.md` and `references/loading-protocol.md` -- skill loading pipeline description
- Direct code reading: `.planning/patterns/preferences.jsonl` -- live preference data format
- Direct code reading: `.planning/REQUIREMENTS.md` -- PREF-03, LOAD-01, LOAD-02 definitions

### Secondary (MEDIUM confidence)
- Phase 26 research document -- established patterns for JSONL operations, retirement, atomic writes
- UPGRADES.md -- "all 7 workflows" reference for --milestone flag threading (confirms 7 workflow files)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use in the codebase, no new external dependencies
- Architecture: HIGH - extending existing patterns (checkAndPromote, ~/.gsd/ directory, workflow markdown steps)
- Pitfalls: HIGH - identified from direct code reading and established patterns (GSD_HOME isolation, atomic writes, token budgets)

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- internal tooling, no external dependency churn)
