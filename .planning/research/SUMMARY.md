# Project Research Summary

**Project:** GSD v6.0 Adaptive Observation & Learning Loop
**Domain:** AI coding assistant adaptive learning -- correction capture, preference extraction, feedback loops
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

GSD v6.0 is a data pipeline problem, not a technology problem. The milestone adds an adaptive learning loop that captures user corrections, extracts durable preferences from repeated corrections, and generates skill refinement suggestions -- all within the existing Claude Code hook/skill/agent architecture. The critical insight from stack research is that Claude IS the NLP engine: no external ML or NLP libraries are needed because every feature runs inside Claude Code where Claude's own reasoning handles pattern detection and semantic analysis. The stack additions are minimal: zero new npm dependencies, Node.js stdlib only for new CJS modules, JSONL file storage extended with new record types, and Markdown specs for the observer agent and learning-observer skill.

The recommended approach follows a strict dependency chain: correction capture first (the root dependency for everything else), then preference tracking, then live recall, then the observer agent and suggestion pipeline. Architecture research confirms the system integrates into four existing layers (hooks, data files, commands, agents) plus one new data layer (preferences store). All new components are either Markdown specifications or JSON/JSONL data files -- no new compiled code. The build order is data layer, capture layer, injection layer, analysis layer, presentation layer, pipeline wiring.

The dominant risks are performance-related and signal-quality-related. Hook latency from correction capture must stay under 500ms (hooks must append-only, never analyze). Context window budget blowout from loading too many corrections must be capped (hard limit of 10 corrections, share the 2-5% skill budget). False positive pattern detection from ambiguous natural language corrections must be mitigated with scope tagging and the existing 3-correction minimum guardrail. The observer agent must NOT be a full subagent spawn -- it should be a lightweight script or bounded prompt to avoid burning an entire context window on session boundary analysis.

## Key Findings

### Recommended Stack

Zero new dependencies. The entire learning pipeline builds on Node.js built-in modules (fs, path, crypto), existing JSONL file storage patterns, Claude Code hooks (PreToolUse/PostToolUse/SessionStart), Claude Code skills (auto-loading Markdown), and Claude Code agents (subagent Markdown specs). A single new CJS module (`learning.cjs` in `get-shit-done/bin/lib/`) handles all data persistence. Two new hook scripts handle real-time capture and session injection. One agent spec (observer.md) replaces the current stub. One skill spec (learning-observer/SKILL.md) teaches Claude to self-diagnose when corrected.

**Core technologies:**
- JSONL flat files: corrections, preferences, suggestions persistence -- append-only, crash-safe, established pattern
- Claude Code Hooks: real-time correction capture (PostToolUse) and session injection (SessionStart) -- no new hook types needed
- Claude Code Skills: learning-observer skill for self-diagnosis -- pure prompt engineering via structured Markdown
- Single `learning.cjs` CJS module: cohesive data pipeline (corrections feed preferences feed suggestions) -- not split across files

**Explicitly excluded:** External NLP libraries, SQLite/databases, vector databases, ESM modules, React/Vue UIs, Redis/queues, cron/scheduled tasks.

### Expected Features

**Must have (table stakes):**
- Hook-based correction capture -- foundation; every other feature depends on this
- Auto self-diagnosis on correction -- categorizes why mistakes happen (fixed taxonomy, not freeform)
- Preference tracking as durable patterns -- promotes 3+ repeated corrections to persistent preferences
- Correction recall at session start -- prevents repeating previously corrected mistakes
- Live recall within current session -- cross-references historical corrections during active work
- Observer agent implementation -- replaces stub; aggregates patterns, extracts preferences, generates suggestions
- Suggestion pipeline writer -- completes the existing dead-code `/gsd:suggest` flow
- Enhanced `/gsd:digest` with correction analysis -- makes learning progress visible

**Should have (v6.x, after validation):**
- Cross-session preference inheritance -- user-level preferences across projects
- Collaborative skill refinement via digest -- auto-proposes skill changes when corrections contradict skills
- Preference conditions/scoping -- context-aware preferences ("prefer X when in test files")

**Defer (v7+):**
- Preference analytics dashboard -- visual trends
- Team preference sharing -- multi-user workflows

### Architecture Approach

The system integrates into four existing architectural layers plus one new data layer. All communication is file-based: hooks write JSONL, commands and agents read JSONL, suggestions flow through suggestions.json. No IPC, no daemon, no background process. The correction capture hook fires on PostToolUse (Write/Edit), appends to corrections.jsonl, and exits in under 500ms. The observer agent runs on-demand (via `/gsd:digest` or session-end hook), reads accumulated data, and writes preferences and suggestions. The inject-corrections hook fires on SessionStart, reads the last 10 corrections and all active preferences, and outputs formatted text under 1000 chars.

**Major components:**
1. `correction-capture.js` (hook) -- real-time correction detection on Write/Edit, append-only to corrections.jsonl
2. `inject-corrections.js` (hook) -- loads corrections + preferences into session context at start
3. `corrections.jsonl` + `preferences.jsonl` (data) -- structured append-only stores in `.planning/patterns/`
4. `observer.md` (agent) -- session boundary analysis, preference extraction, suggestion generation
5. `self-diagnosis.md` (agent) -- root cause analysis on corrections (batch mode recommended over inline)
6. Enhanced `digest.md` + `session-start.md` (commands) -- new sections for correction analysis and recall

### Critical Pitfalls

1. **Context window budget blowout** -- Loading too many corrections burns tokens before real work begins. Hard cap at 10 corrections, relevance filtering by current phase, share the 2-5% skill budget. Measure tokens_loaded at session start.

2. **False positive pattern detection** -- One-time contextual preference misinterpreted as universal rule. Every correction must have a scope field (file/filetype/phase/project/global) defaulting to narrowest scope. Enforce 3-correction minimum strictly for scope escalation.

3. **sessions.jsonl unbounded growth** -- Append-only without rotation means grow-forever. Implement rotation at 1000 lines, archive to dated files, enforce retention_days at read time.

4. **Hook latency degrading UX** -- Correction capture must be append-only with zero analysis inline. Max 500ms. Diagnosis and pattern detection happen later in observer/digest.

5. **Observer agent context burn** -- Do NOT implement as full subagent spawn. Use lightweight script or bounded prompt (4K input, 1K output). Run async at session end, never synchronously at session start.

6. **Guardrail violations under edge cases** -- The suggestion pipeline must enforce all 6 bounded learning guardrails (20% max change, 3 corrections min, 7-day cooldown, user confirmation, permission checks, 5+ co-activations). Write unit tests for every boundary condition before implementation.

7. **Verbose/wrong self-diagnosis** -- Diagnosis must use fixed taxonomy (7 categories), max 100 tokens, with an "unknown" escape hatch. Never feed diagnosis directly into suggestion pipeline.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Layer and Correction Capture
**Rationale:** Correction capture is the root dependency -- every other v6.0 feature needs correction data to exist. The data schemas must be defined first to prevent downstream rework.
**Delivers:** corrections.jsonl schema + creation, preferences.jsonl schema + creation, config.json new keys, correction-capture.js hook, settings.json registration
**Addresses:** Hook-based correction capture (P1 table stakes), structured schema with scope tagging
**Avoids:** Hook latency (append-only constraint), false positives (scope field from day one), sessions.jsonl growth (rotation at write time)

### Phase 2: Self-Diagnosis and Preference Tracking
**Rationale:** Diagnosis enriches corrections with root cause categories, making the preference extraction step more precise. Preferences are the durable memory layer that gives the system cross-session value.
**Delivers:** self-diagnosis.md agent (batch mode), learning.cjs preference promotion logic, preferences.jsonl writer, 3-correction threshold enforcement
**Addresses:** Auto self-diagnosis (P1), preference tracking (P1)
**Avoids:** Verbose diagnosis (fixed taxonomy, 100-token cap), false positive patterns (3-correction minimum, contradiction detection)

### Phase 3: Live Recall and Session Injection
**Rationale:** Once corrections and preferences exist, they must be surfaced at session boundaries to close the learning loop. This is the phase where users first experience "Claude remembers."
**Delivers:** inject-corrections.js hook, session-start.md enhancement, within-session cross-referencing
**Addresses:** Correction recall at session start (P1), live recall within session (P1)
**Avoids:** Context window blowout (hard cap 10 corrections, 1000-char output limit, budget accounting)

### Phase 4: Observer Agent
**Rationale:** The observer replaces the stub and connects correction data to suggestion output. It depends on corrections and preferences being populated. This is the highest-complexity component.
**Delivers:** Full observer.md implementation, pattern aggregation, preference extraction automation, suggestion generation
**Addresses:** Observer agent implementation (P1), suggestion pipeline writer (P1)
**Avoids:** Observer context burn (lightweight script, not full subagent), guardrail violations (centralized enforcement function, unit tests for all boundary conditions)

### Phase 5: Enhanced Digest and Pipeline Wiring
**Rationale:** Presentation and end-to-end wiring come last because they depend on all upstream components. Digest enhancements are additive (new sections 3g, 3h) and do not change existing behavior.
**Delivers:** Enhanced digest with correction analysis (section 3g) and preference summary (section 3h), skill-integration SKILL.md updates, end-to-end pipeline verification
**Addresses:** Enhanced `/gsd:digest` (P1), collaborative skill refinement proposals (P2 stretch)
**Avoids:** Suggestion fatigue (1 notification per session, dismissed suggestions never re-suggested)

### Phase 6: Cross-Session Inheritance (Stretch)
**Rationale:** Only meaningful after the core loop is validated with real usage data. Depends on preference tracking being stable.
**Delivers:** User-level preferences at `~/.gsd/preferences.json`, cross-project promotion when preference appears in 3+ projects
**Addresses:** Cross-session preference inheritance (P2)

### Phase Ordering Rationale

- Dependency-driven: correction capture must exist before anything can read corrections. Preferences must exist before observer can aggregate them. Observer must exist before suggestions flow.
- Architecture-aligned: data layer first, then capture layer, then injection layer, then analysis layer, then presentation layer -- matches the architecture research's build order exactly.
- Risk-front-loaded: the two highest risks (hook latency, false positive patterns) are addressed in Phase 1 through schema design and hook constraints. Context window budget is addressed in Phase 3 before users encounter it.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Correction Capture):** The detection heuristic for file-based corrections (comparing recent writes) needs prototyping. STACK.md recommends skill-driven capture over hook-based NLP, but ARCHITECTURE.md describes hook-based file comparison. These two approaches need reconciliation during phase planning.
- **Phase 4 (Observer Agent):** Implementation approach (lightweight CJS script vs. bounded Claude prompt vs. subagent) must be decided early. Pitfalls research strongly warns against full subagent spawn. Needs concrete prototyping.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Self-Diagnosis):** Well-defined taxonomy, clear constraints (100 tokens, 7 categories). Standard agent spec pattern.
- **Phase 3 (Live Recall):** Extends existing session-start hook. Standard hook pattern, clear budget constraints.
- **Phase 5 (Enhanced Digest):** Additive sections to existing command. No architectural decisions needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies, all patterns verified against existing codebase. No external technology risk. |
| Features | MEDIUM | Internal architecture well-understood; feature set clear. Medium because adaptive learning loops for file-based AI coding assistants have few exact precedents -- feature prioritization based on reasoning rather than proven market patterns. |
| Architecture | HIGH | All integration points verified against existing source. Component boundaries, data flow, and hook registration formats confirmed against actual code. |
| Pitfalls | HIGH | Domain-specific analysis grounded in existing codebase constraints. Every pitfall maps to a specific phase with concrete prevention strategies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Correction detection approach:** STACK.md recommends skill-driven capture (Claude self-diagnoses before acting), while ARCHITECTURE.md describes hook-based file comparison (PostToolUse detects overwrites). These are complementary but the primary detection path needs to be chosen during Phase 1 planning. Recommendation: skill-driven as primary (higher quality signals), hook-based as backup (catches file-level overwrites the skill misses).

- **Observer implementation form factor:** Research agrees the observer should not be a full subagent but does not commit to a specific alternative. Options: (a) CJS script run as hook command, (b) bounded Claude prompt with strict token limits, (c) hybrid where a script pre-processes data and passes a summary to a bounded prompt. Decide in Phase 4 planning.

- **JSONL rotation implementation:** Identified as critical (Pitfall 3) but no existing rotation code to reference. The retention_days config exists but has no enforcement code. Phase 1 must implement rotation, but the specific trigger mechanism (write-time size check vs. session-start cleanup) needs design.

- **Guardrail enforcement centralization:** The bounded guardrails exist at two levels (skill awareness + code enforcement). The suggestion pipeline adds a third level. A single centralized guardrail-check function is recommended but not yet designed. Must be addressed in Phase 4 before suggestion generation is implemented.

## Sources

### Primary (HIGH confidence)
- Project codebase: `.claude/hooks/`, `get-shit-done/bin/lib/`, `.claude/skills/`, `.claude/agents/` -- direct inspection of existing patterns
- `.claude/skills/skill-integration/SKILL.md` -- bounded learning guardrails, observation protocol
- `.claude/skills/skill-integration/references/observation-patterns.md` -- JSONL schema, signal taxonomy
- `.claude/skills/skill-integration/references/bounded-guardrails.md` -- 6 non-negotiable constraints
- `.planning/PROJECT.md` -- v6.0 milestone requirements
- `.claude/settings.json` -- hook configuration format
- `commands/gsd/digest.md`, `commands/gsd/suggest.md`, `commands/gsd/session-start.md` -- existing command structures
- Claude Code documentation (2026) -- hook I/O protocol, skill auto-loading, agent spawning

### Secondary (MEDIUM confidence)
- Claude Code Memory System docs -- MEMORY.md structure, auto-memory behavior
- SFEIR Institute analysis -- 40% correction reduction claim from structured memory
- Windsurf/Cursor/Copilot comparisons -- Cascade Memories behavior, competitor approaches
- Algomox/Cleric agentic RCA patterns -- iterative hypothesis testing, automated feedback mechanisms

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
