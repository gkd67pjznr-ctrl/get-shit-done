---
phase: 17-catalogue-todo-system-consolidation-fix
plan: 17
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/STATE.md
autonomous: true
requirements: []
---

<objective>
Catalogue the todo system consolidation fix in this repo's tracking files so it is properly recorded as a GSD improvement. The fix was done in a different repo session (GymRats2) and is described in `.planning/HANDOFF-todo-consolidation.md`. No code changes are needed — this task records the improvement.
</objective>

<context>
Background: Two competing todo systems were unified. `/add-to-todos` and `/check-todos` (user-level slash commands at `~/.claude/commands/`) were rewritten to use the same `.planning/todos/pending/*.md` format as the GSD `/gsd:add-todo` and `/gsd:check-todos` commands. Ten orphaned items were migrated from the legacy `TO-DOS.md` flat file, which was then deleted.

The fix has no code artifacts in this repo — the changes were to user-level Claude commands (`~/.claude/commands/add-to-todos.md`, `~/.claude/commands/check-todos.md`) in a GymRats2 project session.

What "cataloguing" means here:
- Add quick task #17 to the STATE.md Quick Tasks Completed table
- Commit so the record is in git history
</context>

<tasks>

<task type="auto">
  <name>Task 1: Record quick task #17 in STATE.md and commit</name>
  <files>.planning/STATE.md</files>
  <action>
    1. Open `/Users/tmac/Projects/gsdup/.planning/STATE.md`.

    2. In the "Quick Tasks Completed" table, add a new row for #17 immediately after the #16 row:

       ```
       | 17 | Catalogue todo system consolidation fix (unified /add-to-todos + /check-todos with GSD folder system) | 2026-03-07 | — | Verified | [17-catalogue-todo-system-consolidation-fix-](./quick/17-catalogue-todo-system-consolidation-fix-/) |
       ```

       Note: The commit hash column is "—" since this is a documentation-only record of work done in another session. Fill it in with the actual commit hash after committing in step 4.

    3. Update "Session Continuity" section at the bottom:
       - Change "Last activity" to: `2026-03-07 — Catalogued todo system consolidation fix (quick task #17)`
       - Change "Next step" to: `Continue v4.0 milestone — define requirements and create roadmap`

    4. Commit with message:
       `docs(17): catalogue todo system consolidation fix in STATE.md`

       Body: `Records the /add-to-todos + /check-todos unification with GSD folder system. Fix was applied in GymRats2 session; see .planning/HANDOFF-todo-consolidation.md for details.`

       Include `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` trailer.

    5. After committing, update the commit hash column in STATE.md row #17 with the actual short hash, then amend or make a second commit. (If amending feels cumbersome, leave "—" and move on — the row entry is the important artifact.)
  </action>
  <verify>
    <automated>grep "17" /Users/tmac/Projects/gsdup/.planning/STATE.md | grep "todo"</automated>
  </verify>
  <done>STATE.md Quick Tasks Completed table has a row for #17 with description of the todo consolidation fix. Git log shows a docs(17) commit.</done>
</task>

</tasks>

<verification>
1. Check STATE.md has row 17: `grep "17.*todo" /Users/tmac/Projects/gsdup/.planning/STATE.md`
2. Check git log: `git -C /Users/tmac/Projects/gsdup log --oneline -3`
</verification>

<success_criteria>
- STATE.md Quick Tasks Completed table includes entry #17 describing the todo system consolidation
- A docs(17) commit exists in git history
- Session Continuity section is updated to reflect current state
</success_criteria>

<output>
After completion, create `/Users/tmac/Projects/gsdup/.planning/quick/17-catalogue-todo-system-consolidation-fix-/17-SUMMARY.md`
</output>
