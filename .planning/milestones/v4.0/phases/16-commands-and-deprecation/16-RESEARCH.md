# Phase 16: Commands and Deprecation - Research

**Researched:** 2026-03-09
**Domain:** Claude Code slash commands, config migration, deprecation lifecycle
**Confidence:** HIGH

## Summary

Phase 16 is the final phase of v4.0. It has two distinct workstreams: (1) creating three new analysis commands (`suggest`, `digest`, `session-start`) and porting 13 standalone commands into the `/gsd:*` namespace, and (2) removing all `/wrap:*` and `/sc:*` commands, updating docs/skills that reference the old system, and marking the standalone `gsd-skill-creator` package as deprecated.

The existing `/sc:*` commands (`suggest`, `digest`, `start`, `observe`, `status`, `wrap`) contain well-defined logic that serves as the source material for the new `/gsd:*` commands. The key adaptation required is updating config references from `.planning/skill-creator.json` to `.planning/config.json` (under the `adaptive_learning` key) and removing references to the standalone `skill-creator` CLI tool. The 13 standalone commands in `.claude/commands/` are simple markdown files (32-105 lines each, 644 lines total) that need to be moved into `commands/gsd/` to join the existing 34 GSD commands.

**Primary recommendation:** Port `/sc:suggest`, `/sc:digest`, and `/sc:start` as `/gsd:suggest`, `/gsd:digest`, and `/gsd:session-start` with config path updates; move 13 standalone commands into `commands/gsd/`; delete `.claude/commands/wrap/` and `.claude/commands/sc/` directories; update 7 skill files that reference `skill-creator`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CMD-01 | `/gsd:suggest` command -- analyzes accumulated observations and proposes skill improvements | Port from `/sc:suggest` (`.claude/commands/sc/suggest.md`, 158 lines). Update config path from `skill-creator.json` to `config.json`. Replace `npx skill-creator create` guidance with inline skill creation help. |
| CMD-02 | `/gsd:digest` command -- generates learning summaries from session patterns | Port from `/sc:digest` (`.claude/commands/sc/digest.md`, 217 lines). Update config path. Remove `/sc:start` and `/sc:observe` footer references, replace with `/gsd:session-start` and inline observation note. |
| CMD-03 | `/gsd:session-start` command -- session briefing with GSD position and recent activity | Port from `/sc:start` (`.claude/commands/sc/start.md`, 294 lines). Update config path. Replace `npx skill-creator status --json` with manual scan fallback (the CLI is being deprecated). Update footer command references. |
| CMD-04 | 13 standalone commands ported into GSD command set | Move 13 files from `.claude/commands/` to `commands/gsd/`. Update YAML frontmatter `name:` field to use `gsd:` prefix. Files: beautiful-commits, code-review, decision-framework, file-operation-patterns, context-handoff, gsd-preflight, gsd-onboard, gsd-trace, gsd-dashboard, typescript-patterns, api-design, env-setup, test-generator. |
| DEPR-01 | Wrapper commands (`/wrap:*`) removed | Delete `.claude/commands/wrap/` directory (4 files: execute.md, verify.md, plan.md, phase.md). Wrapper functionality is now native -- Phase 15 baked observation into all GSD workflows. |
| DEPR-02 | `/sc:*` commands removed -- functionality absorbed into `/gsd:*` | Delete `.claude/commands/sc/` directory (6 files: digest.md, observe.md, start.md, status.md, suggest.md, wrap.md). Replaced by CMD-01/02/03; observe/status/wrap have no direct replacements (functionality absorbed). |
| DEPR-03 | Help text and docs updated to reflect integrated system | Update 7 skill files referencing `skill-creator`: gsd-workflow/SKILL.md, gsd-workflow/references/command-routing.md, gsd-workflow/references/yolo-mode.md, skill-integration/SKILL.md, skill-integration/references/bounded-guardrails.md, session-awareness/SKILL.md, security-hygiene/SKILL.md. Update config schema to remove `wrapper_commands` toggle. |
| DEPR-04 | gsd-skill-creator marked as deprecated with migration notice | Add deprecation notice to the standalone package. This is external to the gsdup repo -- likely a README/package.json change in the skill-creator repo, or a note in gsdup's own docs. |
</phase_requirements>

## Standard Stack

### Core

No new libraries needed. This phase is entirely about reorganizing markdown command files and updating text references.

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| `commands/gsd/` | `/Users/tmac/Projects/gsdup/commands/gsd/` | GSD slash command source directory | Already has 34 commands; installer copies to `.claude/commands/gsd/` |
| `.claude/commands/` | `/Users/tmac/Projects/gsdup/.claude/commands/` | Project-level standalone commands (being deprecated) | Source material for porting |
| `.claude/commands/sc/` | `/Users/tmac/Projects/gsdup/.claude/commands/sc/` | Skill-creator commands (being removed) | Source material for CMD-01/02/03 |
| `.claude/commands/wrap/` | `/Users/tmac/Projects/gsdup/.claude/commands/wrap/` | Wrapper commands (being removed) | To be deleted entirely |

### Supporting

| File | Purpose | Impact |
|------|---------|--------|
| `src/integration/config/schema.ts` | Zod schema for adaptive_learning config | Remove `wrapper_commands` field |
| `src/integration/config/types.ts` | TypeScript types | Remove `wrapper_commands` field |
| `tests/foundation.test.cjs` | Config shape test | Remove `wrapper_commands` from expected shape |
| `skills/gsd-workflow/SKILL.md` | Workflow routing skill | Update skill-creator references |
| `skills/skill-integration/SKILL.md` | Integration skill | Major update -- remove wrapper/sc references |
| `skills/session-awareness/SKILL.md` | Session skill | Update "skill-creator Artifacts" section |

## Architecture Patterns

### Command File Structure

All commands in `commands/gsd/` follow this pattern:

```markdown
---
name: gsd:command-name
description: One-line description of what the command does
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
---

# /gsd:command-name -- Title

<objective>
What the command achieves.
</objective>

<process>
## Step 1: ...
## Step 2: ...
</process>

<success_criteria>
- Criterion 1
- Criterion 2
</success_criteria>
```

### Porting Pattern: SC Commands to GSD Commands

When porting `/sc:*` commands to `/gsd:*`:

1. **Update YAML frontmatter:** Change `name: sc:X` to `name: gsd:X`
2. **Update config path:** Replace `.planning/skill-creator.json` with `.planning/config.json`, access settings under `adaptive_learning` key
3. **Remove `npx skill-creator` references:** Replace CLI invocations with inline alternatives or manual file operations
4. **Update cross-references:** Replace `/sc:*` command references with `/gsd:*` equivalents
5. **Remove integration level concept:** The three-level integration model (Level 1/2/3) is deprecated -- everything is natively integrated

### Porting Pattern: Standalone Commands to GSD Namespace

When moving standalone commands from `.claude/commands/` to `commands/gsd/`:

1. **Move file:** `cp .claude/commands/beautiful-commits.md commands/gsd/beautiful-commits.md`
2. **Update YAML frontmatter:** Ensure `name:` field uses the target slash command name
3. **Content stays unchanged:** These are reference/guidance commands, not workflow commands -- their content is already correct

### Config Path Migration Map

| Old Path | New Path |
|----------|----------|
| `.planning/skill-creator.json` | `.planning/config.json` |
| `config.integration.*` | `config.adaptive_learning.integration.*` |
| `config.observation.*` | `config.adaptive_learning.observation.*` |
| `config.suggestions.*` | `config.adaptive_learning.suggestions.*` |
| `config.token_budget.*` | `config.adaptive_learning.token_budget.*` |

### SC Command Disposition

| SC Command | Disposition | New Location |
|------------|-------------|-------------|
| `/sc:suggest` | Port to `/gsd:suggest` | `commands/gsd/suggest.md` |
| `/sc:digest` | Port to `/gsd:digest` | `commands/gsd/digest.md` |
| `/sc:start` | Port to `/gsd:session-start` | `commands/gsd/session-start.md` |
| `/sc:observe` | Absorb -- native observation in Phase 15 replaces this | No replacement needed |
| `/sc:status` | Absorb -- budget/skill info available via `/gsd:session-start` | No replacement needed |
| `/sc:wrap` | Remove -- wrapper concept deprecated | No replacement needed |

### Standalone Command Mapping (CMD-04)

| Current Location | Target Location | Slash Command |
|-----------------|-----------------|---------------|
| `.claude/commands/beautiful-commits.md` | `commands/gsd/beautiful-commits.md` | `/gsd:beautiful-commits` |
| `.claude/commands/code-review.md` | `commands/gsd/code-review.md` | `/gsd:code-review` |
| `.claude/commands/decision-framework.md` | `commands/gsd/decision-framework.md` | `/gsd:decision-framework` |
| `.claude/commands/file-operation-patterns.md` | `commands/gsd/file-operation-patterns.md` | `/gsd:file-operation-patterns` |
| `.claude/commands/context-handoff.md` | `commands/gsd/context-handoff.md` | `/gsd:context-handoff` |
| `.claude/commands/gsd-preflight.md` | `commands/gsd/preflight.md` | `/gsd:preflight` |
| `.claude/commands/gsd-onboard.md` | `commands/gsd/onboard.md` | `/gsd:onboard` |
| `.claude/commands/gsd-trace.md` | `commands/gsd/trace.md` | `/gsd:trace` |
| `.claude/commands/gsd-dashboard.md` | `commands/gsd/dashboard.md` | `/gsd:dashboard` |
| `.claude/commands/typescript-patterns.md` | `commands/gsd/typescript-patterns.md` | `/gsd:typescript-patterns` |
| `.claude/commands/api-design.md` | `commands/gsd/api-design.md` | `/gsd:api-design` |
| `.claude/commands/env-setup.md` | `commands/gsd/env-setup.md` | `/gsd:env-setup` |
| `.claude/commands/test-generator.md` | `commands/gsd/test-generator.md` | `/gsd:test-generator` |

**Note:** Commands with `gsd-` prefix should drop the prefix when moving to the `gsd/` directory (e.g., `gsd-preflight.md` becomes `preflight.md` since it will be invoked as `/gsd:preflight`). The existing `gsd-dashboard.md` in `.claude/commands/` was already handled in Phase 14 but needs its canonical home in `commands/gsd/dashboard.md`.

### Anti-Patterns to Avoid

- **Don't port `/sc:observe`:** Its functionality is fully replaced by Phase 15's native observation. Creating a duplicate would cause confusion.
- **Don't port `/sc:status`:** Budget info is now part of `/gsd:session-start`. A standalone status command adds no value.
- **Don't port `/sc:wrap`:** The entire wrapper concept is being deprecated. There is nothing to port.
- **Don't keep `wrapper_commands` in config:** The toggle is meaningless once wrappers are removed. Leaving dead config causes confusion.
- **Don't leave orphaned references:** Every `skill-creator` mention in skills must be updated or the system will reference a deprecated tool.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Config reading | Custom JSON parser with path resolution | Read `.planning/config.json` and access `adaptive_learning` key directly | Config structure is stable and well-defined from Phase 12 |
| Observation capture | New observation logic in ported commands | Native observation from Phase 15 | Observation is already baked into all 7 GSD workflow commands |
| Skill loading | Manual skill enumeration | Glob `.claude/skills/*/SKILL.md` | Standard pattern already used throughout the system |

## Common Pitfalls

### Pitfall 1: Forgetting Config Path in Ported Commands
**What goes wrong:** Ported commands still reference `.planning/skill-creator.json` which no longer exists
**Why it happens:** The sc commands have 11 references to `skill-creator.json` across 6 files
**How to avoid:** Search-and-replace ALL config path references during porting. Use the Config Path Migration Map above.
**Warning signs:** Commands fail silently when config file is not found (they use defaults)

### Pitfall 2: Cross-Reference Loops
**What goes wrong:** Ported `/gsd:suggest` still says "Run `/sc:status` to see updated budget"
**Why it happens:** SC commands reference each other extensively in footer text and guidance
**How to avoid:** Update ALL command cross-references to use `/gsd:*` equivalents. Specifically check footers, help text, and "Run X to..." guidance.
**Warning signs:** User sees references to commands that don't exist

### Pitfall 3: Orphaned `.claude/commands/` Entries
**What goes wrong:** After moving standalone commands to `commands/gsd/`, the old files in `.claude/commands/` remain and create duplicates
**Why it happens:** Files are copied but not deleted
**How to avoid:** Delete source files after confirming target files exist. Verify no duplicate command names.
**Warning signs:** Same command available under two different names

### Pitfall 4: Dashboard Command Collision
**What goes wrong:** `gsd-dashboard.md` exists in `.claude/commands/` AND Phase 14 may have created content in `commands/gsd/`
**Why it happens:** Dashboard was handled in Phase 14 but the canonical command file may not be in `commands/gsd/` yet
**How to avoid:** Check whether `commands/gsd/dashboard.md` already exists before creating it. The `.claude/commands/gsd-dashboard.md` is the current source.
**Warning signs:** Two dashboard commands with different behavior

### Pitfall 5: Missing `npx skill-creator` Replacement
**What goes wrong:** Ported commands reference `npx skill-creator create`, `npx skill-creator status --json`, etc. which no longer works
**Why it happens:** The standalone CLI is being deprecated
**How to avoid:** Replace every `npx skill-creator` reference with either inline instructions or remove the reference entirely. For `/gsd:suggest` accept action, replace with "describe the skill and I'll help draft it" guidance.
**Warning signs:** Commands instruct users to run a tool that doesn't exist

### Pitfall 6: Test Expectations for Config Shape
**What goes wrong:** `tests/foundation.test.cjs` line 75 expects `wrapper_commands: true` in the config shape
**Why it happens:** Test was written when wrappers existed
**How to avoid:** Update the test to remove `wrapper_commands` from expected config shape when the schema is updated
**Warning signs:** Test failures after schema change

## Code Examples

### Example 1: YAML Frontmatter for Ported Command

```markdown
---
name: gsd:suggest
description: Review pending skill suggestions -- accept, dismiss, or defer detected patterns
allowed-tools:
  - Read
  - Write
  - Bash
---
```

### Example 2: Config Reading in Ported Command (Updated Path)

```markdown
## Step 1: Read integration config

Read `.planning/config.json` using the Read tool. Extract `adaptive_learning.suggestions.min_occurrences` (default: 3).

If the config file is missing or `adaptive_learning` key does not exist, use defaults:
- min_occurrences: 3
- cooldown_days: 7
- auto_dismiss_after_days: 30
```

### Example 3: Updated Cross-References in Footer

```markdown
---
_Run `/gsd:session-start` for session briefing | `/gsd:digest` for learning summary_
```

### Example 4: Removing wrapper_commands from Schema

```typescript
// src/integration/config/schema.ts
// REMOVE this line:
//   wrapper_commands: z.boolean().default(true),

// src/integration/config/types.ts
// REMOVE these lines:
//   /** Enable wrapper command features. */
//   wrapper_commands: boolean;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate skill-creator CLI (`npx skill-creator`) | Integrated into GSD core | v4.0 (Phase 12-16) | No standalone install needed |
| Wrapper commands (`/wrap:*`) for observation | Native observation in workflow commands | Phase 15 | Wrappers are now redundant |
| Separate config (`skill-creator.json`) | Unified config (`config.json` with `adaptive_learning` key) | Phase 12 | Single config file |
| Three integration levels (L1/L2/L3) | Everything natively integrated | Phase 16 | No user configuration needed for integration |
| `/sc:*` command namespace | `/gsd:*` namespace | Phase 16 | Single command namespace |

## Files to Modify (Complete Inventory)

### New Files to Create (3)

| File | Source | Lines (approx) |
|------|--------|----------------|
| `commands/gsd/suggest.md` | Port from `.claude/commands/sc/suggest.md` | ~150 |
| `commands/gsd/digest.md` | Port from `.claude/commands/sc/digest.md` | ~200 |
| `commands/gsd/session-start.md` | Port from `.claude/commands/sc/start.md` | ~280 |

### Files to Move (13)

All from `.claude/commands/*.md` to `commands/gsd/*.md` (see Standalone Command Mapping table above).

### Files to Delete (10)

| File | Reason |
|------|--------|
| `.claude/commands/sc/suggest.md` | Replaced by `commands/gsd/suggest.md` |
| `.claude/commands/sc/digest.md` | Replaced by `commands/gsd/digest.md` |
| `.claude/commands/sc/start.md` | Replaced by `commands/gsd/session-start.md` |
| `.claude/commands/sc/observe.md` | Absorbed by Phase 15 native observation |
| `.claude/commands/sc/status.md` | Absorbed into `/gsd:session-start` |
| `.claude/commands/sc/wrap.md` | Wrapper concept deprecated |
| `.claude/commands/wrap/execute.md` | Wrapper concept deprecated |
| `.claude/commands/wrap/verify.md` | Wrapper concept deprecated |
| `.claude/commands/wrap/plan.md` | Wrapper concept deprecated |
| `.claude/commands/wrap/phase.md` | Wrapper concept deprecated |

Plus 13 standalone command files from `.claude/commands/` after successful move to `commands/gsd/`.

### Files to Update (Content Changes)

| File | Change |
|------|--------|
| `skills/gsd-workflow/SKILL.md` | Update "skill-creator" references to integrated system |
| `skills/gsd-workflow/references/command-routing.md` | Replace skill-creator Actions section with `/gsd:*` equivalents |
| `skills/gsd-workflow/references/yolo-mode.md` | Update skill-creator reference |
| `skills/skill-integration/SKILL.md` | Major rewrite -- remove wrapper/sc references, update to integrated model |
| `skills/skill-integration/references/bounded-guardrails.md` | Update skill-creator reference |
| `skills/session-awareness/SKILL.md` | Update "skill-creator Artifacts" section header and references |
| `skills/security-hygiene/SKILL.md` | Update skill-creator reference |
| `src/integration/config/schema.ts` | Remove `wrapper_commands` field from schema |
| `src/integration/config/types.ts` | Remove `wrapper_commands` field from types |
| `tests/foundation.test.cjs` | Remove `wrapper_commands` from expected config shape |
| `.planning/config.json` | Remove `wrapper_commands: true` from integration block |

## Open Questions

1. **DEPR-04 Scope: Where does the deprecation notice go?**
   - What we know: gsd-skill-creator is a separate package/repo. DEPR-04 says "mark as deprecated with migration notice."
   - What's unclear: Is the deprecation notice just in the gsdup repo's docs, or does it require changes to an external skill-creator repo?
   - Recommendation: Add a deprecation note in gsdup's README or docs referencing that skill-creator functionality is now part of GSD core. If the skill-creator repo is accessible, add a deprecation notice there too. If not accessible, document what would be needed.

2. **Should `/gsd:observe` exist as a replacement for `/sc:observe`?**
   - What we know: Phase 15 native observation replaces automatic capture. `/sc:observe` was for manual point-in-time snapshots.
   - What's unclear: Whether users still need manual observation capture.
   - Recommendation: Do NOT create `/gsd:observe`. The native observation system handles this automatically. Manual observation was a workaround for the lack of native capture.

3. **Should `/gsd:status` exist as a replacement for `/sc:status`?**
   - What we know: `/sc:status` showed skill budget and suggestions. This info is in `/gsd:session-start`.
   - What's unclear: Whether a standalone budget check is useful.
   - Recommendation: Do NOT create a separate `/gsd:status`. The session-start command already covers this. Adding another command would create confusion about which to use.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner + Vitest |
| Config file | vitest.config.ts (Vitest), none for Node test runner |
| Quick run command | `node --test tests/commands.test.cjs` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | `/gsd:suggest` command file exists with correct structure | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| CMD-02 | `/gsd:digest` command file exists with correct structure | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| CMD-03 | `/gsd:session-start` command file exists with correct structure | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| CMD-04 | 13 standalone commands exist in `commands/gsd/` | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| DEPR-01 | No files in `.claude/commands/wrap/` | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| DEPR-02 | No files in `.claude/commands/sc/` | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| DEPR-03 | No `skill-creator.json` references in skills | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |
| DEPR-04 | Deprecation notice exists | unit | `node --test tests/commands-deprecation.test.cjs` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test tests/commands-deprecation.test.cjs`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/commands-deprecation.test.cjs` -- covers CMD-01 through CMD-04, DEPR-01 through DEPR-04
- [ ] Tests verify: file existence, YAML frontmatter correctness, config path references, absence of deprecated files

## Sources

### Primary (HIGH confidence)
- Direct file inspection of `.claude/commands/sc/` (6 files, source material for ports)
- Direct file inspection of `.claude/commands/wrap/` (4 files, to be deleted)
- Direct file inspection of `.claude/commands/` (13 standalone files, to be moved)
- Direct file inspection of `commands/gsd/` (34 existing GSD commands, target directory)
- Direct file inspection of `skills/` (7 files with skill-creator references)
- Direct file inspection of `src/integration/config/schema.ts` and `types.ts`
- Direct file inspection of `tests/foundation.test.cjs`
- Direct file inspection of `.planning/config.json`
- Phase 15 ROADMAP entry confirming native observation is complete

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md requirement definitions for CMD-01 through DEPR-04

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all files inspected directly, no external dependencies
- Architecture: HIGH -- command file pattern is well-established with 34 existing examples
- Pitfalls: HIGH -- identified through direct code inspection of config paths and cross-references
- File inventory: HIGH -- complete file listing verified against filesystem

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- internal restructuring, no external dependencies)
