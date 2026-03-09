/**
 * Minimal CLI wrapper for the GSD Dashboard generator.
 * Compiled by esbuild to dist/dashboard.cjs.
 * Uses only Node.js built-ins.
 */
import { generate } from './generator.js';
import { rm, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MANIFEST_FILENAME } from './incremental.js';

const args = process.argv.slice(2);
const subcommand = args.find((a) => !a.startsWith('-')) ?? 'generate';

function hasFlag(flag: string, short?: string): boolean {
  return args.includes(flag) || (short ? args.includes(short) : false);
}
function flagValue(flag: string, short?: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag || (short && args[i] === short)) return args[i + 1];
  }
  return undefined;
}

if (hasFlag('--help', '-h') || subcommand === 'help') {
  console.log(`GSD Dashboard Generator

Usage:
  node dist/dashboard.cjs [generate] [options]
  node dist/dashboard.cjs clean [options]

Options:
  --output, -o <dir>    Output directory (default: dashboard/)
  --planning <dir>      Planning directory (default: .planning/)
  --force, -f           Overwrite existing files
  --live, -l            Inject auto-refresh script
  --watch, -w           Watch for changes and regenerate
  --watch-interval <ms> File polling interval in ms (default: 3000)
  --help, -h            Show this help
`);
  process.exit(0);
}

async function runClean(outputDir: string): Promise<void> {
  try {
    const entries = await readdir(outputDir);
    let removed = 0;
    for (const entry of entries) {
      if (entry.endsWith('.html') || entry === MANIFEST_FILENAME) {
        await rm(join(outputDir, entry), { force: true });
        removed++;
      }
    }
    console.log(`Removed ${removed} file(s) from ${outputDir}`);
  } catch {
    console.log(`Output directory not found: ${outputDir}. Nothing to clean.`);
  }
}

async function runGenerate(): Promise<void> {
  const outputDir = flagValue('--output', '-o') ?? 'dashboard';
  const planningDir = flagValue('--planning') ?? '.planning';
  const force = hasFlag('--force', '-f');
  const live = hasFlag('--live', '-l') || hasFlag('--watch', '-w');

  const result = await generate({ planningDir, outputDir, force, live });

  for (const err of result.errors) console.error(`Error: ${err}`);
  if (result.pages.length > 0) {
    console.log(`Generated ${result.pages.length} page(s) in ${result.duration.toFixed(0)}ms`);
    for (const page of result.pages) console.log(`  + ${page}`);
  }
  if (result.skipped.length > 0) {
    console.log(`Skipped ${result.skipped.length} unchanged page(s)`);
  }
  if (result.pages.length === 0 && result.errors.length === 0) {
    console.log('All pages up to date');
  }
}

async function main(): Promise<void> {
  if (subcommand === 'clean') {
    await runClean(flagValue('--output', '-o') ?? 'dashboard');
    return;
  }

  await runGenerate();

  if (hasFlag('--watch', '-w')) {
    const watchInterval = parseInt(flagValue('--watch-interval') ?? '3000', 10);
    const planningDir = flagValue('--planning') ?? '.planning';
    const watchFiles = ['PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md', 'MILESTONES.md'];

    console.log(`Watching ${planningDir} every ${watchInterval}ms (Ctrl+C to stop)`);
    let lastMtime = 0;
    for (const f of watchFiles) {
      try { lastMtime = Math.max(lastMtime, (await stat(join(planningDir, f))).mtimeMs); } catch {}
    }

    setInterval(async () => {
      let currentMtime = 0;
      for (const f of watchFiles) {
        try { currentMtime = Math.max(currentMtime, (await stat(join(planningDir, f))).mtimeMs); } catch {}
      }
      if (currentMtime > lastMtime) {
        lastMtime = currentMtime;
        console.log('Change detected, regenerating...');
        await runGenerate();
      }
    }, watchInterval);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
