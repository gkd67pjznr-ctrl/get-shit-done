# Phase 30: Dashboard Gate Health Page - Research

**Researched:** 2026-03-10
**Domain:** Dashboard SPA (Preact + htm), JSONL aggregation, server-side API
**Confidence:** HIGH

## Summary

Phase 30 adds a dedicated Gate Health page to the existing GSD dashboard SPA. The dashboard uses Preact 10.23.1 with htm tagged template literals (no JSX, no build step), served from `dashboard/` as static files by `server.cjs`. The existing Patterns page (`pattern-page.js`) provides an exact template: a standalone component that fetches from a server API endpoint, handles loading/error/empty states, and renders cross-project aggregated data.

The server side reads JSONL files from each registered project's `.planning/observations/` directory. Two data sources are needed: `gate-executions.jsonl` (gate outcomes, quality levels, per-gate data) and `context7-calls.jsonl` (Context7 utilization). Both files have well-defined schemas from Phase 28's write libraries. The aggregation function follows the same pattern as `aggregatePatterns()` in server.cjs -- iterate registry, read JSONL from each project, merge into a single response.

**Primary recommendation:** Follow the pattern-page.js template exactly -- new component file, new API endpoint, new router case, new subnav link. Pure CSS stacked bars (width percentages), no charting library, no new dependencies.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal stacked bars for gate outcome distribution (passed/warned/blocked/skipped) -- CSS width percentages, no charting library
- Single horizontal summary bar for quality level usage (standard/strict/fast proportions)
- Compact stats block for Context7 utilization (total calls, avg tokens, cap-hit rate, used-in-code rate)
- Pure CSS/HTML only -- no charting library, no new dependencies. Matches pattern-page approach
- Single scrollable page, all sections visible -- no tabs or cards
- Section order: quality level summary bar -> gate outcome bars (5 sentinel steps) -> per-gate firing rates table -> Context7 stats block
- Sidebar link below "Patterns" -- labeled "Gate Health"
- Hash route: `#/gate-health`
- Same routing pattern as pattern-page (router.js parseHash, new component file)
- Cross-project aggregate -- data from all registered projects
- All available data -- no date filtering, no time range selector
- No filtering controls -- all 5 gates and all 3 quality levels always visible
- Empty state: guidance message explaining why (fast mode skips gates), pointing to `/gsd:set-quality standard`
- Partial data: show what's available with subtle "N of M projects reporting" note
- Loading: simple text "Loading gate data..." matching pattern-page loading state

### Claude's Discretion
- Exact CSS styling and spacing within the established design system
- How to structure the server-side API endpoint (likely `/api/gate-health`)
- JSONL parsing and aggregation logic
- Per-gate firing rate table column layout
- Loading skeleton design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dedicated Gate Health page (standalone page like patterns page) with full gate metrics | Pattern-page.js template, router.js route case, sidebar link, subnav link -- all patterns documented |
| DASH-02 | Gate outcome distribution visualization (passed/warned/blocked/skipped rates) | gate-executions.jsonl schema (gate, outcome, quality_level fields), CSS stacked bar pattern |
| DASH-03 | Quality level usage distribution across sessions | gate-executions.jsonl quality_level field (standard/strict), plus fast mode = absence of data |
| DASH-04 | Per-gate firing rates and warn rates | gate-executions.jsonl 5 valid gates, outcomes per gate aggregation |
| DASH-05 | Context7 utilization metrics (calls, token usage, cap hits) | context7-calls.jsonl schema (tokens_requested, token_cap, used fields) |

</phase_requirements>

## Standard Stack

### Core (already in project -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | 10.23.1 | UI rendering | Already loaded via importmap in index.html |
| htm | 3.1.1 | Tagged template literals (no JSX) | Already loaded, all components use this |
| @preact/signals | 1.3.0 | Reactive state | Already loaded, used by router.js and state.js |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js built-in http | -- | Server API endpoint | server.cjs createServer() |
| Node.js built-in fs | -- | JSONL file reading | Server-side aggregation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS stacked bars | Chart.js/D3 | User explicitly locked: no charting library, pure CSS only |
| New build step | Vite | Dashboard is intentionally build-free (esm.sh importmap) |

**Installation:**
```bash
# No installation needed -- zero new dependencies
```

## Architecture Patterns

### Integration Points (exact file locations)
```
dashboard/
  js/
    app.js               # Add import + route case for GateHealthPage (~line 13, ~line 83)
    lib/
      router.js          # Add 'gate-health' case in parseHash() (~line 19)
    components/
      pattern-page.js    # TEMPLATE to copy -- do NOT modify
      gate-health-page.js # NEW FILE -- the main deliverable
      sidebar.js         # Add "Gate Health" link (after line 188)
  .dashboard-manifest.json # Add gate-health-page.js to files array

get-shit-done/bin/lib/
  server.cjs             # Add /api/gate-health endpoint (~line 1071, after /api/patterns)
```

### Pattern 1: Page Component (copy from pattern-page.js)
**What:** Standalone page with fetch/loading/error/empty/render states
**When to use:** Every new dashboard page
**Example:**
```javascript
// Source: dashboard/js/components/pattern-page.js (existing)
import { html } from 'htm/preact';
import { useState, useEffect } from 'preact/hooks';

export function GateHealthPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gate-health')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) return html`<div style="padding:32px; color:var(--text-muted)">Loading gate data...</div>`;
  if (error) return html`<div style="padding:32px; color:var(--signal-error)">Failed to load gate data: ${error}</div>`;
  if (!data || !data.hasData) return html`...empty state...`;
  // render sections
}
```

### Pattern 2: Server API Endpoint (copy from /api/patterns)
**What:** GET endpoint that reads registry, iterates projects, aggregates JSONL data
**When to use:** Any cross-project data aggregation
**Example:**
```javascript
// Source: server.cjs /api/patterns handler (line 1061)
if (req.method === 'GET' && pathname === '/api/gate-health') {
  const registry = loadRegistry();
  const gateHealth = aggregateGateHealth(registry);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(gateHealth));
  return;
}
```

### Pattern 3: Router Hash Route (copy from patterns)
**What:** Hash-based routing with parseHash() switch
**When to use:** Adding new top-level pages
**Example:**
```javascript
// Source: dashboard/js/lib/router.js (line 19)
if (parts[0] === 'gate-health') {
  return { page: 'gate-health' };
}
```

### Pattern 4: CSS Stacked Bar (GitHub language bar style)
**What:** Proportional colored segments using CSS width percentages
**When to use:** Gate outcome distribution, quality level distribution
**Example:**
```javascript
// Derived from user's "GitHub language bars" request
html`
  <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; background:var(--bg-card);">
    <div style="width:${passedPct}%; background:var(--signal-success);" title="Passed: ${passedPct}%" />
    <div style="width:${warnedPct}%; background:var(--signal-warning);" title="Warned: ${warnedPct}%" />
    <div style="width:${blockedPct}%; background:var(--signal-error);" title="Blocked: ${blockedPct}%" />
    <div style="width:${skippedPct}%; background:var(--text-muted);" title="Skipped: ${skippedPct}%" />
  </div>
`
```

### Anti-Patterns to Avoid
- **Adding a charting library:** User explicitly locked pure CSS. Width percentages handle all visualization needs.
- **Building in index.html:** Dashboard is build-free. New components are ES modules loaded via importmap.
- **Modifying pattern-page.js:** It is a template to copy, not to extend. Gate health page is a separate file.
- **Adding date filtering or drill-down:** Explicitly out of scope for Phase 30.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL parsing | Custom streaming parser | `fs.readFileSync().split('\n').filter(Boolean).map(JSON.parse)` with try/catch | Matches aggregatePatterns() pattern exactly; files are small (max 5000/2000 lines) |
| Project iteration | Custom project discovery | `loadRegistry()` from dashboard.cjs | Already handles discovery, path resolution, missing files |
| Color tokens | Hardcoded hex values | CSS variables from tokens.css | `--signal-success`, `--signal-warning`, `--signal-error`, `--text-muted` |
| Route management | Custom router | Existing `parseHash()` in router.js | Just add a case |

**Key insight:** Every piece of infrastructure already exists. This phase is purely assembly -- no new patterns, no new dependencies, just new content following established conventions.

## Common Pitfalls

### Pitfall 1: Forgetting fast mode in quality level distribution
**What goes wrong:** Quality level bar shows only standard/strict because gate-executions.jsonl never contains fast mode entries.
**Why it happens:** Fast mode skips all gates, so no entries are written.
**How to avoid:** The API must infer fast mode usage. Options: (a) count fast as "total sessions minus standard+strict sessions" using correction.jsonl quality_level field, or (b) accept that only standard/strict are visible and note "fast mode sessions not tracked" in the UI. The CONTEXT.md says "all 3 quality levels always visible" so option (a) or a note is required.
**Warning signs:** Quality bar shows only 2 segments when it should show 3.

### Pitfall 2: Division by zero in percentage calculations
**What goes wrong:** NaN or Infinity renders in the UI when no data exists for a category.
**Why it happens:** Dividing by total=0 when computing percentages.
**How to avoid:** Guard all percentage calculations: `total > 0 ? (count / total * 100) : 0`. Test with empty JSONL files.
**Warning signs:** "NaN%" or "Infinity%" appearing in the UI.

### Pitfall 3: Malformed JSONL lines crashing aggregation
**What goes wrong:** One bad line in a JSONL file causes the entire API to return 500.
**Why it happens:** JSON.parse throws on malformed lines.
**How to avoid:** Wrap each line parse in try/catch (matches aggregatePatterns() pattern). Skip bad lines silently.
**Warning signs:** API returning errors when data files exist.

### Pitfall 4: Missing subnav link
**What goes wrong:** Page works via direct URL but users can't navigate to it.
**Why it happens:** Adding the sidebar link but forgetting the subnav in app.js.
**How to avoid:** Subnav is rendered in app.js (~line 76-78). Add "Gate Health" link after "Patterns" link.
**Warning signs:** No way to reach the page from Overview.

### Pitfall 5: Not adding to .dashboard-manifest.json
**What goes wrong:** Dashboard may not serve the new file correctly in some deployment scenarios.
**Why it happens:** Manifest is not auto-generated.
**How to avoid:** Add `js/components/gate-health-page.js` to the files array in `.dashboard-manifest.json`.

## Code Examples

### JSONL Data Schemas (from Phase 28 write libraries)

#### gate-executions.jsonl entry
```json
{
  "gate": "codebase_scan",
  "task": 1,
  "outcome": "passed",
  "quality_level": "standard",
  "phase": "28",
  "plan": "01",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```
Valid gates: `codebase_scan`, `context7_lookup`, `test_baseline`, `test_gate`, `diff_review`
Valid outcomes: `passed`, `warned`, `skipped`, `blocked`
Valid quality_levels: `standard`, `strict` (never `fast`)

#### context7-calls.jsonl entry
```json
{
  "library": "/vercel/next.js",
  "query": "routing configuration",
  "tokens_requested": 2000,
  "token_cap": 2000,
  "used": true,
  "quality_level": "standard",
  "phase": "28",
  "plan": "02",
  "timestamp": "2026-03-10T12:00:00.000Z"
}
```
`query` is optional. `token_cap` comes from config (currently 2000). `used` = whether result was used in code.

### Recommended API Response Shape
```javascript
// Source: derived from requirements + JSONL schemas
{
  projectCount: 3,           // total registered projects
  reportingCount: 2,         // projects with gate data
  totalExecutions: 150,      // total gate-execution entries

  // DASH-02: outcome distribution
  outcomes: {
    passed: 120, warned: 15, blocked: 5, skipped: 10
  },

  // DASH-03: quality level distribution
  qualityLevels: {
    standard: 100, strict: 50, fast: 0  // fast inferred or 0
  },

  // DASH-04: per-gate firing rates
  gates: {
    codebase_scan:    { total: 30, passed: 25, warned: 3, blocked: 1, skipped: 1 },
    context7_lookup:  { total: 30, passed: 28, warned: 2, blocked: 0, skipped: 0 },
    test_baseline:    { total: 30, passed: 20, warned: 5, blocked: 3, skipped: 2 },
    test_gate:        { total: 30, passed: 22, warned: 4, blocked: 2, skipped: 2 },
    diff_review:      { total: 30, passed: 25, warned: 1, blocked: 0, skipped: 4 },
  },

  // DASH-05: Context7 utilization
  context7: {
    totalCalls: 45,
    avgTokensRequested: 1800,
    capHitRate: 0.12,        // fraction where tokens_requested >= token_cap
    usedInCodeRate: 0.78,    // fraction where used === true
  },

  hasData: true              // false if no JSONL files found anywhere
}
```

### Color Mapping for Stacked Bars
```javascript
// Source: dashboard/css/tokens.css
const OUTCOME_COLORS = {
  passed:  'var(--signal-success)',  // #22c55e green
  warned:  'var(--signal-warning)',  // #f97316 orange
  blocked: 'var(--signal-error)',    // #ef4444 red
  skipped: 'var(--text-muted)',      // #6e7681 gray
};

const QUALITY_COLORS = {
  standard: 'var(--signal-success)',  // green
  strict:   'var(--signal-warning)',  // orange
  fast:     'var(--text-muted)',      // gray (per CONTEXT.md)
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No gate observability | JSONL persistence (Phase 28) | 2026-03-10 | Gate data now available for dashboard |
| Quality level implicit | Explicit in gate-executions.jsonl | Phase 28 | Can aggregate quality level distribution |
| No Context7 tracking | context7-calls.jsonl | Phase 28 | Token usage and utilization visible |

## Open Questions

1. **Fast mode representation in quality level bar**
   - What we know: gate-executions.jsonl never contains fast mode entries (fast mode skips all gates)
   - What's unclear: How to count fast mode sessions. corrections.jsonl has optional quality_level field but defaults may be unreliable.
   - Recommendation: Show "standard" and "strict" from gate data; add a note "Fast mode sessions skip gate enforcement and are not tracked" below the quality bar. This is honest and avoids unreliable inference.

2. **Manifest file purpose**
   - What we know: `.dashboard-manifest.json` lists files but pattern-page.js is NOT in it (loaded via import in app.js)
   - What's unclear: Whether manifest is used for anything beyond documentation
   - Recommendation: Add gate-health-page.js anyway for consistency and forward-compatibility.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `npm test`) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose tests/server.test.cjs` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Gate Health page renders with navigation | unit | `npx vitest run tests/gate-health-page.test.cjs -x` | Wave 0 |
| DASH-02 | Gate outcome distribution computed correctly | unit | `npx vitest run tests/server.test.cjs -t "gate-health" -x` | Wave 0 |
| DASH-03 | Quality level distribution computed | unit | `npx vitest run tests/server.test.cjs -t "quality-level" -x` | Wave 0 |
| DASH-04 | Per-gate firing rates aggregated | unit | `npx vitest run tests/server.test.cjs -t "per-gate" -x` | Wave 0 |
| DASH-05 | Context7 metrics aggregated | unit | `npx vitest run tests/server.test.cjs -t "context7" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/server.test.cjs -x`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/server.test.cjs` -- add `aggregateGateHealth()` tests (DASH-02 through DASH-05). Server test file likely exists; add new test cases.
- [ ] Framework install: none needed -- Vitest already configured

## Sources

### Primary (HIGH confidence)
- `dashboard/js/components/pattern-page.js` -- exact template for page component pattern
- `dashboard/js/lib/router.js` -- hash routing implementation (28 lines, fully understood)
- `dashboard/js/app.js` -- app shell with subnav and page routing (120 lines)
- `dashboard/js/components/sidebar.js` -- navigation component (192 lines)
- `dashboard/css/tokens.css` -- design tokens and CSS variables
- `dashboard/.dashboard-manifest.json` -- file manifest
- `get-shit-done/bin/lib/server.cjs` -- server with /api/patterns endpoint (template for /api/gate-health)
- `.claude/hooks/lib/write-gate-execution.cjs` -- gate-executions.jsonl schema and validation (5 gates, 4 outcomes)
- `.claude/hooks/lib/write-context7-call.cjs` -- context7-calls.jsonl schema and validation

### Secondary (MEDIUM confidence)
- `dashboard/index.html` -- importmap confirming Preact 10.23.1, htm 3.1.1, @preact/signals 1.3.0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all code read directly, no new dependencies
- Architecture: HIGH -- exact template exists (pattern-page.js), all integration points identified with line numbers
- Pitfalls: HIGH -- derived from code analysis and data schema constraints

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- no external dependencies)
