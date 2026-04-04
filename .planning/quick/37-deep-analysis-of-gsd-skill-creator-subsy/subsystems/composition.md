# Composition (Agent Composition)

## What It Is

The composition subsystem is gsd-skill-creator's agent team assembly layer — the mechanism by which individual agents and skills are combined into multi-agent teams with defined handoff contracts, co-activation histories, and emergent capabilities. It is distinct from the chipset architecture (which defines what each agent does) and from the mesh networking layer (which handles cross-session communication): composition specifically handles the question of which agents should work together and under what conditions that pairing is valid. The skill-creator config key `agent_composition` governs this subsystem.

## How It Works

Composition operates on two inputs: co-activation history and co-activation thresholds.

**Co-activation history** — the observation system records which agents and skills are active together in each session. Over time, pairs and groups that consistently co-activate form a pattern. The composition module reads this history from `sessions.jsonl` and computes a co-activation score for each candidate pair.

**Eligibility thresholds** — composition does not propose agent teams speculatively. A team is only proposed when:
- The agent pair (or group) has co-activated for at least **5 sessions** over at least **7 days**. This prevents ephemeral patterns from generating premature team proposals.
- The co-activation score exceeds the confidence threshold (mirrors the observation system's 0.85 confidence floor).
- The proposed team does not violate any declared incompatibility in the skill manifests.

**Team proposal** — once thresholds are met, the composition module generates a team definition: a named group with its constituent agents, the handoff contract between them (what output format the upstream agent must produce for the downstream agent to consume), and an activation condition (the task pattern that triggers this team rather than individual agents).

**Bounded composition** — like the learning system, composition proposals require user confirmation before activation. The 7-day co-activation window and 5-session minimum are the bounded mutation constraints for composition, analogous to the 3-correction minimum and 7-day cooldown in the learning system.

gsdup does not have a composition layer — its 10 agents are invoked individually via GSD commands. The flat agent model works at current scale.

## Integration Verdict for gsdup

**Defer**

Composition adds genuine value when agents are regularly paired in multi-agent workflows — it formalizes what is currently ad-hoc handoff. But the 5-session, 7-day threshold means the system needs multi-agent session history to have anything to analyze. gsdup's sequential, single-agent model does not generate this history today. The effort tier is L (requires the agent routing layer from chipsets as a prerequisite). Trigger condition: revisit when gsdup has at least two agents that consistently co-activate (e.g., gsd-planner + gsd-executor running back-to-back in automated workflows) and when the chipset architecture prototype is in place.

## Action Items

1. Instrument session logging to record which named agents are invoked per session, even without a composition layer, so co-activation history accumulates for future use.
2. Define the handoff contract format (as a simple JSON schema) for the gsd-planner → gsd-executor handoff as a pilot — this is the most consistent agent pairing in gsdup and the best candidate for a future composition rule.
