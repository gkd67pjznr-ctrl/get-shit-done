# Phase 16: Core Debt Module - Research

**Researched:** 2026-02-25
**Domain:** Node.js CLI — markdown file schema design, atomic file I/O, structured record parsing
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DEBT-01 | DEBT.md hub exists with structured entry format (TD-NNN IDs, 10 fields: id, type, severity, component, description, date_logged, logged_by, status, source_phase, source_plan) | DEBT.md schema designed below. Markdown table format with auto-incrementing TD-NNN IDs. File lives at `.planning/DEBT.md` (project-level, not milestone-scoped per STATE.md decision). |
| DEBT-02 | `gsd-tools debt log` command appends a new debt entry atomically (concurrent-safe via append-only writes) | `fs.appendFileSync` on POSIX uses `O_APPEND` flag — kernel-level atomic for single write calls. Individual markdown table rows are < 512 bytes (POSIX PIPE_BUF minimum). Verified approach in STATE.md design decisions. |
| DEBT-03 | `gsd-tools debt list` command returns debt entries filtered by status, severity, or type (JSON output) | Parse DEBT.md table with regex, filter rows by field values, return JSON array via `output()` helper pattern from `core.cjs`. |
| DEBT-04 | `gsd-tools debt resolve` command transitions a debt entry's status (open → in-progress → resolved/deferred) | Read DEBT.md, find row by TD-NNN ID, replace status cell inline, write back with `fs.writeFileSync`. Same read-modify-write pattern as `cmdStatePatch` in `state.cjs`. |
</phase_requirements>

---

## Summary

Phase 16 creates the foundational tech debt tracking infrastructure for the GSD v3.0 system. The work has three parts: (1) define the DEBT.md file schema, (2) create `get-shit-done/bin/lib/debt.cjs` with three command implementations, and (3) wire the `debt` subcommand into the CLI router in `get-shit-done/bin/gsd-tools.cjs`.

The entire implementation uses only Node.js built-ins (`fs`, `path`) — no new npm dependencies. The concurrent-safety strategy is already decided in STATE.md: `fs.appendFileSync` for `debt log`, which is OS-atomic via `O_APPEND` on POSIX for individual single-call writes. The only concurrent-safety concern for `debt resolve` is the read-modify-write pattern: it is NOT atomic, but this is acceptable because debt resolution is a human-initiated, one-at-a-time operation (not concurrent by nature). A second parallel resolve on the same TD-NNN ID would be a human workflow error, not a concurrency bug.

The implementation follows established patterns visible in peer modules: `debt.cjs` mirrors the structure of `milestone.cjs` and `commands.cjs` (CommonJS, `require('./core.cjs')`, `output(result, raw, rawValue)` for JSON/raw output, `error(message)` for failures). The router case follows the same subcommand dispatch pattern as `'state'`, `'roadmap'`, and `'requirements'`.

**Primary recommendation:** Create `debt.cjs` as a new peer module in `get-shit-done/bin/lib/`, implement the three commands against DEBT.md at `.planning/DEBT.md`, and add a `'debt'` case to the CLI router. Follow the `milestone.cjs` / `state.cjs` module skeleton exactly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `fs` | built-in (v20.20.0) | Read, write, append DEBT.md | Already used in every lib module |
| Node.js `path` | built-in | Path joining for `.planning/DEBT.md` | Already used in every lib module |
| `output()` from `core.cjs` | project | JSON/raw output with 50KB tmpfile fallback | Established output contract for all commands |
| `error()` from `core.cjs` | project | Error reporting with `process.exit(1)` | Established error contract for all commands |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fs.appendFileSync` | built-in | Atomic-append for `debt log` | Concurrent-safe single-entry writes |
| `fs.readFileSync` + `fs.writeFileSync` | built-in | Read-modify-write for `debt resolve` | Serial human-triggered status transitions |
| Regex table parsing | built-in | Parse DEBT.md markdown table rows | No markdown parser needed for single-table file |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `fs.appendFileSync` | `fs.open(O_APPEND)` + `fs.write()` | `appendFileSync` already uses `O_APPEND` — no benefit to manual open/write |
| `fs.appendFileSync` | File locking (`proper-lockfile`, `lockfile`) | Adds npm dependency; overkill for append-only operations where OS atomicity is sufficient |
| Markdown table format | JSON Lines / YAML entries | Markdown table keeps DEBT.md human-readable without a viewer; consistent with ROADMAP.md / STATE.md conventions |
| Auto-increment TD-NNN by counting rows | UUID / timestamp IDs | TD-NNN IDs are user-friendly, short, sortable, and consistent with the requirement spec |

**Installation:** No new packages. Pure Node.js built-ins.

---

## Architecture Patterns

### Recommended Project Structure

```
get-shit-done/bin/
├── gsd-tools.cjs           # CLI router — add 'debt' case (after 'requirements' case ~line 456)
└── lib/
    └── debt.cjs            # NEW: cmdDebtLog, cmdDebtList, cmdDebtResolve + helpers
```

DEBT.md location:
```
.planning/
└── DEBT.md                 # Project-level debt hub (not milestone-scoped — per STATE.md design decision)
```

### Pattern 1: New Lib Module Skeleton (debt.cjs)

**What:** Every lib module exports named functions and imports `output`, `error` from `core.cjs`.

**When to use:** All new commands follow this exact skeleton.

**Example — from milestone.cjs:**
```javascript
// Source: get-shit-done/bin/lib/milestone.cjs lines 1-8
/**
 * Debt — Tech debt tracking operations
 */
const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

function cmdDebtLog(cwd, opts, raw) { ... }
function cmdDebtList(cwd, opts, raw) { ... }
function cmdDebtResolve(cwd, opts, raw) { ... }

module.exports = { cmdDebtLog, cmdDebtList, cmdDebtResolve };
```

### Pattern 2: CLI Router Subcommand Dispatch

**What:** The `'debt'` case in `gsd-tools.cjs` dispatches to `debt.cmdDebt*` via `args[1]` as the subcommand.

**When to use:** All new top-level commands follow this pattern.

**Example — modeled on 'requirements' case (gsd-tools.cjs ~line 448):**
```javascript
// Source: get-shit-done/bin/gsd-tools.cjs lines 448-456 (requirements case — model to follow)
case 'debt': {
  const subcommand = args[1];
  if (subcommand === 'log') {
    // parse --type, --severity, --component, --description, --logged-by, --source-phase, --source-plan
    const typeIdx = args.indexOf('--type');
    const severityIdx = args.indexOf('--severity');
    const componentIdx = args.indexOf('--component');
    const descriptionIdx = args.indexOf('--description');
    const loggedByIdx = args.indexOf('--logged-by');
    const sourcePhasIdx = args.indexOf('--source-phase');
    const sourcePlanIdx = args.indexOf('--source-plan');
    debt.cmdDebtLog(cwd, {
      type: typeIdx !== -1 ? args[typeIdx + 1] : null,
      severity: severityIdx !== -1 ? args[severityIdx + 1] : null,
      component: componentIdx !== -1 ? args[componentIdx + 1] : null,
      description: descriptionIdx !== -1 ? args[descriptionIdx + 1] : null,
      logged_by: loggedByIdx !== -1 ? args[loggedByIdx + 1] : null,
      source_phase: sourcePhasIdx !== -1 ? args[sourcePhasIdx + 1] : null,
      source_plan: sourcePlanIdx !== -1 ? args[sourcePlanIdx + 1] : null,
    }, raw);
  } else if (subcommand === 'list') {
    const statusIdx = args.indexOf('--status');
    const severityIdx = args.indexOf('--severity');
    const typeIdx = args.indexOf('--type');
    debt.cmdDebtList(cwd, {
      status: statusIdx !== -1 ? args[statusIdx + 1] : null,
      severity: severityIdx !== -1 ? args[severityIdx + 1] : null,
      type: typeIdx !== -1 ? args[typeIdx + 1] : null,
    }, raw);
  } else if (subcommand === 'resolve') {
    const idIdx = args.indexOf('--id');
    const statusIdx = args.indexOf('--status');
    debt.cmdDebtResolve(cwd, {
      id: idIdx !== -1 ? args[idIdx + 1] : null,
      status: statusIdx !== -1 ? args[statusIdx + 1] : null,
    }, raw);
  } else {
    error('Unknown debt subcommand. Available: log, list, resolve');
  }
  break;
}
```

### Pattern 3: DEBT.md Schema — Markdown Table Format

**What:** DEBT.md is a markdown file with a header section and a single data table. Each row is one debt entry.

**When to use:** Created by `cmdDebtLog` on first run (if file missing), appended for subsequent calls.

**DEBT.md format:**
```markdown
# DEBT.md — Tech Debt Register

Project-level tracker for structured tech debt. Entries logged by `gsd-tools debt log`.

| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |
|----|------|----------|-----------|-------------|-------------|-----------|--------|--------------|-------------|
| TD-001 | code | high | debt.cjs | Missing input validation on debt log | 2026-02-25 | gsd-executor | open | 16 | 16-01 |
```

**The 10 fields (DEBT-01):**
| Field | Values / Format | Notes |
|-------|-----------------|-------|
| `id` | `TD-NNN` (3-digit zero-padded, auto-increment) | Unique key; parse max existing N to compute next |
| `type` | `code`, `test`, `docs`, `config`, `arch` | Extensible; validate loosely |
| `severity` | `critical`, `high`, `medium`, `low` | Used for `--severity` filter in `debt list` |
| `component` | free text, no pipes | The file, module, or subsystem |
| `description` | free text, no pipes | One-line summary |
| `date_logged` | `YYYY-MM-DD` | Auto-set by `debt log` via `new Date().toISOString().split('T')[0]` |
| `logged_by` | free text | Agent name or username |
| `status` | `open`, `in-progress`, `resolved`, `deferred` | `debt resolve` transitions this |
| `source_phase` | phase number string | Provenance (WIRE-04 dependency) |
| `source_plan` | plan reference string | Provenance (WIRE-04 dependency) |

### Pattern 4: Auto-Increment TD-NNN ID

**What:** Parse existing rows to find the highest N, then use N+1 for the new entry.

**Example:**
```javascript
// Source: project pattern — verified via inspection of existing ID schemes
function getNextDebtId(content) {
  const matches = [...content.matchAll(/\|\s*(TD-(\d+))\s*\|/g)];
  if (matches.length === 0) return 'TD-001';
  const maxN = Math.max(...matches.map(m => parseInt(m[2], 10)));
  return 'TD-' + String(maxN + 1).padStart(3, '0');
}
```

### Pattern 5: Atomic Append for debt log

**What:** `fs.appendFileSync` uses `O_APPEND` flag on POSIX — the kernel guarantees that the full write is appended atomically when the data is within one write call. A single markdown table row is < 512 bytes, well within POSIX PIPE_BUF.

**When to use:** `cmdDebtLog` uses this for the table row. The header write (on first-create) is a `writeFileSync` — no concurrent issue because two simultaneous first-creates would be an impossible race in this system (DEBT.md creation is a one-time setup).

**Example:**
```javascript
// Source: Node.js docs — O_APPEND is the built-in behavior of appendFileSync
function cmdDebtLog(cwd, opts, raw) {
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');

  // Initialize file if it does not exist
  if (!fs.existsSync(debtPath)) {
    const header = [
      '# DEBT.md — Tech Debt Register',
      '',
      'Project-level tracker for structured tech debt. Entries logged by `gsd-tools debt log`.',
      '',
      '| id | type | severity | component | description | date_logged | logged_by | status | source_phase | source_plan |',
      '|----|------|----------|-----------|-------------|-------------|-----------|--------|--------------|-------------|',
      '',
    ].join('\n');
    fs.writeFileSync(debtPath, header, 'utf-8');
  }

  const content = fs.readFileSync(debtPath, 'utf-8');
  const id = getNextDebtId(content);
  const date = new Date().toISOString().split('T')[0];

  // Sanitize pipe characters from free-text fields
  const sanitize = (v) => (v || '').replace(/\|/g, '/');

  const row = `| ${id} | ${sanitize(opts.type)} | ${sanitize(opts.severity)} | ${sanitize(opts.component)} | ${sanitize(opts.description)} | ${date} | ${sanitize(opts.logged_by)} | open | ${sanitize(opts.source_phase)} | ${sanitize(opts.source_plan)} |\n`;

  fs.appendFileSync(debtPath, row, 'utf-8');
  output({ id, logged: true }, raw, id);
}
```

**Note on initialization race:** If two agents call `debt log` simultaneously when DEBT.md does not exist, both may pass the `!fs.existsSync` check and both call `writeFileSync`. The second overwrites the first's header — but no row data is lost because rows are appended after the existsSync guard. This is acceptable: the header is idempotent content. For maximum safety, the implementation can use `fs.openSync(debtPath, 'a')` + `fs.closeSync()` to touch the file first (creating it with 0 bytes), then conditionally write the header only if the file was empty. This eliminates the race without locking.

### Pattern 6: Read-Modify-Write for debt resolve

**What:** `cmdDebtResolve` reads DEBT.md, locates the target TD-NNN row by ID, replaces the status cell, writes back. Same as `cmdStatePatch` in `state.cjs`.

**Status transitions (DEBT-04):** `open` → `in-progress` → `resolved` | `deferred`. The implementation should accept any target status without enforcing ordering — the spec says "transitions", not a strict state machine. Validate that the provided status is one of the four valid values.

**Example:**
```javascript
// Source: pattern from state.cjs cmdStatePatch (read-modify-write)
function cmdDebtResolve(cwd, opts, raw) {
  if (!opts.id) error('--id required for debt resolve');
  if (!opts.status) error('--status required for debt resolve');

  const validStatuses = ['open', 'in-progress', 'resolved', 'deferred'];
  if (!validStatuses.includes(opts.status)) {
    error(`Invalid status "${opts.status}". Must be: ${validStatuses.join(', ')}`);
  }

  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  if (!fs.existsSync(debtPath)) error('DEBT.md not found — run debt log first');

  let content = fs.readFileSync(debtPath, 'utf-8');
  const idEscaped = opts.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Match the row with this ID and replace the status column (8th pipe-delimited cell)
  // Row format: | TD-NNN | type | severity | component | description | date | logged_by | STATUS | source_phase | source_plan |
  const rowPattern = new RegExp(
    `(\\|\\s*${idEscaped}\\s*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|[^|]*\\|)\\s*[^|]+\\s*(\\|[^|]*\\|[^|]*\\|)`,
    'i'
  );

  if (!rowPattern.test(content)) {
    output({ updated: false, reason: `${opts.id} not found in DEBT.md` }, raw, 'false');
    return;
  }

  content = content.replace(rowPattern, `$1 ${opts.status} $2`);
  fs.writeFileSync(debtPath, content, 'utf-8');
  output({ id: opts.id, status: opts.status, updated: true }, raw, 'true');
}
```

### Pattern 7: Filtering in debt list

**What:** Parse all table rows from DEBT.md, build an array of objects, apply filter predicates, return JSON array.

**Example:**
```javascript
// Source: pattern from history-digest in commands.cjs (parse + filter pattern)
function parseDebtRows(content) {
  const entries = [];
  const lines = content.split('\n');
  // Find header line with column names
  const headerIdx = lines.findIndex(l => l.includes('| id |'));
  if (headerIdx === -1) return entries;
  // Data rows start 2 lines after header (skip separator line)
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.endsWith('|')) continue;
    const cells = line.slice(1, -1).split('|').map(c => c.trim());
    if (cells.length < 10) continue;
    entries.push({
      id: cells[0],
      type: cells[1],
      severity: cells[2],
      component: cells[3],
      description: cells[4],
      date_logged: cells[5],
      logged_by: cells[6],
      status: cells[7],
      source_phase: cells[8],
      source_plan: cells[9],
    });
  }
  return entries;
}

function cmdDebtList(cwd, opts, raw) {
  const debtPath = path.join(cwd, '.planning', 'DEBT.md');
  if (!fs.existsSync(debtPath)) {
    output({ entries: [], total: 0 }, raw, '[]');
    return;
  }
  const content = fs.readFileSync(debtPath, 'utf-8');
  let entries = parseDebtRows(content);

  if (opts.status) entries = entries.filter(e => e.status === opts.status);
  if (opts.severity) entries = entries.filter(e => e.severity === opts.severity);
  if (opts.type) entries = entries.filter(e => e.type === opts.type);

  output({ entries, total: entries.length }, raw, JSON.stringify(entries));
}
```

### Anti-Patterns to Avoid

- **Importing `debt.cjs` without adding it to the router:** The module must be required in `gsd-tools.cjs` (`const debt = require('./lib/debt.cjs')`) AND the `case 'debt':` block added. Missing either breaks the command.
- **Relying on row ordering for status column position:** The regex for `debt resolve` must count pipe-delimited columns, not assume a fixed character offset. Descriptions can contain variable-length text.
- **Storing raw pipe characters in description/component:** Pipe is the DEBT.md table delimiter. Always sanitize with `replace(/\|/g, '/')` before inserting user-provided text into a table cell.
- **Making DEBT.md milestone-scoped:** STATE.md design decision: DEBT.md is project-level (`.planning/DEBT.md`), not placed in `.planning/milestones/vX.Y/DEBT.md`. Debt entries carry `source_phase` for provenance.
- **Skipping header initialization guard:** If `debt log` is called on a non-existent DEBT.md, it must write the header first. Skipping this produces a file of bare table rows with no header, which breaks `debt list` parsing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent-safe file writes | Lock files, semaphores, temp-file-rename | `fs.appendFileSync` (O_APPEND) | Single-row appends are within POSIX atomicity guarantees; no external dependency |
| JSON output with large payload handling | Custom stdout write | `output(result, raw, rawValue)` from `core.cjs` | Already handles 50KB buffer limit by writing to tmpfile |
| Error with exit | `console.error` + `process.exit` | `error(message)` from `core.cjs` | Consistent error format across all commands |
| Markdown table parsing | Third-party markdown parser | Regex + split('|') | DEBT.md is a single controlled-format table; full parser is overkill |

**Key insight:** All infrastructure is already present in the codebase. This phase is purely additive: one new file (`debt.cjs`) and a router extension.

---

## Common Pitfalls

### Pitfall 1: Status Column Regex Fragility

**What goes wrong:** The regex to find and replace the status column in `debt resolve` fails on rows where description, component, or other free-text fields contain special regex characters.

**Why it happens:** The description field can contain anything except pipes. Naive patterns like `.*` in cells can fail to match rows with special characters.

**How to avoid:** Use `[^|]*` (match anything except pipe) for each cell, not `.*`. Escape the TD-NNN ID with `escapeRegex` (already in `core.cjs` as `escapeRegex` — verify it's exported, or inline).

**Warning signs:** `debt resolve --id TD-001 --status resolved` returns `updated: false` even though TD-001 exists in the file.

### Pitfall 2: ID Counter Reads Separator Row

**What goes wrong:** `getNextDebtId` matches the separator row `|---|---|...` and parses `NaN` from the dashes, breaking the max calculation.

**Why it happens:** The regex `TD-(\d+)` only matches `TD-` followed by digits, which will NOT match the separator row (`---`). This pitfall would only occur if someone used a different ID prefix. The `TD-\d+` regex is safe.

**How to avoid:** Use the specific `TD-\d+` pattern — it is self-filtering. Confirm with a unit test that the separator row produces zero matches.

**Warning signs:** First debt entry gets `TD-NaN` or `TD-001` is assigned when entries already exist.

### Pitfall 3: Pipe Characters in Free-Text Fields Corrupt the Table

**What goes wrong:** A user passes `--description "Fix foo | bar parsing"` — the pipe character breaks the table row into an extra column. `debt list` then fails to parse the row (cells.length < 10).

**Why it happens:** Markdown tables use pipe as the column delimiter.

**How to avoid:** Sanitize all user-provided free-text fields before inserting into the table row: `value.replace(/\|/g, '/')`.

**Warning signs:** `debt list` returns fewer entries than exist in the file; `debt resolve` can't find entries that are visually present.

### Pitfall 4: Missing require in gsd-tools.cjs

**What goes wrong:** `debt.cjs` is created and the `case 'debt':` is added, but `const debt = require('./lib/debt.cjs')` is not added at the top of `gsd-tools.cjs`. Running `gsd-tools debt log` throws `ReferenceError: debt is not defined`.

**Why it happens:** Forgetting to add the require alongside the case. All other modules are required at lines 130-139 of `gsd-tools.cjs`.

**How to avoid:** Add `const debt = require('./lib/debt.cjs')` in the module import block (lines 130-139), adjacent to `const milestone = require('./lib/milestone.cjs')`.

**Warning signs:** `Error: debt is not defined` on first `gsd-tools debt` call.

### Pitfall 5: Forgetting to Update CLI Usage Comment

**What goes wrong:** The giant JSDoc comment at the top of `gsd-tools.cjs` (lines 1-126) does not list `debt log`, `debt list`, `debt resolve`. This is informational only, but the project pattern requires it.

**Why it happens:** The comment is easy to overlook — it's far from the `case 'debt':` implementation.

**How to avoid:** Add a `Debt Operations:` section to the JSDoc comment at the top, listing all three subcommands and their flags, following the style of `Roadmap Operations:` (lines 38-44).

### Pitfall 6: DEBT.md Path Not Using planningRoot

**What goes wrong:** Phase 16 hardcodes `path.join(cwd, '.planning', 'DEBT.md')`. Per STATE.md, DEBT.md is project-level and NOT milestone-scoped — this is intentional. However, if the decision later changes, the hardcoded path will need updating.

**Why it happens:** DEBT.md is deliberately project-level (cross-cutting concern, entries carry `source_phase` for provenance).

**How to avoid:** Document in the code comment that the hardcoded `.planning/DEBT.md` is intentional (not an oversight like INTG-01). Use a `const DEBT_PATH = path.join(cwd, '.planning', 'DEBT.md')` constant within each function to centralize the path.

---

## Code Examples

Verified patterns from official sources:

### Module Require Block in gsd-tools.cjs (Lines 130-139 — insertion point)

```javascript
// Source: get-shit-done/bin/gsd-tools.cjs lines 128-139
const fs = require('fs');
const path = require('path');
const { error } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');
const phase = require('./lib/phase.cjs');
const roadmap = require('./lib/roadmap.cjs');
const verify = require('./lib/verify.cjs');
const config = require('./lib/config.cjs');
const template = require('./lib/template.cjs');
const milestone = require('./lib/milestone.cjs');
const commands = require('./lib/commands.cjs');
const init = require('./lib/init.cjs');
const frontmatter = require('./lib/frontmatter.cjs');
// ADD:
const debt = require('./lib/debt.cjs');
```

### output() and error() Pattern (from core.cjs)

```javascript
// Source: get-shit-done/bin/lib/core.cjs lines 27-48
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `gsd-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

function error(message) {
  process.stderr.write('Error: ' + message + '\n');
  process.exit(1);
}
```

### Test Pattern for New Commands (from helpers.cjs + commands.test.cjs)

```javascript
// Source: tests/helpers.cjs lines 47-55 + tests/commands.test.cjs lines 23-33
const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('debt commands', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject(); });
  afterEach(() => { cleanup(tmpDir); });

  test('debt log creates DEBT.md and returns TD-001', () => {
    const result = runGsdTools(
      'debt log --type code --severity high --component debt.cjs --description "Test entry" --logged-by test --source-phase 16 --source-plan 16-01',
      tmpDir
    );
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.id, 'TD-001');
    assert.ok(out.logged);
    // File must exist
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'DEBT.md')));
  });
});
```

### escapeRegex (already in core.cjs — use it)

```javascript
// Source: get-shit-done/bin/lib/core.cjs lines 160-162 (exported)
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
// Export: get-shit-done/bin/lib/core.cjs line 430 (check exports list when importing)
```

**Verification needed:** Confirm `escapeRegex` is in the `module.exports` of `core.cjs`. If not, define it inline in `debt.cjs`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No structured debt tracking | DEBT.md with markdown table | Phase 16 (v3.0) | Agents can log and query debt programmatically |
| Implicit tech debt in TODO comments | Explicit TD-NNN entries with severity, provenance | Phase 16 (v3.0) | Debt is visible, filterable, resolvable |
| Manual file locking for concurrent writes | `fs.appendFileSync` O_APPEND (kernel-atomic) | Phase 16 (v3.0) | Zero-dependency concurrent safety |

**Deprecated/outdated:**
- `.planning/TO-DOS.md` for structural debt: replaced by DEBT.md for programmatic debt. TO-DOS.md still handles manual workflow todos.

---

## Open Questions

1. **Does `escapeRegex` need to be imported from `core.cjs` or defined inline in `debt.cjs`?**
   - What we know: `escapeRegex` is defined in `core.cjs` at lines 160-162. It is used in `phase.cjs` (imported at line 7).
   - What's unclear: Whether it appears in `module.exports` of `core.cjs` (need to verify lines 425-445 of `core.cjs`).
   - Recommendation: Check `core.cjs` exports. If exported, import it. If not, define a 1-line version inline in `debt.cjs` — do not modify `core.cjs` just for this.

2. **Should `debt log` validate the `type` and `severity` field values?**
   - What we know: Requirements specify the 10 field names but do not say validation is required for Phase 16.
   - What's unclear: Phase 18 (WIRE-01) will have agents calling `debt log` automatically — loose validation prevents agent errors from blocking logging.
   - Recommendation: Accept any non-empty string. Log `type` and `severity` as-is. Strict enum validation is a Phase 18 concern (WIRE-03 gates logging on quality level).

3. **What should `debt list` return when DEBT.md does not exist?**
   - What we know: Consistent with other commands (e.g., `cmdListTodos` returns `{ count: 0, todos: [] }` if dir missing).
   - What's unclear: Whether callers (Phase 18 agents) need `{ entries: [], total: 0 }` or an error exit.
   - Recommendation: Return `{ entries: [], total: 0 }` (graceful empty, not error). Same pattern as `cmdListTodos`.

---

## Sources

### Primary (HIGH confidence)

All findings are derived from direct source code inspection of the project. No external library documentation needed — pure Node.js built-ins.

- `get-shit-done/bin/gsd-tools.cjs` — CLI router, module require pattern, `milestoneScope` parsing, existing subcommand cases (lines 128-641)
- `get-shit-done/bin/lib/commands.cjs` — `output()`/`error()` usage patterns, `cmdListTodos` empty-return pattern, `cmdHistoryDigest` parse pattern
- `get-shit-done/bin/lib/state.cjs` — `cmdStatePatch` read-modify-write pattern, regex field matching
- `get-shit-done/bin/lib/milestone.cjs` — module skeleton, named export pattern, `cmdRequirementsMarkComplete` table-update pattern
- `get-shit-done/bin/lib/core.cjs` — `output()`, `error()`, `escapeRegex`, `planningRoot()` source
- `tests/helpers.cjs` — `createTempProject()`, `runGsdTools()`, `cleanup()` test utilities
- `tests/commands.test.cjs` — test case structure for new commands
- `.planning/STATE.md` (Key v3.0 design decisions) — DEBT.md is project-level; `debt log` uses `fs.appendFileSync`; agent debt logging in try-catch
- `.planning/REQUIREMENTS.md` (DEBT-01 through DEBT-04) — exact 10-field spec, status transitions, filter parameters

### Secondary (MEDIUM confidence)

- Node.js v20.20.0 built-in `fs` module: `appendFileSync` uses `O_APPEND` flag on POSIX — confirmed by behavior test and Node.js documentation (POSIX `O_APPEND` guarantees atomicity for writes within a single `write()` call when data fits in kernel buffer).

### Tertiary (LOW confidence)

- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure Node.js built-ins, no external dependencies, all patterns verified from source
- Architecture: HIGH — module structure, router pattern, file format all directly observed from peer implementations in same codebase
- Pitfalls: HIGH — derived from reading source code and understanding the markdown table format constraints

**Research date:** 2026-02-25
**Valid until:** Indefinite — internal code only, no external dependency versions to expire
