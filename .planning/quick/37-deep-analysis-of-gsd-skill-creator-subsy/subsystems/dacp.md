# DACP (Data-Augmented Context Protocol)

## What It Is

DACP (Data-Augmented Context Protocol) is gsd-skill-creator's structured bundle format for packaging agent context — data, code, tests, and intent — into a self-describing artifact that agents can exchange without losing fidelity. A DACP bundle is a filesystem artifact with a defined directory structure and a completion marker, enabling agents to hand off not just results but the full context needed to reproduce, verify, or extend those results. The protocol defines five fidelity levels that govern what a bundle contains.

## How It Works

**Fidelity levels (0–4):**

- **Level 0 (prose only)** — a single `intent.md` file describing what the bundle is for and what was done. No structured data, no code. Suitable for brainstorm outputs and lightweight handoffs.
- **Level 1 (prose + manifest)** — `intent.md` + `manifest.json`. The manifest records bundle ID, source agent, fidelity level, timestamp, and checksums for any referenced files. Enables basic tracking without full data.
- **Level 2 (prose + manifest + data)** — adds a `data/` directory. Structured data files (JSON, JSONL, CSV) that back the intent. Suitable for analysis outputs and session summaries.
- **Level 3 (prose + manifest + data + code)** — adds a `code/` directory. Source files implementing the logic described in `intent.md`. Suitable for feature proposals with prototype implementations.
- **Level 4 (prose + manifest + data + code + tests)** — the full bundle: `intent.md` + `manifest.json` + `data/` + `code/` + `tests/`. The `.complete` marker file is written only when all four directories are present and all tests pass. Level 4 is the only fidelity level that is considered "shippable" by the DACP protocol.

**Bundle artifact structure:**
```
<bundle-id>/
  manifest.json        # bundle metadata, checksums, fidelity level
  intent.md            # human-readable description of purpose and contents
  data/                # structured data files (fidelity 2+)
  code/                # source files (fidelity 3+)
  tests/               # test files (fidelity 4 only)
  .complete            # marker file, written only when fidelity 4 and tests pass
```

The protocol does not specify a transport — bundles are filesystem artifacts. Agents exchange bundles by writing to a shared directory and signaling completion via the `.complete` marker. A receiving agent polls for `.complete` before reading the bundle contents.

## Integration Verdict for gsdup

**Defer**

gsdup already uses filesystem-based bundle exchange via JSONL files (`sessions.jsonl`, `gate-executions.jsonl`, `corrections.jsonl`) and Markdown planning documents. This covers the Level 0–2 fidelity range that gsdup's current workflows require. The formal DACP bundle format adds value at Level 3–4 — when gsdup agents need to hand off code and tests as first-class artifacts. That capability is not yet needed in gsdup's sequential, human-in-the-loop model. Trigger condition: revisit when gsdup introduces parallel agent execution or when a workflow requires agents to exchange runnable code bundles, not just data.

## Action Items

1. Document the Level 0–2 overlap between DACP and gsdup's existing JSONL exchange format so the gap is clearly scoped when the trigger condition is evaluated.
2. Review the `manifest.json` schema as a potential enhancement to gsdup's existing JSONL entry schemas — the checksum and fidelity fields may add value even without full DACP adoption.
