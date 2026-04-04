<purpose>
Orchestrate a 3-stage mechanical brainstorming pipeline: Seed → Expand → Converge.
Enforcement is mechanical — eval detection, quantity floors, SCAMPER completeness, and
saturation checks are all enforced by code (brainstorm.cjs) not prompts.

Invoked by /gsd:brainstorm [topic] [--wild] [--from-corrections] [--from-debt] [--for-milestone]
</purpose>

<required_reading>
Do NOT read ROADMAP.md or STATE.md before or during the Expand stage.
Context blinding is intentional — divergent thinking must not be anchored to current plans.
ROADMAP.md and STATE.md are loaded only at the start of the Converge stage.
</required_reading>

<process>

<step name="parse_args">
Parse `$ARGUMENTS` for the following:

- **Topic:** all non-flag words joined with spaces (required — if missing, use AskUserQuestion: "What topic do you want to brainstorm?")
- **`--wild`:** boolean flag — set `WILD_MODE=true`, `WILD_FLAG=--wild`. Otherwise `WILD_MODE=false`, `WILD_FLAG=`.
- **`--from-corrections`:** boolean — set `FROM_CORRECTIONS=--from-corrections`. Otherwise empty.
- **`--from-debt`:** boolean — set `FROM_DEBT=--from-debt`. Otherwise empty.
- **`--for-milestone`:** boolean — set `FOR_MILESTONE=--for-milestone`. Otherwise empty.

Create session directory:

```bash
SESSION_DIR=$(mktemp -d)
```

Resolve planning root:

```bash
PLANNING_ROOT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs state json 2>/dev/null | node -e "
process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);
process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.planning_root||'.planning')}catch{process.stdout.write('.planning')}})
" 2>/dev/null || echo ".planning")
```

Show the user:

```
## Brainstorm: [TOPIC]
Mode: [standard | WILD]
Session: [SESSION_DIR]
```
</step>

<step name="seed">
Build seed brief (context-blind — no ROADMAP/STATE loaded yet):

```bash
SEED=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm build-seed-brief "$PLANNING_ROOT" $FROM_CORRECTIONS $FROM_DEBT $FOR_MILESTONE)
```

Parse the `brief` field from the SEED JSON and display it.
Parse the `included` and `excluded` arrays from the SEED JSON.
If `excluded` is non-empty, display a note after the brief content:

> **Note:** The following sources were excluded from this seed brief (context-blind): [excluded joined with ", "]
> ROADMAP.md and STATE.md are always excluded.

If `excluded` is empty (all sources included), no additional note is needed.

Show:

```
## Seed Brief

[brief content]

---

Ready to begin the Expand stage. The goal is maximum divergence — no evaluation allowed.

What direction do you want to explore for [TOPIC]? (Or press Enter to go wide.)
```

Use AskUserQuestion to capture the user's direction note. Store in `SEED_DIRECTION`. If the response is an empty string, proceed — direction is optional.
</step>

<step name="expand_freeform">
Show:

```
## Expand: Freeform Dump

Generate as many ideas as possible. No evaluation — only possibilities.
Floor: [15 standard | 30 wild] ideas before you can advance.

Seed direction: [SEED_DIRECTION if set, else "(open)"]
Topic: [TOPIC]
```

Initialize `FREEFORM_COUNT=0`.

Run a generation loop. Generate ideas about the topic. For each idea produced:

1. Check eval before storing:

```bash
EVAL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-eval "$IDEA_TEXT" $WILD_FLAG)
CLEAN=$(echo "$EVAL" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.clean))}catch{process.stdout.write('true')}})")
```

2. If `CLEAN=false`: parse the `violations` and `suggestion` fields from EVAL JSON, show them to the user, and re-prompt for a revised phrasing of the idea. Do NOT store the original. Retry until the revised phrasing is clean.

3. If `CLEAN=true`: store the idea:

```bash
STORE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm append-idea "$SESSION_DIR" \
  --content "$IDEA_TEXT" --technique freeform)
```

Parse `count` from STORE JSON and set `FREEFORM_COUNT` to that value.

4. After each store, check floor:

```bash
FLOOR=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-floor freeform $FREEFORM_COUNT $WILD_FLAG)
MET=$(echo "$FLOOR" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.met))}catch{process.stdout.write('false')}})")
```

5. When `MET=true`, show current count and use AskUserQuestion: "Floor met ([N] ideas). Continue freeform, move to SCAMPER, or converge now? (freeform/scamper/converge)"

   - If user says `freeform` or `continue`: keep generating in the current loop.
   - If user says `scamper`: proceed to `expand_scamper` step.
   - If user says `converge`: jump directly to the `converge` step.

6. Keep generating until the user chooses to advance or converge.
</step>

<step name="expand_scamper">
Show:

```
## Expand: SCAMPER

7 lenses. Minimum [2 standard | 4 wild] ideas per lens before advancing.
All 7 lenses must be completed before SCAMPER is done.
```

Loop over lens indices 0–6. For each `$LENS_IDX` (0, 1, 2, 3, 4, 5, 6):

1. Get lens prompt:

```bash
LENS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm scamper-lens $LENS_IDX)
LENS_ID=$(echo "$LENS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.id)}catch{}})")
LENS_PROMPT=$(echo "$LENS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.prompt)}catch{}})")
```

2. Show:

```
### SCAMPER: [LENS_ID] (lens [N] of 7)

[LENS_PROMPT]

Apply this lens to the topic "[TOPIC]". Generate ideas:
```

3. Initialize `LENS_IDEA_COUNT=0`.

4. For each idea generated under this lens: check eval, retry if dirty (same eval check loop as freeform), then store:

```bash
STORE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm append-idea "$SESSION_DIR" \
  --content "$IDEA_TEXT" --technique scamper --lens $LENS_ID)
LENS_IDEA_COUNT=$((LENS_IDEA_COUNT + 1))
```

   (Note: LENS_IDEA_COUNT is a local counter — reset to 0 for each new lens, incremented per idea.)

5. After each store, check floor for this lens:

```bash
FLOOR=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-floor scamper_per_lens $LENS_IDEA_COUNT $WILD_FLAG)
LENS_MET=$(echo "$FLOOR" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.met))}catch{process.stdout.write('false')}})")
```

6. When `LENS_MET=true`: show count and use AskUserQuestion: "Floor met for [LENS_ID] ([N] ideas). Continue [LENS_ID] or advance to next lens? (continue/advance)"

   - If `continue`: keep generating for this lens.
   - If `advance`: move to the next lens index.

After all 7 lens indices are done, check SCAMPER completeness:

```bash
SCAMPER_STATUS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm scamper-complete "$SESSION_DIR")
COMPLETE=$(echo "$SCAMPER_STATUS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.complete))}catch{process.stdout.write('false')}})")
MISSING=$(echo "$SCAMPER_STATUS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write((p.missingLenses||[]).join(', '))}catch{}})")
```

If `COMPLETE=false`: show which lenses are missing and loop back to cover those specific lenses before advancing.

After SCAMPER is complete, run the saturation check (call the `check_saturation` subroutine inline), then use AskUserQuestion: "SCAMPER complete. Move to Starbursting, Perspective Shifts, or Converge? (starburst/perspectives/converge)"
</step>

<step name="expand_starburst">
Show:

```
## Expand: Starbursting

Force structured questioning across 6 angles: Who, What, Where, When, Why, How.
Minimum [3 standard | 6 wild] ideas per angle.
```

Six angles in order: `who`, `what`, `where`, `when`, `why`, `how`.

For each angle:

1. Show the angle prompt:

```
**[ANGLE]?** — Ask [ANGLE] questions about "[TOPIC]". Generate ideas from the answers.
```

2. Initialize `ANGLE_COUNT=0`.

3. Generation loop: for each idea generated, check eval, retry if dirty (same eval check loop), then store:

```bash
STORE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm append-idea "$SESSION_DIR" \
  --content "$IDEA_TEXT" --technique starburst)
ANGLE_COUNT=$((ANGLE_COUNT + 1))
```

   (ANGLE_COUNT is a local counter — reset to 0 for each new angle, incremented per idea.)

4. After each store, check floor:

```bash
FLOOR=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-floor starburst $ANGLE_COUNT $WILD_FLAG)
ANGLE_MET=$(echo "$FLOOR" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.met))}catch{process.stdout.write('false')}})")
```

5. When `ANGLE_MET=true`: show count and advance automatically to the next angle (no user pause needed between angles — starbursting is structured). Continue generating until each angle's floor is met, then move on.

After all 6 angles are complete, run the saturation check subroutine inline, then use AskUserQuestion: "Starbursting complete. Move to Perspective Shifts, back to SCAMPER, or Converge? (perspectives/scamper/converge)"
</step>

<step name="expand_perspectives">
Show:

```
## Expand: Perspective Shifts

[3 standard | 7 wild] provocative framings. Interactive per perspective.
Minimum [3 standard | 6 wild] ideas per perspective.
```

Select perspectives:

```bash
PERSP_COUNT=3
if [ "$WILD_MODE" = "true" ]; then PERSP_COUNT=7; fi
PERSPECTIVES=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm random-perspectives $PERSP_COUNT)
```

Parse the returned JSON array. For each perspective object in the array:

1. Extract `id` and `prompt` fields from the perspective object.

2. Show:

```
### Perspective: [perspective.id]

[perspective.prompt]

Apply this perspective to "[TOPIC]". Generate ideas as this character or framing would:
```

3. Initialize `PERSP_IDEA_COUNT=0`.

4. Generation loop: for each idea generated, check eval, retry if dirty (same eval check loop), then store:

```bash
STORE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm append-idea "$SESSION_DIR" \
  --content "$IDEA_TEXT" --technique perspective --perspective $PERSPECTIVE_ID)
PERSP_IDEA_COUNT=$((PERSP_IDEA_COUNT + 1))
```

   (PERSP_IDEA_COUNT is a local counter — reset to 0 for each new perspective, incremented per idea.)

5. After each store, check floor:

```bash
FLOOR=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-floor perspective $PERSP_IDEA_COUNT $WILD_FLAG)
PERSP_MET=$(echo "$FLOOR" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.met))}catch{process.stdout.write('false')}})")
```

6. When `PERSP_MET=true`: show count and use AskUserQuestion: "Floor met for [perspective.id] ([N] ideas). Continue this perspective or advance to next? (continue/advance)"

   - If `continue`: keep generating for this perspective.
   - If `advance`: move to the next perspective in the array.

After all perspectives are done, run the saturation check subroutine inline, then use AskUserQuestion: "Perspectives complete. Start another technique or Converge? (starburst/scamper/converge)"
</step>

<step name="check_saturation">
This step is called as a subroutine after each technique completes. It is not a standalone flow — each expand step calls it inline.

```bash
SAT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm check-saturation "$SESSION_DIR")
SATURATED=$(echo "$SAT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.saturated))}catch{process.stdout.write('false')}})")
VELOCITY=$(echo "$SAT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.velocity===null?'N/A':String(p.velocity))}catch{}})")
SUGGESTION=$(echo "$SAT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.suggestion||'')}catch{}})")
```

Parse total idea count from SESSION_DIR ideas:

```bash
TOTAL=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm read-ideas "$SESSION_DIR" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.count))}catch{process.stdout.write('?')}})")
```

If `SATURATED=true`, show:

```
Saturation signal detected — idea velocity has dropped.

[SUGGESTION]

Choose:
  1. Switch to next expand technique
  2. Move to Converge now
  3. Continue current technique anyway
```

Use AskUserQuestion to capture choice (1/2/3). Route accordingly:
- `1`: advance to the next technique in the sequence
- `2`: jump to the `converge` step
- `3`: continue the current technique's loop

If `SATURATED=false`, show:

```
Velocity healthy — [TOTAL] ideas so far. (velocity: [VELOCITY])

Choose:
  1. Switch to next expand technique
  2. Move to Converge now
  3. Continue current technique
```

Use AskUserQuestion to capture choice. Same routing as above.
</step>

<step name="converge">
Show:

```
## Converge

Context restored. Now loading ROADMAP.md and STATE.md to evaluate ideas against
current project reality.

Total ideas captured: [N]
```

Load project context now — read ROADMAP.md and STATE.md. This is the first time these files are read in the session.

Read all ideas from the session:

```bash
IDEAS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm read-ideas "$SESSION_DIR")
IDEA_COUNT=$(echo "$IDEAS" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(String(p.count))}catch{process.stdout.write('0')}})")
```

Cluster ideas:

```bash
CLUSTERS=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm cluster "$SESSION_DIR")
```

Save clusters to file:

```bash
echo "$CLUSTERS" > "$SESSION_DIR/clusters.json"
```

Display clusters as sections. For each cluster, show the cluster name and a preview (first 60 characters) of each idea in that cluster. This gives the user a landscape view before scoring.

Score each idea interactively. Parse the `ideas` array from `IDEAS` JSON and iterate over each. For each idea:

1. Show the idea content and use AskUserQuestion once per idea:

```
Score idea [N/TOTAL]: "[content preview]"

Rate 4 dimensions on a scale of 1–5:
  Feasibility  (1=very hard,      5=trivial)
  Impact       (1=negligible,     5=transformative)
  Alignment    (1=off-topic,      5=core to mission)
  Risk         (1=safe,           5=high risk)

Enter scores as 4 space-separated integers (e.g., 4 3 5 2):
```

2. Parse 4 integers from the response: `FEASIBILITY`, `IMPACT`, `ALIGNMENT`, `RISK`.

3. Store score:

```bash
SCORE=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm score "$SESSION_DIR" $IDEA_ID $FEASIBILITY $IMPACT $ALIGNMENT $RISK)
```

4. Accumulate all score objects. After all ideas are scored, write accumulated scores to:

```bash
# Write aggregated scores JSON (array of score objects)
echo "$ALL_SCORES_JSON" > "$SESSION_DIR/scores.json"
```

After all ideas scored, display a ranked table sorted by composite score descending:

```
## Ranked Ideas

| Rank | ID | Content (preview)          | F | I | A | R | Composite |
|------|----|----------------------------|---|---|---|---|-----------|
| 1    | 7  | ...first 50 chars...       | 5 | 4 | 5 | 1 | 13        |
| 2    | 3  | ...                        | 4 | 5 | 4 | 2 | 11        |
```

Use AskUserQuestion: "Select finalist idea IDs (comma-separated, e.g., 7,3,12):"

Store response in `SELECTED_IDS`.

Run finalist selection:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm select-finalists "$SESSION_DIR" \
  --ids "$SELECTED_IDS" --scores-file "$SESSION_DIR/scores.json" \
  > "$SESSION_DIR/finalists.json"
```
</step>

<step name="output">
Create output directory:

```bash
OUTPUT_RESULT=$(node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm create-output-dir \
  --planning-root "$PLANNING_ROOT" --topic "$TOPIC")
OUTPUT_DIR=$(echo "$OUTPUT_RESULT" | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const p=JSON.parse(d);process.stdout.write(p.dir)}catch{}})")
```

Format results:

```bash
node ~/.claude/get-shit-done/bin/gsd-tools.cjs brainstorm format-results "$SESSION_DIR" \
  --output-dir "$OUTPUT_DIR" \
  --clusters-file "$SESSION_DIR/clusters.json" \
  --scores-file "$SESSION_DIR/scores.json" \
  --finalists-file "$SESSION_DIR/finalists.json"
```

Show completion summary:

```
## Brainstorm Complete

Topic: [TOPIC]
Total ideas: [IDEA_COUNT]
Finalists: [count from finalists.json]
Output: [OUTPUT_DIR]

Files:
  - FEATURE-IDEAS.md — finalist ideas with scores
  - BRAINSTORM-SESSION.md — full session transcript
  - ideas.jsonl — raw idea store

Session data in [SESSION_DIR] can be safely discarded.
```
</step>

</process>
