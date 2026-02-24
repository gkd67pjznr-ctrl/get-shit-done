---
name: gsd:set-quality
description: Set quality enforcement level (fast/standard/strict) for project or globally
argument-hint: <level> [--global]
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Set the quality enforcement level for GSD commands. Controls how thoroughly the quality sentinel checks code during execution.

Sets quality.level for the current project (default) or globally via --global flag:
- `fast` — Skip all quality gates (fastest execution)
- `standard` — Run quality gates, warn on issues (default for new projects)
- `strict` — Run quality gates, block on issues

Routes to the set-quality workflow which handles:
- Argument validation (fast/standard/strict)
- Scope detection (project vs global)
- Config update via CLI command
- Confirmation with level table display
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/set-quality.md
</execution_context>

<process>
**Follow the set-quality workflow** from `@~/.claude/get-shit-done/workflows/set-quality.md`.

The workflow handles all logic including:
1. Level argument validation
2. Scope detection (project vs global)
3. CLI command execution
4. Confirmation display with level table
</process>
