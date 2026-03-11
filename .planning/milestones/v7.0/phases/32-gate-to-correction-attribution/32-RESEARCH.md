# Phase 32: Gate-to-Correction Attribution - Research

**Researched:** 2026-03-11
**Domain:** JSONL analytics / heuristic attribution mapping
**Confidence:** HIGH

## Summary

Phase 32 creates an attribution analysis script that reads two existing JSONL data sources -- gate-executions.jsonl (in `.planning/observations/`) and corrections.jsonl (in `.planning/patterns/`) -- and produces heuristic mappings linking correction categories to originating gates. The output goes to `gate-attribution.jsonl`.

The project already has a well-established pattern for JSONL processing libraries in `.claude/hooks/lib/`. The `analyze-patterns.cjs` library is the closest structural analog: it reads corrections.jsonl, aggregates data, and writes structured output. The attribution script should follow the same CommonJS pattern with zero external dependencies (Node.js fs and path only).

**Primary recommendation:** Create a single `attribute-gates.cjs` library in `.claude/hooks/lib/` following the `analyze-patterns.cjs` pattern -- reads both data sources, applies heuristic rules mapping correction categories to gates, writes results to `.planning/observations/gate-attribution.jsonl`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLZ-01 | Gate-to-correction attribution analysis script (heuristic mapping from correction categories to gates) | Heuristic mapping rules defined below in Architecture Patterns; script follows analyze-patterns.cjs structural pattern |
| ANLZ-02 | Attribution summary output to `gate-attribution.jsonl` | Output format defined below; written to `.planning/observations/gate-attribution.jsonl` alongside gate-executions.jsonl |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fs | built-in | File I/O for JSONL read/write | Project convention: zero external deps in hooks/lib |
| Node.js path | built-in | Path resolution | Project convention |

### Supporting
No additional libraries needed. This is pure data processing with built-in Node.js modules.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom JSONL parsing | `jsonl-parse-stringify` npm | Unnecessary -- line-split + JSON.parse is the project pattern and handles all cases |
| Statistical library | Simple heuristic rules | Overkill -- the data volume is small (1000-5000 entries) and the mapping is category-based, not ML-based |

**Installation:**
```bash
# No installation needed -- zero external dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
.claude/hooks/lib/
  attribute-gates.cjs      # NEW: attribution analysis library
tests/hooks/
  gate-attribution.test.ts # NEW: tests for the library
.planning/observations/
  gate-attribution.jsonl    # NEW: output file (written by the script)
```

### Pattern 1: Heuristic Attribution Rules

**What:** Map correction categories to the gate most likely to have caught (or missed) the issue.

**When to use:** Always -- this is the core logic of the phase.

The 5 gates and 14 correction categories have logical affinities:

| Gate | Catches These Correction Categories | Rationale |
|------|--------------------------------------|-----------|
| `codebase_scan` | `code.wrong_pattern`, `code.missing_context`, `code.style_mismatch`, `process.convention_violation` | Codebase scan checks existing patterns, imports, conventions |
| `context7_lookup` | `code.stale_knowledge`, `process.research_gap` | Context7 provides current API docs, prevents stale knowledge |
| `test_baseline` | `process.regression` | Test baseline catches regressions before changes |
| `test_gate` | `process.implementation_bug`, `code.under_engineering` | Test gate validates implementation correctness |
| `diff_review` | `code.over_engineering`, `code.scope_drift`, `process.planning_error`, `process.requirement_misread`, `process.integration_miss` | Diff review catches scope/quality issues in final output |

**Confidence scoring:** Each attribution gets a confidence score (0.0 to 1.0) based on:
- **1.0 (HIGH):** Direct causal link (e.g., `code.stale_knowledge` -> `context7_lookup`)
- **0.7 (MEDIUM):** Strong correlation (e.g., `code.wrong_pattern` -> `codebase_scan`)
- **0.4 (LOW):** Indirect relationship (e.g., `process.planning_error` -> `diff_review`)

### Pattern 2: JSONL Processing (project convention)

**What:** Read JSONL files line-by-line, parse JSON, aggregate, write output.

**When to use:** All JSONL processing in this project.

```javascript
// Source: analyze-patterns.cjs and write-correction.cjs patterns
function readJsonlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
      .filter(l => l.trim() !== '')
      .map(line => { try { return JSON.parse(line); } catch (e) { return null; } })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}
```

### Pattern 3: Library Module Pattern (project convention)

**What:** CommonJS module with function export + CLI invocation via `require.main === module`.

**When to use:** All `.claude/hooks/lib/*.cjs` files follow this pattern.

```javascript
// Source: analyze-patterns.cjs, write-gate-execution.cjs
module.exports = { attributeGates };

if (require.main === module) {
  const cwd = process.argv[2] || process.cwd();
  const result = attributeGates({ cwd });
  if (process.env.DEBUG_ATTRIBUTION) {
    process.stdout.write(JSON.stringify(result) + '\n');
  }
  process.exit(0);
}
```

### Pattern 4: Empty Data Handling

**What:** When either data source is empty or missing, produce an empty result (not an error).

**When to use:** Required by success criteria #3.

```javascript
// Returns { analyzed: true, attributions: 0 } when no data
// Never throws or returns error states for missing files
```

### Anti-Patterns to Avoid
- **Complex ML/statistical approaches:** The data volume is tiny and the mapping is categorical. Simple heuristic rules are correct here.
- **Modifying source JSONL files:** The attribution script is read-only against gate-executions.jsonl and corrections.jsonl. It only writes to gate-attribution.jsonl.
- **External dependencies:** Every hooks/lib file uses zero npm packages. Do not break this convention.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL reading | Custom stream parser | Line-split + JSON.parse | Project convention, handles all edge cases in this codebase |
| Date handling | Moment.js / date-fns | Native Date + ISO strings | All timestamps in the project are ISO 8601 strings |
| Config reading | Custom config loader | Copy `getObservationConfig()` pattern from existing libraries | Consistent with analyze-patterns.cjs |

## Common Pitfalls

### Pitfall 1: Different File Locations
**What goes wrong:** Gate executions are in `.planning/observations/` but corrections are in `.planning/patterns/` -- easy to look in the wrong place.
**Why it happens:** Historical split between observation data and pattern data.
**How to avoid:** Explicitly use `path.join(cwd, '.planning', 'observations', 'gate-executions.jsonl')` and `path.join(cwd, '.planning', 'patterns', 'corrections.jsonl')`.
**Warning signs:** "File not found" when data exists.

### Pitfall 2: Archived Files
**What goes wrong:** Both gate-executions and corrections rotate to dated archive files. Only reading the active file misses historical data.
**Why it happens:** Rotation happens at 5000 entries (gates) and 1000 entries (corrections).
**How to avoid:** Read both the active file AND archived files (pattern: `corrections-*.jsonl`, `gate-executions-*.jsonl`). The `readCorrections()` function in write-correction.cjs already does this -- reuse it or follow its pattern.
**Warning signs:** Attribution results only cover recent data.

### Pitfall 3: quality_level Field Inconsistency
**What goes wrong:** Gate executions always have `quality_level` (standard/strict, never fast). Corrections have optional `quality_level` that may be absent or any of fast/standard/strict.
**Why it happens:** Different validation rules in the two write libraries.
**How to avoid:** Don't require quality_level matching as a join condition. Use phase + timestamp proximity for temporal correlation.

### Pitfall 4: No Direct Foreign Key
**What goes wrong:** Trying to join gate executions to corrections by a shared ID that doesn't exist.
**Why it happens:** These are independent data streams with no shared key.
**How to avoid:** Use heuristic attribution based on correction category -> gate mapping, not record-level joins. Temporal correlation (same phase, overlapping time windows) provides supporting evidence.

## Code Examples

### Output Format: gate-attribution.jsonl

Each line is a JSON object representing one attribution mapping:

```javascript
{
  "correction_category": "code.stale_knowledge",
  "gate": "context7_lookup",
  "confidence": 1.0,
  "correction_count": 5,
  "gate_outcome_distribution": { "passed": 3, "warned": 1, "skipped": 1 },
  "phases_observed": ["28", "30", "31"],
  "sample_corrections": ["Used deprecated API", "Wrong config format"],
  "timestamp": "2026-03-11T12:00:00.000Z"
}
```

### Main Attribution Function

```javascript
// Core attribution logic
function attributeGates(options) {
  const cwd = (options && options.cwd) ? options.cwd : process.cwd();

  // Read both data sources
  const gateEntries = readAllGateExecutions(cwd);   // observations dir + archives
  const corrections = readAllCorrections(cwd);       // patterns dir + archives

  // Empty data -> empty result
  if (corrections.length === 0) {
    writeAttributionFile(cwd, []);
    return { analyzed: true, attributions: 0 };
  }

  // Group corrections by category
  const correctionsByCategory = groupBy(corrections, 'diagnosis_category');

  // Group gate executions by gate name
  const gatesByName = groupBy(gateEntries, 'gate');

  // Build attributions
  const attributions = [];
  for (const [category, catCorrections] of Object.entries(correctionsByCategory)) {
    const mappedGate = CATEGORY_GATE_MAP[category];
    if (!mappedGate) continue;

    const gateEvents = gatesByName[mappedGate] || [];
    attributions.push({
      correction_category: category,
      gate: mappedGate,
      confidence: CONFIDENCE_MAP[category],
      correction_count: catCorrections.length,
      gate_outcome_distribution: countOutcomes(gateEvents),
      phases_observed: uniquePhases(catCorrections),
      sample_corrections: catCorrections.slice(0, 3).map(c => c.diagnosis_text || ''),
      timestamp: new Date().toISOString(),
    });
  }

  writeAttributionFile(cwd, attributions);
  return { analyzed: true, attributions: attributions.length };
}
```

### Reading Gate Executions (including archives)

```javascript
function readAllGateExecutions(cwd) {
  const obsDir = path.join(cwd, '.planning', 'observations');
  const files = ['gate-executions.jsonl'];
  try {
    const dirFiles = fs.readdirSync(obsDir);
    for (const f of dirFiles) {
      if (f.startsWith('gate-executions-') && f.endsWith('.jsonl')) files.push(f);
    }
  } catch (e) { /* no archives */ }

  let entries = [];
  for (const file of files) {
    const parsed = readJsonlFile(path.join(obsDir, file));
    entries = entries.concat(parsed);
  }
  return entries;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No gate observability | JSONL persistence for gates, corrections, context7 | Phase 28 (2026-03-10) | Data now available for attribution |
| No cross-source analysis | analyze-patterns.cjs reads corrections -> suggestions | Pre-v7.0 | Established pattern for cross-source analysis scripts |

**Deprecated/outdated:**
- None -- this is a new capability being built on top of Phase 28 infrastructure.

## Open Questions

1. **Should archives be included in attribution analysis?**
   - What we know: Both gate-executions and corrections rotate. readCorrections() already reads archives.
   - What's unclear: Whether attribution should span all-time data or just current active files.
   - Recommendation: Read archives by default (more data = better attribution). This matches readCorrections() behavior.

2. **Should the output file rotate?**
   - What we know: gate-attribution.jsonl is overwritten each run (not appended), so rotation is not needed in the same way.
   - What's unclear: Whether historical attribution snapshots have value.
   - Recommendation: Overwrite on each run. The output is derived data that can be regenerated. Keep it simple.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/hooks/gate-attribution.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLZ-01 | Attribution script reads both JSONL sources and produces heuristic mappings | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "produces attributions"` | Wave 0 |
| ANLZ-01 | All 14 correction categories map to a gate | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "maps all categories"` | Wave 0 |
| ANLZ-01 | Confidence scores are assigned per mapping | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "confidence"` | Wave 0 |
| ANLZ-02 | Output written to gate-attribution.jsonl | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "writes output"` | Wave 0 |
| ANLZ-02 | Structured entries with correction types, gate names, confidence | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "structured entries"` | Wave 0 |
| SC-3 | Empty data produces empty result, not error | unit | `npx vitest run tests/hooks/gate-attribution.test.ts -t "empty"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/hooks/gate-attribution.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/hooks/gate-attribution.test.ts` -- covers ANLZ-01, ANLZ-02, SC-3
- No framework install needed -- Vitest already configured

## Sources

### Primary (HIGH confidence)
- `.claude/hooks/lib/write-gate-execution.cjs` -- gate execution schema, validation rules, file paths
- `.claude/hooks/lib/write-correction.cjs` -- correction schema, 14-category taxonomy, readCorrections() pattern
- `.claude/hooks/lib/analyze-patterns.cjs` -- structural template for analysis scripts
- `get-shit-done/bin/lib/server.cjs` -- existing gate data reading patterns (getProjectGateHealth, aggregateGateHealth)

### Secondary (MEDIUM confidence)
- Phase 28 summaries -- confirmed data format decisions and file locations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero external deps, all built-in Node.js (verified from existing codebase)
- Architecture: HIGH -- follows exact patterns from analyze-patterns.cjs and write-correction.cjs
- Pitfalls: HIGH -- identified from direct code inspection of both data source libraries
- Heuristic mapping rules: MEDIUM -- the category-to-gate mapping is a judgment call based on gate purposes; may need tuning after real data analysis

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- internal tooling, no external dependencies)
