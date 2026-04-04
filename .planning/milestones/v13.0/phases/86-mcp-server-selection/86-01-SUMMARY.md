---
phase: 86
plan: "01"
status: complete
completed: "2026-04-04"
duration_minutes: 25
commits:
  - a7c6d30
  - 5022510
  - 21e86b2
---

# Summary — Plan 86-01: Task-type classifier and MCP recommendation mapping

## Outcome

All four tasks completed. The mcp-classifier module, CLI wiring, and tests are all in place. Zero regressions in the full suite.

## What Was Built

**`get-shit-done/bin/lib/mcp-classifier.cjs`** — new CommonJS module containing:
- `MCP_TASK_MAP` — maps five task types to advisory MCP server name arrays
- `classifyTask(description, fileExtensions)` — heuristic classification using ordered keyword rules + extension checks, returning one of: `database`, `library-integration`, `api-integration`, `ui-component`, `file-restructuring`, or `unknown`
- `getMcpServers(taskType)` — safe lookup that never throws, returns `[]` for unknown types
- `classifyAndRecommend(description, fileExtensions)` — convenience wrapper returning `{ task_type, servers }`
- `cmdMcpClassify(cwd, taskDescription, fileExtensions, raw)` — CLI output formatter (JSON or human-readable)

**`get-shit-done/bin/gsd-tools.cjs`** — modified:
- Added `require('./lib/mcp-classifier.cjs')` after the contextBudget require
- Added `case 'mcp-classify':` handler parsing `--task`, `--ext`, and delegating to `cmdMcpClassify`

**`tests/mcp-classifier.test.cjs`** — 11 tests covering all classification rules, edge cases, priority ordering, getMcpServers behavior, and a full CLI round-trip.

## Decisions Made

- `classifyTask` keyword order: database > library-integration > api-integration > ui-component > file-restructuring — database rule wins over extension check (as required by the priority test)
- Extension normalization strips missing leading dot at function entry, handles empty/null inputs
- `--ext` flag in CLI accepts comma-separated extensions (e.g. `--ext .tsx,.ts`)
- `rename` keyword matches file-restructuring even when `.tsx` files are present, because `rename` fires the file-restructuring rule after ui-component — but ui-component extension check fires first. The plan explicitly accepts either outcome for that combination.

## Test Results

```
ℹ tests 11
ℹ pass 11
ℹ fail 0
```

Full suite: 1242 tests, 1239 pass, 3 fail — all 3 failures are pre-existing (config-get, INST-06, parseTmuxOutput).

## Deviations

None. Plan executed as written.

## Next Step

Plan 86-02: Integrate recommendation emission into execute-plan workflow and add dashboard validation query.
