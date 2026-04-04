'use strict';

const fs = require('fs');

/**
 * MCP task-type classifier and server recommendation map.
 *
 * Classifies task descriptions into task types using keyword heuristics and
 * file extension checks, then maps each type to suggested MCP server names.
 * This is advisory only — no auto-configuration.
 */

const MCP_TASK_MAP = {
  'library-integration': ['npm-mcp', 'context7'],
  'database':            ['postgres-mcp', 'sqlite-mcp', 'prisma-mcp'],
  'file-restructuring':  ['filesystem-mcp'],
  'ui-component':        ['figma-mcp', 'storybook-mcp'],
  'api-integration':     ['http-mcp', 'openapi-mcp'],
};

/**
 * Classify a task description + file extensions into a task type.
 *
 * @param {string} description - task title and action text
 * @param {string[]} fileExtensions - list of file extensions like ['.tsx', '.cjs']
 * @returns {string} task type key or 'unknown'
 */
function classifyTask(description, fileExtensions) {
  const desc = (description || '').toLowerCase();
  const exts = (fileExtensions || []).map(e => {
    const s = (e || '').toLowerCase().trim();
    return s.startsWith('.') ? s : '.' + s;
  });

  // Rule 1: database
  const dbKeywords = [
    'migration', 'postgres', 'sqlite', 'mysql', 'mongodb', 'database schema',
    'db migration', 'orm', 'prisma migrate', 'knex', 'sequelize', 'typeorm',
  ];
  if (dbKeywords.some(k => desc.includes(k))) return 'database';

  // Rule 2: library-integration
  const libKeywords = [
    'npm install', 'yarn add', 'pnpm add', 'install package', 'add dependency',
    'require(', 'import from', 'library integration',
  ];
  if (libKeywords.some(k => desc.includes(k))) return 'library-integration';

  // Rule 3: api-integration
  const apiKeywords = [
    'rest endpoint', 'api route', 'fetch(', 'axios', 'http client',
    'openapi', 'swagger', 'grpc', 'graphql endpoint', 'webhook',
  ];
  if (apiKeywords.some(k => desc.includes(k))) return 'api-integration';

  // Rule 4: ui-component (extension check or description keywords)
  const uiExtensions = ['.tsx', '.jsx', '.vue', '.svelte'];
  const uiKeywords = [
    'react component', 'ui component', 'component props',
    'tailwind', 'css module', 'storybook',
  ];
  if (exts.some(e => uiExtensions.includes(e)) || uiKeywords.some(k => desc.includes(k))) {
    return 'ui-component';
  }

  // Rule 5: file-restructuring
  const fsKeywords = [
    'rename', 'move files', 'restructure', 'reorganize', 'directory layout',
    'folder structure', 'refactor directory',
  ];
  if (fsKeywords.some(k => desc.includes(k))) return 'file-restructuring';

  return 'unknown';
}

/**
 * Return the list of recommended MCP servers for a given task type.
 *
 * @param {string} taskType
 * @returns {string[]} array of MCP server name strings (empty if unknown)
 */
function getMcpServers(taskType) {
  return MCP_TASK_MAP[taskType] ?? [];
}

/**
 * Classify and return both task_type and recommended servers.
 *
 * @param {string} description
 * @param {string[]} fileExtensions
 * @returns {{ task_type: string, servers: string[] }}
 */
function classifyAndRecommend(description, fileExtensions) {
  const task_type = classifyTask(description, fileExtensions);
  const servers = getMcpServers(task_type);
  return { task_type, servers };
}

/**
 * Classify an entire plan file by extracting <title>, <action>, and <files>
 * tags and calling classifyAndRecommend on the combined text.
 *
 * @param {string} planPath - absolute or relative path to the plan file
 * @returns {{ task_type: string, servers: string[] }}
 */
function classifyPlanForMcp(planPath) {
  try {
    const content = fs.readFileSync(planPath, 'utf-8');

    // Extract all <title>...</title> and <action>...</action> text
    const titleMatches = [...content.matchAll(/<title>([\s\S]*?)<\/title>/gi)];
    const actionMatches = [...content.matchAll(/<action>([\s\S]*?)<\/action>/gi)];
    const combinedText = [
      ...titleMatches.map(m => m[1]),
      ...actionMatches.map(m => m[1]),
    ].join(' ');

    // Extract file extensions from <files>...</files> blocks
    const filesMatches = [...content.matchAll(/<files>([\s\S]*?)<\/files>/gi)];
    const allFileText = filesMatches.map(m => m[1]).join(' ');
    const extRegex = /\.\w+/g;
    const fileExtensions = [...new Set((allFileText.match(extRegex) || []).map(e => e.toLowerCase()))];

    return classifyAndRecommend(combinedText, fileExtensions);
  } catch {
    return { task_type: 'unknown', servers: [] };
  }
}

/**
 * CLI command: mcp-classify
 *
 * @param {string} cwd - working directory
 * @param {string} taskDescription
 * @param {string[]} fileExtensions
 * @param {boolean} raw - if true, output JSON to stdout
 * @param {string|null} planPath - if provided, classify a plan file instead of task description
 */
function cmdMcpClassify(cwd, taskDescription, fileExtensions, raw, planPath) {
  let result;
  if (planPath) {
    const resolvedPath = require('path').isAbsolute(planPath)
      ? planPath
      : require('path').join(cwd, planPath);
    result = classifyPlanForMcp(resolvedPath);
  } else {
    result = classifyAndRecommend(taskDescription, fileExtensions || []);
  }
  if (raw) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    const serverList = result.servers.length > 0
      ? result.servers.join(', ')
      : '(none — task type unknown or unmapped)';
    console.log(`Task type: ${result.task_type}`);
    console.log(`Recommended MCP servers: ${serverList}`);
  }
}

module.exports = {
  MCP_TASK_MAP,
  classifyTask,
  getMcpServers,
  classifyAndRecommend,
  classifyPlanForMcp,
  cmdMcpClassify,
};
