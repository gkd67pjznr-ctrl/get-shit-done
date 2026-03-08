# Team Config Agent ID Verification

**Verified:** 2026-03-07
**Requirement:** TEAM-02

## Summary

Two team schemas exist. `code-review` and `doc-generation` use a member schema
without `agentId` fields -- they are not applicable to this verification. `gsd-debug`
and `gsd-research` use member schemas with `agentId` fields.

## Canonical Agent Basenames

Derived from `agents/*.md` in the gsdup repo:

- `gsd-codebase-mapper`
- `gsd-debugger`
- `gsd-executor`
- `gsd-integration-checker`
- `gsd-nyquist-auditor`
- `gsd-phase-researcher`
- `gsd-plan-checker`
- `gsd-planner`
- `gsd-project-researcher`
- `gsd-research-synthesizer`
- `gsd-roadmapper`
- `gsd-verifier`

## gsd-debug.json

- `leadAgentId: "gsd-debug-lead"` -- NO MATCH (team-internal coordinator role)
- Member `agentId: "gsd-debugger-alpha"` -- NO MATCH (team-internal investigator role)
- Member `agentId: "gsd-debugger-beta"` -- NO MATCH (team-internal investigator role)
- Member `agentId: "gsd-debugger-gamma"` -- NO MATCH (team-internal investigator role)

**Assessment:** These IDs are intentional team-internal roles, not references to standalone
GSD agents. The gsd-debug team spawns ephemeral investigators -- they don't need to
correspond to agents/*.md files.

## gsd-research.json

- Member `agentId: "gsd-research-synthesizer"` -- MATCH (agents/gsd-research-synthesizer.md)
- Other member `agentId`s (gsd-researcher-stack, gsd-researcher-features, gsd-researcher-architecture, gsd-researcher-pitfalls) -- NO MATCH (team-internal researcher roles)

**Assessment:** The synthesizer role references a canonical agent. Researcher roles are
team-internal. No changes needed.

## code-review.json

No `agentId` fields. Members use `{name, role, description}` schema. Not applicable.

## doc-generation.json

No `agentId` fields. Members use `{name, role, description}` schema. Not applicable.

## Verdict

TEAM-02 satisfied. Agent IDs have been verified. Team-internal roles are intentional
and do not need to match standalone agent files. The one cross-reference
(`gsd-research-synthesizer`) correctly matches its agent file.
