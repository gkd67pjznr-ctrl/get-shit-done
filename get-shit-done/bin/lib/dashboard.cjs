'use strict';

const fs = require('fs');
const path = require('path');

const { generateSlugInternal, output, error } = require('./core.cjs');

function getDashboardPath() {
  const os = require('os');
  const gsdHome = process.env.GSD_HOME || path.join(os.homedir(), '.gsd');
  return path.join(gsdHome, 'dashboard.json');
}

function loadRegistry() {
  try {
    const raw = fs.readFileSync(getDashboardPath(), 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data.projects) ? data.projects : [];
  } catch {
    return [];
  }
}

function saveRegistry(projects) {
  const dashPath = getDashboardPath();
  fs.mkdirSync(path.dirname(dashPath), { recursive: true });
  fs.writeFileSync(dashPath, JSON.stringify({ projects }, null, 2) + '\n', 'utf-8');
}

function detectProjectName(projectPath) {
  try {
    const content = fs.readFileSync(path.join(projectPath, '.planning', 'PROJECT.md'), 'utf-8');
    // Skip frontmatter
    let searchContent = content;
    if (content.startsWith('---')) {
      const endIdx = content.indexOf('---', 3);
      if (endIdx !== -1) {
        searchContent = content.slice(endIdx + 3);
      }
    }
    const match = searchContent.match(/^#\s+(.+)$/m);
    if (match) return match[1].trim();
  } catch {}
  return path.basename(projectPath);
}

function resolveProjectPath(rawPath) {
  const resolved = path.resolve(rawPath);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function cmdDashboardAdd(cwd, args, raw) {
  // Parse args: --name takes next element; non-flag element is targetPath
  let targetPath = null;
  let nameOverride = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && i + 1 < args.length) {
      nameOverride = args[++i];
    } else if (!args[i].startsWith('-')) {
      targetPath = args[i];
    }
  }
  if (!targetPath) targetPath = cwd;

  const resolvedPath = resolveProjectPath(path.resolve(cwd, targetPath));

  // Check .planning/ exists
  if (!fs.existsSync(path.join(resolvedPath, '.planning'))) {
    error('Not a GSD project (no .planning/ directory): ' + resolvedPath);
  }

  const displayName = nameOverride || detectProjectName(resolvedPath);
  const slug = nameOverride || generateSlugInternal(displayName);
  const projects = loadRegistry();

  // Duplicate path check
  const existingPath = projects.find(p => p.path === resolvedPath);
  if (existingPath) {
    output({ added: false, reason: 'already_registered', name: existingPath.name }, raw);
    return;
  }

  // Duplicate slug check (different path)
  const existingSlug = projects.find(p => p.name === slug);
  if (existingSlug) {
    error('Project name "' + slug + '" already registered at ' + existingSlug.path + '. Use --name <alias> to override.');
  }

  projects.push({
    name: slug,
    display_name: nameOverride ? nameOverride : displayName,
    path: resolvedPath,
    added: new Date().toISOString(),
  });

  saveRegistry(projects);
  output({ added: true, name: slug, display_name: nameOverride || displayName, path: resolvedPath }, raw);
}

function cmdDashboardRemove(slugName, raw) {
  if (!slugName) {
    error('Usage: gsd dashboard remove <name>');
  }

  const projects = loadRegistry();
  const filtered = projects.filter(p => p.name !== slugName);

  if (filtered.length === projects.length) {
    console.log('No project registered with name: ' + slugName);
    process.exit(0);
    return;
  }

  saveRegistry(filtered);
  output({ removed: true, name: slugName }, raw);
}

function formatTable(projects) {
  const nameWidth = Math.max(4, ...projects.map(p => p.name.length));
  const pathWidth = Math.max(4, ...projects.map(p => p.path.length + (fs.existsSync(p.path) ? 0 : 10)));

  const header = 'NAME'.padEnd(nameWidth + 2) + 'PATH'.padEnd(pathWidth + 2) + 'ADDED';
  const sep = '-'.repeat(nameWidth + 2) + '-'.repeat(pathWidth + 2) + '----------';

  const rows = projects.map(p => {
    const pathStr = fs.existsSync(p.path) ? p.path : p.path + ' [missing]';
    const added = p.added ? p.added.slice(0, 10) : 'unknown';
    return p.name.padEnd(nameWidth + 2) + pathStr.padEnd(pathWidth + 2) + added;
  });

  return [header, sep, ...rows].join('\n');
}

function cmdDashboardList(raw) {
  const projects = loadRegistry();
  const missing = projects.filter(p => !fs.existsSync(p.path)).length;

  if (raw) {
    output({ projects, total: projects.length, missing }, raw);
    return;
  }

  if (projects.length === 0) {
    console.log('No projects registered. Use `gsd dashboard add` to register a project.');
    process.exit(0);
    return;
  }

  console.log(formatTable(projects));
  const footer = projects.length + ' project' + (projects.length !== 1 ? 's' : '') +
    (missing > 0 ? ' (' + missing + ' missing)' : '');
  console.log(footer);
  process.exit(0);
}

function setTracking(name, tracking) {
  const projects = loadRegistry();
  const idx = projects.findIndex(p => p.name === name);
  if (idx === -1) {
    throw new Error('Project not found: ' + name);
  }
  if (tracking === true) {
    delete projects[idx].tracking; // omit means true (backward compat)
  } else {
    projects[idx].tracking = false;
  }
  saveRegistry(projects);
  return projects[idx];
}

module.exports = {
  cmdDashboardAdd,
  cmdDashboardRemove,
  cmdDashboardList,
  detectProjectName,
  loadRegistry,
  saveRegistry,
  getDashboardPath,
  setTracking,
};
