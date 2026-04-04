#!/usr/bin/env node

/**
 * GSD Tools — CLI utility for GSD workflow operations
 *
 * Replaces repetitive inline bash patterns across ~50 GSD command/workflow/agent files.
 * Centralizes: config parsing, model resolution, phase lookup, git commits, summary verification.
 *
 * Usage: node gsd-tools.cjs <command> [args] [--raw]
 *
 * Atomic Commands:
 *   state load                         Load project config + state
 *   state json                         Output STATE.md frontmatter as JSON
 *   state update <field> <value>       Update a STATE.md field
 *   state get [section]                Get STATE.md content or section
 *   state patch --field val ...        Batch update STATE.md fields
 *   resolve-model <agent-type>         Get model for agent based on profile
 *   find-phase <phase>                 Find phase directory by number
 *   commit <message> [--files f1 f2]   Commit planning docs
 *   verify-summary <path>              Verify a SUMMARY.md file
 *   generate-slug <text>               Convert text to URL-safe slug
 *   current-timestamp [format]         Get timestamp (full|date|filename)
 *   list-todos [area]                  Count and enumerate pending todos
 *   verify-path-exists <path>          Check file/directory existence
 *   config-ensure-section              Initialize .planning/config.json
 *   history-digest                     Aggregate all SUMMARY.md data
 *   summary-extract <path> [--fields]  Extract structured data from SUMMARY.md
 *   state-snapshot                     Structured parse of STATE.md
 *   phase-plan-index <phase>           Index plans with waves and status
 *   websearch <query>                  Search web via Brave API (if configured)
 *     [--limit N] [--freshness day|week|month]
 *
 * Phase Operations:
 *   phase next-decimal <phase>         Calculate next decimal phase number
 *   phase add <description>            Append new phase to roadmap + create dir
 *   phase insert <after> <description> Insert decimal phase after existing
 *   phase remove <phase> [--force]     Remove phase, renumber all subsequent
 *   phase complete <phase>             Mark phase done, update state + roadmap
 *
 * Roadmap Operations:
 *   roadmap get-phase <phase>          Extract phase section from ROADMAP.md
 *   roadmap analyze                    Full roadmap parse with disk status
 *   roadmap update-plan-progress <N>   Update progress table row from disk (PLAN vs SUMMARY counts)
 *
 * Requirements Operations:
 *   requirements mark-complete <ids>   Mark requirement IDs as complete in REQUIREMENTS.md
 *                                      Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]
 *
 * Debt Operations:
 *   debt log                           Append a new tech debt entry to .planning/DEBT.md
 *     --type <code|test|docs|config|arch>
 *     --severity <critical|high|medium|low>
 *     --component <name>
 *     --description <text>
 *     --logged-by <name>
 *     --source-phase <phase>
 *     --source-plan <plan>
 *   debt list                          List debt entries with optional filters
 *     [--status <open|in-progress|resolved|deferred>]
 *     [--severity <critical|high|medium|low>]
 *     [--type <code|test|docs|config|arch>]
 *   debt resolve                       Transition a debt entry's status
 *     --id <TD-NNN>
 *     --status <open|in-progress|resolved|deferred>
 *   debt impact                        List debt entries ranked by correction count
 *                                      with link_confidence field
 *
 * Migration:
 *   migrate --dry-run [--version <v>]  Preview legacy→milestone conversion
 *   migrate --apply [--version <v>]    Convert legacy layout to milestone-scoped
 *   migrate --cleanup [--dry-run]      Remove stale flat-pattern duplicates
 *
 * Milestone Operations:
 *   milestone complete <version>       Archive milestone, create MILESTONES.md
 *     [--name <name>]
 *     [--archive-phases]               Move phase dirs to milestones/vX.Y-phases/
 *
 * Validation:
 *   validate consistency               Check phase numbering, disk/roadmap sync
 *   validate health [--repair]         Check .planning/ integrity, optionally repair
 *
 * Progress:
 *   progress [json|table|bar]          Render progress in various formats
 *
 * Todos:
 *   todo complete <filename>           Move todo from pending to completed
 *
 * Scaffolding:
 *   scaffold context --phase <N>       Create CONTEXT.md template
 *   scaffold uat --phase <N>           Create UAT.md template
 *   scaffold verification --phase <N>  Create VERIFICATION.md template
 *   scaffold phase-dir --phase <N>     Create phase directory
 *     --name <name>
 *
 * Frontmatter CRUD:
 *   frontmatter get <file> [--field k] Extract frontmatter as JSON
 *   frontmatter set <file> --field k   Update single frontmatter field
 *     --value jsonVal
 *   frontmatter merge <file>           Merge JSON into frontmatter
 *     --data '{json}'
 *   frontmatter validate <file>        Validate required fields
 *     --schema plan|summary|verification
 *
 * Verification Suite:
 *   verify plan-structure <file>       Check PLAN.md structure + tasks
 *   verify phase-completeness <phase>  Check all plans have summaries
 *   verify references <file>           Check @-refs + paths resolve
 *   verify commits <h1> [h2] ...      Batch verify commit hashes
 *   verify artifacts <plan-file>       Check must_haves.artifacts
 *   verify key-links <plan-file>       Check must_haves.key_links
 *
 * Template Fill:
 *   template fill summary --phase N    Create pre-filled SUMMARY.md
 *     [--plan M] [--name "..."]
 *     [--fields '{json}']
 *   template fill plan --phase N       Create pre-filled PLAN.md
 *     [--plan M] [--type execute|tdd]
 *     [--wave N] [--fields '{json}']
 *   template fill verification         Create pre-filled VERIFICATION.md
 *     --phase N [--fields '{json}']
 *
 * State Progression:
 *   state advance-plan                 Increment plan counter
 *   state record-metric --phase N      Record execution metrics
 *     --plan M --duration Xmin
 *     [--tasks N] [--files N]
 *   state benchmark-plan               Write benchmark entry to phase-benchmarks.jsonl
 *     --phase N --plan M
 *     --type <phase_type>
 *     --quality-level <level>
 *     [--duration Xmin]
 *     [--milestone <version>]
 *   state update-progress              Recalculate progress bar
 *   state add-decision --summary "..."  Add decision to STATE.md
 *     [--phase N] [--rationale "..."]
 *     [--summary-file path] [--rationale-file path]
 *   state add-blocker --text "..."     Add blocker
 *     [--text-file path]
 *   state resolve-blocker --text "..." Remove blocker
 *   state record-session               Update session continuity
 *     --stopped-at "..."
 *     [--resume-file path]
 *
 * Compound Commands (workflow-specific initialization):
 *   init execute-phase <phase>         All context for execute-phase workflow
 *   init plan-phase <phase>            All context for plan-phase workflow
 *   init new-project                   All context for new-project workflow
 *   init new-milestone                 All context for new-milestone workflow
 *   init quick <description>           All context for quick workflow
 *   init resume                        All context for resume-project workflow
 *   init verify-work <phase>           All context for verify-work workflow
 *   init phase-op <phase>              Generic phase operation context
 *   init todos [area]                  All context for todo workflows
 *   init milestone-op                  All context for milestone operations
 *   init map-codebase                  All context for map-codebase workflow
 *   init progress                      All context for progress workflow
 */

const fs = require('fs');
const path = require('path');
const { error, resolveActiveMilestone } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');
const phase = require('./lib/phase.cjs');
const roadmap = require('./lib/roadmap.cjs');
const verify = require('./lib/verify.cjs');
const config = require('./lib/config.cjs');
const template = require('./lib/template.cjs');
const milestone = require('./lib/milestone.cjs');
const commands = require('./lib/commands.cjs');
const init = require('./lib/init.cjs');
const frontmatter = require('./lib/frontmatter.cjs');
const debt = require('./lib/debt.cjs');
const migrate = require('./lib/migrate.cjs');
const benchmark = require('./lib/benchmark.cjs');
const sessionReport = require('./lib/session-report.cjs');
const skillMetrics = require('./lib/skill-metrics.cjs');
const skillScorer = require('./lib/skill-scorer.cjs');
const dashboard = require('./lib/dashboard.cjs');

// ─── CLI Router ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Optional cwd override for sandboxed subagents running outside project root.
  let cwd = process.cwd();
  const cwdEqArg = args.find(arg => arg.startsWith('--cwd='));
  const cwdIdx = args.indexOf('--cwd');
  if (cwdEqArg) {
    const value = cwdEqArg.slice('--cwd='.length).trim();
    if (!value) error('Missing value for --cwd');
    args.splice(args.indexOf(cwdEqArg), 1);
    cwd = path.resolve(value);
  } else if (cwdIdx !== -1) {
    const value = args[cwdIdx + 1];
    if (!value || value.startsWith('--')) error('Missing value for --cwd');
    args.splice(cwdIdx, 2);
    cwd = path.resolve(value);
  }

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    error(`Invalid --cwd: ${cwd}`);
  }

  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  // --milestone scope for concurrent milestone execution
  let milestoneScope = null;
  const milestoneEqArg = args.find(arg => arg.startsWith('--milestone='));
  const milestoneIdx = args.indexOf('--milestone');
  if (milestoneEqArg) {
    milestoneScope = milestoneEqArg.slice('--milestone='.length).trim();
    if (!milestoneScope) error('Missing value for --milestone');
    args.splice(args.indexOf(milestoneEqArg), 1);
  } else if (milestoneIdx !== -1) {
    const value = args[milestoneIdx + 1];
    if (!value || value.startsWith('--')) error('Missing value for --milestone');
    args.splice(milestoneIdx, 2);
    milestoneScope = value;
  }

  // Auto-detect milestone scope when not explicitly provided
  if (!milestoneScope) {
    milestoneScope = resolveActiveMilestone(cwd);
  }

  const command = args[0];

  if (!command) {
    error('Usage: gsd-tools <command> [args] [--raw] [--cwd <path>] [--milestone <version>]\n\nCommands:\n  State:       state, state-snapshot\n  Phase:       phase, phases, find-phase, phase-plan-index\n  Roadmap:     roadmap, requirements\n  Milestone:   milestone\n  Debt:        debt\n  Verify:      verify, verify-summary, validate, frontmatter\n  Template:    template, scaffold\n  Config:      config-ensure-section, config-set, config-get, set-quality\n  Progress:    progress, history-digest\n  Todos:       todo, list-todos\n  Git:         commit, check-patches\n  Init:        init\n  Utility:     resolve-model, generate-slug, current-timestamp, verify-path-exists, summary-extract, websearch');
  }

  switch (command) {
    case 'state': {
      const subcommand = args[1];
      if (subcommand === 'json') {
        state.cmdStateJson(cwd, raw);
      } else if (subcommand === 'update') {
        state.cmdStateUpdate(cwd, args[2], args[3]);
      } else if (subcommand === 'get') {
        state.cmdStateGet(cwd, args[2], raw);
      } else if (subcommand === 'patch') {
        const patches = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace(/^--/, '');
          const value = args[i + 1];
          if (key && value !== undefined) {
            patches[key] = value;
          }
        }
        state.cmdStatePatch(cwd, patches, raw);
      } else if (subcommand === 'advance-plan') {
        state.cmdStateAdvancePlan(cwd, raw);
      } else if (subcommand === 'record-metric') {
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const durationIdx = args.indexOf('--duration');
        const tasksIdx = args.indexOf('--tasks');
        const filesIdx = args.indexOf('--files');
        state.cmdStateRecordMetric(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
          tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
          files: filesIdx !== -1 ? args[filesIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'update-progress') {
        state.cmdStateUpdateProgress(cwd, raw, milestoneScope);
      } else if (subcommand === 'add-decision') {
        const phaseIdx = args.indexOf('--phase');
        const summaryIdx = args.indexOf('--summary');
        const summaryFileIdx = args.indexOf('--summary-file');
        const rationaleIdx = args.indexOf('--rationale');
        const rationaleFileIdx = args.indexOf('--rationale-file');
        state.cmdStateAddDecision(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
          summary_file: summaryFileIdx !== -1 ? args[summaryFileIdx + 1] : null,
          rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : '',
          rationale_file: rationaleFileIdx !== -1 ? args[rationaleFileIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'add-blocker') {
        const textIdx = args.indexOf('--text');
        const textFileIdx = args.indexOf('--text-file');
        state.cmdStateAddBlocker(cwd, {
          text: textIdx !== -1 ? args[textIdx + 1] : null,
          text_file: textFileIdx !== -1 ? args[textFileIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'resolve-blocker') {
        const textIdx = args.indexOf('--text');
        state.cmdStateResolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'record-session') {
        const stoppedIdx = args.indexOf('--stopped-at');
        const resumeIdx = args.indexOf('--resume-file');
        state.cmdStateRecordSession(cwd, {
          stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
          resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : 'None',
        }, raw);
      } else if (subcommand === 'benchmark-plan') {
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const typeIdx = args.indexOf('--type');
        const qualityIdx = args.indexOf('--quality-level');
        const durationIdx = args.indexOf('--duration');
        const milestoneIdx = args.indexOf('--milestone');
        benchmark.cmdBenchmarkPlan(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          phase_type: typeIdx !== -1 ? args[typeIdx + 1] : null,
          quality_level: qualityIdx !== -1 ? args[qualityIdx + 1] : null,
          duration_min: durationIdx !== -1 ? args[durationIdx + 1] : null,
          milestone_scope: milestoneIdx !== -1 ? args[milestoneIdx + 1] : (milestoneScope || null),
        }, raw);
      } else {
        state.cmdStateLoad(cwd, raw);
      }
      break;
    }

    case 'session-report': {
      const lastIdx = args.indexOf('--last');
      const rawLast = lastIdx !== -1 ? parseInt(args[lastIdx + 1], 10) : NaN;
      sessionReport.cmdSessionReport(cwd, {
        last: (Number.isFinite(rawLast) && rawLast > 0) ? rawLast : 10,
        milestone_scope: milestoneScope || null,
      }, raw);
      break;
    }

    case 'skill-metrics': {
      const subcommand = args[1];
      if (subcommand === 'compute') {
        skillMetrics.cmdSkillMetricsCompute(cwd, {
          milestone_scope: milestoneScope || null,
        }, raw);
      } else if (subcommand === 'show') {
        skillMetrics.cmdSkillMetricsShow(cwd, raw);
      } else {
        console.error('Unknown skill-metrics subcommand. Available: compute, show');
        process.exit(1);
      }
      break;
    }

    case 'skill-score': {
      const taskIdx = args.indexOf('--task');
      const taskDescription = taskIdx !== -1 ? args[taskIdx + 1] : '';
      if (!taskDescription) {
        console.error('Usage: skill-score --task "description of current task"');
        process.exit(1);
      }
      skillScorer.cmdSkillScore(cwd, taskDescription, raw);
      break;
    }

    case 'resolve-model': {
      commands.cmdResolveModel(cwd, args[1], raw);
      break;
    }

    case 'find-phase': {
      phase.cmdFindPhase(cwd, args[1], raw, milestoneScope);
      break;
    }

    case 'commit': {
      const amend = args.includes('--amend');
      const filesIndex = args.indexOf('--files');
      // Collect all positional args between command name and first flag,
      // then join them — handles both quoted ("multi word msg") and
      // unquoted (multi word msg) invocations from different shells
      const endIndex = filesIndex !== -1 ? filesIndex : args.length;
      const messageArgs = args.slice(1, endIndex).filter(a => !a.startsWith('--'));
      const message = messageArgs.join(' ') || undefined;
      const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
      commands.cmdCommit(cwd, message, files, raw, amend);
      break;
    }

    case 'verify-summary': {
      const summaryPath = args[1];
      const countIndex = args.indexOf('--check-count');
      const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
      verify.cmdVerifySummary(cwd, summaryPath, checkCount, raw);
      break;
    }

    case 'template': {
      const subcommand = args[1];
      if (subcommand === 'select') {
        template.cmdTemplateSelect(cwd, args[2], raw);
      } else if (subcommand === 'fill') {
        const templateType = args[2];
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const nameIdx = args.indexOf('--name');
        const typeIdx = args.indexOf('--type');
        const waveIdx = args.indexOf('--wave');
        const fieldsIdx = args.indexOf('--fields');
        template.cmdTemplateFill(cwd, templateType, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          name: nameIdx !== -1 ? args[nameIdx + 1] : null,
          type: typeIdx !== -1 ? args[typeIdx + 1] : 'execute',
          wave: waveIdx !== -1 ? args[waveIdx + 1] : '1',
          fields: fieldsIdx !== -1 ? JSON.parse(args[fieldsIdx + 1]) : {},
        }, raw);
      } else {
        error('Unknown template subcommand. Available: select, fill');
      }
      break;
    }

    case 'frontmatter': {
      const subcommand = args[1];
      const file = args[2];
      if (subcommand === 'get') {
        const fieldIdx = args.indexOf('--field');
        frontmatter.cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, raw);
      } else if (subcommand === 'set') {
        const fieldIdx = args.indexOf('--field');
        const valueIdx = args.indexOf('--value');
        frontmatter.cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, valueIdx !== -1 ? args[valueIdx + 1] : undefined, raw);
      } else if (subcommand === 'merge') {
        const dataIdx = args.indexOf('--data');
        frontmatter.cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? args[dataIdx + 1] : null, raw);
      } else if (subcommand === 'validate') {
        const schemaIdx = args.indexOf('--schema');
        frontmatter.cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? args[schemaIdx + 1] : null, raw);
      } else {
        error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
      }
      break;
    }

    case 'verify': {
      const subcommand = args[1];
      if (subcommand === 'plan-structure') {
        verify.cmdVerifyPlanStructure(cwd, args[2], raw);
      } else if (subcommand === 'phase-completeness') {
        verify.cmdVerifyPhaseCompleteness(cwd, args[2], raw, milestoneScope);
      } else if (subcommand === 'references') {
        verify.cmdVerifyReferences(cwd, args[2], raw);
      } else if (subcommand === 'commits') {
        verify.cmdVerifyCommits(cwd, args.slice(2), raw);
      } else if (subcommand === 'artifacts') {
        verify.cmdVerifyArtifacts(cwd, args[2], raw);
      } else if (subcommand === 'key-links') {
        verify.cmdVerifyKeyLinks(cwd, args[2], raw);
      } else {
        error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links');
      }
      break;
    }

    case 'generate-slug': {
      commands.cmdGenerateSlug(args[1], raw);
      break;
    }

    case 'current-timestamp': {
      commands.cmdCurrentTimestamp(args[1] || 'full', raw);
      break;
    }

    case 'list-todos': {
      commands.cmdListTodos(cwd, args[1], raw);
      break;
    }

    case 'verify-path-exists': {
      commands.cmdVerifyPathExists(cwd, args[1], raw);
      break;
    }

    case 'config-ensure-section': {
      config.cmdConfigEnsureSection(cwd, raw);
      break;
    }

    case 'config-set': {
      config.cmdConfigSet(cwd, args[1], args[2], raw);
      break;
    }

    case 'config-get': {
      config.cmdConfigGet(cwd, args[1], raw);
      break;
    }

    case 'set-quality': {
      // Parse args: set-quality [--global] <level>
      // The level may come before or after --global flag
      const isGlobal = args.includes('--global');
      const levelArgs = args.slice(1).filter(a => a !== '--global');
      const level = levelArgs[0];
      if (!level) {
        error('Usage: set-quality [--global] <level>  (valid levels: fast, standard, strict)');
      }
      config.cmdSetQuality(cwd, level, { global: isGlobal }, raw);
      break;
    }

    case 'check-patches': {
      commands.cmdCheckPatches(cwd, raw);
      break;
    }

    case 'history-digest': {
      commands.cmdHistoryDigest(cwd, raw);
      break;
    }

    case 'phases': {
      const subcommand = args[1];
      if (subcommand === 'list') {
        const typeIndex = args.indexOf('--type');
        const phaseIndex = args.indexOf('--phase');
        const options = {
          type: typeIndex !== -1 ? args[typeIndex + 1] : null,
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
          includeArchived: args.includes('--include-archived'),
        };
        phase.cmdPhasesList(cwd, options, raw, milestoneScope);
      } else {
        error('Unknown phases subcommand. Available: list');
      }
      break;
    }

    case 'roadmap': {
      const subcommand = args[1];
      if (subcommand === 'get-phase') {
        roadmap.cmdRoadmapGetPhase(cwd, args[2], raw, milestoneScope);
      } else if (subcommand === 'analyze') {
        roadmap.cmdRoadmapAnalyze(cwd, raw, milestoneScope);
      } else if (subcommand === 'update-plan-progress') {
        roadmap.cmdRoadmapUpdatePlanProgress(cwd, args[2], raw, milestoneScope);
      } else {
        error('Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress');
      }
      break;
    }

    case 'requirements': {
      const subcommand = args[1];
      if (subcommand === 'mark-complete') {
        milestone.cmdRequirementsMarkComplete(cwd, args.slice(2), raw);
      } else {
        error('Unknown requirements subcommand. Available: mark-complete');
      }
      break;
    }

    case 'debt': {
      const subcommand = args[1];
      if (subcommand === 'log') {
        const typeIdx = args.indexOf('--type');
        const severityIdx = args.indexOf('--severity');
        const componentIdx = args.indexOf('--component');
        const descriptionIdx = args.indexOf('--description');
        const loggedByIdx = args.indexOf('--logged-by');
        const sourcePhasIdx = args.indexOf('--source-phase');
        const sourcePlanIdx = args.indexOf('--source-plan');
        debt.cmdDebtLog(cwd, {
          type: typeIdx !== -1 ? args[typeIdx + 1] : null,
          severity: severityIdx !== -1 ? args[severityIdx + 1] : null,
          component: componentIdx !== -1 ? args[componentIdx + 1] : null,
          description: descriptionIdx !== -1 ? args[descriptionIdx + 1] : null,
          logged_by: loggedByIdx !== -1 ? args[loggedByIdx + 1] : null,
          source_phase: sourcePhasIdx !== -1 ? args[sourcePhasIdx + 1] : null,
          source_plan: sourcePlanIdx !== -1 ? args[sourcePlanIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'list') {
        const statusIdx = args.indexOf('--status');
        const severityIdx = args.indexOf('--severity');
        const typeIdx = args.indexOf('--type');
        debt.cmdDebtList(cwd, {
          status: statusIdx !== -1 ? args[statusIdx + 1] : null,
          severity: severityIdx !== -1 ? args[severityIdx + 1] : null,
          type: typeIdx !== -1 ? args[typeIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'resolve') {
        const idIdx = args.indexOf('--id');
        const statusIdx = args.indexOf('--status');
        debt.cmdDebtResolve(cwd, {
          id: idIdx !== -1 ? args[idIdx + 1] : null,
          status: statusIdx !== -1 ? args[statusIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'impact') {
        debt.cmdDebtImpact(cwd, {}, raw);
      } else {
        error('Unknown debt subcommand. Available: log, list, resolve, impact');
      }
      break;
    }

    case 'migrate': {
      // Parse --version flag (same pattern as --milestone)
      let migrateVersion = null;
      const versionEqArg = args.find(arg => arg.startsWith('--version='));
      const versionIdx = args.indexOf('--version');
      if (versionEqArg) {
        migrateVersion = versionEqArg.slice('--version='.length).trim();
        if (!migrateVersion) error('Missing value for --version');
      } else if (versionIdx !== -1) {
        const vVal = args[versionIdx + 1];
        if (!vVal || vVal.startsWith('--')) error('Missing value for --version');
        migrateVersion = vVal;
      }

      if (args.includes('--cleanup')) {
        const cleanupDryRun = args.includes('--dry-run');
        migrate.cmdMigrateCleanup(cwd, { dryRun: cleanupDryRun }, raw);
      } else if (args.includes('--dry-run')) {
        migrate.cmdMigrateDryRun(cwd, { version: migrateVersion }, raw);
      } else if (args.includes('--apply')) {
        migrate.cmdMigrateApply(cwd, { version: migrateVersion }, raw);
      } else {
        error('Usage: migrate --dry-run [--version <label>] | migrate --apply [--version <label>] | migrate --cleanup [--dry-run]');
      }
      break;
    }

    case 'phase': {
      const subcommand = args[1];
      if (subcommand === 'next-decimal') {
        phase.cmdPhaseNextDecimal(cwd, args[2], raw, milestoneScope);
      } else if (subcommand === 'add') {
        phase.cmdPhaseAdd(cwd, args.slice(2).join(' '), raw, milestoneScope);
      } else if (subcommand === 'insert') {
        phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw, milestoneScope);
      } else if (subcommand === 'remove') {
        const forceFlag = args.includes('--force');
        phase.cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw, milestoneScope);
      } else if (subcommand === 'complete') {
        phase.cmdPhaseComplete(cwd, args[2], raw, milestoneScope);
      } else {
        error('Unknown phase subcommand. Available: next-decimal, add, insert, remove, complete');
      }
      break;
    }

    case 'milestone': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        const nameIndex = args.indexOf('--name');
        const archivePhases = args.includes('--archive-phases');
        // Collect --name value (everything after --name until next flag or end)
        let milestoneName = null;
        if (nameIndex !== -1) {
          const nameArgs = [];
          for (let i = nameIndex + 1; i < args.length; i++) {
            if (args[i].startsWith('--')) break;
            nameArgs.push(args[i]);
          }
          milestoneName = nameArgs.join(' ') || null;
        }
        milestone.cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw, milestoneScope);
      } else if (subcommand === 'new-workspace') {
        milestone.cmdMilestoneNewWorkspace(cwd, args[2], {}, raw);
      } else if (subcommand === 'update-manifest') {
        const filesIndex = args.indexOf('--files');
        const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
        milestone.cmdMilestoneUpdateManifest(cwd, args[2], files, raw);
      } else if (subcommand === 'write-status') {
        const version = args[2];
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const checkpointIdx = args.indexOf('--checkpoint');
        const progressIdx = args.indexOf('--progress');
        const statusIdx = args.indexOf('--status');
        const options = {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          checkpoint: checkpointIdx !== -1 ? args[checkpointIdx + 1] : null,
          progress: progressIdx !== -1 ? args[progressIdx + 1] : null,
          status: statusIdx !== -1 ? args[statusIdx + 1] : null,
        };
        milestone.cmdMilestoneWriteStatus(cwd, version, options, raw);
      } else if (subcommand === 'manifest-check') {
        milestone.cmdManifestCheck(cwd, raw);
      } else {
        error('Unknown milestone subcommand. Available: complete, new-workspace, update-manifest, write-status, manifest-check');
      }
      break;
    }

    case 'validate': {
      const subcommand = args[1];
      if (subcommand === 'consistency') {
        verify.cmdValidateConsistency(cwd, raw);
      } else if (subcommand === 'health') {
        const repairFlag = args.includes('--repair');
        verify.cmdValidateHealth(cwd, { repair: repairFlag }, raw);
      } else {
        error('Unknown validate subcommand. Available: consistency, health');
      }
      break;
    }

    case 'progress': {
      const subcommand = args[1] || 'json';
      commands.cmdProgressRenderMulti(cwd, subcommand, raw);
      break;
    }

    case 'todo': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        commands.cmdTodoComplete(cwd, args[2], raw);
      } else {
        error('Unknown todo subcommand. Available: complete');
      }
      break;
    }

    case 'scaffold': {
      const scaffoldType = args[1];
      const phaseIndex = args.indexOf('--phase');
      const nameIndex = args.indexOf('--name');
      const scaffoldOptions = {
        phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
        name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null,
      };
      commands.cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
      break;
    }

    case 'init': {
      const workflow = args[1];
      switch (workflow) {
        case 'execute-phase':
          init.cmdInitExecutePhase(cwd, args[2], raw, milestoneScope);
          break;
        case 'plan-phase':
          init.cmdInitPlanPhase(cwd, args[2], raw, milestoneScope);
          break;
        case 'new-project':
          init.cmdInitNewProject(cwd, raw);
          break;
        case 'new-milestone':
          init.cmdInitNewMilestone(cwd, raw);
          break;
        case 'quick':
          init.cmdInitQuick(cwd, args.slice(2).join(' '), raw);
          break;
        case 'resume':
          init.cmdInitResume(cwd, raw, milestoneScope);
          break;
        case 'verify-work':
          init.cmdInitVerifyWork(cwd, args[2], raw, milestoneScope);
          break;
        case 'phase-op':
          init.cmdInitPhaseOp(cwd, args[2], raw, milestoneScope);
          break;
        case 'todos':
          init.cmdInitTodos(cwd, args[2], raw);
          break;
        case 'milestone-op':
          init.cmdInitMilestoneOp(cwd, raw, milestoneScope);
          break;
        case 'map-codebase':
          init.cmdInitMapCodebase(cwd, raw);
          break;
        case 'progress':
          init.cmdInitProgress(cwd, raw, milestoneScope);
          break;
        default:
          error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress`);
      }
      break;
    }

    case 'phase-plan-index': {
      phase.cmdPhasePlanIndex(cwd, args[1], raw, milestoneScope);
      break;
    }

    case 'state-snapshot': {
      state.cmdStateSnapshot(cwd, raw);
      break;
    }

    case 'summary-extract': {
      const summaryPath = args[1];
      const fieldsIndex = args.indexOf('--fields');
      const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null;
      commands.cmdSummaryExtract(cwd, summaryPath, fields, raw);
      break;
    }

    case 'websearch': {
      const query = args[1];
      const limitIdx = args.indexOf('--limit');
      const freshnessIdx = args.indexOf('--freshness');
      await commands.cmdWebsearch(query, {
        limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
        freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null,
      }, raw);
      break;
    }

    case 'dashboard': {
      const subAction = args[1];
      switch (subAction) {
        case 'add':
          dashboard.cmdDashboardAdd(cwd, args.slice(2), raw);
          break;
        case 'remove':
          dashboard.cmdDashboardRemove(args[2], raw);
          break;
        case 'list':
          dashboard.cmdDashboardList(raw);
          break;
        case 'serve': {
          // Parse --port flag
          let port = 3141;
          const portIdx = args.indexOf('--port');
          if (portIdx !== -1) {
            const portVal = args[portIdx + 1];
            if (!portVal || portVal.startsWith('-')) {
              error('--port requires a value. Usage: gsd1 dashboard serve [--port PORT]');
            }
            const parsed = parseInt(portVal, 10);
            if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
              error('Invalid port number: ' + portVal + '. Must be between 1 and 65535.');
            }
            port = parsed;
          }
          // Parse --host flag
          let host = 'localhost';
          const hostIdx = args.indexOf('--host');
          if (hostIdx !== -1) {
            const hostVal = args[hostIdx + 1];
            if (!hostVal || hostVal.startsWith('-')) {
              error('--host requires a value. Usage: gsd1 dashboard serve [--port PORT] [--host HOST]');
            }
            host = hostVal;
          }
          // Delegate to server module (long-running foreground process)
          const { startDashboardServer } = require('./lib/server.cjs');
          startDashboardServer(port, { host });
          const url = `http://${host}:${port}`;
          const { exec } = require('child_process');
          const platform = process.platform;
          setTimeout(() => {
            const cmd = platform === 'darwin' ? `open "${url}"`
              : platform === 'win32' ? `start "" "${url}"`
              : `xdg-open "${url}"`;
            exec(cmd, (err) => {
              if (err) {
                // Non-fatal: print a hint if browser open fails
                console.log('[gsd-server] Could not open browser automatically. Visit: ' + url);
              }
            });
          }, 300);
          // NOTE: do NOT call process.exit() here -- the server runs until SIGINT
          break;
        }
        default:
          error(`Unknown dashboard subcommand: ${subAction || '(none)'}. Usage: gsd1 dashboard add|remove|list|serve`);
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\nRun gsd-tools without arguments to see all available commands.`);
  }
}

main();
