<purpose>
Set the quality enforcement level for GSD commands. Controls how thoroughly the quality sentinel checks code during execution.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="validate">
Validate argument:

```
if $ARGUMENTS is empty or the level portion is not in ["fast", "standard", "strict"]:
  Error: Invalid quality level. Valid levels: fast, standard, strict

  - fast: Skip all quality gates (fastest execution)
  - standard: Run quality gates, warn on issues (default for new projects)
  - strict: Run quality gates, block on issues

  EXIT
```

Extract the level from $ARGUMENTS (ignoring --global flag if present):
- If $ARGUMENTS is "strict", level = "strict"
- If $ARGUMENTS is "standard --global" or "--global standard", level = "standard", flag = "--global"
- Parse level as the non-flag token
</step>

<step name="detect_scope">
Check for --global flag in $ARGUMENTS:
- If --global present: scope = "global"
- Otherwise: scope = "project"
</step>

<step name="execute">
Run the CLI command:

```bash
# For project scope:
node ~/.claude/get-shit-done/bin/gsd-tools.cjs set-quality $LEVEL

# For global scope:
node ~/.claude/get-shit-done/bin/gsd-tools.cjs set-quality --global $LEVEL
```
</step>

<step name="confirm">
Display confirmation based on scope:

For project scope:
```
Quality level set to: $LEVEL

| Level    | Behavior                            |
|----------|-------------------------------------|
| fast     | Skip all quality gates              |
| standard | Run gates, warn on issues           |
| strict   | Run gates, block on issues          |

Current: $LEVEL
Scope: project (.planning/config.json)

Subsequent commands will enforce the new level.
```

For global scope:
```
Global quality default set to: $LEVEL

New projects initialized after this will inherit quality.level=$LEVEL.
Existing projects are not affected (update them with /gsd:set-quality $LEVEL).

Scope: global (~/.gsd/defaults.json)
```
</step>

</process>

<success_criteria>
- [ ] Level argument validated
- [ ] Scope detected (project vs global)
- [ ] Config updated via CLI command
- [ ] Confirmation displayed with level table
</success_criteria>
