# AGC (Autonomous Goal Chasing)

## What It Is

AGC (Autonomous Goal Chasing) is an educational and reference subsystem in gsd-skill-creator that simulates Apollo Guidance Computer hardware for curriculum purposes. It is not an operational agent coordination system — it is a learning module living in `src/agc/` that uses the AGC architecture (1960s-era rope memory, fixed-point math, real-time scheduler) as a teaching analog for constraint-driven engineering. The name is intentionally evocative: just as the original AGC operated under severe resource constraints to achieve a precise goal, gsd-skill-creator's AGC module teaches developers to think in terms of constrained, goal-directed computation.

## How It Works

The AGC module is a TypeScript implementation of key Apollo Guidance Computer concepts:

- **Rope memory simulator** — models the AGC's fixed read-only memory as an immutable instruction store. In the curriculum context, this teaches the difference between persistent learned patterns (rope memory) and working context (erasable RAM).
- **Fixed-point arithmetic engine** — implements the AGC's integer-only math model. Used in the curriculum to illustrate precision constraints and deterministic computation without floating-point ambiguity.
- **Real-time scheduler (EXEC)** — simulates the AGC's cooperative task scheduler. Tasks declare their priority and yield points; the scheduler runs the highest-priority task until it yields. This is the reference model for understanding why gsd-skill-creator's Exec chipset primitive is designed as it is — the chipset Exec is a modern analog of the AGC scheduler.
- **Curriculum integration** — `src/agc/` components are referenced from `.college/` department materials as worked examples of constraint-driven architecture. Students reading the College's engineering curriculum encounter AGC examples as illustrations of broader principles.

The AGC module has no runtime role in skill creation, agent coordination, or workflow management. It does not feed data to any operational subsystem.

## Integration Verdict for gsdup

**Skip**

AGC is explicitly educational and reference-only — it simulates Apollo hardware for curriculum purposes and has no operational role. gsdup has no College curriculum, no educational modules, and no need for Apollo hardware simulation. The integration effort would produce zero operational value. This is correctly categorized as out of scope for gsdup's CLI workflow management focus.

## Action Items

1. No action — document as out-of-scope in RECOMMENDATIONS.md.
