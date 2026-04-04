'use strict';
/**
 * Transition Guards — DONE criteria parser and verification engine.
 *
 * Parses <done> blocks from plan task XML and classifies each bullet
 * into a structured assertion usable for mechanical verification.
 *
 * Zero external dependencies beyond Node.js built-ins.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Type definitions (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {'file-exists'|'grep-for-export'|'test-passes'|'human-check'} AssertionType
 *
 * @typedef {Object} Assertion
 * @property {AssertionType} type
 * @property {string} raw          - Original bullet text
 * @property {string} [filePath]   - For file-exists and grep-for-export
 * @property {string} [pattern]    - For grep-for-export (string to search for)
 * @property {string} taskId       - Source task id attribute
 * @property {string} taskTitle    - Source task title text
 * @property {string} planFile     - Relative path to the PLAN.md file
 */

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Extract text content of the first <title> element within a task block.
 * @param {string} taskBlock
 * @returns {string}
 */
function extractTaskTitle(taskBlock) {
  const m = taskBlock.match(/<title>([\s\S]*?)<\/title>/);
  return m ? m[1].trim() : '';
}

/**
 * Extract all <done> blocks from a task XML element.
 * Returns an array of raw done-block text strings.
 * @param {string} taskBlock
 * @returns {string[]}
 */
function extractDoneBlocks(taskBlock) {
  const blocks = [];
  const re = /<done>([\s\S]*?)<\/done>/g;
  let m;
  while ((m = re.exec(taskBlock)) !== null) {
    blocks.push(m[1]);
  }
  return blocks;
}

/**
 * Extract bullet lines from a done block.
 * Lines starting with `- ` or `* ` (after trim) are bullets.
 * @param {string} doneBlock
 * @returns {string[]}
 */
function extractBullets(doneBlock) {
  return doneBlock
    .split('\n')
    .map(l => l.trim())
    .filter(l => /^[-*]\s+/.test(l))
    .map(l => l.replace(/^[-*]\s+/, '').trim());
}

// ---------------------------------------------------------------------------
// File path extraction
// ---------------------------------------------------------------------------

/**
 * Extract a file path from a bullet line.
 * Looks for backtick-quoted strings that contain a file extension or path separator.
 * Also looks for unquoted path-like tokens.
 *
 * @param {string} bullet
 * @returns {string|null}
 */
function extractFilePath(bullet) {
  // Prefer backtick-quoted tokens
  const backtickRe = /`([^`]+)`/g;
  let m;
  while ((m = backtickRe.exec(bullet)) !== null) {
    const token = m[1];
    if (isFilePath(token)) return token;
  }

  // Fallback: bare word with extension
  const bareRe = /\b([\w./\\-]+\.(?:cjs|mjs|js|ts|tsx|md|json|sh|yaml|yml))\b/;
  const bare = bullet.match(bareRe);
  if (bare) return bare[1];

  return null;
}

/**
 * Heuristic: is a token a file path?
 * @param {string} token
 * @returns {boolean}
 */
function isFilePath(token) {
  if (!token) return false;
  // Contains a slash or has a known file extension
  return (
    token.includes('/') ||
    token.includes('\\') ||
    /\.(cjs|mjs|js|ts|tsx|md|json|sh|yaml|yml|cjs)$/.test(token)
  );
}

// ---------------------------------------------------------------------------
// Grep pattern extraction
// ---------------------------------------------------------------------------

/**
 * Extract a grep pattern from a bullet line.
 * Looks for the token that is being searched for in a file.
 * Pattern: "X appears in Y", "X is in Y", "Y contains X", "X present in Y"
 *
 * Returns the first backtick-quoted token that is NOT a file path.
 * @param {string} bullet
 * @returns {string|null}
 */
function extractGrepPattern(bullet) {
  const tokens = [];
  const backtickRe = /`([^`]+)`/g;
  let m;
  while ((m = backtickRe.exec(bullet)) !== null) {
    tokens.push(m[1]);
  }
  // The grep pattern is usually the first backtick token that is not a file path
  for (const t of tokens) {
    if (!isFilePath(t)) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Assertion classification
// ---------------------------------------------------------------------------

/**
 * Classify a single bullet line into an Assertion.
 *
 * @param {string} bullet
 * @param {string} taskId
 * @param {string} taskTitle
 * @param {string} planFile
 * @returns {Assertion}
 */
function classifyBullet(bullet, taskId, taskTitle, planFile) {
  const lower = bullet.toLowerCase();

  // --- test-passes ---
  if (
    /zero\s+test\s+fail|all\s+tests?\s+.*pass|tests?\s+pass|no\s+test\s+fail|pass(es|ing)?\s+all|test\s+suite\s+pass/.test(lower)
  ) {
    return { type: 'test-passes', raw: bullet, taskId, taskTitle, planFile };
  }

  // --- grep-for-export ---
  // "X appears in file", "file contains X", "X is present in file",
  // "set includes X", "X is in the Y"
  if (
    /appears\s+in|is\s+present\s+in|contains?\s+`|set\s+includes|found\s+in|present\s+in/.test(lower)
  ) {
    const filePath = extractFilePath(bullet);
    const pattern = extractGrepPattern(bullet);
    return {
      type: 'grep-for-export',
      raw: bullet,
      filePath: filePath || undefined,
      pattern: pattern || undefined,
      taskId,
      taskTitle,
      planFile,
    };
  }

  // --- file-exists ---
  // "file X exists", "X loads without error", "X created", "X is present"
  const filePath = extractFilePath(bullet);
  if (
    filePath &&
    /exists|loads?\s+without\s+error|created|present|is\s+at|written\s+to|saved\s+to/.test(lower)
  ) {
    return { type: 'file-exists', raw: bullet, filePath, taskId, taskTitle, planFile };
  }

  // If a file path is present but no strong signal, still classify as file-exists
  // when the bullet is short and file-centric
  if (filePath && lower.length < 80 && !/return|output|result|assert|console|log/.test(lower)) {
    return { type: 'file-exists', raw: bullet, filePath, taskId, taskTitle, planFile };
  }

  // --- human-check (fallback) ---
  return { type: 'human-check', raw: bullet, taskId, taskTitle, planFile };
}

// ---------------------------------------------------------------------------
// Plan file parsing
// ---------------------------------------------------------------------------

/**
 * Parse a single PLAN.md file and return all assertions extracted from its
 * <done> blocks.
 *
 * @param {string} planFilePath - Absolute path to the PLAN.md file
 * @param {string} relPath      - Relative path for labeling (planFile field)
 * @returns {Assertion[]}
 */
function parsePlanFile(planFilePath, relPath) {
  let content;
  try {
    content = fs.readFileSync(planFilePath, 'utf-8');
  } catch (e) {
    return [];
  }

  const assertions = [];

  // Extract all <task ...> blocks
  const taskRe = /<task\s+id="([^"]+)">([\s\S]*?)<\/task>/g;
  let taskMatch;

  while ((taskMatch = taskRe.exec(content)) !== null) {
    const taskId = taskMatch[1];
    const taskBlock = taskMatch[2];
    const taskTitle = extractTaskTitle(taskBlock);
    const doneBlocks = extractDoneBlocks(taskBlock);

    for (const doneBlock of doneBlocks) {
      const bullets = extractBullets(doneBlock);
      for (const bullet of bullets) {
        assertions.push(classifyBullet(bullet, taskId, taskTitle, relPath));
      }
    }
  }

  return assertions;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse all PLAN.md files in a phase directory and return structured assertions.
 *
 * @param {string} phaseDir - Absolute path to the phase directory
 * @returns {Assertion[]}
 */
function parseDoneCriteria(phaseDir) {
  let entries;
  try {
    entries = fs.readdirSync(phaseDir);
  } catch (e) {
    return [];
  }

  const planFiles = entries
    .filter(f => f.endsWith('-PLAN.md'))
    .sort();

  const allAssertions = [];
  for (const file of planFiles) {
    const absPath = path.join(phaseDir, file);
    const assertions = parsePlanFile(absPath, file);
    allAssertions.push(...assertions);
  }

  return allAssertions;
}

/**
 * Parse a single PLAN.md by absolute path and return its assertions.
 * Useful for testing or per-plan verification.
 *
 * @param {string} planFilePath - Absolute path to the PLAN.md
 * @returns {Assertion[]}
 */
function parseSinglePlan(planFilePath) {
  const relPath = path.basename(planFilePath);
  return parsePlanFile(planFilePath, relPath);
}

// ---------------------------------------------------------------------------
// Verification engine
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} AssertionResult
 * @property {'pass'|'fail'|'needs-human'} outcome
 * @property {string} raw           - Original bullet text
 * @property {AssertionType} type   - Assertion type
 * @property {string} taskId
 * @property {string} taskTitle
 * @property {string} planFile
 * @property {string} [detail]      - Failure reason or needs-human explanation
 */

/**
 * Verify a file-exists assertion.
 * @param {Assertion} assertion
 * @param {string} cwd
 * @returns {AssertionResult}
 */
function verifyFileExists(assertion, cwd) {
  const { filePath, raw, taskId, taskTitle, planFile } = assertion;

  if (!filePath) {
    return {
      outcome: 'needs-human',
      raw,
      type: 'file-exists',
      taskId,
      taskTitle,
      planFile,
      detail: 'no file path extracted from criterion',
    };
  }

  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  const exists = fs.existsSync(absPath);
  return {
    outcome: exists ? 'pass' : 'fail',
    raw,
    type: 'file-exists',
    taskId,
    taskTitle,
    planFile,
    detail: exists ? undefined : `file not found: ${filePath}`,
  };
}

/**
 * Verify a grep-for-export assertion.
 * @param {Assertion} assertion
 * @param {string} cwd
 * @returns {AssertionResult}
 */
function verifyGrepForExport(assertion, cwd) {
  const { filePath, pattern, raw, taskId, taskTitle, planFile } = assertion;

  if (!filePath || !pattern) {
    return {
      outcome: 'needs-human',
      raw,
      type: 'grep-for-export',
      taskId,
      taskTitle,
      planFile,
      detail: `could not extract ${!filePath ? 'file path' : 'search pattern'} from criterion`,
    };
  }

  const absPath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(cwd, filePath);

  let content;
  try {
    content = fs.readFileSync(absPath, 'utf-8');
  } catch (e) {
    return {
      outcome: 'fail',
      raw,
      type: 'grep-for-export',
      taskId,
      taskTitle,
      planFile,
      detail: `file not found: ${filePath}`,
    };
  }

  const found = content.includes(pattern);
  return {
    outcome: found ? 'pass' : 'fail',
    raw,
    type: 'grep-for-export',
    taskId,
    taskTitle,
    planFile,
    detail: found ? undefined : `pattern not found in ${filePath}: ${pattern}`,
  };
}

/**
 * Verify a test-passes assertion.
 * When runTests=false (default), all test-passes assertions become needs-human.
 * When runTests=true, attempts to find and run the relevant test file.
 *
 * @param {Assertion} assertion
 * @param {string} cwd
 * @param {boolean} runTests
 * @returns {AssertionResult}
 */
function verifyTestPasses(assertion, cwd, runTests) {
  const { raw, taskId, taskTitle, planFile } = assertion;

  if (!runTests) {
    return {
      outcome: 'needs-human',
      raw,
      type: 'test-passes',
      taskId,
      taskTitle,
      planFile,
      detail: 'test execution skipped (runTests=false); verify manually',
    };
  }

  // Attempt to identify a test file from the raw criterion or task title
  // Pattern: look for a backtick-quoted token ending in .test.cjs or .test.ts
  const testFileMatch = raw.match(/`([^`]*\.test\.[a-z]+)`/);
  if (!testFileMatch) {
    return {
      outcome: 'needs-human',
      raw,
      type: 'test-passes',
      taskId,
      taskTitle,
      planFile,
      detail: 'no test file identified in criterion; verify manually',
    };
  }

  const testFile = testFileMatch[1];
  const absTestPath = path.isAbsolute(testFile)
    ? testFile
    : path.resolve(cwd, testFile);

  if (!fs.existsSync(absTestPath)) {
    return {
      outcome: 'fail',
      raw,
      type: 'test-passes',
      taskId,
      taskTitle,
      planFile,
      detail: `test file not found: ${testFile}`,
    };
  }

  const result = spawnSync('node', ['--test', absTestPath], {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
  });

  const passed = result.status === 0;
  return {
    outcome: passed ? 'pass' : 'fail',
    raw,
    type: 'test-passes',
    taskId,
    taskTitle,
    planFile,
    detail: passed ? undefined : `test run failed (exit ${result.status})`,
  };
}

/**
 * Verify all assertions in the array against the codebase at cwd.
 *
 * @param {Assertion[]} assertions
 * @param {string} cwd             - Project root directory
 * @param {object} [options]
 * @param {boolean} [options.runTests=false] - Whether to execute test-passes assertions
 * @returns {AssertionResult[]}
 */
function verifyAssertions(assertions, cwd, options) {
  const runTests = (options && options.runTests) === true;
  const results = [];

  for (const assertion of assertions) {
    let result;

    switch (assertion.type) {
      case 'file-exists':
        result = verifyFileExists(assertion, cwd);
        break;
      case 'grep-for-export':
        result = verifyGrepForExport(assertion, cwd);
        break;
      case 'test-passes':
        result = verifyTestPasses(assertion, cwd, runTests);
        break;
      case 'human-check':
      default:
        result = {
          outcome: 'needs-human',
          raw: assertion.raw,
          type: assertion.type,
          taskId: assertion.taskId,
          taskTitle: assertion.taskTitle,
          planFile: assertion.planFile,
          detail: 'requires human judgment',
        };
        break;
    }

    results.push(result);
  }

  return results;
}

module.exports = { parseDoneCriteria, parseSinglePlan, verifyAssertions };
