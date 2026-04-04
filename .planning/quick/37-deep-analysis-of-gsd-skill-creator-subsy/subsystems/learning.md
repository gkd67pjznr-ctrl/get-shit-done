# Learning System

## What It Is

The learning system is gsd-skill-creator's bounded mutation engine for skills. It observes user corrections, accumulates evidence, and proposes skill refinements when the evidence crosses defined thresholds — but never applies changes without explicit user confirmation. The "bounded" qualifier is load-bearing: the system is deliberately constrained to prevent runaway self-modification while still enabling meaningful adaptation over time. gsdup has adopted the core learning loop from gsd-skill-creator as part of the v4.0 integration; what remains is a delta, not a gap.

## How It Works

The learning system operates on three data signals: correction events (user fixes agent output), preference promotions (high-confidence patterns elevated to cross-project inheritance), and skill quality scores (correction rate per skill over time).

Bounded mutation rules — these are exact and non-negotiable:

- **Minimum 3 corrections** before a refinement is proposed. One or two corrections could be noise; three is the evidence floor.
- **Maximum 20% content change** per refinement cycle. Larger proposed changes are rejected and the user is asked to break them into smaller steps.
- **7-day cooldown** between refinements of the same skill. Prevents the system from thrashing on a skill that is still accumulating signal.
- **Mandatory user confirmation** for every refinement, with no bypass path. Even in YOLO mode (which applies to GSD workflow commands), skill modifications require explicit user approval.

The pipeline: corrections accumulate in `corrections.jsonl` → the `/gsd:digest` command aggregates them → `/gsd:suggest` surfaces refinement candidates that pass the three thresholds → `/gsd:refine-skill` applies a specific refinement to a skill file after user confirmation → the skill's `SKILL-HISTORY.md` records the change as a unified diff entry.

gsdup has the full pipeline in place. The remaining gap vs. gsd-skill-creator's implementation is the `SKILL-HISTORY.md` append (skill iteration history with 50-entry rotation) — this is tracked as phase 39-01 in the v9.0 roadmap.

## Integration Verdict for gsdup

**Integrate**

The core learning system is already integrated in gsdup (v4.0 integration, 2026-03-09). The remaining work is closing the `SKILL-HISTORY.md` gap from gsd-skill-creator's implementation — specifically the 50-entry rotation and `.gitattributes merge=union` strategy for merge safety. This is a targeted addition, not a new integration. Effort tier is S (the phase 39-01 plan already exists in v9.0).

## Action Items

1. Complete phase 39-01 (v9.0 roadmap): implement `SKILL-HISTORY.md` append with 50-entry rotation and `.gitattributes merge=union` for each skill directory that receives a refinement.
2. Verify that the 3-correction minimum, 20% max change, and 7-day cooldown bounds are enforced in `corrections.cjs` — add a unit test for each bound if not already present.
3. Confirm that the `/gsd:refine-skill` command rejects skill modifications in YOLO mode (YOLO bypass must not apply to skill mutations).
