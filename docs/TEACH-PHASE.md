# GSD Teach Phase

A teaching mode for GSD that replaces discuss/plan/execute for projects where the user writes all code manually.

---

## Section 1: Overview

`/gsd:teach-phase N` is an alternative to the standard GSD `discuss → plan → execute` cycle, designed for projects where the learner writes every line of code themselves.

**Core philosophy: guide, explain, verify — never write source code.**

Where the standard GSD workflow has Claude produce code that gets committed to disk, the teach phase inverts this: Claude shows code in chat, the user types it into their editor, and Claude verifies they got it right before moving on.

**When to use teach-phase (vs. standard GSD execute flow):**

| Situation | Use |
|-----------|-----|
| You are learning the language/framework by building | teach-phase |
| You want to understand every line you ship | teach-phase |
| Speed is the priority, learning is secondary | execute |
| You are building production code you do not write | execute |
| You want Claude to type all the code for you | execute |

Teach-phase is not a slower execute — it is a different mode entirely. The output is not just working code, it is working code that the developer understands and can reproduce.

---

## Section 2: Origins

Teach-phase originated in the `nrgy` project — a Python/PySide6 desktop app the user built from scratch to learn coding.

**The user's situation:** New to coding, learning by building, typed every line manually, and asked "why" constantly. The explicit constraint: no copy-paste from Claude. Every character entered via keyboard.

Two memory files captured the pattern that emerged from early phases:

- **`user_learning_project.md`** — Documented the user's goal: learn Python/PySide6 by building NRGY, no copy-paste. Noted the user as new to coding, learning visually by doing, asking excellent "why" questions.

- **`feedback_teaching_style.md`** — Captured the evolved teaching style across Phase 1 and Phase 2. Key refinements: go block by block (not whole files), explain *why* before showing code, use Socratic prompting for familiar concepts rather than just presenting code to copy.

The nrgy project's per-phase manual teaching sessions revealed something: the teaching pattern was consistent, repeatable, and valuable enough to codify. Rather than re-inventing it ad-hoc at the start of each phase, it could be captured as a formal GSD workflow — so any learning project could run the same high-quality teaching loop.

---

## Section 3: Design Evolution

The teaching style evolved across two phases of nrgy before it was formalized.

**Phase 1 learning:** The user wanted a slow pace with explanations of purpose, imports, and mechanics before typing. The request: understand each line before committing it to memory (and disk). Whole-file dumps failed — too much to absorb at once.

**Phase 2 refinement:** The user clarified: go block by block within each file, not whole files at a time. And use Socratic prompting for patterns the user had already seen — asking "what do you think we need to import here?" rather than just showing it.

**The key insight — adaptive mode:** Not all concepts need the same depth. New/unfamiliar concepts (PySide6 signals, SQL schema, decorators) need line-by-line explanation with "why" before typing. Familiar patterns (basic variable assignment, imports they've done before) benefit from Socratic questioning — reinforces their knowledge and builds confidence.

**The decision to formalize it:** Encoding this as a GSD workflow rather than continuing ad-hoc means:
- The planner researches the phase before teaching starts (dependency ordering)
- Progress is tracked so sessions can be interrupted and resumed
- Mastery memory accumulates across phases (system knows what's already learned)
- Any learning project can use the same pattern

---

## Section 4: Architecture

The teach-phase feature consists of six components working in sequence:

| Component | File | Role |
|-----------|------|------|
| Slash command | `.claude/commands/teach-phase.md` | Entry point; invoked as `/gsd:teach-phase N` |
| Workflow definition | `~/.claude/get-shit-done/workflows/teach-phase.md` | 6-step orchestration: initialize, check_existing, research_and_plan, display_plan_summary, teach, wrap_up |
| gsd-teach-planner agent | `.claude/agents/gsd-teach-planner.md` | Researches phase, builds TEACH-PLAN.md with dependency-ordered steps, classifies concepts as new vs. review |
| gsd-teacher agent | `.claude/agents/gsd-teacher.md` | Interactive teaching: runs on Opus, adapts between line-by-line and Socratic per concept, tracks progress |
| TEACH-PLAN.md | `{phase_dir}/{padded_phase}-TEACH-PLAN.md` | Ordered teaching plan: steps, concepts, verification commands, session estimate |
| TEACH-PROGRESS.md | `{phase_dir}/{padded_phase}-TEACH-PROGRESS.md` | Session state: completed steps, skill observations, mastery notes |

The workflow is designed for straight-through execution: once started, the planner researches and writes the plan, then teaching begins immediately — no intermediate prompt to the user between plan creation and teaching start.

---

## Section 5: Workflow Detail (the 6 steps)

### Step 1: initialize

Validates the phase number against the GSD roadmap via `gsd-tools.cjs init phase-op`. Resolves the phase directory, padded phase number, and phase metadata. Checks whether TEACH-PLAN.md and TEACH-PROGRESS.md already exist for this phase.

If the phase is not found in the roadmap, the workflow exits and directs the user to `/gsd:progress`.

### Step 2: check_existing

Routes based on what artifacts exist:

- **TEACH-PROGRESS.md exists with incomplete steps** — reads the file, finds the first unchecked item, and skips directly to the teach step to resume
- **TEACH-PLAN.md exists but no TEACH-PROGRESS.md** — offers to start teaching or rebuild the plan
- **Neither exists** — continues to research_and_plan

This routing ensures sessions can be safely interrupted and restarted without losing progress.

### Step 3: research_and_plan

Spawns the `gsd-teach-planner` agent (Sonnet) with a prompt that includes the roadmap, requirements, prior TEACH-PROGRESS.md files from earlier phases, and the project's mastery memory. The planner:

1. Identifies all deliverables (files, classes, functions) for the phase
2. Maps concept dependencies across those deliverables
3. Classifies each concept as new (line-by-line) or review (Socratic) based on prior progress
4. Orders the teaching steps so the user never writes code that references something they haven't built yet
5. Writes the result as `{padded_phase}-TEACH-PLAN.md` in the phase directory

After the planner returns, the plan is committed to git.

### Step 4: display_plan_summary

Reads the newly created TEACH-PLAN.md and displays a brief summary:
- Phase name and number
- Number of files to build
- New concepts introduced this phase
- Estimated session count

Then immediately continues to teaching — no pause for confirmation.

### Step 5: teach

Spawns the `gsd-teacher` agent (Opus) with the teach plan and progress file. The teacher:

- Greets the user and states which step they are on
- Works through each file in dependency order
- Adapts between line-by-line and Socratic mode per concept
- Shows code in chat — never writes to disk
- Verifies each file before moving to the next
- Updates TEACH-PROGRESS.md as steps complete

The teacher runs interactively until the user stops the session or all steps in the plan are complete.

### Step 6: wrap_up

Reads TEACH-PROGRESS.md and displays completion status. If all steps are checked off, shows a completion banner and the command for the next phase. If partially complete, shows the progress count and the resume command (`/gsd:teach-phase N`). Updates STATE.md with session info and commits the progress file.

---

## Section 6: Adaptive Teaching Mode

The gsd-teacher agent evaluates each concept independently within every step:

### LINE-BY-LINE Mode — for new/unfamiliar concepts

Triggered when a concept is:
- Not in the mastery map, or marked as low confidence
- A PySide6 pattern (signals/slots, widgets, layouts, models)
- A decorator, metaclass, or advanced Python pattern
- SQL schema design, ORM patterns, or database operations
- Anything the user has not demonstrated before

How it works:
1. Show code one logical chunk at a time (imports, then class definition, then method body)
2. Explain what each line does and WHY before the user types it
3. Wait for the user to confirm they have typed it before moving on
4. Answer any "why" or "what does this do" questions thoroughly
5. Connect new concepts to things already known when possible

### SOCRATIC Mode — for familiar concepts

Triggered when a concept is:
- In the mastery map with medium or high confidence
- Basic imports the user has done before
- Simple variable assignment, function definitions, or syntax already demonstrated
- Patterns successfully used in a previous step this session

How it works:
1. Describe what needs to happen next in plain English
2. Ask guiding questions: "What do you think we need to import here?"
3. Give hints if the user is on the right track but missing details
4. Fall back to line-by-line after 2 failed attempts, or on user request
5. Celebrate correct answers — reinforce that they know this

### User Overrides (always available)

The user can redirect the mode at any time:
- "just show me" / "give me the answer" — switches to line-by-line for current concept
- "I know this, skip ahead" — accepts mastery, moves to next chunk
- "why?" / "what does this do?" — triggers thorough explanation regardless of mode
- "let me try again" / "I want to redo this" — encouraged; redoing is how they learn

---

## Section 7: Mastery Memory

The system tracks learning state across phases so it never re-teaches what the user has already mastered.

**TEACH-PROGRESS.md** (per phase) stores:
- Completed steps with dates
- Demonstrated mastery (concepts they nailed)
- Concepts that needed guidance (struggled with)
- Session notes (observed patterns, learning velocity)

**How it accumulates:** When the teach planner researches a new phase, it reads all prior TEACH-PROGRESS.md files from earlier phases. This gives it a full picture of the user's existing skill level before classifying concepts as new vs. review.

**Project-level mastery memory:** For the nrgy project, mastery memory also lives in `~/.claude/projects/-Users-tmac-Projects-nrgy/memory/`. The workflow and agent prompts read `user_learning_project.md` and `feedback_teaching_style.md` from this directory to calibrate teaching style at the start of each session.

The result: by Phase 5, the system knows the user has mastered Python imports, basic class definitions, and simple variable assignment. Those concepts get Socratic treatment. PySide6 signals (introduced in Phase 3) are marked as demonstrated but not fully mastered — so they get a refresher in line-by-line mode when they reappear. Concepts appearing for the first time always get full line-by-line treatment.

---

## Section 8: Current Availability

### Project-level (this repo)

- `.claude/commands/teach-phase.md` — project-level slash command
- `.claude/agents/gsd-teacher.md` — teacher agent (Opus)
- `.claude/agents/gsd-teach-planner.md` — teach planner agent (Sonnet)

### Global (`~/.claude/`)

- `~/.claude/commands/gsd/teach-phase.md` — available to all projects via GSD routing
- `~/.claude/agents/gsd-teacher.md` — globally available teacher agent
- `~/.claude/agents/gsd-teach-planner.md` — globally available teach planner agent
- `~/.claude/get-shit-done/workflows/teach-phase.md` — canonical workflow definition

**Assessment:** The feature is fully available globally. Any GSD project can invoke `/gsd:teach-phase N` as long as a phase plan exists in the roadmap. The workflow currently hardcodes mastery memory paths to `/Users/tmac/.claude/projects/-Users-tmac-Projects-nrgy/memory/` — for other learning projects, those paths would need to be updated in the workflow and agent prompt templates.

---

## Section 9: Recommendation — Making It Fully Generic

The one coupling to the nrgy project is the mastery memory path. The workflow prompt and the gsd-teacher agent both reference:

```
/Users/tmac/.claude/projects/-Users-tmac-Projects-nrgy/memory/
```

This works perfectly for nrgy. For any other learning project, these paths would need to be updated manually.

**The clean fix:** The workflow should resolve the active project's memory directory dynamically, using the same mechanism that GSD uses to resolve the active project path. Claude Code's project memory lives at `~/.claude/projects/{encoded-path}/memory/` — this path can be derived from the working directory at workflow start.

This is a small improvement scoped to a future milestone. The teach-phase feature is fully functional today for nrgy, and adaptable to other projects with a minor path update.
