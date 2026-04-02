---
name: refine-skill
description: Accept or dismiss a pending skill suggestion
---

# /gsd:refine-skill

<objective>
Accept or dismiss a pending suggestion to refine a SKILL.md file. Accepting writes sample corrections into the target skill as a new Learned Patterns section and commits the change. Dismissing marks the suggestion dismissed without modifying any skill file.
</objective>

<arguments>
- skill-name (optional): name of the target skill (e.g. code-review)
- --id <suggestionId>: target a specific suggestion by ID
</arguments>

<process>
1. Read `.planning/patterns/suggestions.json` from the project root.

2. Determine the filter:
   - If `--id <suggestionId>` was provided, find the suggestion with that exact ID and status `pending`.
   - If a skill name was provided as the first argument, filter to suggestions where `target_skill === skill-name` and `status === 'pending'`.
   - If no argument was provided, collect all suggestions where `status === 'pending'`.

3. If no pending suggestions match the filter, say: "No pending suggestions found for [skill-name or 'any skill']." and stop.

4. For each matching suggestion, display:
   - ID: `<id>`
   - Target skill: `<target_skill>`
   - Category: `<category>`
   - Correction count: `<correction_count>`
   - Sample corrections (first 2): list each on its own line

5. Ask the user: "Accept (a) or Dismiss (d)?" — if there is only one suggestion, confirm action directly. If multiple, ask for each one in sequence.

6. On 'a' (accept):
   - Run: `node .claude/hooks/lib/refine-skill.cjs accept <id>`
   - Parse the JSON output.
   - If exit code is 0 and `ok: true`: report "Skill refined: .claude/skills/<target_skill>/SKILL.md updated and committed."
   - If exit code is non-zero or `ok: false`: report the error reason and stop.

7. On 'd' (dismiss):
   - Run: `node .claude/hooks/lib/refine-skill.cjs dismiss <id>`
   - Parse the JSON output.
   - If exit code is 0 and `ok: true`: report "Suggestion dismissed."
   - If exit code is non-zero or `ok: false`: report the error reason and stop.

8. Confirm the action completed successfully. If the user accepted, note that the Learned Patterns section was added to the skill file and the change was committed to git.
</process>

<success_criteria>
- The user is shown the pending suggestion details before being asked to act.
- Accept path: SKILL.md is updated, a git commit is created, and the suggestion status becomes `refined`.
- Dismiss path: suggestion status becomes `dismissed`, no skill file is touched, no git commit is created.
- Exit code from `refine-skill.cjs` is checked — errors are surfaced to the user.
</success_criteria>
