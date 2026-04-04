# Observation System

## What It Is

The observation system is gsd-skill-creator's pattern detection pipeline — the data collection layer that feeds the learning system. It watches agent activity during sessions, records tool sequences and correction events to JSONL append logs, and promotes high-signal deterministic patterns to bash scripts for future automation. gsdup adopted the observation system in the v4.0 integration; the core pipeline (`sessions.jsonl`, `corrections.jsonl`, `preferences.jsonl`) is operational. The gap is primarily in the auto-promotion threshold logic.

## How It Works

The observation system operates in three stages:

**Stage 1: Event recording** — every tool call sequence, correction event, and preference decision during a session is appended to the relevant JSONL log (`sessions.jsonl` for tool patterns, `corrections.jsonl` for user fixes). Each entry is timestamped and tagged with a session ID and phase context. The append-only format ensures no data is lost and the log is auditable.

**Stage 2: Pattern analysis** — after each session, the pattern analysis hook (`analyze-patterns.cjs`) reads recent JSONL entries and computes two scores per candidate pattern:
- **Determinism score** — how consistently a tool sequence produces the same outcome across sessions (threshold: **0.95** to qualify for promotion).
- **Confidence score** — how often the pattern was followed without user correction (threshold: **0.85** to qualify for promotion).

Patterns that exceed both thresholds are flagged as promotion candidates.

**Stage 3: Auto-promotion** — patterns that exceed both thresholds can be auto-promoted to bash scripts. The promotion writes a shell script to `.planning/patterns/scripts/` and records the promotion event in `preferences.jsonl`. Auto-promotion applies only to purely deterministic tool sequences (file reads, git commands, test runs) — it never applies to LLM-backed operations where output varies.

gsdup has Stages 1 and 2 operational. The auto-promotion (Stage 3) and the specific threshold enforcement (0.95 determinism, 0.85 confidence) are present in the skill-integration skill documentation but may not be fully enforced in code. The v9.0 phase 38 work (populating `skills_loaded` in sessions.jsonl) is a prerequisite for Stage 2 to produce accurate attribution data.

## Integration Verdict for gsdup

**Integrate**

The observation system is already integrated in gsdup. The remaining work is verifying threshold enforcement in `analyze-patterns.cjs` and ensuring Stage 3 auto-promotion is implemented or explicitly deferred. The effort tier is S — this is a completeness check and targeted code addition, not a new integration. No new infrastructure required.

## Action Items

1. Audit `analyze-patterns.cjs` to verify the determinism (0.95) and confidence (0.85) thresholds are enforced as numeric comparisons, not documentation-only assertions.
2. Implement or explicitly stub Stage 3 auto-promotion in `analyze-patterns.cjs` — if deferred, add a TODO comment citing these exact thresholds so the next implementer has the spec.
3. Confirm that `.planning/patterns/` is in `.gitignore` (security requirement — pattern data must not leak into shared repos).
