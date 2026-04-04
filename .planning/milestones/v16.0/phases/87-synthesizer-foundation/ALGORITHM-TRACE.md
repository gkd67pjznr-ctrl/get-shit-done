# Algorithm Trace — Cursor Assignment Verification

*Trace date: 2026-04-04*
*Purpose: Manual verification that the synthesizer cursor algorithm produces correct, gap-free, collision-free phase assignments*

## Inputs

```
next_starting_phase = 50
milestones_in_order = [v16.0, v17.0]
```

### Milestone Phase Counts

| Milestone | PROPOSAL.md | Phase Labels | phase_count |
|-----------|-------------|--------------|-------------|
| v16.0 | PROPOSAL-v16.md | PHASE-A, PHASE-B, PHASE-C | 3 |
| v17.0 | PROPOSAL-v17.md | PHASE-A, PHASE-B | 2 |

**Total phases to assign:** 3 + 2 = 5

## Cursor Execution

### Initialization

```
cursor = 50
phase_map = {}
```

### Milestone 1: v16.0 (phase_count = 3)

```
phase_labels = [PHASE-A, PHASE-B, PHASE-C]

i=0: phase_map[v16.0][PHASE-A] = cursor + 0 = 50 + 0 = 50
i=1: phase_map[v16.0][PHASE-B] = cursor + 1 = 50 + 1 = 51
i=2: phase_map[v16.0][PHASE-C] = cursor + 2 = 50 + 2 = 52

cursor += phase_count  →  cursor = 50 + 3 = 53
```

### Milestone 2: v17.0 (phase_count = 2)

```
phase_labels = [PHASE-A, PHASE-B]

i=0: phase_map[v17.0][PHASE-A] = cursor + 0 = 53 + 0 = 53
i=1: phase_map[v17.0][PHASE-B] = cursor + 1 = 53 + 1 = 54

cursor += phase_count  →  cursor = 53 + 2 = 55
```

### Final State

```
cursor = 55  (next available phase number after this synthesis batch)
```

## Phase Map (Final)

| Milestone | Label | Assigned Phase | Name |
|-----------|-------|----------------|------|
| v16.0 | PHASE-A | 50 | Core Foundation |
| v16.0 | PHASE-B | 51 | Feature Implementation |
| v16.0 | PHASE-C | 52 | Integration and Polish |
| v17.0 | PHASE-A | 53 | Auth Foundation |
| v17.0 | PHASE-B | 54 | Session Management |

## Dependency Resolution

Dependencies in PROPOSAL.md use PHASE-X labels. After synthesis, ROADMAP.md must use resolved numbers.

| Milestone | Phase | PROPOSAL depends-on | Resolved to |
|-----------|-------|---------------------|-------------|
| v16.0 | PHASE-A | Nothing (first phase) | Nothing (first phase) |
| v16.0 | PHASE-B | PHASE-A | Phase 50 |
| v16.0 | PHASE-C | PHASE-B | Phase 51 |
| v17.0 | PHASE-A | Nothing (first phase) | Nothing (first phase) |
| v17.0 | PHASE-B | PHASE-A | Phase 53 |

Note: PHASE-A in v17.0 resolves to Phase 53, NOT Phase 50. Labels are milestone-scoped; each milestone's PHASE-A maps to the first phase in that milestone's assigned range.

## Correctness Verification

### No Gaps Check

Phases assigned: 50, 51, 52, 53, 54

Expected range: 50 through 54 (next_starting_phase=50, total=5)

```
50 - 50 = 0  ✓ (sequential from start)
51 - 50 = 1  ✓
52 - 50 = 2  ✓
53 - 50 = 3  ✓
54 - 50 = 4  ✓
Final cursor (55) - next_starting_phase (50) = total phases (5)  ✓
```

No gaps detected.

### No Collisions Check

All assigned phase numbers: {50, 51, 52, 53, 54}

Unique count: 5 = total phases assigned (5)

No collisions detected.

### Cross-Milestone Isolation Check

v16.0 phases: {50, 51, 52}
v17.0 phases: {53, 54}

Intersection: {} (empty set)

No phase number appears in both milestones.

## Summary

The cursor algorithm correctly assigns phases 50-54 with:
- v16.0 receiving phases 50, 51, 52 (PHASE-A, PHASE-B, PHASE-C)
- v17.0 receiving phases 53, 54 (PHASE-A, PHASE-B)
- Final cursor = 55 (ready for next synthesis batch starting at 55)
- Zero gaps, zero collisions across 3 + 2 = 5 total phases
