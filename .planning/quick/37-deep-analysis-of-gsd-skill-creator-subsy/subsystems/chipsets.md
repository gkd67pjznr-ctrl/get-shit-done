# Chipsets

## What It Is

The chipset architecture is gsd-skill-creator's composable agent coordination layer, modeled after Amiga hardware components. Rather than a flat list of agents, chipsets define discrete processing units with explicit roles — each "chip" handles a specific category of work (DMA scheduling, output rendering, I/O brokering) and they are wired together at runtime to form agent teams. The system spans two source trees: `src/amiga/` for the Amiga-inspired chip definitions and `src/chipset/` for the Gastown chipset and shared composables (Copper, Blitter, Exec).

## How It Works

Five subsystems compose the full chipset architecture:

- **AMIGA (Agnus)** — the DMA scheduler. Agnus controls which chip gets bus access and when, analogous to a task scheduler. In agent terms, Agnus decides which agent runs next and what data it receives, preventing resource contention in multi-agent workflows.
- **AMIGA (Denise)** — the output renderer. Denise takes the data produced by Agnus-scheduled work and formats it for display or downstream consumption. In agent terms, this is the "presentation" layer of a pipeline.
- **AMIGA (Paula)** — the I/O broker. Paula handles audio and peripheral I/O in the original Amiga; in the chipset model, it abstracts external input sources — tool calls, file reads, API requests — so agents don't talk to I/O directly.
- **Gastown** — a higher-level chipset built on top of the Amiga model. Gastown (`src/chipset/gastown/`) implements team-level workflow patterns: handoff protocols, parallel branch execution, and result aggregation.
- **Copper / Blitter / Exec** — three composable primitives shared across chipsets. Copper handles sequencing (co-processor instructions), Blitter handles bulk data movement between agents, and Exec is the kernel — the lightweight OS layer managing memory allocation and inter-chip messaging.

Chips are instantiated and wired via configuration objects rather than hardcoded wiring. A team definition declares which chips are active, what their input/output contracts are, and how Exec arbitrates between them. This makes the architecture composable: you can assemble a team from a subset of chips without modifying any chip's internal logic.

## Integration Verdict for gsdup

**Defer**

The chipset architecture is architecturally ahead of gsdup's current single-agent, sequential execution model. Chipsets add genuine value — they make multi-agent handoffs composable and introspectable — but that value only materializes once gsdup has an agent routing layer. The effort tier is L (COMPARISON.md Section 3C), and the prerequisite is v9.0 signal intelligence proving out multi-agent coordination patterns. Revisit when gsdup moves beyond 10 agents or when a workflow requires true parallel agent execution.

## Action Items

1. Document the chipset architecture in `.planning/research/` as a reference design for when gsdup's agent count and coordination complexity warrant adoption.
2. Identify the minimal Exec + Gastown handoff protocol as the candidate first chip to prototype — it has the most direct analog to gsdup's existing agent handoff patterns.
