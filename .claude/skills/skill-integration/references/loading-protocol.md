# Skill Loading Protocol -- Full Reference

## Overview

The 6-stage pipeline determines which skills are loaded into context before any GSD phase executes.

1. **Score** -- Run `node get-shit-done/bin/gsd-tools.cjs skill-score --task "current task description"` to rank skills by Jaccard keyword overlap against the task description. Use `--raw` for JSON output. Skills are sorted by `final_score` descending — use this order when selecting which SKILL.md files to read fully versus skim within the context budget.
2. **Resolve** -- Handle conflicts between project-level and user-level skills. Project-level always wins. Deduplicate by skill name.
3. **ModelFilter** -- Filter skills by model compatibility. Some skills are model-specific (e.g., vision skills only for multimodal models).
4. **CacheOrder** -- Prioritize recently activated skills. Skills used in the last 3 sessions rank higher than dormant ones.
5. **Budget** -- Enforce 2-5% context window maximum. Calculate total token cost of selected skills. Trim lowest-scored skills if over budget.
6. **Load** -- Read selected SKILL.md files into context. Log which skills were loaded and which were deferred.

## Priority Algorithm

When multiple skills compete for budget:

- Phase-relevant skills get highest priority (testing skills during `verify-work`)
- Recently activated skills (last 3 sessions) rank above dormant
- Project-level overrides user-level duplicates by name
- If budget exceeded, queue overflow skills and note in context what was deferred

## Scoring CLI

The scoring command is:
```bash
node get-shit-done/bin/gsd-tools.cjs skill-score --task "description of current task"
```

Output (non-raw): ranked table of skills with scores.
Output (`--raw`): JSON array `[{ skill: string, score: number }, ...]` sorted by score descending.

Cache: scores are cached in `.planning/patterns/skill-scores.json` with per-skill MD5 content hashes. The cache is invalidated automatically when SKILL.md content changes or the task description changes. No manual cache clearing needed.

## Subagent Context

When forking subagent contexts for GSD phases:

- Include relevant skills in the subagent prompt
- Skills are part of "clean context" -- clean means no stale conversation, not no knowledge
- A subagent without skills repeats solved problems and throws away learned knowledge
- Both `execute-phase` and `verify-work` subagents need skill access

## Loading Locations

| Location | Type | Precedence |
|----------|------|------------|
| `.claude/commands/` | Project-level commands | Highest |
| `.claude/skills/` | Project-level skills | Highest |
| `~/.claude/commands/` | User-level commands | Fallback |

- Project-level takes precedence on conflict (same skill name)
- Load SKILL.md for each, check description against current task
- Skills with no description match are deprioritized, not excluded
- Log loading decisions for observability

## Budget Calculation

The 2-5% budget is calculated against the model's context window:

- 200k context window: 4k-10k tokens for skills
- Skills averaging ~150 lines: roughly 5-15 skills fit within budget
- Overflow is queued, not silently dropped -- always note what was deferred
- If zero skills fit, log a warning but do not block phase execution
