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

---

## Section 10: The Agent of Learning (AOL) — The Next Evolution

The teach-phase described above is the **v1 implementation** — effective but simple. A separate project, **Agent of Learning (AOL)** (`~/Projects/aol`), takes the same core philosophy and builds it into a full intelligent tutoring system (ITS) grounded in pedagogical research.

AOL is not a replacement for GSD's teach-phase. It is what teach-phase grows into when the learning dimension becomes the primary concern rather than a mode within a project management system.

### The Core Inversion (Shared with Teach-Phase)

Both systems share the same fundamental insight:

> Success criteria is NOT "make this code well, save it in context, and direct the learner to create exactly that." Success criteria IS: "Teach and guide the user to code the project to a functional state... while giving control of the exact form the code takes to the learner, and verify that the user did it themselves and displayed learning."

The agent never writes source code. The learner types everything. The agent guides, explains, verifies, and adapts.

### What AOL Adds Beyond Basic Teach-Phase

| Capability | GSD Teach-Phase | AOL |
|------------|-----------------|-----|
| Teaching modes | 2 (line-by-line, Socratic) | 4+ (PRIMM, Scaffolded, Socratic, Constructivist) |
| Mastery tracking | TEACH-PROGRESS.md per phase | Bayesian Knowledge Graph with continuous probability |
| Concept ordering | Planner reads prior progress files | DAG with topological sort, prerequisite enforcement |
| Scaffold management | Implicit (agent judgment) | Explicit 3-stage fading with thresholds and re-scaffolding |
| Learning assessment | Skill observations in progress file | Bloom's Taxonomy levels per concept (Remember→Create) |
| Session structure | Start→teach→wrap_up | State machine: INIT→WARMUP→TEACH→INSPECT→REFLECT→WRAP_UP→DONE |
| Observation system | Notes in TEACH-PROGRESS.md | Append-only JSONL with typed signals and strength ratings |
| Spaced repetition | None | Review scheduling woven into session warmups |
| Cognitive load management | One file at a time | One new concept at a time against familiar background, graph-enforced |
| State ownership | Agent writes markdown directly | Python engine owns all state; agents call CLI for reads/writes |

### AOL's Four Teaching Modes

GSD teach-phase has two modes (line-by-line and Socratic). AOL expands this to four research-grounded pedagogical approaches, selected dynamically per concept:

**1. PRIMM** (Predict → Run → Investigate → Modify → Make)
- For new syntax/patterns the learner hasn't seen
- Five cognitive steps: predict what code does → run it → investigate structure → modify behavior → make something new
- Natural progression from reading comprehension to creation

**2. Scaffolded** (Structure-Fading)
- For concepts in the learner's Zone of Proximal Development (can do with help)
- Provides supports (function signatures, step outlines, test cases) then explicitly fades them
- 3-stage fading: full → partial → minimal → none
- Requires 3+ successes before fading; re-scaffolds after 2+ failures

**3. Socratic** (Questioning/Deepening)
- Same as GSD teach-phase's Socratic mode, but with structured escalation
- If stuck after 2 attempts, auto-downgrades to PRIMM or Scaffolded
- Selected when mastery probability is medium-high

**4. Constructivist** (Discovery-Based)
- For concepts best learned through experimentation
- Creates situations where the learner encounters the concept naturally
- Example: "Try using parentheses instead of square brackets. What changed? Why?"
- Embraces productive failure as a learning mechanism

Future modes planned: Live Demo, Navigator/Driver, Rubber Duck, Retrieval Practice.

### Bayesian Knowledge Graph

Where GSD teach-phase tracks mastery as notes in a markdown file, AOL uses a formal Bayesian knowledge graph:

**Each concept node tracks:**
- `mastery_probability` (0.0–1.0) — updated via Bayesian inference after every interaction
- `bloom_level` — current demonstrated cognitive level (Remember through Create)
- `scaffold_level` — current scaffolding intensity, tracked per concept
- `demonstration_count` — successful demonstrations across varied contexts (not just one correct answer)
- `next_review_date` — calculated from mastery probability for spaced repetition

**Scaffold-weighted updates:** Success with full scaffolding barely moves mastery. Success without scaffolding moves it strongly. This prevents the illusion-of-learning where scaffolds do the thinking.

```
mastery_delta = learning_rate × step_size
learning_rate = (4 - scaffold_level) / 4.0
```

**50+ Python concepts** organized as a DAG with prerequisite edges:
- Foundation: variables, print, data_types, operators, strings, f-strings
- Control flow: conditionals, for_loops, while_loops
- Functions: functions → return_values → function_arguments → default_arguments → scope
- Data structures: lists, tuples, dicts, sets → comprehensions
- OOP: classes → instance_methods, inheritance, context_managers
- Advanced: decorators, generators, lambda, type_hints, dataclasses, exceptions

Topological sort enforces teaching order — the learner never encounters a concept whose prerequisites aren't mastered.

### Observation System

GSD teach-phase records skill observations as freeform notes in TEACH-PROGRESS.md. AOL replaces this with a structured, append-only observation system:

**Typed observation signals with strength ratings:**

| Signal | Strength | Example |
|--------|----------|---------|
| Correct Socratic answer | HIGH | Direct mastery evidence |
| Independent debugging | HIGH | Problem-solving competence |
| Unprompted "why" explanation | HIGH | Deep understanding |
| Code passes first try | MEDIUM | May be mastery or luck |
| "Just show me" request | MEDIUM | Mode mismatch or frustration |
| 2+ wrong Socratic attempts | MEDIUM | Partial understanding |
| Hesitation | LOW | Uncertainty signal |

**Append-only JSONL** — crash-safe, never edited after write. Aggregation is a separate read-then-write step performed by the engine.

**Teaching preference adaptation loop:**
1. Accumulate 3+ observations of same pattern
2. Generate preference: "For abstract concepts, default to Constructivist instead of Socratic"
3. Store in `teaching-preferences.jsonl` (7-day cooldown between adaptations)
4. Next session's curriculum planner reads preferences and adjusts mode selection

### Session State Machine

GSD teach-phase has a loose flow: start → teach through files → wrap up. AOL formalizes this as a state machine with explicit phases:

```
INIT → WARMUP → TEACH → INSPECT → REFLECT → WRAP_UP → DONE
```

- **WARMUP** — spaced repetition reviews woven naturally into session start
- **INSPECT** — code inspection checkpoints (functional correctness + learning evidence + Bloom's level + independence score)
- **REFLECT** — Kolb experiential learning cycle: "what happened? why? what did you learn?"

Each state is recoverable — sessions can crash and resume from any point.

### Learning Verification

GSD teach-phase verifies by asking the user to run a command and report what they see. AOL adds a formal verification layer:

**Learning Report (per phase):**
- Functional correctness: does the code work?
- Learning evidence: which concepts were demonstrated vs. need reinforcement?
- Bloom's peak: highest cognitive level demonstrated this session
- Independence score: ratio of independent vs. guided completions
- Recommendation: ready for next phase, or specific concepts need more work

### Architecture: Engine Authority

The most significant architectural difference: AOL separates the Python engine from the Claude agent layer.

```
Claude Code Layer (Markdown agents/commands)
    ↓ CLI calls (python -m aol.tools)
Python Workflow Engine (owns all state, makes decisions)
    ↓ reads/writes
File System State (.aol/ directory)
```

Agents never directly read/write state files. The engine is the single source of truth. This makes the system testable, deterministic, and agent-independent — the markdown layer could be swapped for a different AI without changing the engine.

State lives in `.aol/` (not `.planning/`) to avoid collision with GSD managing the build lifecycle.

### Pedagogical Foundations

AOL grounds its design in established learning science:

- **Bloom's Taxonomy (Revised)** — tracks cognitive level per concept across six stages
- **Zone of Proximal Development (Vygotsky)** — tasks stay challenging but achievable with guidance
- **Scaffolding with Fading (Bruner)** — explicit support that is explicitly removed
- **Mastery Learning (Bloom)** — 3+ demonstrations across varied contexts, not just one correct answer
- **Constructivism (Piaget/Papert)** — learning through building and productive failure
- **Kolb's Experiential Learning** — Experience → Reflect → Conceptualize → Experiment
- **Cognitive Load Theory (Sweller)** — one new concept at a time against familiar background
- **Spaced Repetition** — mastered concepts scheduled for review
- **Deliberate Practice (Ericsson)** — targeted exercises for identified weaknesses

### Implementation Status

AOL has completed Phases 1–2:
- **Phase 1:** CLI framework (Click), project init, config management, `.aol/` directory structure
- **Phase 2:** Knowledge graph engine — 50+ concepts, Bayesian updates, prerequisite enforcement, readiness checking

Remaining phases (3–7) cover: state management + observations, the core teaching loop (critical milestone), knowledge dashboard, spaced repetition + additional modes, and integration/milestones.

### The Relationship Between Teach-Phase and AOL

GSD teach-phase is the **working v1** — simple, effective, usable today. It proves the concept: an AI agent can teach rather than write code, and the learner retains more.

AOL is the **research-grounded v2** — taking everything learned from teach-phase sessions and building formal systems around it. The Bayesian graph replaces freeform notes. The four teaching modes replace binary line-by-line/Socratic. The observation system replaces manual skill tracking. The engine authority pattern replaces agent-writes-everything.

They share the same soul: the agent never writes source code, the learner types everything, "why" questions are the primary learning mechanism, and sessions can be interrupted and resumed.
