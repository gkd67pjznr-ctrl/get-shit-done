---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/tmac/.claude/get-shit-done/workflows/new-project.md
  - /Users/tmac/.claude/get-shit-done/workflows/settings.md
autonomous: true
requirements: [QUAL-ONBOARD-01, QUAL-ONBOARD-02, QUAL-ONBOARD-03]

must_haves:
  truths:
    - "New interactive project onboarding asks user to select quality level (fast/standard/strict)"
    - "New auto-mode project onboarding asks user to select quality level with fast as recommended"
    - "Config.json template outputs in both flows include quality.level field"
    - "Settings workflow includes quality question so users can change it after project init"
  artifacts:
    - path: "/Users/tmac/.claude/get-shit-done/workflows/new-project.md"
      provides: "Quality question in Step 5 Round 1 and Step 2a Round 1, config templates with quality"
      contains: "quality"
    - path: "/Users/tmac/.claude/get-shit-done/workflows/settings.md"
      provides: "Quality question in settings questionnaire"
      contains: "quality"
  key_links:
    - from: "new-project.md Step 5 Round 1"
      to: "config.json template (interactive)"
      via: "selected quality level flows into config output"
      pattern: "quality.*level"
    - from: "new-project.md Step 2a Round 1"
      to: "config.json template (auto)"
      via: "selected quality level flows into config output"
      pattern: "quality.*level"
    - from: "settings.md questionnaire"
      to: "config.json update_config step"
      via: "selected quality level written to config"
      pattern: "quality.*level"
---

<objective>
Add the quality enforcement level question (fast/standard/strict) to the GSD onboarding and settings workflows.

Purpose: Quality level is already supported in config.json and enforced by the CLI (set-quality command, config.cjs auto-migration), but users are never asked about it during project setup. This means it silently defaults. Making it an explicit onboarding question ensures users make a conscious choice.

Output: Updated new-project.md and settings.md workflow files with quality questions and config template updates.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/tmac/.claude/get-shit-done/workflows/new-project.md
@/Users/tmac/.claude/get-shit-done/workflows/settings.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add quality question to new-project.md onboarding flows</name>
  <files>/Users/tmac/.claude/get-shit-done/workflows/new-project.md</files>
  <action>
Make three targeted edits to `/Users/tmac/.claude/get-shit-done/workflows/new-project.md`:

**Edit 1 — Step 5 "Workflow Preferences", Round 1 (interactive mode, ~line 368-409):**

Add a 5th question to the Round 1 AskUserQuestion array (after the "Git Tracking" question, before the closing `]`). Insert this question object:

```
  {
    header: "Quality",
    question: "Quality enforcement level for execution gates?",
    multiSelect: false,
    options: [
      { label: "Standard (Recommended)", description: "Run quality gates, warn on issues" },
      { label: "Fast", description: "Skip all quality gates (fastest execution)" },
      { label: "Strict", description: "Run quality gates, block on issues" }
    ]
  }
```

Update the Round 1 header comment from "4 questions" to "5 questions":
Change `**Round 1 — Core workflow settings (4 questions):**` to `**Round 1 — Core workflow settings (5 questions):**`

**Edit 2 — Step 2a "Auto Mode Config", Round 1 (auto mode, ~line 86-121):**

Add a 4th question to the Round 1 AskUserQuestion array (after "Git Tracking", before closing `]`). Insert:

```
  {
    header: "Quality",
    question: "Quality enforcement level for execution gates?",
    multiSelect: false,
    options: [
      { label: "Fast (Recommended)", description: "Skip all quality gates (fastest execution)" },
      { label: "Standard", description: "Run quality gates, warn on issues" },
      { label: "Strict", description: "Run quality gates, block on issues" }
    ]
  }
```

Note: In auto mode, "Fast" is recommended (not "Standard") because auto mode prioritizes speed.

Update the Round 1 header comment from "3 questions" to "4 questions":
Change `**Round 1 — Core settings (3 questions, no Mode question):**` to `**Round 1 — Core settings (4 questions, no Mode question):**`

**Edit 3 — Config.json template outputs (two locations):**

In the auto mode config template (~line 169-183), add `"quality"` field. The JSON should become:

```json
{
  "mode": "yolo",
  "depth": "[selected]",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "quality": {
    "level": "fast|standard|strict"
  },
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false,
    "auto_advance": true
  }
}
```

In the interactive mode config template (~line 466-480), add the same `"quality"` field:

```json
{
  "mode": "yolo|interactive",
  "depth": "quick|standard|comprehensive",
  "parallelization": true|false,
  "commit_docs": true|false,
  "model_profile": "quality|balanced|budget",
  "quality": {
    "level": "fast|standard|strict"
  },
  "workflow": {
    "research": true|false,
    "plan_check": true|false,
    "verifier": true|false
  }
}
```

Do NOT change anything else in the file. Preserve all existing formatting, indentation, and content.

  <quality_scan>
    <code_to_reuse>
      - Known: The existing AskUserQuestion pattern in both Round 1 blocks — replicate exact structure (header, question, multiSelect, options with label+description)
      - Known: The existing config.json template blocks — add `"quality"` object adjacent to `"model_profile"`
    </code_to_reuse>
    <docs_to_consult>
      N/A — no external library dependencies. Only editing markdown workflow files.
    </docs_to_consult>
    <tests_to_write>
      N/A — no new exported logic. These are markdown workflow instruction files, not code.
    </tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>grep -c "Quality" /Users/tmac/.claude/get-shit-done/workflows/new-project.md | xargs test 4 -le</automated>
  </verify>
  <done>
    - Step 5 Round 1 has 5 questions including Quality with Standard as recommended
    - Step 2a Round 1 has 4 questions including Quality with Fast as recommended
    - Both config.json templates include "quality": { "level": "..." }
    - No other content changed
  </done>
</task>

<task type="auto">
  <name>Task 2: Add quality question to settings.md workflow</name>
  <files>/Users/tmac/.claude/get-shit-done/workflows/settings.md</files>
  <action>
Make three targeted edits to `/Users/tmac/.claude/get-shit-done/workflows/settings.md`:

**Edit 1 — Add Quality question to AskUserQuestion in `present_settings` step (~line 40-106):**

Add an 8th question to the AskUserQuestion array. Insert it after the "Branching" question (the last current question, before the closing `])`). Add:

```
  {
    question: "Quality enforcement level for execution gates?",
    header: "Quality",
    multiSelect: false,
    options: [
      { label: "Standard (Recommended)", description: "Run quality gates, warn on issues" },
      { label: "Fast", description: "Skip all quality gates (fastest execution)" },
      { label: "Strict", description: "Run quality gates, block on issues" }
    ]
  }
```

**Edit 2 — Update `read_current` step (~line 22-34) to parse quality level:**

Add to the parsed values list:
```
- `quality.level` — execution gate enforcement (default: `standard`)
```

**Edit 3 — Update `update_config` step JSON template (~line 111-129):**

Add `"quality"` field to the merged config JSON. It should become:

```json
{
  ...existing_config,
  "model_profile": "quality" | "balanced" | "budget",
  "quality": {
    "level": "fast" | "standard" | "strict"
  },
  "workflow": {
    "research": true/false,
    "plan_check": true/false,
    "verifier": true/false,
    "auto_advance": true/false,
    "nyquist_validation": true/false
  },
  "git": {
    "branching_strategy": "none" | "phase" | "milestone"
  }
}
```

**Edit 4 — Update `confirm` step display table (~line 180-196):**

Add a row for Quality in the settings confirmation table, after "Git Branching":

```
| Quality Level        | {fast/standard/strict} |
```

Also update the success criteria comment at the bottom (~line 209) from "7 settings" to "8 settings":
Change `User presented with 7 settings (profile + 5 workflow toggles + git branching)` to `User presented with 8 settings (profile + 5 workflow toggles + git branching + quality level)`

**Edit 5 — Update `save_as_defaults` JSON template (~line 157-173):**

Add quality field to the defaults.json template:

```json
{
  "mode": <current>,
  "depth": <current>,
  "model_profile": <current>,
  "commit_docs": <current>,
  "parallelization": <current>,
  "branching_strategy": <current>,
  "quality": {
    "level": <current>
  },
  "workflow": {
    ...
  }
}
```

Do NOT change anything else in the file. Preserve all existing formatting and content.

  <quality_scan>
    <code_to_reuse>
      - Known: The existing AskUserQuestion pattern in `present_settings` step — replicate exact structure
      - Known: The existing config JSON template in `update_config` step — add quality object
    </code_to_reuse>
    <docs_to_consult>
      N/A — no external library dependencies. Only editing markdown workflow files.
    </docs_to_consult>
    <tests_to_write>
      N/A — no new exported logic. These are markdown workflow instruction files, not code.
    </tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>grep -c "Quality" /Users/tmac/.claude/get-shit-done/workflows/settings.md | xargs test 3 -le</automated>
  </verify>
  <done>
    - Settings questionnaire has 8 questions including Quality with Standard as recommended
    - Config JSON template includes quality.level field
    - Defaults JSON template includes quality.level field
    - Confirmation table shows Quality Level row
    - Success criteria updated to mention 8 settings
    - No other content changed
  </done>
</task>

</tasks>

<verification>
After both tasks complete, verify:

1. new-project.md has quality question in BOTH Step 5 Round 1 AND Step 2a Round 1
2. new-project.md has quality field in BOTH config.json templates
3. settings.md has quality question in the AskUserQuestion array
4. settings.md has quality field in the update_config JSON template
5. settings.md has quality field in the save_as_defaults JSON template
6. All three valid levels appear in each question: fast, standard, strict
7. Interactive/settings flows recommend "Standard"; auto mode recommends "Fast"

```bash
# Verify quality appears in all expected locations
grep -n "quality" /Users/tmac/.claude/get-shit-done/workflows/new-project.md
grep -n "quality" /Users/tmac/.claude/get-shit-done/workflows/settings.md
# Verify level options present
grep -c "fast\|standard\|strict" /Users/tmac/.claude/get-shit-done/workflows/new-project.md
grep -c "fast\|standard\|strict" /Users/tmac/.claude/get-shit-done/workflows/settings.md
```
</verification>

<success_criteria>
- Quality question appears in new-project.md Step 5 Round 1 (interactive) with Standard recommended
- Quality question appears in new-project.md Step 2a Round 1 (auto) with Fast recommended
- Both config.json templates in new-project.md include "quality": { "level": "..." }
- Quality question appears in settings.md questionnaire with Standard recommended
- Config template in settings.md includes quality.level
- Defaults template in settings.md includes quality.level
- Settings confirmation table includes Quality Level row
- No unrelated changes to either file
</success_criteria>

<output>
After completion, create `.planning/quick/6-we-need-the-quality-question-in-the-gsd-/6-SUMMARY.md`
</output>
