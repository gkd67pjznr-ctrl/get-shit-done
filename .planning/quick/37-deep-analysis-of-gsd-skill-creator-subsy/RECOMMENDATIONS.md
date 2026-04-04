# gsd-skill-creator Subsystem Integration Recommendations

**Date:** 2026-04-04
**Based on:** Quick task 37 subsystem analysis; Quick task 36 COMPARISON.md
**Scope:** 12 subsystems analyzed — MCP server, chipsets, College, brainstorm, embeddings, mesh,
AGC, DACP, learning, observation, detection, composition

---

## Priority 1 — Integrate Now (highest value, lowest effort)

These subsystems have a clear integration path, no blocking infrastructure prerequisites, and deliver direct value to gsdup's current workflow management focus.

**MCP server** | Effort: M
Scaffold `get-shit-done/bin/lib/mcp-server.cjs` exposing GSD commands (phase status, gate results, session data, skill metrics) as MCP tools over stdio transport using `@modelcontextprotocol/sdk`.
Prerequisite: None — `@modelcontextprotocol/sdk` is a standalone npm package requiring no infrastructure changes.

**Brainstorm engine** | Effort: S
Implement `get-shit-done/bin/lib/brainstorm.cjs` with a three-stage pipeline (seed, expand, normalize) and add a `/gsd:brainstorm` slash command that writes structured `FEATURE-IDEAS.md` output.
Prerequisite: None — the core structured output pattern does not require embeddings or postgres.

**Learning system (gap closure)** | Effort: S
The core learning system is already integrated in gsdup (v4.0). The remaining gap is `SKILL-HISTORY.md` append with 50-entry rotation and `.gitattributes merge=union` — already tracked as v9.0 phase 39-01.
Prerequisite: Phase 38 complete (skills_loaded data must be real before correction attribution is accurate).

**Observation system (gap closure)** | Effort: S
The observation pipeline (sessions.jsonl, corrections.jsonl, preferences.jsonl) is operational. The gap is verifying determinism (0.95) and confidence (0.85) threshold enforcement in `analyze-patterns.cjs` and implementing or stubbing Stage 3 auto-promotion.
Prerequisite: None — this is a code completeness check, not a new integration.

**Detection (gap closure)** | Effort: S
`skill-metrics.cjs` with `CATEGORY_SKILL_MAP` attribution is implemented (v9.0 phase 41). The remaining gap is reliable input: `skills_loaded` in sessions.jsonl must be populated (phase 38 prerequisite) for attribution scores to be accurate.
Prerequisite: Phase 38 complete.

---

## Priority 2 — Defer (clear trigger condition exists)

These subsystems have genuine long-term value but are premature given gsdup's current scale or architecture.

**College structure** | Effort: S-M
Trigger condition: Revisit when gsdup's skill count exceeds 34, or when a new milestone introduces 10+ domain-specific skills that don't fit the current flat `.claude/skills/` structure.
Do not build yet: the full College runtime (calibration, safety layers, cross-references, 43-department hierarchy) — adopt only the directory hierarchy skeleton, not the runtime machinery.

**Embeddings** | Effort: L
Trigger condition: Revisit when gsdup's skill count exceeds 50, at which point semantic search provides disambiguation value that keyword overlap cannot deliver.
Do not build yet: postgres vector storage or the `@huggingface/transformers` pipeline — the JSON-based cache mode is available without postgres, but even that adds model download overhead unjustified below 50 skills.

**Chipsets** | Effort: L
Trigger condition: Revisit when gsdup moves beyond 10 agents or when a workflow requires true parallel agent execution with explicit bus arbitration.
Do not build yet: the Amiga chip model (Agnus/Denise/Paula) or Gastown — prototype only after an agent routing layer exists in gsdup.

**DACP** | Effort: M
Trigger condition: Revisit when gsdup introduces parallel agent execution or when a workflow requires agents to exchange runnable code bundles (Level 3–4 fidelity), not just data.
Do not build yet: the full bundle protocol — gsdup's existing JSONL exchange (Sessions, gates, corrections) already covers Level 0–2 fidelity. Build only when Levels 3–4 are needed.

**Composition** | Effort: L
Trigger condition: Revisit when at least two gsdup agents consistently co-activate across 5+ sessions over 7+ days and when the chipset architecture prototype is in place.
Do not build yet: any team-assembly logic — there is no co-activation history to analyze in gsdup's current sequential, single-agent model.

---

## Priority 3 — Skip (out of scope for gsdup)

These subsystems are correctly out of scope given gsdup's architectural boundaries and design goals.

**AGC (Autonomous Goal Chasing)** — AGC is an educational simulation of Apollo Guidance Computer hardware for curriculum purposes; gsdup has no College curriculum and no need for Apollo hardware simulation.

**Mesh networking** — gsdup is intentionally sequential and single-agent; mesh networking requires replacing the linear plan/execute/verify cycle with a persistent multi-agent goal graph, which conflicts with the predictability that quality gating depends on.

---

## Consolidated Action List

These are the concrete next steps for all Priority 1 items, ordered so foundational steps precede dependent steps. Each item is actionable by a developer opening this file cold.

1. Complete v9.0 phase 38: populate `skills_loaded` in `sessions.jsonl` entries and add `skills_active` to `gate-executions.jsonl` — this is the data prerequisite for detection and learning gap closure.
2. Audit `analyze-patterns.cjs` to verify the determinism (0.95) and confidence (0.85) thresholds are enforced as numeric comparisons; implement or stub Stage 3 auto-promotion with a comment citing these thresholds.
3. Complete v9.0 phase 39-01: implement `SKILL-HISTORY.md` append with 50-entry rotation and `.gitattributes merge=union` for each skill directory that receives a refinement.
4. Verify that the 3-correction minimum, 20% max change, and 7-day cooldown bounds are tested in `corrections.cjs` unit tests; add tests for any bound not currently covered.
5. Add `@modelcontextprotocol/sdk` to `package.json` and scaffold `get-shit-done/bin/lib/mcp-server.cjs` with a single server exposing `phase_status`, `gate_results`, `session_data`, and `skill_metrics` tools.
6. Add a `mcp` CLI subcommand to `gsd-tools.cjs` that starts the MCP server and write a v9.0 phase plan for MCP scaffolding linked to the existing roadmap MCP entry.
7. Create `get-shit-done/bin/lib/brainstorm.cjs` implementing the three-stage pipeline (seed, expand, normalize) and add `/gsd:brainstorm` to `.claude/commands/gsd/`.
8. Update `CATEGORY_SKILL_MAP` in `skill-metrics.cjs` whenever new skills are added to `.claude/skills/` — stale map entries produce low-confidence attribution scores.

---

## v9.0 Alignment

The v9.0 Signal Intelligence milestone (phases 37–42) is directly aligned with the Priority 1 gap closures. Phase 38 (Skill Call Tracking) is the shared prerequisite for both detection accuracy and learning system completeness — it unlocks items 1, 3, and 4 in the Consolidated Action List above. Phase 39-01 (skill iteration history) maps directly to the learning system gap closure in item 3. Phases 40–42 (session report, skill quality metrics, skill relevance scoring) build the analytics surface on top of the observation and detection systems.

The MCP server (Consolidated Action List items 5–6) is the one Priority 1 item not yet covered by v9.0 phases. The v9.0 roadmap references "MCP server selection intelligence" as in scope but does not yet have a phase for gsdup acting as an MCP server. A new phase (candidate: Phase 43, post-v9.0) or an extension to Phase 42 should be added to the v9.0 or v10.0 roadmap for MCP server scaffolding.

The brainstorm engine (item 7) is also not a current v9.0 phase. It is a standalone S-effort addition that does not depend on any v9.0 prerequisite and could be executed as a quick task at any point.

---

## Key Constraints Honored

- gsdup remains CJS/Node.js CLI-first — no Tauri desktop app, no TypeScript ESM rewrite of the CLI core until explicitly planned.
- Postgres is not adopted as part of any Priority 1 recommendation — embeddings at scale (the only postgres use case) is firmly Defer.
- AGC and mesh networking are out of scope — their architectures conflict with gsdup's sequential, single-agent, quality-gated execution model.
- The v4.0 integration boundary is clean (16 legacy artifacts removed in quick task 35) — no `/sc:*` or `/wrap:*` commands are reintroduced.
- Skill bulk import from gsd-skill-creator is explicitly forbidden — cherry-pick only, with review, to avoid context budget inflation.
- Full College runtime is not adopted — only the directory hierarchy skeleton is considered, and only when skill count triggers the condition (>34).
- All skill mutations (learning system refinements) require explicit user confirmation with no bypass path, including in YOLO mode.
- `.planning/patterns/` must remain in `.gitignore` — pattern data must not leak into shared repositories.
