---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - /Users/tmac/Projects/Gymrats2/.planning/config.json
  - /Users/tmac/Projects/pyxelate/.planning/config.json
  - /Users/tmac/.gsd/defaults.json
autonomous: true
requirements: [QUAL-01, QUAL-02, QUAL-03]

must_haves:
  truths:
    - "Gymrats2 uses Opus model for execution (model_profile: quality)"
    - "Gymrats2 has nyquist validation enabled in workflow"
    - "Pyxelate has nyquist validation enabled in workflow"
    - "Pyxelate enforces strict quality level"
    - "Global defaults ensure all new projects start with full quality settings"
  artifacts:
    - path: "/Users/tmac/Projects/Gymrats2/.planning/config.json"
      provides: "Gymrats2 GSD config with quality profile and nyquist"
      contains: "\"model_profile\": \"quality\""
    - path: "/Users/tmac/Projects/pyxelate/.planning/config.json"
      provides: "Pyxelate GSD config with strict quality and nyquist"
      contains: "\"nyquist_validation\": true"
    - path: "/Users/tmac/.gsd/defaults.json"
      provides: "Global defaults for all new GSD projects"
      contains: "\"model_profile\": \"quality\""
  key_links:
    - from: "/Users/tmac/.gsd/defaults.json"
      to: "get-shit-done/bin/lib/config.cjs"
      via: "userDefaults merge in cmdConfigInit"
      pattern: "userDefaults"
---

<objective>
Enable full GSD quality settings across Gymrats2, Pyxelate, and global defaults.

Purpose: Ensure all projects use maximum code quality enforcement -- Opus model for execution, nyquist validation during planning, and strict quality gates. Global defaults ensure future projects inherit these settings automatically.

Output: Three updated config files with full quality settings enabled.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/tmac/Projects/gsdup/.planning/STATE.md

Research confirmed current state:
- Gymrats2: model_profile "balanced" (should be "quality"), missing nyquist_validation
- Pyxelate: model_profile already "quality", missing nyquist_validation, missing quality section
- Global defaults: Only has quality.level "standard", no workflow or model_profile defaults

Config merge logic in config.cjs (lines 148-153): userDefaults spread over hardcoded defaults,
with nested merge for workflow and quality objects. Global defaults at ~/.gsd/defaults.json
are loaded as userDefaults during `cmdConfigInit`.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update Gymrats2 and Pyxelate project configs</name>
  <files>/Users/tmac/Projects/Gymrats2/.planning/config.json, /Users/tmac/Projects/pyxelate/.planning/config.json</files>
  <action>
Update Gymrats2 config.json:
1. Change `model_profile` from `"balanced"` to `"quality"`
2. Add `"nyquist_validation": true` to the `workflow` object
3. Preserve ALL existing fields exactly (mode, depth, parallelization, commit_docs, concurrent, quality section with test_exemptions and context7_token_cap)

Final Gymrats2 config should be:
```json
{
  "mode": "yolo",
  "depth": "comprehensive",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  },
  "concurrent": true,
  "quality": {
    "level": "strict",
    "test_exemptions": [".md", ".json", "templates/**", ".planning/**"],
    "context7_token_cap": 2000
  }
}
```

Update Pyxelate config.json:
1. Add `"nyquist_validation": true` to the `workflow` object
2. Add a `quality` section with `"level": "strict"` and standard test_exemptions
3. Preserve ALL existing fields exactly (mode, depth, parallelization, commit_docs, model_profile)

Final Pyxelate config should be:
```json
{
  "mode": "yolo",
  "depth": "comprehensive",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "quality",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  },
  "quality": {
    "level": "strict",
    "test_exemptions": [".md", ".json", "templates/**", ".planning/**"],
    "context7_token_cap": 2000
  }
}
```
  </action>
  <verify>
    <automated>cat /Users/tmac/Projects/Gymrats2/.planning/config.json | python3 -c "import sys,json; c=json.load(sys.stdin); assert c['model_profile']=='quality', 'gymrats2 model_profile'; assert c['workflow']['nyquist_validation']==True, 'gymrats2 nyquist'; print('Gymrats2 OK')" && cat /Users/tmac/Projects/pyxelate/.planning/config.json | python3 -c "import sys,json; c=json.load(sys.stdin); assert c['workflow']['nyquist_validation']==True, 'pyxelate nyquist'; assert c['quality']['level']=='strict', 'pyxelate quality'; print('Pyxelate OK')"</automated>
  </verify>
  <done>Gymrats2 has model_profile "quality" and nyquist_validation true. Pyxelate has nyquist_validation true and quality level "strict". All existing settings preserved.</done>
</task>

<task type="auto">
  <name>Task 2: Update global defaults for future projects</name>
  <files>/Users/tmac/.gsd/defaults.json</files>
  <action>
Update ~/.gsd/defaults.json to include full quality settings that new projects will inherit via the userDefaults merge in config.cjs cmdConfigInit (lines 148-153).

The defaults.json is spread over hardcoded defaults, with nested merge for workflow and quality objects. So any keys present in defaults.json will override the hardcoded values when a new project runs `gsd-tools.cjs config init`.

Final defaults.json should be:
```json
{
  "model_profile": "quality",
  "workflow": {
    "nyquist_validation": true
  },
  "quality": {
    "level": "strict"
  }
}
```

Note: Only include settings that should OVERRIDE hardcoded defaults. The merge logic in config.cjs handles the rest (research, plan_check, verifier default to true; test_exemptions and context7_token_cap come from requiredQualityDefaults). We only need to override: model_profile (hardcoded "balanced" -> "quality"), nyquist_validation (hardcoded false -> true), quality.level (hardcoded "fast" -> "strict").
  </action>
  <verify>
    <automated>cat /Users/tmac/.gsd/defaults.json | python3 -c "import sys,json; c=json.load(sys.stdin); assert c['model_profile']=='quality', 'model_profile'; assert c['workflow']['nyquist_validation']==True, 'nyquist'; assert c['quality']['level']=='strict', 'quality level'; print('Global defaults OK')"</automated>
  </verify>
  <done>Global defaults updated so all future GSD project initializations will use quality model profile, nyquist validation, and strict quality level.</done>
</task>

</tasks>

<verification>
All three config files updated with full quality settings:
1. `cat /Users/tmac/Projects/Gymrats2/.planning/config.json` -- model_profile is "quality", nyquist_validation is true
2. `cat /Users/tmac/Projects/pyxelate/.planning/config.json` -- nyquist_validation is true, quality.level is "strict"
3. `cat /Users/tmac/.gsd/defaults.json` -- model_profile "quality", nyquist_validation true, quality.level "strict"
</verification>

<success_criteria>
- Gymrats2 config uses model_profile "quality" (was "balanced") and has nyquist_validation enabled
- Pyxelate config has nyquist_validation enabled and quality level "strict" (was missing both)
- Global defaults ensure new projects start with quality profile, nyquist enabled, and strict quality
- All existing config fields in both projects are preserved (no data loss)
- All three files are valid JSON
</success_criteria>

<output>
After completion, create `.planning/quick/11-enable-full-gsd-quality-settings-in-gymr/11-SUMMARY.md`
</output>
