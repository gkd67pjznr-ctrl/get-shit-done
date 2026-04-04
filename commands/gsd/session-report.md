---
name: gsd:session-report
description: Surface per-session analytics — correction density, gate fires, skills loaded, and plan performance trends
argument-hint: "[--last N]"
allowed-tools:
  - Bash
---

<objective>
Generate a per-session analytics report by calling the session-report CLI subcommand. Surfaces correction density, gate fire count, and skills loaded for recent sessions, plus plan performance trends when phase-benchmarks.jsonl contains data.

All JSONL aggregation is performed by Node.js (session-report.cjs). This command renders the results as a formatted markdown report.
</objective>

<process>

## Step 1: Parse arguments

Extract --last N from $ARGUMENTS if provided. Default to 10 if not specified.

```bash
LAST_N=10
if echo "$ARGUMENTS" | grep -q '\-\-last'; then
  LAST_N=$(echo "$ARGUMENTS" | grep -oP '(?<=--last )\d+' || echo "10")
fi
```

## Step 2: Run session-report CLI subcommand

```bash
REPORT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs session-report --last "$LAST_N" --raw 2>&1)
EXIT_CODE=$?
```

If EXIT_CODE is non-zero:
- Print: "session-report command failed. Is GSD installed? Check: node ~/.claude/get-shit-done/bin/gsd-tools.cjs session-report --last 5"
- EXIT

## Step 3: Render session analytics table

Parse the JSON output and render a markdown table.

```bash
SESSION_COUNT=$(echo "$REPORT" | jq -r '.total_sessions_shown // 0')
```

Print header:
```
## Session Report (last $LAST_N sessions — showing $SESSION_COUNT)
```

Print the sessions table:
```bash
echo "| Phase | Timestamp | Type | Corrections | Gate Fires | Skills |"
echo "|-------|-----------|------|-------------|------------|--------|"
echo "$REPORT" | jq -r '
  .sessions[] |
  "| \(.phase) | \(.timestamp // "—") | \(.type // "—") | \(.correction_count) | \(.gate_fire_count) | \(if (.skills | length) > 0 then (.skills | join(", ")) else "none recorded" end) |"
'
```

If SESSION_COUNT is 0:
- Print: "> No sessions recorded yet. Session data is captured by GSD workflow hooks after commits."

## Step 4: Render benchmark trends (conditional)

```bash
HAS_BENCHMARKS=$(echo "$REPORT" | jq -r 'if .benchmark_trends then "yes" else "no" end')
```

If HAS_BENCHMARKS is "yes":

```bash
echo ""
echo "## Plan Performance Trends"
echo "$REPORT" | jq -r '
  "**Sample count:** \(.benchmark_trends.sample_count) plans\n" +
  "**Avg corrections/plan:** \(.benchmark_trends.avg_corrections)\n" +
  "**Avg gate fires/plan:** \(.benchmark_trends.avg_gates)\n"
'
echo "### Breakdown by Phase Type"
echo "| Phase Type | Plans | Avg Corrections |"
echo "|------------|-------|----------------|"
echo "$REPORT" | jq -r '
  .benchmark_trends.by_phase_type | to_entries[] |
  "| \(.key) | \(.value.count) | \(if .value.count > 0 then (.value.corrections / .value.count | . * 100 | round / 100 | tostring) else "0" end) |"
'
```

If HAS_BENCHMARKS is "no":
- Print: "> No plan benchmark data yet. Benchmarks are recorded at plan completion via /gsd:execute-phase."

</process>

<success_criteria>
- [ ] Session table renders with Phase, Timestamp, Type, Corrections, Gate Fires, Skills columns
- [ ] --last N argument controls number of sessions shown
- [ ] Sessions with empty skills_loaded show "none recorded" in the Skills column
- [ ] Benchmark trends section appears when phase-benchmarks.jsonl has data
- [ ] Benchmark trends section shows explanatory note when no benchmark data exists
- [ ] All JSONL parsing happens in Node.js (session-report.cjs), not inline bash
</success_criteria>
