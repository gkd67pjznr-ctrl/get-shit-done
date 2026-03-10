# Stack Research

**Domain:** Adaptive observation and learning loop for Claude Code agent framework (GSD v6.0)
**Researched:** 2026-03-10
**Confidence:** HIGH

---

## Executive Summary

The v6.0 milestone needs correction capture, preference learning, pattern detection, live context injection, and suggestion generation. The critical insight: **Claude IS the NLP engine.** Every feature in this milestone runs inside Claude Code, where Claude's own reasoning performs the "NLP" -- pattern detection, semantic analysis, root cause diagnosis. No external NLP/ML libraries are needed or appropriate.

The stack additions are minimal and deliberate:
- **Zero new npm dependencies** for the core learning pipeline
- **Node.js stdlib only** (fs, path, crypto) for hook scripts and data modules
- **JSONL file storage** extended with new record types (corrections, preferences, suggestions)
- **Markdown agent specs** for the observer agent
- **Existing Claude Code hooks system** for real-time capture

This is a data pipeline problem, not a technology problem. The existing patterns (JSONL append, CJS modules, hook scripts, agent Markdown) are the right tools.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js CJS modules | Node 18+ (existing) | Hook scripts, data read/write, CLI commands | Already the standard for all GSD modules. CJS required for consistency with core.cjs, phase.cjs, etc. No ESM migration needed or wanted. |
| JSONL file storage | N/A (file format) | Corrections, preferences, suggestions persistence | Existing pattern (sessions.jsonl). Append-only, line-delimited JSON. No database needed -- files are small (hundreds of entries per project, not millions). `fs.appendFileSync` gives atomic single-line writes. |
| Claude Code Hooks | Current (2026) | Real-time correction capture, session boundary events | PreToolUse/PostToolUse hooks already wired. Need new hooks for correction detection (PostToolUse on Edit/Write after user message containing correction signals). SessionStart for live recall injection. |
| Claude Code Skills (SKILL.md) | Current (2026) | Preference-aware behavior, correction avoidance | Auto-loading Markdown specifications. Observer skill loads correction history and preferences into Claude's context. No code execution -- pure prompt engineering via structured Markdown. |
| Claude Code Agents (subagent) | Current (2026) | Observer agent for session boundary analysis, pattern aggregation | Spawned as subagent with fresh context. Reads JSONL data, produces suggestions. Markdown spec, no compiled code. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` | Built-in | JSONL read/write, config updates | All data persistence -- corrections.jsonl, preferences.jsonl, suggestions.jsonl |
| `node:path` | Built-in | Path resolution for .planning/patterns/ | Resolving data file paths relative to project root |
| `node:crypto` | Built-in | UUID generation for correction/preference IDs | `crypto.randomUUID()` for unique record identifiers (Node 19+, or `crypto.randomBytes(16).toString('hex')` for Node 18) |

### Data Files (New)

| File | Location | Format | Purpose |
|------|----------|--------|---------|
| `corrections.jsonl` | `.planning/patterns/` | JSONL | Captured corrections with root cause analysis |
| `preferences.jsonl` | `.planning/patterns/` | JSONL | Extracted user preferences as durable patterns |
| `suggestions.jsonl` | `.planning/patterns/` | JSONL | Generated skill refinement candidates |
| `sessions.jsonl` | `.planning/patterns/` (existing) | JSONL | Extended with correction-type entries |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest (existing) | Unit tests for new CJS modules | Already configured. Test the data modules (correction capture, preference extraction, suggestion generation) |
| Node.js built-in test runner (existing) | CJS module tests | `node --test tests/*.test.cjs` for new learning pipeline modules |

---

## New Module Architecture

### What to Build (CJS modules in `get-shit-done/bin/lib/`)

| Module | Responsibility | Depends On |
|--------|---------------|------------|
| `learning.cjs` | Core learning pipeline: write corrections, read corrections, write preferences, read preferences, write suggestions, read suggestions | `node:fs`, `node:path`, `node:crypto`, `core.cjs` (for `planningRoot`) |

**Single module, not five.** The learning pipeline is cohesive -- corrections feed preferences which feed suggestions. Splitting into separate files adds import overhead and cross-module coordination for no benefit. One module with clearly separated sections (like `debt.cjs` handles log/list/resolve).

### What to Build (Hook scripts in `.claude/hooks/`)

| Hook | Trigger | Purpose |
|------|---------|---------|
| `gsd-capture-correction.js` | PostToolUse (Edit, Write) | Detects when Claude re-does work after user correction. Writes to corrections.jsonl. |
| `gsd-inject-learning.js` | SessionStart | Injects recent corrections and active preferences into session context. Replaces or augments `gsd-inject-snapshot.js`. |

### What to Build (Agent specs in `.claude/agents/`)

| Agent | Trigger | Purpose |
|-------|---------|---------|
| `observer.md` | SessionEnd hook or `/gsd:digest` command | Reads corrections.jsonl + sessions.jsonl, detects patterns, generates suggestions.jsonl entries, proposes preference extractions |

### What to Build (Skill specs in `.claude/skills/`)

| Skill | Purpose |
|-------|---------|
| `learning-observer/SKILL.md` | Teaches Claude to self-diagnose when corrected. Provides the "pause and analyze" protocol -- what went wrong, why, what preference to extract. |

---

## Schema Designs

### corrections.jsonl Record

```json
{
  "id": "corr-<uuid>",
  "timestamp": "ISO-8601",
  "session_id": "string",
  "type": "correction",
  "trigger": "user_message",
  "user_said": "string -- the corrective message",
  "what_claude_did": "string -- the action that was wrong",
  "what_was_wanted": "string -- the correct action",
  "root_cause": "string -- why Claude made the mistake",
  "category": "style|naming|architecture|testing|workflow|tool_choice|other",
  "related_files": ["string -- files involved"],
  "preference_extracted": "pref-<uuid> | null"
}
```

### preferences.jsonl Record

```json
{
  "id": "pref-<uuid>",
  "timestamp": "ISO-8601",
  "source_corrections": ["corr-<uuid>"],
  "pattern": "string -- the preference as a reusable rule",
  "category": "style|naming|architecture|testing|workflow|tool_choice|other",
  "confidence": "low|medium|high",
  "occurrence_count": 1,
  "last_seen": "ISO-8601",
  "active": true
}
```

### suggestions.jsonl Record

```json
{
  "id": "sug-<uuid>",
  "timestamp": "ISO-8601",
  "type": "skill_refinement|new_skill|preference_promotion|anti_pattern",
  "title": "string -- short description",
  "rationale": "string -- why this suggestion",
  "source_corrections": ["corr-<uuid>"],
  "source_preferences": ["pref-<uuid>"],
  "confidence": "low|medium|high",
  "status": "pending|accepted|rejected|expired",
  "target_skill": "string | null -- skill to refine, if applicable"
}
```

---

## Correction Detection Strategy

**How hooks detect corrections (no NLP library needed):**

The PostToolUse hook does NOT do NLP. It does simple structural detection:

1. **Hook receives tool call context** -- the tool name, parameters, and result
2. **Hook checks a flag file** (`.planning/patterns/.correction-pending`) that gets written by a PreToolUse hook when it detects the user's message contains correction signals
3. **Correction signal detection** is done by Claude itself via the learning-observer skill, NOT by the hook script

The flow:
```
User says "no, use X instead"
  -> Claude reads learning-observer SKILL.md (auto-loaded)
  -> Skill instructs Claude to self-diagnose before acting
  -> Claude writes correction record via learning.cjs API
  -> Claude then performs the corrected action
```

**Why this beats hook-based NLP:**
- Claude has full conversational context; a hook script only sees one tool call
- Claude understands nuance ("actually, let's try..." vs "no, that's wrong")
- No regex/keyword matching that produces false positives
- The skill approach means Claude captures corrections BEFORE acting, not after

---

## Installation

```bash
# No new npm dependencies required.
# All new code uses Node.js built-in modules only.

# New files to create:
# get-shit-done/bin/lib/learning.cjs     -- data persistence module
# .claude/hooks/gsd-capture-correction.js -- PostToolUse correction capture
# .claude/hooks/gsd-inject-learning.js    -- SessionStart context injection
# .claude/agents/observer.md              -- observer agent spec
# .claude/skills/learning-observer/SKILL.md -- self-diagnosis skill
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| JSONL flat files | SQLite via `better-sqlite3` | Overkill. Correction data is small (hundreds of records per project). JSONL is already the established pattern. SQLite adds a native dependency (build issues on some platforms), requires schema migrations, and doesn't improve query performance at this scale. |
| Claude-as-NLP (skill-driven) | `compromise` or `natural` NLP libraries | Wrong abstraction. Claude already understands natural language. Adding an NLP library to detect corrections in user messages is like adding a calculator to a supercomputer. The library would do keyword matching; Claude understands intent. |
| Single `learning.cjs` module | Separate `corrections.cjs`, `preferences.cjs`, `suggestions.cjs` | Over-modularization. The learning pipeline is tightly coupled -- corrections feed preferences which feed suggestions. Three modules means three sets of imports, three test files, cross-module dependencies. One module with clear sections is simpler. |
| Skill-driven self-diagnosis | Hook-based regex correction detection | Hooks only see tool call parameters, not conversation context. A hook can't distinguish "actually, use tabs" (correction) from "use tabs in the config" (instruction). Claude with the learning-observer skill has full conversation context. |
| `.planning/patterns/` directory | New `.planning/learning/` directory | Patterns directory already exists and is in `.gitignore`. Adding a new directory fragments the data and requires updating gitignore, dashboard aggregation, etc. |
| Append-only JSONL | Mutable JSON files | Append-only prevents data loss from concurrent writes, partial writes, or corruption. JSONL survives crashes mid-write (at most one line lost). Mutable JSON can be fully corrupted by a partial write. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| External NLP libraries (`natural`, `compromise`, `wink-nlp`) | Claude IS the language model. Adding NLP to detect patterns in user messages is redundant -- Claude already parses and understands the messages. These libraries do token-level analysis; Claude does semantic understanding. | Claude's own reasoning via the learning-observer skill |
| SQLite / LevelDB / any database | Data volume is tiny (hundreds of records). Database adds native dependency compilation, schema migrations, and operational complexity for zero performance benefit. | JSONL flat files with `fs.appendFileSync` |
| Vector databases (ChromaDB, Pinecone) | Embedding-based similarity search is unnecessary. Corrections and preferences are structured records with explicit categories, not unstructured text requiring semantic search. | Category-based filtering on JSONL records |
| ESM modules for new code | Core GSD modules are CJS. Mixing module systems creates `require`/`import` interop pain, especially in hook scripts which must be self-contained. | CJS (`module.exports`, `require()`) consistent with existing modules |
| React/Vue for suggestion UI | Suggestions are reviewed via CLI commands (`/gsd:suggest`), not a web UI. Building a frontend for this is over-engineering. | Markdown output from CLI commands, displayed in Claude Code conversation |
| Redis/message queues | No inter-process communication needed. Hooks write files; skills read files. The "pipeline" is a series of file reads within a single Claude Code session. | Direct file I/O |
| `node-cron` / scheduled tasks | No daemon process. Analysis runs at session boundaries (SessionStart/SessionEnd hooks) and on-demand (`/gsd:digest`). | Hook-triggered and command-triggered execution |

---

## Integration Points

### With Existing Systems

| System | Integration | How |
|--------|------------|-----|
| `sessions.jsonl` (existing) | Corrections also written to sessions.jsonl as type "correction" | Dual-write: full record to corrections.jsonl, summary to sessions.jsonl for backward compatibility |
| `config.json` adaptive_learning section | Learning pipeline config (capture enabled, categories, thresholds) | Read via existing `loadConfig()` pattern in core.cjs |
| `/gsd:digest` command (existing) | Enhanced with correction analysis | Observer agent reads corrections.jsonl alongside sessions.jsonl |
| `/gsd:suggest` command (existing) | Reads from suggestions.jsonl | Currently has no writer; learning.cjs provides the writer |
| Dashboard server (server.cjs) | Pattern aggregation reads corrections.jsonl | Extend existing `aggregatePatterns()` to include correction records |
| Bounded learning guardrails | Suggestion generation respects 3-correction minimum, 7-day cooldown | learning.cjs enforces thresholds before writing suggestions |

### With Claude Code Hook System

| Hook Point | Current Use | v6.0 Addition |
|------------|------------|---------------|
| SessionStart | Restore work state, inject snapshot, session state | Add: inject recent corrections + active preferences |
| SessionEnd | Save work state, snapshot session | Add: trigger observer agent for pattern analysis |
| PreToolUse (Bash) | Validate commit messages | No change needed |
| PostToolUse (Write) | Phase boundary check | No change needed -- correction capture handled by skill, not hook |

---

## Version Compatibility

| Component | Required Version | Notes |
|-----------|-----------------|-------|
| Node.js | 18+ (existing requirement) | `crypto.randomUUID()` available in Node 19+. For Node 18, use `crypto.randomBytes(16).toString('hex')`. |
| Claude Code Hooks | 2026 current | SessionStart, SessionEnd, PreToolUse, PostToolUse all used. No new hook types needed. |
| Claude Code Skills | 2026 current | SKILL.md auto-loading. learning-observer skill uses standard frontmatter format. |
| GSD config.json | v4.0+ format | `adaptive_learning` key already exists from v4.0 migration. Extend with `learning_pipeline` sub-key. |

---

## Config Extension

```json
{
  "adaptive_learning": {
    "learning_pipeline": {
      "capture_corrections": true,
      "extract_preferences": true,
      "generate_suggestions": true,
      "min_corrections_for_preference": 3,
      "min_corrections_for_suggestion": 3,
      "suggestion_cooldown_days": 7,
      "max_context_injection_entries": 10,
      "categories": ["style", "naming", "architecture", "testing", "workflow", "tool_choice"]
    }
  }
}
```

---

## Sources

- Project codebase analysis: `.claude/hooks/`, `get-shit-done/bin/lib/`, `.claude/skills/` -- direct inspection of existing patterns
- `.claude/skills/skill-integration/SKILL.md` -- current skill integration protocol
- `.claude/skills/skill-integration/references/observation-patterns.md` -- JSONL schema and signal strength taxonomy
- `.claude/skills/skill-integration/references/bounded-guardrails.md` -- non-negotiable learning constraints
- `.claude/settings.json` -- current hook configuration
- `.planning/PROJECT.md` -- v6.0 milestone requirements
- Claude Code documentation (2026) -- hook I/O protocol, skill auto-loading, agent spawning

---
*Stack research for: GSD v6.0 Adaptive Observation & Learning Loop*
*Researched: 2026-03-10*
