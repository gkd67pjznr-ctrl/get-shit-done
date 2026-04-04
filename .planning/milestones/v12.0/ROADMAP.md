# Roadmap — Milestone v12.0 Quality Enforcement Evolution

*Created: 2026-04-04*

## Overview

Three targeted quality enforcement additions: a deterministic ESLint MCP gate that fires on code file writes (extending the v8.0 PostToolUse hook pattern), mechanical DONE criteria verification at phase transitions (so phase completion is verifiable, not prose-based), and test count trending across milestones (extending v9.0 phase-benchmarks.jsonl). Each addition is independent, additive, and config-gated by quality level.

## Phases

- [~] **Phase 50: ESLint Gate** - Wire ESLint MCP as a PostToolUse quality gate on .ts/.js/.cjs writes
- [ ] **Phase 51: Transition Guards** - Parse and mechanically verify DONE criteria before phase completion
- [ ] **Phase 52: Test Trending** - Track test count per plan and surface delta in progress/digest

## Phase Details

### Phase 50: ESLint Gate
**Goal**: ESLint runs automatically on every code file write and its results persist alongside existing gate data
**Depends on**: Nothing (extends existing PostToolUse hook, no phase dependency)
**Requirements**: LINT-01, LINT-02, LINT-03, LINT-04, LINT-05
**Success Criteria** (what must be TRUE):
  1. Writing a .ts, .js, or .cjs file triggers an ESLint MCP call automatically via PostToolUse hook
  2. ESLint gate results appear in gate-executions.jsonl with gate_type "eslint_gate"
  3. fast mode skips the gate, standard mode warns, strict mode blocks on lint errors — matching existing gate behavior
  4. When ESLint MCP server is unavailable, execution continues without error and degradation is logged
  5. Dashboard Gate Health page shows eslint_gate metrics without any dashboard code changes
**Plans**: TBD

Plans:
- [x] 50-01: Wire ESLint MCP PostToolUse hook with quality-level gating and graceful degradation
- [ ] 50-02: Verify gate-executions.jsonl persistence and Dashboard Gate Health aggregation

### Phase 51: Transition Guards
**Goal**: Phase completion mechanically verifies DONE criteria extracted from plan tasks, surfacing failures before the verifier agent runs
**Depends on**: Phase 50
**Requirements**: GUARD-01, GUARD-02, GUARD-03, GUARD-04, GUARD-05
**Success Criteria** (what must be TRUE):
  1. DONE criteria in `<done>` tags are parsed into structured assertions (file exists, export present, test passes) automatically
  2. Each assertion is checked against the codebase before verify_phase_goal proceeds
  3. When all assertions pass, the verifier agent runs as normal
  4. When an assertion cannot be verified automatically, it is surfaced to the user as a required human check rather than silently passing
  5. fast mode skips guards, standard mode warns on failure, strict mode blocks on failure
**Plans**: TBD

Plans:
- [ ] 51-01: DONE criteria parser — extract assertions from `<done>` tags in PLAN.md files
- [ ] 51-02: Verification engine — check file-exists, grep-for-export, and test-execution assertions
- [ ] 51-03: Integrate guards into verify_phase_goal with quality-level gating and human-check surfacing

### Phase 52: Test Trending
**Goal**: Test count is tracked at plan completion and surfaced as a delta so regressions and growth are visible in progress and digest output
**Depends on**: Phase 51
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Running /gsd:execute-plan captures the current test count via test runner output parsing at plan completion
  2. phase-benchmarks.jsonl entries include test_count and test_delta fields for every completed plan
  3. /gsd:progress shows current test count with delta since the last milestone's final benchmark
  4. /gsd:digest includes a test count trend table across completed milestones
**Plans**: TBD

Plans:
- [ ] 52-01: Test count extraction at plan completion and phase-benchmarks.jsonl field additions
- [ ] 52-02: Surface test count delta in /gsd:progress and /gsd:digest

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 50. ESLint Gate | 1/2 | In progress | - |
| 51. Transition Guards | 0/3 | Not started | - |
| 52. Test Trending | 0/2 | Not started | - |
