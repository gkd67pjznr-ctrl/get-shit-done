# Pitfalls Research

**Domain:** Adaptive observation, correction capture, preference learning, and feedback loops for an AI coding assistant framework (v6.0)
**Researched:** 2026-03-10
**Confidence:** HIGH (domain-specific analysis grounded in existing codebase and architectural constraints)

## Critical Pitfalls

### Pitfall 1: Context Window Budget Blowout from Correction History

**What goes wrong:**
Live recall loads too many past corrections into the execution context at session start or during task execution. Each correction entry includes `correction_from`, `correction_to`, context fields, and timestamps. Loading 50+ corrections at session start burns 5-15K tokens before any real work begins. Combined with skill loading (2-5% budget), STATE.md, ROADMAP.md, and the actual task -- the context window is half consumed before the first line of code.

**Why it happens:**
The naive approach is "load all corrections so Claude never repeats a mistake." This feels safe and comprehensive. Developers building recall systems tend to err on the side of "more context is better" without measuring the token cost. The existing observation schema (observation-patterns.md) already has 5 fields per entry -- correction entries will be larger with `correction_from` and `correction_to` fields containing actual code snippets.

**How to avoid:**
- Hard cap: maximum 10 corrections loaded into context at any time (approximately 2-3K tokens)
- Relevance filtering: only load corrections matching the current phase topic, file patterns, or commit type -- not all corrections ever recorded
- Summarization layer: after 30 days, compress raw corrections into terse preference rules ("always use X instead of Y") that cost 50 tokens instead of 500
- Budget accounting: correction recall must share the existing 2-5% skill loading budget, not get its own unlimited allocation
- Measure: add a `tokens_loaded` field to session-start output so budget creep is visible

**Warning signs:**
- Session start takes noticeably longer
- Claude's responses reference corrections from weeks ago that are irrelevant to the current task
- Context window exhaustion errors mid-task
- `/gsd:digest` shows sessions.jsonl growing beyond 500 entries without rotation

**Phase to address:**
Phase 1 (Correction Capture) must define the schema with size constraints. Phase 4 (Live Recall) must implement the relevance filter and budget cap. Phase 5 (Observer Agent) must implement the summarization/compression layer.

---

### Pitfall 2: False Positive Pattern Detection from Natural Language Corrections

**What goes wrong:**
The system misinterprets a one-time contextual preference as a universal correction. User says "use tabs here" (meaning in this specific Makefile), and the system records a correction "always use tabs instead of spaces." The suggestion pipeline then proposes a skill that enforces tabs everywhere. Worse: two contradictory corrections in different contexts create an oscillating pattern that never stabilizes.

**Why it happens:**
Natural language corrections are inherently ambiguous about scope. "Don't do X" might mean "never do X in this project," "never do X in this file type," or "don't do X right now." The existing bounded-guardrails.md already warns about this: "single corrections may be context-specific, not general patterns." But the correction capture system will be parsing freeform text, not structured data -- the temptation to over-extract is strong.

**How to avoid:**
- Context binding: every correction must be tagged with its scope -- file type, phase type, project, or global. Default to narrowest scope (this file, this task)
- Contradiction detection: before proposing a refinement, check if any existing corrections contradict the new pattern. Surface contradictions to the user rather than silently picking one
- The min-3-corrections guardrail already exists -- enforce it strictly for scope escalation (3 corrections in the same narrow scope before widening)
- Never auto-extract universal rules from corrections. The suggestion pipeline should propose, never apply
- Add a `scope` field to the correction schema: `file`, `filetype`, `phase`, `project`, `global`

**Warning signs:**
- Suggestions that reference conflicting corrections
- User dismissing suggestions repeatedly (high dismiss rate in `/gsd:suggest`)
- Skills that produce different behavior depending on which correction was loaded most recently
- Corrections with no `scope` field (defaulting to global)

**Phase to address:**
Phase 1 (Correction Capture) must include scope tagging in the schema. Phase 6 (Suggestion Pipeline) must implement contradiction detection. Phase 7 (Enhanced Digest) should surface dismiss rates as a quality signal.

---

### Pitfall 3: sessions.jsonl Unbounded Growth Causing Read Failures

**What goes wrong:**
The append-only sessions.jsonl file grows without bound. Every workflow command (7 commands) appends an entry. Correction capture will add more entries per session. After 3 months of active use, the file could have 5000+ entries. Reading the entire file for `/gsd:digest` or pattern detection becomes slow. Claude's Read tool may truncate or fail on very large files. The existing digest command already warns about files over 500 lines -- this is a design smell, not a solution.

**Why it happens:**
Append-only is the correct write pattern (observation-patterns.md says "never overwrite"), but without a corresponding retention/rotation mechanism, append-only means grow-forever. The existing config has `retention_days: 30` but no code enforces it. The observation-patterns.md specifies "validate entries on read" but says nothing about pruning.

**How to avoid:**
- Implement rotation at write time: when appending, check file size. If over 1000 lines, archive to `sessions-YYYY-MM.jsonl` and start fresh
- Implement retention at read time: when loading for digest/suggest/recall, filter by `retention_days` from config and ignore older entries
- Add a `gsd:prune` command or make rotation part of `/gsd:session-start`
- Size guard: if sessions.jsonl exceeds 2MB, refuse to load it inline and require rotation first
- The correction entries will be larger than workflow entries -- account for this in size calculations

**Warning signs:**
- `/gsd:digest` output includes "analysis may take a moment" warning
- Read tool returns truncated content from sessions.jsonl
- Pattern detection runs on stale data from months ago
- File exceeds 1000 lines without any archival

**Phase to address:**
Phase 1 (Correction Capture) should implement rotation as part of the write path. Phase 5 (Observer Agent) should include a retention enforcement step. Phase 7 (Enhanced Digest) should implement date-filtered reads.

---

### Pitfall 4: Auto Self-Diagnosis Producing Verbose, Wrong, or Circular Analysis

**What goes wrong:**
When Claude is corrected, the auto self-diagnosis step generates a "root cause analysis" that is speculative, verbose (500+ tokens), or outright wrong. Example: user corrects a variable name, and the diagnosis says "I incorrectly assumed camelCase was preferred because the codebase uses mixed conventions" -- when the real reason is just that the user prefers a specific domain term. The diagnosis consumes tokens, adds noise to the correction record, and may feed bad signals into the pattern detection pipeline.

**Why it happens:**
LLMs are very good at generating plausible-sounding explanations for anything. Without ground truth, the diagnosis is just another generation -- it cannot verify its own reasoning. The temptation to make diagnosis "smart" and "thorough" leads to long explanations that feel insightful but are unfalsifiable.

**How to avoid:**
- Diagnosis must be terse: maximum 2 sentences, maximum 100 tokens
- Diagnosis must be structured, not freeform: choose from a fixed taxonomy of root causes (`wrong_convention`, `missing_context`, `stale_knowledge`, `wrong_scope`, `wrong_tool`, `wrong_pattern`, `user_preference`)
- Diagnosis is optional, not mandatory: if Claude cannot identify a root cause from the taxonomy, record `unknown` and move on
- Never let the diagnosis feed directly into skill refinement -- it is metadata for humans reviewing corrections, not an input to the suggestion pipeline
- Test with adversarial cases: trivial corrections should produce trivial diagnoses, not elaborate explanations

**Warning signs:**
- Diagnosis text longer than the original correction
- Diagnosis references information not available in the current context
- Multiple diagnoses citing the same root cause for unrelated corrections (over-fitting)
- User skipping or ignoring diagnosis output

**Phase to address:**
Phase 2 (Auto Self-Diagnosis) is entirely about this. The taxonomy and length constraints must be defined before implementation begins, not after.

---

### Pitfall 5: Observer Agent Burning Full Context Window on Session Boundary Analysis

**What goes wrong:**
The observer agent is designed to run at session boundaries (start/end) to aggregate patterns and detect cross-session trends. If implemented as a full subagent spawn, it consumes an entire context window (200K tokens) just to read sessions.jsonl, perform analysis, and write suggestions. This is wildly disproportionate to the value delivered. Worse: if it runs synchronously at session start, it delays the user's actual work.

**Why it happens:**
The existing GSD pattern (executor, verifier, planner) uses subagent spawns for heavy operations. The natural instinct is to make the observer another subagent. But those agents do complex multi-step work (planning, coding, testing). The observer's job is essentially "read JSONL, count patterns, write JSON" -- a data pipeline, not an agent task.

**How to avoid:**
- The observer should NOT be a full subagent spawn. It should be a lightweight script (JS/CJS) that runs as a hook or CLI command
- If Claude-level reasoning is needed for pattern interpretation, use a bounded prompt with strict token limits (e.g., 4K input, 1K output)
- Run asynchronously: session-end hook triggers observer in background, results available at next session-start
- The existing `gsd-snapshot-session.js` hook pattern is the right model: shell script, 10-second timeout, silent failure
- Never load the full sessions.jsonl into a Claude context. Pre-process with a script, pass only aggregated summaries

**Warning signs:**
- Observer agent taking more than 5 seconds to complete
- Session start delayed by observer processing
- Observer generating analysis that nobody reads
- Observer consuming more context than the actual work session

**Phase to address:**
Phase 5 (Observer Agent) must decide implementation approach early. The first task should be choosing hook-based script vs. subagent and committing to the constraint.

---

### Pitfall 6: Suggestion Pipeline Violating Bounded Learning Guardrails Under Edge Cases

**What goes wrong:**
The bounded-guardrails.md specifies 6 non-negotiable constraints (20% max change, 3 corrections minimum, 7-day cooldown, user confirmation, permission checks, 5+ co-activations). The suggestion pipeline implements these correctly for the happy path but misses edge cases: what happens when a skill is brand new (no baseline for 20% calculation)? What happens when corrections span two different skills? What happens when the cooldown expires exactly during a session? What counts as "3 corrections" -- 3 in one session or 3 across sessions?

**Why it happens:**
Guardrails are specified as rules, but their enforcement requires precise definitions of terms. "3 corrections" is ambiguous without defining the counting window, deduplication rules, and scope. The existing enforcement is at TWO levels (awareness layer in SKILL.md and code layer in source) -- but the v6.0 features add a third level (the suggestion pipeline writer) that must also enforce them.

**How to avoid:**
- Write explicit unit tests for every guardrail boundary condition before implementing the suggestion pipeline
- Define a guardrail enforcement spec: what counts as a correction (explicit user "no, do X" vs. implicit redo), how to count across sessions, how to handle the first refinement of a new skill (no 20% baseline)
- For new skills with no baseline: the 20% rule does not apply to creation, only refinement. Make this explicit
- For cross-skill corrections: attribute the correction to the skill most relevant to the corrected behavior, not to all skills
- Centralize guardrail checks in one function/module. The suggestion pipeline calls this function; it does not re-implement the checks
- The 7-day cooldown must be persisted (in suggestions.json or a separate cooldown tracker) -- it cannot rely on session memory

**Warning signs:**
- Suggestions appearing for skills that were refined less than 7 days ago
- Suggestions proposing more than 20% change to an existing skill
- Suggestions based on only 1-2 corrections
- No test coverage for guardrail edge cases

**Phase to address:**
Phase 6 (Suggestion Pipeline) must have guardrail enforcement tests as acceptance criteria. Phase 3 (Preference Tracking) must define what counts as a "correction" precisely.

---

### Pitfall 7: Correction Capture Hook Blocking or Slowing Normal Workflow

**What goes wrong:**
The hook-based correction capture runs synchronously in the Claude Code hook pipeline. If the hook takes more than a few hundred milliseconds (e.g., reading sessions.jsonl to check for duplicates, or running diagnosis inline), it visibly delays every tool call or response. Users disable the hook or the framework feels sluggish. The existing hooks (validate-commit.sh, session-state.sh, phase-boundary-check.sh) are lightweight -- a correction capture hook that does NLP analysis would break this pattern.

**Why it happens:**
Claude Code hooks run shell commands. The temptation is to do everything in the hook: capture the correction, run diagnosis, check for patterns, and maybe even generate a suggestion. Each of these steps adds latency.

**How to avoid:**
- The capture hook must ONLY append a JSON line to sessions.jsonl. No analysis, no diagnosis, no pattern checking
- Maximum hook execution time: 500ms (the existing hooks complete in under 100ms)
- Diagnosis runs as a separate step triggered by the user or at session end, never inline with correction capture
- Use the existing pattern: `gsd-snapshot-session.js` appends data and exits. Analysis happens later in `/gsd:digest`
- If deduplication is needed, do it at read time (in digest/suggest), not at write time (in the hook)

**Warning signs:**
- Hook timeout errors in Claude Code logs
- Noticeable delay between user message and Claude response
- Users asking how to disable the correction hook
- Hook doing file reads (sessions.jsonl) in addition to file writes

**Phase to address:**
Phase 1 (Correction Capture) must enforce the "append-only, no-analysis" constraint on the hook. The hook implementation should be reviewed for latency before merging.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store corrections as unstructured text | Faster to capture | Impossible to query, filter, or aggregate programmatically | Never -- use the structured schema from day one |
| Skip rotation/retention for sessions.jsonl | Simpler write path | File grows unbounded, read performance degrades, digest breaks | Only in first 2 weeks of development; must be addressed before any user testing |
| Hardcode correction categories | Faster initial implementation | New correction types require code changes | MVP only; switch to config-driven taxonomy in Phase 3 |
| Run observer inline at session start | Simpler architecture | Blocks user from starting work; 5-10 second delay | Never -- always run async |
| Store cooldown state in memory only | Simpler implementation | Cooldown resets between sessions; guardrail violated | Never -- must persist to disk |
| Skip contradiction detection in suggestions | Fewer false negatives | Contradictory suggestions erode trust | Acceptable in Phase 6 MVP if flagged as known limitation; must be addressed before Phase 7 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code hooks | Writing hooks that read stdin and do analysis inline | Hooks should append-only to JSONL; analysis happens in commands |
| sessions.jsonl concurrent writes | Two concurrent milestone sessions appending simultaneously cause corrupted JSON lines | Use atomic line writes (echo + redirect with append); each write is a single line so interleaving is safe at line boundaries |
| Skill loading budget | Adding correction recall as a new budget category without reducing skill budget | Correction recall shares the 2-5% skill budget; add a sub-allocation (e.g., 1% corrections, 1-4% skills) |
| config.json adaptive_learning key | Adding new config fields without migration path for existing projects | Use the existing config migration pattern from v4.0; new fields must have defaults |
| suggestions.json read-modify-write | Race condition if two sessions review suggestions simultaneously | Use file locking or accept last-write-wins (acceptable given single-user model) |
| Observer agent output | Writing observer results to sessions.jsonl (circular dependency) | Observer writes to suggestions.json and a separate analysis output; never back to the observation log |
| Cross-project correction leakage | Loading corrections from Project A into Project B's session context | Corrections are project-scoped by default; cross-project sharing requires explicit opt-in via dashboard.json |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full sessions.jsonl for every recall query | Session start takes 3+ seconds | Pre-compute a correction index (top 10 by recency and relevance) at session end | 500+ entries |
| Running pattern detection on every correction | Each correction triggers a full scan of history | Batch pattern detection: run at session boundaries, not on every event | 20+ corrections per session |
| Storing full code snippets in correction_from/correction_to | sessions.jsonl grows 10x faster than workflow-only entries | Truncate code snippets to 200 chars; store file path + line number for full context | 100+ corrections with code |
| Suggestion generation scanning all projects | Cross-project digest reads N projects sequentially | Parallelize reads; cache project summaries; skip projects with no changes since last scan | 5+ registered projects |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing API keys or secrets in correction text | Correction says "use API key X instead of Y" -- key persisted in plaintext JSONL | Sanitize corrections before storage; reject entries matching secret patterns (API key regex) |
| Cross-project correction leakage | Project A's proprietary patterns visible to Project B via shared correction history | Default to project-scoped corrections; cross-project requires explicit opt-in |
| Data poisoning via manual JSONL edits | Attacker injects malicious corrections into sessions.jsonl to influence Claude's behavior | Validate all entries on read (existing guidance); add integrity checks (entry count, timestamp monotonicity) |
| Observer agent with write access to skills | Compromised observer could auto-modify skills bypassing user confirmation | Observer writes suggestions only; skill modification requires separate user-initiated flow |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Surfacing every correction at session start | Information overload; user ignores the briefing | Show only corrections relevant to the current phase/task; limit to 3 most recent |
| Diagnosis monologues after trivial corrections | User corrects a typo, gets a 200-word root cause analysis | Diagnosis is terse (2 sentences max) and only surfaces for non-trivial corrections |
| Too-frequent suggestion prompts | User feels nagged; dismisses everything | Respect 7-day cooldown; limit to 1 suggestion notification per session start |
| Suggesting skills the user already dismissed | Erosion of trust; "I told you no" | Track dismissed suggestion IDs; never re-suggest dismissed patterns |
| Verbose correction confirmation | "I've recorded your correction. The pattern has been saved to sessions.jsonl at timestamp..." | Silent capture; only confirm if the correction changes behavior immediately |

## "Looks Done But Isn't" Checklist

- [ ] **Correction Capture:** Often missing scope tagging -- verify every correction has a `scope` field (file/filetype/phase/project/global)
- [ ] **Correction Capture:** Often missing deduplication -- verify the same correction expressed differently is not stored as two separate entries
- [ ] **sessions.jsonl Rotation:** Often missing the archive-on-write path -- verify rotation triggers when file exceeds threshold, not just when digest runs
- [ ] **Auto Self-Diagnosis:** Often missing the "unknown" escape hatch -- verify diagnosis gracefully handles cases where no root cause fits the taxonomy
- [ ] **Live Recall:** Often missing budget accounting -- verify loaded corrections are counted against the 2-5% skill budget
- [ ] **Live Recall:** Often missing relevance filtering -- verify corrections for Phase 3 are not loaded when working on Phase 7
- [ ] **Observer Agent:** Often missing async execution -- verify observer runs in background hook, not synchronously at session start
- [ ] **Suggestion Pipeline:** Often missing guardrail edge case tests -- verify cooldown persistence, first-skill-no-baseline, cross-skill attribution
- [ ] **Preference Tracking:** Often missing contradiction detection -- verify contradictory preferences are surfaced, not silently overwritten
- [ ] **Enhanced Digest:** Often missing correction-specific analysis -- verify digest shows correction patterns distinct from commit patterns

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context window blowout from corrections | LOW | Reduce recall cap; add relevance filter; redeploy |
| False positive patterns in suggestions | MEDIUM | Purge suggestions.json; add scope tagging; re-run observer with new schema |
| sessions.jsonl too large | LOW | Archive old entries to dated file; truncate; add rotation |
| Wrong diagnoses poisoning pattern detection | MEDIUM | Add `diagnosis_used: false` flag; rebuild suggestions without diagnosis data |
| Observer blocking session start | LOW | Move to background hook; add timeout |
| Guardrail violation (premature suggestion) | HIGH | Audit all suggested/applied refinements; revert unauthorized changes; add missing tests |
| Hook latency degrading UX | LOW | Profile hook; remove inline analysis; move to append-only |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context window blowout | Phase 4 (Live Recall) | Load 50 corrections, measure tokens consumed; must be under 3K |
| False positive patterns | Phase 1 (Correction Capture) + Phase 6 (Suggestion Pipeline) | Create contradictory corrections; verify system surfaces contradiction |
| sessions.jsonl growth | Phase 1 (Correction Capture) | Write 1500 entries; verify rotation triggers; verify digest still works |
| Verbose/wrong diagnosis | Phase 2 (Auto Self-Diagnosis) | Feed 10 trivial corrections; verify all diagnoses under 100 tokens |
| Observer context burn | Phase 5 (Observer Agent) | Measure observer execution time and token usage; must complete in under 5 seconds |
| Guardrail violations | Phase 6 (Suggestion Pipeline) | Unit tests for all 6 guardrail boundary conditions |
| Hook latency | Phase 1 (Correction Capture) | Time hook execution; must complete in under 500ms |
| Correction scope ambiguity | Phase 3 (Preference Tracking) | Record 5 corrections without explicit scope; verify default is narrowest |
| Cross-project leakage | Phase 4 (Live Recall) | Register 2 projects; verify corrections do not cross boundaries without opt-in |
| Suggestion fatigue | Phase 6 (Suggestion Pipeline) | Dismiss a suggestion; verify it never reappears; verify max 1 notification per session |

## Sources

- Existing codebase analysis: `.claude/skills/skill-integration/SKILL.md` (bounded learning guardrails)
- Existing codebase analysis: `.claude/skills/skill-integration/references/observation-patterns.md` (JSONL schema, signal taxonomy)
- Existing codebase analysis: `.claude/skills/skill-integration/references/bounded-guardrails.md` (6 non-negotiable constraints)
- Existing codebase analysis: `commands/gsd/digest.md` (current digest implementation, 500-line warning)
- Existing codebase analysis: `commands/gsd/suggest.md` (current suggestion review flow)
- Existing codebase analysis: `.claude/hooks/gsd-snapshot-session.js` (hook pattern: silent, fast, append-only)
- Existing codebase analysis: `get-shit-done/workflows/execute-phase.md` (observation capture pattern in workflows)
- `.planning/PROJECT.md` (v6.0 feature targets, architectural constraints)
- Domain knowledge: LLM context window management, append-only log rotation patterns, feedback loop design

---
*Pitfalls research for: v6.0 Adaptive Observation & Learning Loop*
*Researched: 2026-03-10*
