# Mesh Networking

## What It Is

The mesh networking subsystem is gsd-skill-creator's multi-agent coordination layer, enabling agents to communicate, hand off state, and pursue goals across sessions and process boundaries. It is the infrastructure layer that makes the AGC (Autonomous Goal Chasing) subsystem possible. The mesh is architecturally distinct from the chipset layer: chipsets define what each agent does and how agents are composed into teams; the mesh defines how those teams communicate across time and process isolation.

## How It Works

The mesh operates as a peer-to-peer message bus with persistent state routing. Key mechanisms:

- **State persistence across sessions** — agents write their current goal state to a shared store (file-based or postgres-backed depending on scale) that survives process termination. On restart, an agent reads its persisted state and resumes from the last checkpoint rather than starting cold.
- **Handoff protocols** — when one agent's output becomes another agent's input, the mesh packages the handoff as a typed message with a source, destination, payload schema, and sequence number. Receiving agents validate the schema before consuming the payload.
- **Goal propagation** — long-horizon goals are decomposed into sub-goals distributed across agents in the mesh. Each agent tracks its sub-goal completion and signals the mesh when done; the mesh aggregates signals and determines when the parent goal is satisfied.
- **Cross-session continuity** — the mesh maintains a goal graph (DAG) that persists between sessions. When a new session starts, the mesh hydrates the relevant sub-graph for the agent being launched and provides it as context.

## Integration Verdict for gsdup

**Skip**

gsdup is intentionally sequential and single-agent. Mesh networking requires a fundamental change to the execution model — replacing the linear plan/execute/verify cycle with a persistent, multi-agent goal graph. This is architecturally out of scope for the current milestone set and conflicts with the predictability that gsdup's quality gating pipeline depends on. The effort tier is XL (COMPARISON.md Section 3G). This is not a value judgment on mesh networking; it is a correct architectural boundary for gsdup's design goals.

## Action Items

1. No action — document as out-of-scope in RECOMMENDATIONS.md.
