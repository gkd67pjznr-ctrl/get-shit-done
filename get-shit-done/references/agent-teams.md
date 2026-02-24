# Agent Teams: Research Findings (TEAM-01)

**Research status:** Complete — findings documented
**Scope:** v2.0 inter-milestone concurrency vs v2.1 intra-milestone parallelism

---

## Summary

Agent Teams is a Claude Code feature for parallel task execution within a single session.
It allows multiple sub-agents to work simultaneously on independent tasks under one orchestrator.

**Key finding:** Agent Teams is suitable for intra-milestone parallelism (v2.1 scope) but NOT for inter-milestone concurrency (v2.0 scope). These are fundamentally different problems that require different solutions.

---

## Why Agent Teams Does NOT Solve Inter-Milestone Concurrency (v2.0)

Inter-milestone concurrency is the scenario where two separate Claude Code sessions run simultaneously, each working on a different milestone (e.g., v2.0 and v2.1 in parallel workspaces).

**The incompatibilities:**

1. **Session model mismatch.** Each concurrent milestone runs in its own independent Claude Code session, started separately by different users or processes. Claude Code session resumption is not compatible with Agent Teams' execution model — Agent Teams requires a parent orchestrator session to remain active and in context while sub-agents run.

2. **Cross-session coordination is not supported.** Agent Teams sub-agents share context with their parent session. There is no mechanism for cross-session state sharing between two independently-launched Claude Code sessions. Milestone isolation requires filesystem-level separation, not sub-agent coordination.

3. **The v2.0 solution is already correct.** The workspace isolation approach — separate planning roots per milestone, explicit `--milestone` flag threading, file-based `STATUS.md` polling aggregated at read time — provides the right level of isolation for concurrent milestone sessions. This is peer-to-peer isolation, not hierarchical coordination.

**Conclusion:** Inter-milestone concurrency = two separate Claude Code sessions, each knowing only its own `--milestone` workspace. Agent Teams cannot bridge independent sessions.

---

## Why Agent Teams IS Promising for Intra-Milestone Parallelism (v2.1)

Intra-milestone parallelism is the scenario where multiple independent phases within a single milestone run concurrently. This is explicitly wave-based execution — a single orchestrator spawns multiple sub-agents, each executing a different phase plan.

**The fit:**

1. **Single session, shared orchestrator.** All phase sub-agents run under one parent session. The orchestrator already has context for the milestone scope and can pass the same `MILESTONE_FLAG` to each sub-agent.

2. **Architecture is ready.** The workspace isolation foundation built in v2.0 (`planningRoot`, `detectLayoutStyle`, `milestoneScope` threading) ensures each sub-agent operates in the same milestone workspace using the same planning root. No cross-workspace contamination.

3. **Independence requirement is already enforced.** Wave-based execution already groups phases by dependency. Phases in the same wave have no dependency overlap and no shared files — exactly the condition Agent Teams requires for safe parallelism.

4. **The `/gsd:execute-phase` orchestrator pattern maps naturally.** The existing `Task()` spawning pattern in execute-phase.md is the natural integration point. Replacing sequential Task() calls within a wave with parallel Agent Teams tasks requires minimal architectural change.

---

## What Was Built in v2.0 (Foundation for Future Agent Teams)

The v2.0 milestone-scoped routing layer provides direct value for future Agent Teams integration:

- `planningRoot(cwd, milestoneScope)` — each Agent Teams sub-agent can call this with the same `milestoneScope`, guaranteeing all path lookups land in the correct milestone workspace
- `detectLayoutStyle(cwd)` — determines whether to apply milestone scoping, letting sub-agents work correctly in both legacy and milestone-scoped projects
- `--milestone` flag threading in all workflow files — orchestrators can pass milestone context to sub-agents without sub-agents needing to re-discover their workspace
- `STATUS.md` per-milestone files — each sub-agent writes to its own workspace without coordination overhead

---

## Deferred to v2.1

The following requirements are explicitly deferred:

| Requirement | Description | Phase |
|-------------|-------------|-------|
| **TEAM-02** | Scaffold/hook points in architecture for Agent Teams integration for parallel phases within a single milestone | v2.1 |
| **TEAM-03** | `/gsd:parallel-phases` workflow using Agent Teams for intra-milestone phase parallelism | v2.1 |

These require designing the Agent Teams integration pattern within `/gsd:execute-phase`, defining how the orchestrator detects wave parallelism candidates, and validating that the workspace isolation foundation actually prevents conflicts in practice.

---

## Decision Record

**Decision (Phase 12, v2.0):** Agent Teams deferred to v2.x — wrong for inter-milestone concurrency; session resumption not supported.

**Rationale:** The correct solution for v2.0 is workspace isolation + explicit `--milestone` flag threading. This solves the actual problem (concurrent sessions writing to different planning roots) without requiring Agent Teams coordination infrastructure that would not work across independent sessions.

**Impact:** TEAM-01 requirement satisfied (research documented). TEAM-02 and TEAM-03 remain in backlog for v2.1 planning.

---

*Research completed: Phase 12 (2026-02-24)*
*Requirement: TEAM-01*
