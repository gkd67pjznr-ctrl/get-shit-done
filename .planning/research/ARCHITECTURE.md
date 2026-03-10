# Architecture Patterns

**Domain:** Adaptive observation and learning loop for GSD framework
**Researched:** 2026-03-10
**Confidence:** HIGH -- all integration points verified against existing source

## Recommended Architecture

The v6.0 features integrate into four existing architectural layers (hooks, data files, commands, agents) plus one new layer (preferences store). No new CJS modules are required -- all new components are either Markdown specifications (commands, agents, skills) or JSON/JSONL data files.

### Architecture Diagram

```
                        SESSION LIFECYCLE
                        =================
 SessionStart hook                               SessionEnd hook
      |                                                |
      v                                                v
 [gsd-inject-snapshot.js]                    [gsd-snapshot-session.js]
 [gsd-restore-work-state.js]                 [gsd-save-work-state.js]
 [NEW: inject-corrections.js] ----+          [NEW: capture-session-end.js]
      |                           |                    |
      | reads                     | injects            | appends
      v                           v                    v
 corrections.jsonl          Claude context       sessions.jsonl
 preferences.jsonl                               corrections.jsonl
      ^                                                ^
      |                                                |
      | writes                                    appends
      |                                                |
 [NEW: correction-capture.js]  <-- PreToolUse/PostToolUse hooks
      |
      | (on correction detection)
      |
      v
 [NEW: self-diagnosis agent] --> corrections.jsonl (root_cause field)
      |
      | (3+ corrections accumulated)
      |
      v
 [observer agent] --> suggestions.json, preference refinements
      |
      v
 [gsd:suggest] -- user reviews suggestions
 [gsd:digest]  -- enhanced with correction analysis
```

### Component Boundaries

| Component | Responsibility | Type | New/Modified | Communicates With |
|-----------|---------------|------|--------------|-------------------|
| `correction-capture.js` | Detect user corrections in real-time via tool use patterns | Hook (PostToolUse) | **NEW** | writes corrections.jsonl |
| `inject-corrections.js` | Load recent corrections into session context at start | Hook (SessionStart) | **NEW** | reads corrections.jsonl, preferences.jsonl |
| `capture-session-end.js` | Aggregate session correction stats on exit | Hook (SessionEnd) | **NEW** | reads/appends corrections.jsonl |
| `corrections.jsonl` | Append-only correction event log | Data file | **NEW** | read by observer, digest, inject |
| `preferences.jsonl` | Durable preference entries with evidence chains | Data file | **NEW** | read by inject hook, observer, digest |
| `self-diagnosis.md` | Auto-analyze root cause when correction detected | Agent | **NEW** | reads correction context, writes root_cause to corrections.jsonl |
| `observer.md` | Session boundary analysis, pattern aggregation, preference extraction | Agent | **MODIFIED** (currently stub) | reads corrections.jsonl, sessions.jsonl; writes suggestions.json, preferences.jsonl |
| `suggest.md` | Review suggestions interactively | Command | **MODIFIED** | reads suggestions.json (unchanged API, enhanced with correction-sourced suggestions) |
| `digest.md` | Learning digest with correction analysis | Command | **MODIFIED** | reads corrections.jsonl (new section), preferences.jsonl (new section) |
| `session-start.md` | Session briefing | Command | **MODIFIED** | reads corrections.jsonl (new "Recent Corrections" section) |
| `skill-integration/SKILL.md` | Skill loading and observation protocol | Skill | **MODIFIED** | updated observation taxonomy to reference corrections.jsonl |
| `settings.json` | Hook registration | Config | **MODIFIED** | new hook entries added |
| `config.json` | Adaptive learning settings | Config | **MODIFIED** | new keys under adaptive_learning |

### Data Flow

**Correction Capture Flow (real-time, within session):**

1. User makes a request, Claude produces output
2. User says "no, use X instead of Y" or edits/overwrites Claude's output
3. `correction-capture.js` (PostToolUse on Write/Edit) detects the overwrite pattern:
   - Compares tool input against recent Claude outputs
   - Heuristic: if a Write targets a file Claude wrote in the last N tool calls, and the content differs significantly, flag as correction
4. Appends correction entry to `.planning/patterns/corrections.jsonl`
5. Optionally spawns `self-diagnosis` agent inline for root cause analysis (gated by config)

**Preference Learning Flow (session boundary):**

1. Observer agent runs at session end (or on-demand via `/gsd:digest`)
2. Reads `corrections.jsonl` -- groups by category (formatting, naming, architecture, testing, etc.)
3. When 3+ corrections share a theme, extracts a preference
4. Writes preference to `preferences.jsonl` with evidence chain (correction IDs)
5. Existing preferences are refined (occurrence count incremented) rather than duplicated

**Live Recall Flow (session start):**

1. `inject-corrections.js` SessionStart hook fires
2. Reads last N corrections from `corrections.jsonl` (configurable, default: 10)
3. Reads all preferences from `preferences.jsonl`
4. Outputs formatted context to stdout (Claude Code injects into session)
5. Format: "Previous corrections: [list]. Learned preferences: [list]."

**Suggestion Pipeline Flow (observer to suggest):**

1. Observer agent aggregates corrections + sessions data
2. Groups patterns by theme, counts occurrences
3. When threshold met (min_occurrences from config), creates suggestion entry
4. Writes to `suggestions.json` (existing file, same schema)
5. User reviews via `/gsd:suggest` (existing command, no change needed)

## New Components: Detailed Specifications

### 1. corrections.jsonl (Data File)

**Location:** `.planning/patterns/corrections.jsonl`
**Format:** Append-only JSONL, same conventions as sessions.jsonl

```json
{
  "id": "corr-20260310T143000-001",
  "timestamp": "2026-03-10T14:30:00Z",
  "session_id": "string",
  "type": "correction",
  "category": "naming|formatting|architecture|testing|logic|style|other",
  "what_claude_did": "Used camelCase for the function name",
  "what_user_wanted": "Use snake_case consistent with existing codebase",
  "file_path": "src/utils/helpers.cjs",
  "tool_context": {
    "tool": "Write",
    "preceding_tools": ["Read", "Grep"]
  },
  "root_cause": null,
  "root_cause_analyzed": false,
  "preference_id": null,
  "phase": 22,
  "milestone": "v6.0"
}
```

**Why JSONL and not JSON array:** Same rationale as sessions.jsonl -- append-only is crash-safe, no read-modify-write races, works with concurrent sessions.

### 2. preferences.jsonl (Data File)

**Location:** `.planning/patterns/preferences.jsonl`
**Format:** JSONL, one preference per line. Updated by observer agent (read-scan-append or read-scan-rewrite for refinement).

```json
{
  "id": "pref-snake-case-functions",
  "category": "naming",
  "description": "Use snake_case for function names, not camelCase",
  "strength": "strong",
  "occurrences": 5,
  "first_seen": "2026-03-01T10:00:00Z",
  "last_seen": "2026-03-10T14:30:00Z",
  "evidence": ["corr-20260301-001", "corr-20260305-003", "corr-20260310-001"],
  "active": true
}
```

**Why JSONL and not JSON:** Preferences are few (tens, not hundreds) but need the same crash-safety as corrections. Rewrite-on-update is acceptable for small files. Observer reads all lines, deduplicates by id, writes back.

**Why not store in config.json:** Preferences accumulate over time and have evidence chains. Config.json is for settings, not data. Keeping them separate follows the existing pattern (sessions.jsonl, suggestions.json are in patterns/, not config.json).

### 3. correction-capture.js (Hook)

**Location:** `.claude/hooks/correction-capture.js`
**Trigger:** PostToolUse on Write and Edit tools
**Hook type:** `command` (same as existing hooks)

**Detection heuristics:**

The hook receives the tool input (file path, content) via stdin JSON. It cannot see the full conversation, but it can:

1. **File-based detection:** Maintain a lightweight state file (`.planning/patterns/.correction-state.json`) tracking files Claude wrote in this session. When a Write targets a file Claude already wrote to in the same session, compare the new content. If significantly different and the time gap is short (<2 minutes), flag as potential correction.

2. **Edit-based detection:** When an Edit tool modifies a file Claude recently wrote, the edit itself is the correction signal. Log the old/new content diff.

3. **Limitations:** The hook cannot detect conversational corrections ("no, do it this way") -- only file-level overwrites. Conversational correction detection requires the observer agent analyzing session transcripts, not a hook.

**Registration in settings.json:**

```json
{
  "matcher": "Write",
  "hooks": [
    {
      "type": "command",
      "command": "node .claude/hooks/correction-capture.js"
    }
  ]
}
```

Also register for Edit matcher.

**Critical constraint:** Must be fast (<500ms). Write to `.correction-state.json` synchronously. Append to `corrections.jsonl` only on detection. Never block the tool use.

### 4. inject-corrections.js (Hook)

**Location:** `.claude/hooks/inject-corrections.js`
**Trigger:** SessionStart
**Output:** Formatted text to stdout (injected into Claude's context)

```javascript
// Pseudocode
const corrections = readLastN('corrections.jsonl', 10);
const preferences = readAll('preferences.jsonl').filter(p => p.active);

let output = '';
if (preferences.length > 0) {
  output += '## Learned Preferences\n';
  preferences.forEach(p => {
    output += `- ${p.description} (${p.occurrences} observations)\n`;
  });
}
if (corrections.length > 0) {
  output += '\n## Recent Corrections\n';
  corrections.forEach(c => {
    output += `- ${c.category}: ${c.what_user_wanted} (not: ${c.what_claude_did})\n`;
  });
}
process.stdout.write(output);
```

**Critical:** Keep output under 1000 chars. Preferences are the high-value signal (condensed from many corrections). Recent corrections provide recency. Truncate aggressively.

### 5. self-diagnosis.md (Agent)

**Location:** `.claude/agents/self-diagnosis.md`
**Purpose:** When a correction is captured, analyze why Claude made the mistake
**Model:** haiku (fast, cheap -- this runs frequently)
**Tools:** Read only

```markdown
---
name: self-diagnosis
description: Analyze root cause of a correction to prevent recurrence
tools:
  - Read
model: haiku
---

# Self-Diagnosis Agent

Given a correction entry, determine the root cause category:

1. **missing_context** -- Claude didn't read relevant files/docs
2. **pattern_mismatch** -- Claude used a different pattern than the codebase
3. **stale_knowledge** -- Claude relied on training data, not current state
4. **ambiguous_instruction** -- The user's request was unclear
5. **preference_unknown** -- Claude didn't know the user's preference
6. **tool_misuse** -- Wrong tool or wrong tool arguments
7. **other** -- None of the above

Read the file at the correction's file_path. Check surrounding code patterns.
Output a single JSON object: {"root_cause": "category", "explanation": "one sentence"}
```

**Invocation:** The correction-capture hook can optionally spawn this agent. Gated by `adaptive_learning.observation.auto_diagnose` config flag (default: false -- too expensive to run on every correction initially).

**Alternative:** Run diagnosis in batch during observer agent execution (cheaper, deferred). Recommend this as the default path.

### 6. observer.md (Agent -- Modified)

**Location:** `.claude/agents/observer.md` (replace current stub)
**Purpose:** Session boundary analysis, pattern aggregation, preference extraction, suggestion generation
**Model:** sonnet (needs analytical capability)
**Trigger:** On-demand via `/gsd:digest`, or spawned by session-end hook

The observer replaces the current stub with a full implementation:

```markdown
---
name: observer
description: Analyze session data, extract preferences, generate suggestions
tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
model: sonnet
---

# Observer Agent

You are the GSD learning loop observer. Your job is to:

1. Read corrections.jsonl and sessions.jsonl
2. Group corrections by category
3. Extract preferences from recurring corrections (3+ same theme)
4. Generate skill suggestions from recurring patterns
5. Write results to preferences.jsonl and suggestions.json

## Analysis Protocol

1. Load all corrections since last observer run
2. Group by category (naming, formatting, architecture, etc.)
3. For each group with 3+ entries:
   a. Check if preference already exists in preferences.jsonl
   b. If yes: increment occurrences, update last_seen, add evidence
   c. If no: create new preference entry
4. For patterns that could become skills:
   a. Check suggestions.json for existing suggestion
   b. If yes: increment occurrences
   c. If no: create new pending suggestion
5. Record observer run timestamp to scan-state.json
```

## Existing Components: Required Modifications

### settings.json (Hook Registration)

Add three new hook entries:

```json
{
  "SessionStart": [
    // ... existing entries ...
    {
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/inject-corrections.js"
        }
      ]
    }
  ],
  "PostToolUse": [
    // ... existing phase-boundary-check entry ...
    {
      "matcher": "Write",
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/correction-capture.js"
        }
      ]
    },
    {
      "matcher": "Edit",
      "hooks": [
        {
          "type": "command",
          "command": "node .claude/hooks/correction-capture.js"
        }
      ]
    }
  ]
}
```

**Note:** The existing PostToolUse Write matcher for phase-boundary-check.sh already fires on Write. The new correction-capture.js will be a second hook on the same matcher. Claude Code supports multiple hooks per matcher -- they run in order.

### config.json (New Keys)

Add under `adaptive_learning`:

```json
{
  "adaptive_learning": {
    "observation": {
      "retention_days": 30,
      "auto_diagnose": false,
      "correction_capture": true
    },
    "suggestions": {
      "min_occurrences": 3
    },
    "preferences": {
      "max_inject_count": 15,
      "correction_lookback": 10
    },
    "integration": {
      "auto_load_skills": true,
      "observe_sessions": true,
      "phase_transition_hooks": true,
      "suggest_on_session_start": true
    },
    "token_budget": {
      "max_percent": 5,
      "warn_at_percent": 4
    }
  }
}
```

New keys: `observation.auto_diagnose`, `observation.correction_capture`, `preferences.max_inject_count`, `preferences.correction_lookback`. All other keys already exist.

### digest.md (Command -- Enhanced)

Add two new analysis sections after existing step 3f:

**3g. Correction Analysis:**
- Read `corrections.jsonl`
- Group by category, show distribution
- Highlight categories with highest frequency
- Show correction rate over time (are corrections decreasing?)

**3h. Preference Summary:**
- Read `preferences.jsonl`
- Show active preferences with strength and evidence count
- Highlight recently added preferences

### session-start.md (Command -- Enhanced)

The inject-corrections.js hook handles the context injection. The command itself needs one new section:

**Step 2.5: Correction Context:**
- Read last 5 corrections from `corrections.jsonl`
- Display as compact table between GSD Position and Recent Activity
- Show total correction count and trend

### skill-integration/SKILL.md (Skill -- Updated)

Update the observation taxonomy table to include corrections as a first-class signal:

```markdown
| Signal | Strength | Source |
|--------|----------|--------|
| User corrects output | HIGHEST | corrections.jsonl |
| Learned preference violated | HIGH | preferences.jsonl + corrections.jsonl |
| Repeated tool sequence | HIGH | sessions.jsonl |
| File touch patterns | MEDIUM | sessions.jsonl |
```

## Patterns to Follow

### Pattern 1: Append-Only Data Files
**What:** All observation data uses JSONL with append-only writes
**When:** Any new data capture component
**Why:** Crash-safe, no read-modify-write races, works with concurrent sessions
**Example:** `corrections.jsonl` follows the same pattern as `sessions.jsonl`

### Pattern 2: Silent Hook Failures
**What:** All hooks wrap in try/catch with silent exit on error
**When:** Any new hook
**Why:** Hooks must never block Claude's tool use or session lifecycle
**Example:**
```javascript
try {
  // detection logic
} catch (e) {
  // Silent failure -- never block tool use
}
```

### Pattern 3: Config-Gated Features
**What:** New features are toggleable via `adaptive_learning` config keys
**When:** Any new behavior that adds overhead or changes existing behavior
**Why:** Users can opt out without uninstalling; follows the quality.level precedent
**Example:** `correction_capture: true` in config gates the correction-capture hook

### Pattern 4: Data in patterns/, Settings in config.json
**What:** Accumulated data goes in `.planning/patterns/`, behavior settings go in `.planning/config.json`
**When:** Deciding where to store new state
**Why:** `patterns/` is gitignored (per-developer data), config.json is project-level settings

### Pattern 5: Markdown Agent Specifications
**What:** Agents are .md files with YAML frontmatter declaring tools and model
**When:** Any new agent
**Why:** Consistent with existing gsd-executor.md, gsd-verifier.md, gsd-planner.md pattern

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking Hooks for ML-Heavy Operations
**What:** Running pattern analysis, LLM inference, or batch processing inside a PreToolUse/PostToolUse hook
**Why bad:** Hook latency directly impacts user experience. A 2-second hook adds 2 seconds to every Write operation
**Instead:** Capture data fast in hooks (append to JSONL), run analysis in batch (observer agent, /gsd:digest)

### Anti-Pattern 2: Storing Preferences in config.json
**What:** Adding learned preferences to the config file
**Why bad:** Config is for settings, not accumulated data. Preferences grow over time, have evidence chains, and are per-developer. Config.json is version-controlled in many projects
**Instead:** Use preferences.jsonl in patterns/ directory (gitignored)

### Anti-Pattern 3: Full Conversation Analysis in Hooks
**What:** Trying to parse the entire conversation to detect corrections
**Why bad:** Hooks receive only tool input/output, not conversation history. Attempting to reconstruct conversation context from hooks is fragile and expensive
**Instead:** File-based correction detection in hooks (fast, reliable). Conversation-level analysis in observer agent (has full session context when spawned)

### Anti-Pattern 4: Monolithic Observer
**What:** Single observer run that does everything -- correction analysis, preference extraction, suggestion generation, digest, skill refinement
**Why bad:** Too expensive for routine runs, context overload, hard to test
**Instead:** Observer does three focused tasks: (1) group corrections, (2) extract preferences, (3) generate suggestions. Digest command handles presentation separately.

### Anti-Pattern 5: Writing corrections.jsonl from Workflow Commands
**What:** Adding correction capture logic to execute-plan.md, verify-work.md, etc.
**Why bad:** Workflow commands already have observation steps that write to sessions.jsonl. Adding correction logic would bloat every workflow and create maintenance burden across 7 files
**Instead:** Use a single PostToolUse hook that captures corrections regardless of which workflow (or non-workflow) context is active

## Build Order (Dependency-Driven)

The components have clear dependencies that dictate build order:

```
Phase 1: Data Layer (no dependencies)
  corrections.jsonl schema + creation
  preferences.jsonl schema + creation
  config.json new keys

Phase 2: Capture Layer (depends on Phase 1)
  correction-capture.js hook
  settings.json registration
  .correction-state.json tracking

Phase 3: Injection Layer (depends on Phase 1)
  inject-corrections.js hook
  settings.json registration

Phase 4: Analysis Layer (depends on Phases 1-2)
  self-diagnosis.md agent
  observer.md full implementation

Phase 5: Presentation Layer (depends on Phases 1-4)
  digest.md enhanced sections
  session-start.md new section
  skill-integration/SKILL.md updates

Phase 6: Pipeline Wiring (depends on Phase 4)
  observer -> suggestions.json writer
  suggestion pipeline end-to-end test
```

**Rationale:** Data files first because everything else reads/writes them. Capture before injection because you need data before you can inject it. Analysis before presentation because digest needs observer output. Pipeline wiring last because it connects everything end-to-end.

## Scalability Considerations

| Concern | At 100 corrections | At 1K corrections | At 10K corrections |
|---------|--------------------|--------------------|---------------------|
| corrections.jsonl size | ~50KB, negligible | ~500KB, fast reads | ~5MB, needs tail-based reading |
| inject-corrections.js | Read last 10, <10ms | Read last 10, <10ms | Read last 10, need `tail` not full read |
| Observer analysis | Full scan, <1s | Full scan, <5s | Needs windowed analysis (last 30 days) |
| preferences.jsonl | ~5 entries, trivial | ~50 entries, trivial | ~200 entries, still small |
| Correction-capture hook | <100ms per Write | <100ms per Write | <100ms per Write (stateless per-call) |

**Mitigation for 10K+ corrections:** The `retention_days` config (default: 30) provides natural pruning. Observer agent should process and archive old entries. The inject hook always reads from the tail, so file size doesn't affect session start latency.

## Integration Risk Assessment

| Integration Point | Risk Level | Reason | Mitigation |
|-------------------|------------|--------|------------|
| PostToolUse hook latency | **MEDIUM** | Every Write/Edit triggers correction-capture.js | Profile early; exit fast when no correction detected |
| Hook ordering with phase-boundary-check | **LOW** | Both fire on Write PostToolUse | Independent -- no ordering dependency |
| SessionStart context budget | **MEDIUM** | inject-corrections.js adds to context window | Hard cap output at 1000 chars; truncate aggressively |
| Observer agent context cost | **LOW** | Runs on-demand, not in hot path | Uses sonnet, not opus; focused scope |
| Self-diagnosis agent cost | **MEDIUM** | Could fire on every correction | Gated by config (default: off); batch mode recommended |
| suggestions.json schema compatibility | **LOW** | Observer writes same schema that suggest.md reads | Existing schema is flexible enough |

## Sources

- `.claude/settings.json` -- hook registration format and existing patterns (verified)
- `.claude/hooks/*.js` -- existing hook implementation patterns (verified)
- `.claude/agents/*.md` -- agent specification format (verified)
- `.planning/patterns/sessions.jsonl` -- existing JSONL schema (verified)
- `.planning/patterns/README.md` -- patterns directory documentation (verified)
- `commands/gsd/suggest.md` -- existing suggestion review command (verified)
- `commands/gsd/digest.md` -- existing digest command (verified)
- `commands/gsd/session-start.md` -- existing session briefing (verified)
- `.claude/skills/skill-integration/references/observation-patterns.md` -- observation taxonomy (verified)
- `.planning/config.json` schema via `tests/foundation.test.cjs` -- adaptive_learning structure (verified)
