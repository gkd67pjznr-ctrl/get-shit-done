---
phase: 14-create-gsd-fork-documentation-and-git-re
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - README.md
  - FORK-GUIDE.md
autonomous: true
requirements:
  - FORK-README
  - FORK-GUIDE
  - GIT-PUSH

must_haves:
  truths:
    - "README.md opens with a clear fork section before the upstream GSD content"
    - "A reader understands what this fork adds without reading UPGRADES.md"
    - "FORK-GUIDE.md provides actionable steps to install and use this fork"
    - "FORK-GUIDE.md explains how to keep fork changes when upstream GSD updates"
    - "The repo is pushed to the fork remote and publicly visible"
  artifacts:
    - path: "README.md"
      provides: "Fork header section prepended to existing upstream README"
      contains: "UPGRADES.md"
    - path: "FORK-GUIDE.md"
      provides: "Standalone installation and usage guide for the fork"
      contains: "reapply-patches"
  key_links:
    - from: "README.md fork section"
      to: "UPGRADES.md"
      via: "markdown link"
      pattern: "\\[.*\\]\\(UPGRADES\\.md\\)"
    - from: "README.md fork section"
      to: "FORK-GUIDE.md"
      via: "markdown link"
      pattern: "\\[.*\\]\\(FORK-GUIDE\\.md\\)"
    - from: "FORK-GUIDE.md"
      to: "DEPLOY.md"
      via: "markdown link"
      pattern: "\\[.*\\]\\(DEPLOY\\.md\\)"
---

<objective>
Create fork documentation (README header + standalone guide) and push the repo to GitHub.

Purpose: Make this fork discoverable and understandable — someone landing on the GitHub repo should immediately know what it is, what it adds, and how to use it. Then push 233 commits to the fork remote so the repo is publicly visible.

Output: Modified README.md with fork section at top, new FORK-GUIDE.md, repo pushed to fork remote.
</objective>

<execution_context>
@/Users/tmac/.claude/get-shit-done/workflows/execute-plan.md
@/Users/tmac/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@README.md
@UPGRADES.md
@DEPLOY.md
@.planning/PROJECT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fork header section to README.md</name>
  <files>README.md</files>
  <action>
Prepend a fork section to the TOP of README.md, ABOVE the existing `<div align="center">` line. The existing upstream README content (all 705 lines) MUST remain completely intact below the fork section.

The fork section should include:

1. **Header** — "GSD Enhanced Fork" with a brief tagline about what this adds (quality enforcement + concurrent milestones + tech debt)

2. **What This Fork Is** — 2-3 sentences: This is a forked version of GSD that adds three major systems. Links to the upstream repo (origin: https://github.com/gsd-build/get-shit-done). Mention it's fully compatible with vanilla GSD — quality level defaults to `fast` which is zero behavioral change.

3. **What's Different** — A compact table or bullet list of the three systems:
   - Quality Enforcement (v1.0-v1.1): Quality Sentinel in executor, Context7 library lookup, mandatory tests, config-gated levels (fast/standard/strict)
   - Concurrent Milestones (v2.0): Isolated workspaces, lock-free dashboard, advisory conflict detection, --milestone flag threading
   - Tech Debt System (v3.0): DEBT.md with structured entries, CLI commands (debt log/list/resolve), executor/verifier auto-logging, /gsd:fix-debt skill

4. **Quick Stats** — Small table: 4 milestones shipped, 298 tests, 13 lib modules, 85+ validated requirements

5. **Getting Started** — Brief: "See [FORK-GUIDE.md](FORK-GUIDE.md) for installation and usage" and "See [UPGRADES.md](UPGRADES.md) for full milestone-by-milestone details"

6. **What's In Progress** — One-liner: v3.1 milestone for tech debt cleanup and legacy code stripping

7. **A horizontal rule separator** before the upstream README begins

Style notes:
- Keep it concise — aim for 60-80 lines total for the fork section
- Use a single `# GSD Enhanced Fork` heading at the very top
- Do NOT duplicate the upstream badges or install command
- Do NOT use emojis
- Use plain markdown, no HTML divs in the fork section
- After the fork section + separator, the upstream README starts with its original `<div align="center">` block unchanged
  </action>
  <verify>
    <automated>head -100 README.md | grep -c "GSD Enhanced Fork" && grep -c "UPGRADES.md" README.md && tail -10 README.md | grep -c "Claude Code is powerful"</automated>
  </verify>
  <done>README.md starts with the fork section, contains links to UPGRADES.md and FORK-GUIDE.md, and the original upstream README content follows intact after a horizontal rule separator. The final line of the file is still the upstream closing div.</done>
</task>

<task type="auto">
  <name>Task 2: Create FORK-GUIDE.md standalone guide</name>
  <files>FORK-GUIDE.md</files>
  <action>
Create a new file FORK-GUIDE.md at the repo root. This is a practical, action-oriented guide for someone who wants to use this fork. Structure:

**1. Overview** (3-4 sentences)
What the fork is, who it's for (solo developers using Claude Code who want quality enforcement beyond vanilla GSD), and the core value proposition.

**2. Installation**
Step-by-step instructions:
- Clone this repo: `git clone https://github.com/gkd67pjznr-ctrl/get-shit-done.git gsdup`
- Deploy to your global Claude Code install: reference DEPLOY.md for the 3-step process (`npm install -g .`, `node scripts/build-hooks.js`, `get-shit-done-cc --claude --global`)
- Verify: `/gsd:help` in Claude Code should show all commands
- Note: This replaces your vanilla GSD install. Your `.planning/` directories in projects are unaffected.

**3. What Changed from Vanilla GSD**
Brief summary of the three systems (quality enforcement, concurrent milestones, tech debt). Point to UPGRADES.md for the full breakdown. Include:
- Which files were modified vs added
- That all changes are additive — `fast` quality level = zero behavioral change from vanilla
- The key new commands: `/gsd:set-quality`, `/gsd:fix-debt`, `gsd-tools debt log/list/resolve`, `gsd-tools migrate`

**4. Enabling Quality Enforcement**
How to turn it on in a project:
```
/gsd:set-quality standard
```
Or edit `.planning/config.json` directly. Explain the three levels (fast/standard/strict) with a 3-row table showing what each level enables. Recommend `standard` for most projects.

**5. Enabling Concurrent Milestones**
How to activate: set `concurrent: true` in `.planning/config.json`, then `/gsd:new-milestone v2.0`. Brief explanation of workspace isolation. Point to UPGRADES.md v2.0 section for details.

**6. Using Tech Debt Tracking**
Quick examples of `gsd-tools debt log`, `gsd-tools debt list`, `/gsd:fix-debt TD-001`. Note auto-logging in standard/strict modes.

**7. Updating: Keeping Fork Changes When GSD Updates**
This is the critical section. Explain the workflow:
- Upstream GSD updates come via `npx get-shit-done-cc@latest` which overwrites `~/.claude/get-shit-done/`
- This fork's changes are in the repo, not in the installed location
- To reapply after upstream update: run the deploy steps from section 2 again
- The `/gsd:reapply-patches` workflow automates this: it reads the repo, identifies what changed vs vanilla, and re-applies
- Recommend: check upstream changelog first, then deploy, then run tests (`node --test tests/*.test.cjs`)

**8. Customizing for Your Needs**
- Quality levels are config-driven — choose your tradeoff
- Tech debt tracking is automatic at standard+ quality
- Milestone workspaces are opt-in via `concurrent: true`
- Agent files live at `~/.claude/get-shit-done/` — the repo is the source of truth, DEPLOY.md syncs

**9. Running Tests**
```bash
node --test tests/*.test.cjs
```
298 tests across 14 suites. Uses Node.js built-in test runner (no dependencies).

**10. Project Structure**
Brief directory layout showing key paths:
- `get-shit-done/bin/gsd-tools.cjs` — CLI entry point
- `get-shit-done/bin/lib/` — 13 source modules
- `tests/` — 14 test suites
- `.planning/` — planning docs (this project's own planning)
- `UPGRADES.md` — full milestone-by-milestone documentation
- `DEPLOY.md` — deployment instructions

Style notes:
- Keep it practical and scannable
- Aim for 150-200 lines
- Do NOT use emojis
- Code blocks for all commands
- Link to UPGRADES.md, DEPLOY.md, and the upstream repo where relevant
  </action>
  <verify>
    <automated>test -f FORK-GUIDE.md && grep -c "reapply-patches" FORK-GUIDE.md && grep -c "DEPLOY.md" FORK-GUIDE.md && grep -c "set-quality" FORK-GUIDE.md && wc -l FORK-GUIDE.md | awk '{print ($1 >= 100) ? "OK: " $1 " lines" : "TOO SHORT: " $1 " lines"}'</automated>
  </verify>
  <done>FORK-GUIDE.md exists at repo root with all 10 sections, contains actionable installation steps, explains the update/reapply workflow, links to DEPLOY.md and UPGRADES.md, and is 100+ lines.</done>
</task>

<task type="auto">
  <name>Task 3: Push repo to fork remote</name>
  <files></files>
  <action>
Push the local main branch to the fork remote. The fork remote is already configured:
- Remote name: `fork`
- URL: `https://github.com/gkd67pjznr-ctrl/get-shit-done.git`
- Local main is 233 commits ahead of fork/main

Run:
```bash
git push fork main
```

If this fails due to auth issues, create a checkpoint for the user to authenticate. If it succeeds, verify by checking `git log fork/main --oneline -1` matches the local HEAD.

IMPORTANT: Do NOT force push. Do NOT push to origin (that's the upstream GSD repo). Only push to `fork`.
  </action>
  <verify>
    <automated>git log fork/main --oneline -1 2>/dev/null && git rev-parse HEAD && echo "Compare above: fork/main should match HEAD"</automated>
  </verify>
  <done>Local main branch is pushed to fork remote. `git log fork/main --oneline -1` shows the same commit as local HEAD. The repo is publicly visible at https://github.com/gkd67pjznr-ctrl/get-shit-done.</done>
</task>

</tasks>

<verification>
1. README.md starts with "# GSD Enhanced Fork" header
2. README.md contains links to both UPGRADES.md and FORK-GUIDE.md
3. The original upstream README content is fully intact (search for "Claude Code is powerful" near the end)
4. FORK-GUIDE.md exists and covers installation, quality levels, update workflow, and project structure
5. FORK-GUIDE.md contains references to reapply-patches, DEPLOY.md, and set-quality
6. The fork remote is up to date with local main
</verification>

<success_criteria>
- README.md has a clear fork section at the top that explains what this is and why it exists
- FORK-GUIDE.md is a standalone, actionable guide someone can follow to install and use the fork
- Both docs link to UPGRADES.md for detailed milestone documentation
- The repo is pushed to https://github.com/gkd67pjznr-ctrl/get-shit-done and publicly accessible
</success_criteria>

<output>
After completion, create `.planning/quick/14-create-gsd-fork-documentation-and-git-re/14-SUMMARY.md`
</output>
