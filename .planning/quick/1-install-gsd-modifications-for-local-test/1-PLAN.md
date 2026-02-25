---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: [QUICK-1]
must_haves:
  truths:
    - "Local dev modifications in /Users/tmac/Projects/gsdup are installed to ~/.claude/get-shit-done/"
    - "The get-shit-done-cc CLI is available globally"
    - "All GSD components (workflows, commands, agents, hooks, bin) are updated at ~/.claude/"
  artifacts:
    - path: "~/.claude/get-shit-done/VERSION"
      provides: "Version stamp matching local dev"
    - path: "~/.claude/get-shit-done/workflows/"
      provides: "Updated workflow files including any new additions"
    - path: "~/.claude/commands/gsd/"
      provides: "Updated slash commands"
  key_links:
    - from: "/Users/tmac/Projects/gsdup/get-shit-done/"
      to: "~/.claude/get-shit-done/"
      via: "install.js copies with path replacement"
      pattern: "copyWithPathReplacement"
---

<objective>
Install the local GSD development modifications to the global ~/.claude/ location for testing.

Purpose: The gsdup repo contains in-progress modifications to the GSD framework. These need to be deployed to the global install location (~/.claude/) so they can be tested in real projects that use GSD.

Output: Updated GSD installation at ~/.claude/ with all local modifications applied.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/tmac/Projects/gsdup/DEPLOY.md
@/Users/tmac/Projects/gsdup/package.json
@/Users/tmac/Projects/gsdup/bin/install.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build hooks and install package globally</name>
  <files></files>
  <action>
From the gsdup project root (/Users/tmac/Projects/gsdup), run the following steps sequentially:

1. Install dev dependencies (needed for prepublishOnly hook, though build-hooks.js is pure Node.js copy):
   ```
   cd /Users/tmac/Projects/gsdup && npm install
   ```

2. Install the package globally, which triggers prepublishOnly (builds hooks/dist/) and makes `get-shit-done-cc` CLI available:
   ```
   cd /Users/tmac/Projects/gsdup && npm install -g .
   ```
   This copies the package to the global node_modules and creates the `get-shit-done-cc` symlink.

3. Run the installer to deploy files to ~/.claude/:
   ```
   get-shit-done-cc --claude --global
   ```
   This runs bin/install.js which:
   - Copies commands/gsd/ to ~/.claude/commands/gsd/ (with path replacement)
   - Copies get-shit-done/ to ~/.claude/get-shit-done/ (workflows, templates, references, bin)
   - Copies agents/ to ~/.claude/agents/ (with path replacement)
   - Copies hooks/dist/ to ~/.claude/hooks/
   - Writes VERSION file
   - Writes file manifest for modification detection

IMPORTANT: The installer is interactive if no runtime flags are passed. Always use `--claude --global` flags to avoid interactive prompts.

If the installer prompts about statusline configuration, accept defaults or skip (not critical for testing).

  <quality_scan>
    <code_to_reuse>N/A -- executing existing install tooling, no new code</code_to_reuse>
    <docs_to_consult>N/A -- using project's own DEPLOY.md and install.js</docs_to_consult>
    <tests_to_write>N/A -- no new exported logic</tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>get-shit-done-cc --help 2>&1 | head -5 && echo "---CLI OK---" && cat ~/.claude/get-shit-done/VERSION && echo "---VERSION OK---"</automated>
  </verify>
  <done>get-shit-done-cc CLI is available globally and ~/.claude/get-shit-done/VERSION shows the current version from package.json (1.20.6)</done>
</task>

<task type="auto">
  <name>Task 2: Verify all modifications are deployed</name>
  <files></files>
  <action>
Run verification checks to confirm the local dev modifications made it to the global install:

1. Compare workflow files between dev and installed:
   ```
   diff <(ls /Users/tmac/Projects/gsdup/get-shit-done/workflows/) <(ls ~/.claude/get-shit-done/workflows/)
   ```
   Should show no differences (or only expected differences).

2. Compare template files:
   ```
   diff <(ls /Users/tmac/Projects/gsdup/get-shit-done/templates/) <(ls ~/.claude/get-shit-done/templates/)
   ```

3. Compare bin directory:
   ```
   diff <(ls /Users/tmac/Projects/gsdup/get-shit-done/bin/) <(ls ~/.claude/get-shit-done/bin/)
   ```

4. Compare commands:
   ```
   diff <(ls /Users/tmac/Projects/gsdup/commands/gsd/) <(ls ~/.claude/commands/gsd/)
   ```

5. Compare agents:
   ```
   diff <(ls /Users/tmac/Projects/gsdup/agents/) <(ls ~/.claude/agents/ | grep gsd-)
   ```

6. Spot-check a modified file to confirm content was updated (not stale):
   Pick the most recently modified workflow file in the dev repo and diff its content against the installed version (accounting for path replacement of `~/.claude/` paths).

If any differences are found, report them. Minor path-replacement differences (e.g., `~/.claude/` replaced with full path) are expected and acceptable.

  <quality_scan>
    <code_to_reuse>N/A -- verification commands only</code_to_reuse>
    <docs_to_consult>N/A -- no external library dependencies</docs_to_consult>
    <tests_to_write>N/A -- no new exported logic</tests_to_write>
  </quality_scan>
  </action>
  <verify>
    <automated>diff <(ls /Users/tmac/Projects/gsdup/get-shit-done/workflows/) <(ls ~/.claude/get-shit-done/workflows/) && echo "WORKFLOWS MATCH" && diff <(ls /Users/tmac/Projects/gsdup/commands/gsd/) <(ls ~/.claude/commands/gsd/) && echo "COMMANDS MATCH"</automated>
  </verify>
  <done>All workflow, template, command, agent, and bin files from the dev repo are present in ~/.claude/ with matching file lists. Content differences are limited to expected path replacements.</done>
</task>

</tasks>

<verification>
- `get-shit-done-cc --help` runs successfully
- `~/.claude/get-shit-done/VERSION` matches package.json version
- No missing files when comparing dev repo to installed location
- Workflow, template, command, and agent directories have matching file lists
</verification>

<success_criteria>
- The get-shit-done-cc CLI is installed globally and functional
- All GSD framework files from the local dev repo are deployed to ~/.claude/
- The installed version can be used by other projects for testing
</success_criteria>

<output>
After completion, create `.planning/quick/1-install-gsd-modifications-for-local-test/1-SUMMARY.md`
</output>
