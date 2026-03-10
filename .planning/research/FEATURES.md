# Feature Research

**Domain:** Adaptive Observation and Learning Loop (GSD v6.0)
**Researched:** 2026-03-10
**Confidence:** MEDIUM (internal architecture well-understood; external adaptive learning patterns from multiple sources but few exact precedents for file-based AI coding assistant learning loops)

---

## Context: What GSD Already Has (Baseline for v6.0)

v6.0 layers ON TOP of the existing observation infrastructure shipped in v4.0. Nothing below duplicates completed work.

| Existing Feature | Where | v6.0 Relevance |
|-----------------|-------|----------------|
| sessions.jsonl logging from 7 workflow commands | Observation step in each workflow (plan, execute, verify, discuss, quick, fix-debt, diagnose) | v6.0 adds new entry types (corrections, preferences) and new writers (hooks, observer agent) |
| JSONL schema with type/signal_strength/context fields | `skills/skill-integration/references/observation-patterns.md` | v6.0 extends schema with `correction_from`/`correction_to` fields and preference entries |
| `/gsd:session-start` with recent activity display | `commands/gsd/session-start.md` | v6.0 enhances with correction recall at session start |
| `/gsd:digest` with commit analysis and correction rate | `commands/gsd/digest.md` | v6.0 adds correction analysis, collaborative skill refinement recommendations |
| `/gsd:suggest` with interactive review (reader only) | `commands/gsd/suggest.md` | v6.0 adds the writer side: suggestion generation pipeline |
| Observer agent stub | `.claude/agents/observer.md` | v6.0 implements the full observer agent |
| Skill-integration skill with bounded learning guardrails | `skills/skill-integration/SKILL.md` | v6.0 depends on these guardrails (20% max change, 3 correction minimum, 7-day cooldown) |
| Post-commit hook writing session entries | `hooks/gsd-snapshot-session.js` | v6.0 adds correction-capture hooks (PreToolUse/PostToolUse or equivalent) |
| Dashboard pattern display | `dashboard/js/components/pattern-page.js` | v6.0 feeds richer data (correction patterns, preference trends) |
| suggestions.json structure (pending/accepted/dismissed/deferred) | Used by `/gsd:suggest` reader | v6.0 builds the writer that populates this file |

**The gap:** GSD can observe session events (commits, phase outcomes) but cannot capture the highest-signal data: user corrections and preferences. The observation system is passive event logging -- it records what happened but not what went wrong or what the user prefers. There is no writer for suggestions.json, no correction-capture mechanism, no preference store, no self-diagnosis when corrected, and no live recall of past mistakes within sessions. The observer agent is a stub.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that an adaptive learning system must have to deliver on "learns from its mistakes." Missing any of these means v6.0 does not close the loop.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Hook-based correction capture | The observation-patterns.md spec ranks user corrections as HIGHEST signal. Currently no mechanism captures them -- corrections are lost when the session ends. Any "learning" system that cannot capture corrections is fundamentally broken. Windsurf's Cascade Memories and Claude Code's own MEMORY.md auto-memory both capture corrections as their primary learning signal. | MEDIUM | Hook on user messages that follow Claude output. Detect correction patterns: "no, use X instead of Y", "that's wrong", undo/revert sequences, re-instructions. Write structured entries to sessions.jsonl with `type: "correction"`, `correction_from`, `correction_to` fields. The JSONL schema already defines these fields -- they just have no writer. |
| Preference tracking as durable patterns | When a user corrects the same thing 3+ times, that is a preference (not a one-off correction). Preferences must persist across sessions and be referenceable by skills and agents. Without durable preferences, the system "forgets" learned knowledge every session. Claude Code's MEMORY.md serves this role for general knowledge; GSD needs domain-specific preference storage for coding patterns. | MEDIUM | Preferences stored in `.planning/patterns/preferences.json` -- a structured file distinct from sessions.jsonl (which is append-only event log). Each preference has: id, category (naming, style, tooling, architecture, testing), pattern description, source corrections (IDs from sessions.jsonl), confidence (occurrence count), created/updated timestamps. Bounded guardrails apply: 3+ corrections before promotion to preference. |
| Live recall of corrections within current session | If Claude makes a mistake that was corrected earlier in this session, it should recall the correction before repeating the error. Without intra-session recall, the system makes the same mistake twice in one conversation -- the worst user experience for a "learning" system. | LOW | At the start of each session and after each correction capture, load relevant corrections into active context. Implementation: skill-integration already checks for pending suggestions at session start; extend to also surface recent corrections. Within-session: corrections are in conversation context already, but cross-referencing with historical corrections from sessions.jsonl adds value. |
| Correction recall at session start | Sessions start fresh with no memory of past mistakes. `/gsd:session-start` already shows recent activity and pending suggestions, but does not surface past corrections relevant to the current phase/plan. Without this, every new session repeats previously corrected mistakes. | LOW | Extend `/gsd:session-start` Step 3 (Recent Activity) to filter and highlight correction entries from sessions.jsonl. Show: "Previous corrections relevant to Phase N: [list]". Filter by: current phase context, recency (last 30 days per retention config), signal strength. Depends on: correction capture writing entries to sessions.jsonl. |
| Suggestion pipeline writer | `/gsd:suggest` exists as a reader but has no writer -- suggestions.json is always empty. The entire suggest flow is dead code without a writer. This is documented tech debt (analysis commands read data files with no writers). The writer aggregates patterns from sessions.jsonl and promotes them to suggestion candidates when they cross the min_occurrences threshold. | MEDIUM | Runs as part of the observer agent or as a standalone aggregation step in `/gsd:digest`. Reads sessions.jsonl, groups by pattern similarity, counts occurrences, and writes to suggestions.json when threshold is met. Must respect bounded guardrails: min 3 occurrences, cross-session repetition weighted higher. Output format matches existing suggestions.json schema (candidate.id, candidate.description, candidate.occurrences, state, createdAt). |
| Observer agent implementation | The observer agent at `.claude/agents/observer.md` is a stub with a TODO. It was designed to do session boundary analysis and pattern aggregation. Without it, pattern detection is manual (run `/gsd:digest` and read the output yourself). The observer closes the loop: observe -> detect patterns -> generate suggestions -> user reviews via `/gsd:suggest`. | HIGH | Full agent implementation: (1) Session boundary analysis -- detect when a session starts/ends, capture session-level metadata. (2) Pattern aggregation -- group similar corrections, tool sequences, file patterns across sessions. (3) Suggestion generation -- write to suggestions.json when patterns cross threshold. (4) Skill refinement proposals -- when corrections consistently contradict an existing skill's guidance, propose a refinement (gated by bounded guardrails: 3+ corrections, 20% max change, user confirmation required). |

### Differentiators (Competitive Advantage)

Features that distinguish GSD's adaptive learning from Claude Code's built-in MEMORY.md or competitor approaches (Windsurf Cascade Memories, Cursor rules).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto self-diagnosis on correction | When Claude is corrected, most systems just note the correction. GSD can go further: automatically analyze *why* the mistake happened (wrong assumption? outdated pattern? missing context? skill guidance was wrong?) and record the root cause alongside the correction. This makes the correction actionable -- the system does not just know "X was wrong" but "X was wrong *because* Y." Agentic RCA patterns (Cleric, Algomox) show that automated root-cause analysis significantly improves fix quality vs. surface-level correction logging. | MEDIUM | On correction capture, trigger a lightweight diagnosis step: (1) What did Claude do? (2) What should Claude have done? (3) Why the divergence? Categories: stale-knowledge (training data wrong), missing-context (didn't read enough codebase), skill-conflict (two skills gave contradictory guidance), preference-gap (user preference not recorded), scope-error (did more or less than asked). Record diagnosis in the correction entry. This does NOT spawn a subagent -- it is inline analysis by the current agent, kept lightweight (~500 tokens). |
| Enhanced `/gsd:digest` with correction analysis | Current digest shows commit type distribution and fix/feat correction rates (proxy metric). v6.0 adds actual correction analysis: what categories of mistakes are most common, which skills are being contradicted, which phases generate the most corrections. This turns the digest from "what commits happened" into "what is Claude getting wrong and how is it improving." | LOW | Extend digest Step 3 with a new section 3g: Correction Analysis. Group correction entries by diagnosis category. Show trends: "Preference-gap corrections decreased from 8 to 2 over last 3 phases (preferences are working)." Link corrections to skills when diagnosis indicates skill-conflict. Depends on: correction capture with diagnosis data. |
| Collaborative skill refinement via digest | When `/gsd:digest` identifies a skill that is consistently contradicted by corrections (3+ corrections with diagnosis "skill-conflict" pointing to the same skill), it proposes a specific refinement. This is not auto-applied -- it creates a refinement proposal that the user reviews, following the bounded guardrails (20% max change, user confirmation). The insight is that digest analysis can *drive* skill evolution, not just report on it. | MEDIUM | In digest Step 5 (Recommendations), add a new recommendation type: "Skill refinement proposed." When corrections consistently point to a specific skill, generate a diff-style proposal: "In skill X, change guidance from 'always use Y' to 'prefer Z when condition C'." Write proposal to a new `skill-refinements/` directory or append to suggestions.json with type "refinement". User reviews via `/gsd:suggest`. |
| Cross-session preference inheritance | Preferences learned in one project can inform behavior in other registered projects (via `~/.gsd/dashboard.json` project registry). If a user always prefers `const` over `let` in TypeScript, that preference should apply everywhere -- not be re-learned per project. `/gsd:digest` already reads cross-project sessions; preferences should follow the same pattern. | LOW | Preferences stored at two levels: project-level (`.planning/patterns/preferences.json`) and user-level (`~/.gsd/preferences.json`). Project-level preferences override user-level (matching skill loading precedence). Cross-project promotion: when a preference appears in 3+ projects, promote to user-level. User-level preferences loaded at session start alongside project-level. |

### Anti-Features (Things to Deliberately NOT Build)

Features that seem natural for an adaptive learning system but violate GSD's design constraints or create more problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Auto-apply corrections to skills | "If Claude keeps getting corrected on the same thing, just update the skill automatically" sounds like true autonomy. | Violates the core bounded learning guardrail: "All refinements require user confirmation." Auto-modifying skills without review accumulates drift -- skills diverge from intent through accumulated micro-changes. The skill-integration SKILL.md is explicit: "Never auto-apply suggestions. Always require explicit user confirmation." This is a NON-NEGOTIABLE constraint. | Surface refinement proposals via `/gsd:suggest`. User reviews, accepts or dismisses. The human stays in the loop for all skill mutations. |
| Real-time continuous observation via background agent | "Run an observer agent in the background that watches everything Claude does" sounds like comprehensive coverage. | GSD has no daemon process -- it is file-based, Claude Code-embedded. A persistent background observer would require: an always-on process, IPC between Claude Code and the observer, and would burn context budget continuously. The v5.0 dashboard solved a similar problem with SSE polling, not persistent agents. Claude Code hooks (PreToolUse/PostToolUse) provide event-driven observation without a daemon. | Use Claude Code hooks for real-time correction capture (event-driven, zero overhead when no correction occurs). Run observer agent on-demand at session boundaries (start/end) for aggregation. No daemon. |
| Fine-grained token-level correction tracking | "Track exactly which tokens Claude got wrong in each correction" sounds like it enables precise learning. | Token-level diffs between Claude's output and the user's correction are noisy, expensive to compute, and rarely actionable. The meaningful signal is semantic: "used `var` instead of `const`", not "changed character 47 on line 3." Token-level tracking would generate massive sessions.jsonl entries and make pattern detection harder, not easier. | Capture corrections at the semantic level: `correction_from` (what Claude did) and `correction_to` (what user wanted), both as human-readable descriptions. Pattern detection operates on these descriptions, not raw diffs. |
| ML model training from correction data | "Use the corrections to fine-tune a model" sounds like the ultimate learning loop. | GSD runs inside Claude Code -- it cannot fine-tune the underlying model. Training requires API access, compute infrastructure, and model hosting that is entirely outside GSD's scope. GSD is a *prompt-engineering* and *skill-management* framework, not a model training pipeline. | Skills and preferences are the "model" -- they modify Claude's behavior through prompt context, not weight updates. This is by design: prompt-level adaptation is inspectable, reversible, and human-reviewable. Model fine-tuning is opaque and irreversible. |
| Correction capture from implicit signals (hesitation, edits, undos) | "Track when the user pauses, edits Claude's output, or undoes changes -- these are implicit corrections." | Claude Code hooks provide tool-level events (PreToolUse, PostToolUse, Notification), not keystroke-level events. Detecting "hesitation" requires timing data that is not available. Edit detection would require diffing every file after every user action -- expensive and noisy. The existing observation taxonomy correctly classifies implicit signals (file touch patterns, post-failure commands) as MEDIUM or LOW signal. | Capture explicit corrections only: when the user directly tells Claude something was wrong. The JSONL schema's `correction_from`/`correction_to` fields are designed for explicit corrections. Implicit signals (file patterns, tool sequences) are already captured by the existing workflow observation steps. |
| Preference conflict resolution engine | "When two preferences contradict, automatically resolve the conflict" sounds like smart preference management. | Preferences can legitimately conflict in different contexts (e.g., "prefer short variable names" in scripts vs. "prefer descriptive names" in library code). Automated resolution would pick one and discard the other, losing context-specific nuance. This is the same reasoning behind GSD's advisory-only conflict detection for milestones: surface conflicts, let humans decide. | Surface conflicts in `/gsd:suggest` review: "Preference A ('use short names') conflicts with Preference B ('use descriptive names'). Both have 5+ occurrences. Consider adding context conditions." User resolves by adding conditions to one or both preferences. |

---

## Feature Dependencies

```
[Hook-based correction capture]
    |
    |--required by--> [Auto self-diagnosis on correction]
    |                      (diagnosis runs immediately after capture)
    |
    |--required by--> [Preference tracking]
    |                      (preferences are promoted from repeated corrections)
    |
    |--required by--> [Correction recall at session start]
    |                      (recall reads correction entries from sessions.jsonl)
    |
    |--required by--> [Live recall within session]
    |                      (intra-session recall needs captured corrections)
    |
    |--required by--> [Enhanced /gsd:digest correction analysis]
    |                      (digest section 3g analyzes correction entries)

[Preference tracking]
    |
    |--requires--> [Hook-based correction capture]
    |                  (corrections are the input signal for preferences)
    |
    |--enhances--> [Correction recall at session start]
    |                  (preferences loaded alongside corrections)
    |
    |--enhances--> [Observer agent]
    |                  (observer reads preferences for pattern context)

[Observer agent implementation]
    |
    |--requires--> [Hook-based correction capture]
    |                  (observer aggregates correction data)
    |
    |--requires--> [Preference tracking]
    |                  (observer promotes corrections to preferences)
    |
    |--writes to--> [Suggestion pipeline]
    |                  (observer generates suggestion candidates)

[Suggestion pipeline writer]
    |
    |--requires--> [Observer agent implementation]
    |                  (observer drives the pipeline)
    |                  OR can be run standalone in /gsd:digest
    |
    |--writes to--> [suggestions.json]
    |                  (populates the file that /gsd:suggest reads)

[Auto self-diagnosis]
    |
    |--requires--> [Hook-based correction capture]
    |                  (diagnosis is triggered by correction event)
    |
    |--enhances--> [Preference tracking]
    |                  (diagnosis categories help group corrections)
    |
    |--enhances--> [Enhanced /gsd:digest]
    |                  (diagnosis data enables category-level analysis)

[Enhanced /gsd:digest]
    |
    |--requires--> [Hook-based correction capture]
    |                  (new section 3g needs correction entries)
    |
    |--enhanced by--> [Auto self-diagnosis]
    |                     (diagnosis categories enable richer analysis)
    |
    |--can trigger--> [Collaborative skill refinement]
    |                     (when corrections consistently contradict a skill)

[Collaborative skill refinement via digest]
    |
    |--requires--> [Enhanced /gsd:digest]
    |                  (refinement proposals generated during digest analysis)
    |
    |--requires--> [Auto self-diagnosis]
    |                  (needs "skill-conflict" diagnosis category)
    |
    |--writes to--> [suggestions.json or skill-refinements/]
    |                  (proposal reviewed via /gsd:suggest)
```

### Dependency Notes

- **Correction capture is the root dependency.** Every other v6.0 feature depends on corrections being captured to sessions.jsonl. Without the capture hook, the rest of the system has no input data. Build this first.

- **Preference tracking requires correction capture but not diagnosis.** Preferences can be built from raw corrections (group by similarity, count occurrences). Diagnosis enriches preferences with categories but is not required for the basic promotion mechanism.

- **Observer agent is the heaviest dependency.** It requires both correction capture and preference tracking to be working before it can aggregate patterns meaningfully. It also writes to suggestions.json, completing the pipeline. Build it after the foundational features.

- **Suggestion pipeline can be bootstrapped without the full observer.** A simpler version can run inside `/gsd:digest` as a step that writes to suggestions.json. The observer agent adds continuous, automated pattern detection on top of this manual-trigger baseline.

- **Digest enhancements and skill refinement are additive.** They layer on top of existing `/gsd:digest` without changing its current behavior. Existing sections (3a-3f) remain unchanged; new sections (3g: corrections, 3h: skill refinement proposals) are appended.

- **Cross-session preference inheritance is independent of the core pipeline.** It only requires preference tracking to exist. Can be built at any time after preferences are working.

---

## MVP Definition

### Launch With (v6.0 -- This Milestone)

Minimum viable adaptive learning loop -- the smallest feature set that demonstrates "Claude learns from corrections."

- [ ] **Hook-based correction capture** -- the foundation. Without this, nothing else works. Captures corrections to sessions.jsonl with structured fields (type, correction_from, correction_to, context).

- [ ] **Auto self-diagnosis on correction** -- the differentiator. Inline analysis after each correction produces a diagnosis category. Makes corrections actionable, not just recorded.

- [ ] **Preference tracking (preferences.json)** -- durable memory. Promotes repeated corrections to persistent preferences. Loaded at session start. 3+ occurrence threshold from bounded guardrails.

- [ ] **Correction recall at session start** -- closes the loop for returning sessions. `/gsd:session-start` surfaces relevant past corrections and preferences for the current phase.

- [ ] **Live recall within session** -- closes the loop for the current session. Correction entries available for reference when similar patterns arise.

- [ ] **Observer agent implementation** -- the aggregator. Full implementation replacing the stub. Session boundary analysis, pattern aggregation, suggestion generation.

- [ ] **Suggestion pipeline writer** -- completes the existing suggest flow. Observer or digest writes to suggestions.json so `/gsd:suggest` has data to review.

- [ ] **Enhanced `/gsd:digest` with correction analysis** -- makes corrections visible. New section analyzing correction patterns, categories, trends, and skill refinement proposals.

### Add After Validation (v6.x)

Features to add once the correction capture and preference loop is generating real data.

- [ ] **Cross-session preference inheritance** -- promote project-level preferences to user-level (`~/.gsd/preferences.json`) when they appear in 3+ projects. Trigger: user has multiple registered projects with overlapping preferences.

- [ ] **Collaborative skill refinement via digest** -- generate specific skill refinement proposals when corrections consistently contradict existing skill guidance. Trigger: 3+ corrections with "skill-conflict" diagnosis pointing to the same skill.

- [ ] **Preference conditions/scoping** -- allow preferences to have context conditions ("prefer X when in test files", "prefer Y in library code"). Trigger: users report that broad preferences cause problems in specific contexts.

### Future Consideration (v7+)

- [ ] **Preference analytics dashboard** -- visual display of preference trends, correction rates over time, learning curve visualization. Requires dashboard infrastructure (v5.0).

- [ ] **Team preference sharing** -- share preferences across team members via a shared preferences file. Requires multi-user workflow patterns not yet in GSD.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hook-based correction capture | HIGH -- foundation for all learning | MEDIUM -- hook infrastructure + pattern detection | P1 |
| Auto self-diagnosis on correction | HIGH -- makes corrections actionable | MEDIUM -- inline analysis logic, ~500 token budget | P1 |
| Preference tracking (preferences.json) | HIGH -- durable cross-session memory | MEDIUM -- new data store + promotion logic | P1 |
| Correction recall at session start | HIGH -- prevents repeating mistakes | LOW -- extend existing session-start command | P1 |
| Live recall within session | MEDIUM -- intra-session awareness | LOW -- corrections already in conversation context; add historical cross-ref | P1 |
| Observer agent implementation | HIGH -- closes the full loop | HIGH -- full agent with aggregation, pattern detection, suggestion generation | P1 |
| Suggestion pipeline writer | HIGH -- completes dead-code suggest flow | MEDIUM -- aggregation logic + write to suggestions.json | P1 |
| Enhanced `/gsd:digest` correction analysis | MEDIUM -- visibility into learning progress | LOW -- new section in existing digest command | P1 |
| Cross-session preference inheritance | MEDIUM -- multi-project consistency | LOW -- two-tier file read, promotion logic | P2 |
| Collaborative skill refinement | MEDIUM -- auto-proposes skill improvements | MEDIUM -- detection logic + proposal format | P2 |
| Preference conditions/scoping | LOW -- edge case handling | MEDIUM -- query engine for conditional preferences | P3 |

**Priority key:**
- P1: Must have for v6.0 to deliver "Claude learns from corrections"
- P2: Should have, meaningfully improves the learning loop; add when P1 is stable
- P3: Nice to have, addresses edge cases

---

## Competitor Feature Analysis

| Feature | Claude Code MEMORY.md | Windsurf Cascade Memories | Cursor Rules | GSD v6.0 Approach |
|---------|----------------------|---------------------------|--------------|-------------------|
| Correction capture | Auto-memory detects recurring corrections, writes to MEMORY.md | Session context persistence; remembers corrections within cascade | `.cursorrules` file; manual, not auto-captured | Hook-based structured capture to sessions.jsonl with diagnosis categories |
| Preference storage | MEMORY.md (200-line limit, unstructured) | In-memory session context (lost between cascades unless manually saved) | `.cursorrules` (manual, static) | preferences.json (structured, unlimited, auto-promoted from corrections) |
| Cross-session recall | First 200 lines of MEMORY.md loaded at session start | Cascade Memories persist within project scope | Rules file always loaded | Correction + preference recall at session start, filtered by phase relevance |
| Pattern detection | None -- MEMORY.md is manual or auto-memory (basic) | None -- no aggregation across sessions | None -- static rules | Observer agent + digest analysis: aggregation, threshold detection, suggestion generation |
| Self-diagnosis | None | None | None | Auto diagnosis on correction: why the mistake happened (5 categories) |
| Skill/rule refinement | Manual MEMORY.md edits | Manual | Manual `.cursorrules` edits | Semi-automated: digest proposes refinements, user reviews via `/gsd:suggest` |

**GSD's key differentiator:** Structured, categorized, threshold-gated learning with a closed feedback loop. Competitors offer passive memory (save notes) or session persistence (remember within conversation). GSD captures corrections, diagnoses root causes, promotes to durable preferences, detects patterns across sessions, and proposes skill refinements -- all with bounded guardrails and human review gates.

---

## Sources

- [Claude Code Memory System](https://code.claude.com/docs/en/memory) -- HIGH confidence (official docs; MEMORY.md structure, auto-memory behavior, 200-line limit)
- [SFEIR Institute - CLAUDE.md Deep Dive](https://institute.sfeir.com/en/claude-code/claude-code-memory-system-claude-md/deep-dive/) -- MEDIUM confidence (third-party analysis; 40% correction reduction claim, memory patterns)
- [Windsurf/Cursor/Copilot Comparison](https://www.builder.io/blog/cursor-vs-windsurf-vs-github-copilot) -- MEDIUM confidence (comparison article; Cascade Memories behavior)
- [Algomox - Agentic AI RCA](https://www.algomox.com/resources/blog/agentic_ai_rca_root_cause/) -- MEDIUM confidence (RCA agent patterns; iterative hypothesis testing, confidence calibration)
- [Cleric AI Agent for RCA](https://www.zenml.io/llmops-database/ai-agent-for-automated-root-cause-analysis-in-production-systems) -- MEDIUM confidence (implicit feedback systems, automated feedback mechanisms)
- Internal: `.planning/PROJECT.md` v6.0 target features -- HIGH confidence (canonical requirements)
- Internal: `commands/gsd/digest.md` -- HIGH confidence (existing digest command structure)
- Internal: `commands/gsd/suggest.md` -- HIGH confidence (existing suggest reader, no writer)
- Internal: `commands/gsd/session-start.md` -- HIGH confidence (existing session-start structure)
- Internal: `.claude/agents/observer.md` -- HIGH confidence (stub agent, TODO noted)
- Internal: `skills/skill-integration/SKILL.md` -- HIGH confidence (bounded learning guardrails, observation protocol)
- Internal: `skills/skill-integration/references/observation-patterns.md` -- HIGH confidence (JSONL schema, signal taxonomy, correction fields)
- Internal: `hooks/gsd-snapshot-session.js` -- HIGH confidence (existing session-end hook pattern)

---

*Feature research for: GSD v6.0 Adaptive Observation and Learning Loop -- correction capture, preference learning, auto self-diagnosis, live recall, observer agent, suggestion pipeline, enhanced digest*
*Researched: 2026-03-10*
