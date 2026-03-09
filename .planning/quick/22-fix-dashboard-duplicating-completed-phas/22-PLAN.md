---
phase: "22"
plan: "22-01"
type: quick
autonomous: true
wave: 1
depends_on: []
requirements: []
files_modified:
  - get-shit-done/bin/lib/server.cjs
must_haves:
  truths:
    - parseRoadmapFile() in server.cjs matches ALL top-level checkbox lines at column 0, including plan-level lines that contain "PLAN.md"
    - Bold-formatted phase lines like "**Phase 17: Name**" cause numMatch to return null (number: null) because "**" is not stripped before regex
    - The MilestoneAccordion renders phases.length directly as totalPhases and completedPhases — no filtering happens downstream
    - v4.0 and v5.0 ROADMAPs are unaffected because their plan lines appear under indented "Plans:" subsections (not at column 0)
    - v1.0 has 4 real phases but parser returns 12 (4 + 8 plan lines); v3.1 has 7 real phases but parser returns 19 (7 + 12 plan lines)
  artifacts:
    - get-shit-done/bin/lib/server.cjs (parseRoadmapFile function, lines 69-92)
    - dashboard/js/components/project-detail.js (MilestoneAccordion, lines 15-19)
  key_links:
    - .planning/milestones/v1.0/ROADMAP.md (example with column-0 plan checkboxes)
    - .planning/milestones/v5.0/ROADMAP.md (correct format — unaffected)
---

# Plan 22: Fix Dashboard Duplicating Completed Phases

## Context

The dashboard `MilestoneAccordion` shows inflated phase counts (e.g., 12 instead of 4) for older milestones. Root cause is in `parseRoadmapFile()` in `server.cjs`: it matches every top-level checkbox line at column 0, which includes plan-level entries like `- [x] 01-01-PLAN.md — Fix routing...`. Additionally, the `numMatch` regex fails on bold-formatted lines like `**Phase 17: Name**` because `**` is not stripped before the match, causing all phases to show `number: null`.

## Tasks

### Task 1: Fix parseRoadmapFile() in server.cjs

**Files:**
- `/Users/tmac/Projects/gsdup/get-shit-done/bin/lib/server.cjs`

**Action:**

Open `server.cjs` and locate the `parseRoadmapFile()` function (lines 69-92). Apply all four fixes to the function body:

**Fix 1 — Filter plan-level lines.** After the `checkMatch` regex match succeeds, add an early-continue guard that skips any line where `rest` contains "PLAN.md" (case-insensitive). This filters column-0 plan checkboxes that appear in older ROADMAP formats.

```js
if (/PLAN\.md/i.test(rest)) continue;
```

Place this immediately after `const rest = checkMatch[2].trim();` and before the `numMatch` block.

**Fix 2 — Strip markdown bold from rest before numMatch.** After the PLAN.md guard, strip `**` from `rest` before attempting `numMatch`:

```js
const cleanRest = rest.replace(/\*\*/g, '').trim();
```

Then change `numMatch` to operate on `cleanRest` instead of `rest`, and use `cleanRest` in the else-branch `phases.push` as well.

**Fix 3 — Handle decimal phase numbers in numMatch.** The current regex `(\d+)` only matches integer phase numbers. Replace with `(\d+(?:\.\d+)*)` to also match `16.1`, `3.2.1`, etc.

The updated `numMatch` line:
```js
const numMatch = cleanRest.match(/^(?:Phase\s+)?(\d+(?:\.\d+)*)[\s:-]+(.+)$/i);
```

**Fix 4 — Deduplicate by phase number as safety net.** After the `for` loop ends and before `return { phases }`, deduplicate: keep only the first occurrence of each phase number. Entries with `number: null` are always kept (they have no number to deduplicate on).

```js
const seen = new Set();
const deduped = phases.filter(p => {
  if (p.number === null) return true;
  if (seen.has(p.number)) return false;
  seen.add(p.number);
  return true;
});
return { phases: deduped };
```

Replace `return { phases };` with the block above.

The final `parseRoadmapFile()` function after all fixes:

```js
function parseRoadmapFile(content) {
  try {
    const phases = [];
    const lines = content.split('\n');
    for (const line of lines) {
      // Match: - [x] Phase 01 - Name or - [ ] 01: Name
      const checkMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
      if (checkMatch) {
        const done = checkMatch[1].trim().toLowerCase() === 'x';
        const rest = checkMatch[2].trim();
        // Skip plan-level checkboxes (e.g. "- [x] 01-01-PLAN.md — ...") present in older ROADMAP formats
        if (/PLAN\.md/i.test(rest)) continue;
        // Strip markdown bold formatting before numeric extraction
        const cleanRest = rest.replace(/\*\*/g, '').trim();
        // Extract phase number if present (supports integers and decimals like 16.1)
        const numMatch = cleanRest.match(/^(?:Phase\s+)?(\d+(?:\.\d+)*)[\s:-]+(.+)$/i);
        if (numMatch) {
          phases.push({ number: numMatch[1], name: numMatch[2].trim(), status: done ? 'complete' : 'pending', goal: null });
        } else {
          phases.push({ number: null, name: cleanRest, status: done ? 'complete' : 'pending', goal: null });
        }
      }
    }
    // Deduplicate by phase number — keep first occurrence; null-number entries always kept
    const seen = new Set();
    const deduped = phases.filter(p => {
      if (p.number === null) return true;
      if (seen.has(p.number)) return false;
      seen.add(p.number);
      return true;
    });
    return { phases: deduped };
  } catch {
    return null;
  }
}
```

**Verify:**

Start the dashboard server and curl the project data endpoint for a project that has an older milestone ROADMAP (v1.0 or v3.1). Confirm phase count matches actual phase count:

```sh
# From gsdup repo — start server in background then inspect
node get-shit-done/bin/gsd-tools.cjs dashboard serve --port 9988 &
sleep 1
curl -s http://localhost:9988/api/projects | node -e "
  const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const p = d.find(x => x.milestones);
  p && p.milestones.forEach(m => {
    const phases = (m.roadmap && m.roadmap.phases) || [];
    console.log(m.name, 'phases:', phases.length, phases.map(x => x.number).join(','));
  });
"
kill %1
```

Also run a quick unit-level smoke check by directly calling the function with fixture content:

```sh
node -e "
const fs = require('fs');
// Inline the fixed function and test it
const content = fs.readFileSync('.planning/milestones/v1.0/ROADMAP.md', 'utf8');
// Paste parseRoadmapFile source or require server module
const server = require('./get-shit-done/bin/lib/server.cjs');
// server.cjs does not export parseRoadmapFile, so test via the API instead
console.log('done');
"
```

Because `parseRoadmapFile` is not exported, verify through the running server's API response (see curl above) or by temporarily adding a console.log inside the function during testing.

Additionally, open the dashboard in a browser at `http://localhost:9988` and confirm:
- v1.0 milestone accordion shows 4/4 phases (not 12/12)
- v3.1 milestone accordion shows 7/7 phases (not 19/19)
- Phase numbers display correctly (e.g., "17" not null) for v5.0 bold-format phases
- v4.0 and v5.0 counts are unchanged

**Done criteria:**
- [ ] `parseRoadmapFile()` function body matches the corrected version above exactly
- [ ] The PLAN.md guard (`if (/PLAN\.md/i.test(rest)) continue;`) is present
- [ ] `numMatch` operates on `cleanRest` (bold-stripped) not `rest`
- [ ] `numMatch` regex uses `(\d+(?:\.\d+)*)` for decimal support
- [ ] Deduplication block replaces the bare `return { phases };`
- [ ] Dashboard shows correct phase counts for v1.0, v1.1, v3.0, v3.1 milestones
- [ ] No regressions: v4.0 and v5.0 phase counts and numbers are unchanged
- [ ] Commit with message: `fix(server): filter plan-level checkboxes and strip bold from phase lines in parseRoadmapFile`
