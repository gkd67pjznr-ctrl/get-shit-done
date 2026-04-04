# Detection (Pattern Detection)

## What It Is

The detection subsystem is gsd-skill-creator's correction attribution engine — the component that connects user correction events to the skills that were loaded when those corrections occurred. Without attribution, correction rates are counts without causality: you know something was corrected but not which skill was responsible for the incorrect behavior. Detection solves this by maintaining a `CATEGORY_SKILL_MAP` that links correction categories to the skills most likely to have influenced the corrected output. gsdup adopted the detection concept in the v4.0 integration and completed a direct implementation in v8.0 phase 41 via `skill-metrics.cjs`.

## How It Works

Detection operates as a post-session attribution pass:

1. **Correction event capture** — when a user corrects agent output, the correction is appended to `corrections.jsonl` with a category tag (e.g., `commit-format`, `test-structure`, `api-design`). Categories are defined in `CATEGORY_SKILL_MAP` — a static mapping from correction category to the skill(s) that govern that category's behavior.

2. **Attribution scoring** — after session close, the attribution pass reads correction events and the `skills_loaded` field from the corresponding session entry in `sessions.jsonl`. For each correction, it identifies which loaded skills map to the correction's category via `CATEGORY_SKILL_MAP`. The correction is attributed to those skills proportionally.

3. **Confidence banding** — attribution confidence is classified as high/medium/low based on how unambiguously a category maps to skills:
   - **High** — category maps to exactly one loaded skill.
   - **Medium** — category maps to 2-3 loaded skills.
   - **Low** — category maps to more than 3 loaded skills or to no loaded skills (the skill responsible was not loaded during the session).

4. **Skill metric update** — attributed corrections update the `skill-metrics.json` store with new correction rate estimates, including the `attribution_confidence` field per skill entry (the v9.0 phase 41 deliverable).

gsdup's `skill-metrics.cjs` implements the `CATEGORY_SKILL_MAP` attribution model as of phase 41. The remaining gap vs. gsd-skill-creator's implementation is the `skills_loaded` data in `sessions.jsonl` — phase 38 populates this field, which is a prerequisite for detection to produce accurate rates.

## Integration Verdict for gsdup

**Integrate**

Detection is already integrated in gsdup via `skill-metrics.cjs` and the v9.0 phase 41 implementation. The remaining work is ensuring the `skills_loaded` prerequisite (phase 38) is complete so that attribution scores are computed from real data rather than empty arrays. Effort tier is S — phase 38 is already a v9.0 roadmap item. No architectural changes required.

## Action Items

1. Verify phase 38 (`skills_loaded` population in sessions.jsonl) is complete before treating any detection output as reliable — detection produces low-confidence results when `skills_loaded` is empty.
2. Add a health check to `/gsd:digest` that warns when `skills_loaded` is empty in recent sessions, prompting the user to complete phase 38 before interpreting skill quality scores.
3. Extend `CATEGORY_SKILL_MAP` in `skill-metrics.cjs` as new skills are added — the map is only as accurate as its entries, and stale entries will produce low-confidence attributions.
