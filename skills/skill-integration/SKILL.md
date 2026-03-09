---
name: skill-integration
description: >
  Manages adaptive learning integration with GSD workflows including skill
  loading, session observation, bounded learning guardrails, and pattern
  detection. Use this skill whenever: executing any GSD phase (to ensure
  relevant skills are loaded first), starting or resuming a work session
  (to check for pending suggestions), the user asks about skills, patterns,
  or observation status, performing code changes that might represent
  repeating patterns, the user corrects Claude's output (highest-signal
  observation), or when skill refinement, creation, or suggestion review
  is discussed. Critical for maintaining the adaptive learning layer.
user-invocable: true
---

# Skill-Creator Integration

Manages skill loading, observation, and bounded learning for the GSD ecosystem. Ensures learned knowledge persists across sessions and subagent contexts.

## Skill Loading Before GSD Phases

Before executing any GSD phase, load relevant generated skills:

1. Check `.claude/skills/` for project-level skills
2. Check `~/.claude/skills/` for user-level skills
3. Project-level skills take precedence over user-level on conflict
4. Load only skills relevant to the current phase and task
5. Respect the token budget: 2-5% of context window maximum

**Critical:** When forking subagent contexts for GSD phases (`execute-phase`, `verify-work`), include relevant skills in the subagent's context. Clean context means free of stale conversation history -- not free of learned knowledge.

For full 6-stage pipeline details, see `references/loading-protocol.md`.

## Token Budget Management

The 6-stage skill loading pipeline (Score, Resolve, ModelFilter, CacheOrder, Budget, Load) manages what gets loaded. When multiple skills compete for budget:

1. Phase-relevant skills get priority (e.g., testing skills during `verify-work`)
2. Recently activated skills rank higher than dormant ones
3. Project-level skills override user-level duplicates
4. If budget is exceeded, queue overflow skills and note what was deferred

## Session Observation Protocol

During all work sessions, maintain awareness of patterns worth capturing:

- Tool sequences that repeat across sessions (e.g., `git log -> read file -> edit -> test -> commit`)
- File patterns consistently touched during specific GSD phases
- Commands run after test failures or verification issues
- Corrections the user makes to agent output -- these are the highest-signal observations
- Phase outcomes: success, failure, partial, and what was different

If `.planning/patterns/` exists, record observations to `sessions.jsonl` in that directory. This data feeds the adaptive learning pattern detection pipeline.

For observation taxonomy, signal strength ranking, and JSONL schema, see `references/observation-patterns.md`.

## Bounded Learning Guardrails

**These constraints are NON-NEGOTIABLE:**

- Maximum 20% content change per skill refinement
- Minimum 3 corrections before a refinement is proposed
- 7-day cooldown between refinements of the same skill
- All refinements require user confirmation
- Skill generation never skips permission checks
- Agent composition requires 5+ co-activations over 7+ days

For rationale and enforcement details, see `references/bounded-guardrails.md`.

## Phase Transition Hooks

After completing any GSD phase transition, check for skills that should trigger:

| GSD Event | Check For |
|-----------|-----------|
| `plan-phase` completes | Skills triggered by planning completion, docs regeneration |
| `execute-phase` completes | Skills triggered by execution progress, state updates |
| `verify-work` completes | Skills triggered by verification results, test patterns |
| `complete-milestone` completes | Skills triggered by milestone completion, docs finalization |
| Any `.planning/` file write | Dashboard regeneration if gsd-planning-docs skill is installed |

Run matching skills **after** the phase completes, not during -- avoid adding overhead to the critical path.

## Skill Suggestions

At the start of each new session, check for pending suggestions. If suggestions exist with high confidence (3+ pattern occurrences), briefly notify the user:

> "A repeating pattern has been detected: [brief description]. Run `/gsd:suggest` to review."

**Never auto-apply suggestions. Always require explicit user confirmation.** This is a core safety principle of the bounded learning system.

## When to Suggest Skill Creation

**Suggest creating a skill when:**

- You notice the same sequence of steps has occurred 3+ times
- The user corrects the same kind of output repeatedly
- A workflow is complex enough to benefit from codification
- The user asks "why do I keep having to tell you this?"

**Suggest naturally:**

```
I've noticed we run the same lint -> test -> fix cycle after every code change.
Want me to capture this as a skill so it happens automatically? Run `/gsd:suggest`
to see if it's already been detected, or describe what you'd like to codify.
```

## Anti-Patterns

- Do not execute GSD phases without checking for relevant learned skills first
- Do not auto-apply skill suggestions -- always require user confirmation
- Do not load skills that exceed the token budget -- defer and note what was skipped
- Do not ignore user corrections -- they are the primary signal for skill refinement
