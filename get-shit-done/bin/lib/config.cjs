/**
 * Config — Planning config CRUD operations
 */

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

function cmdConfigEnsureSection(cwd, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // Ensure .planning directory exists
  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  // Detect Brave Search API key availability
  const homedir = require('os').homedir();
  const gsdHome = process.env.GSD_HOME || path.join(homedir, '.gsd');
  const braveKeyFile = path.join(gsdHome, 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // Load user-level defaults from GSD_HOME/defaults.json if available
  const globalDefaultsPath = path.join(gsdHome, 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
    }
  } catch (err) {
    // Ignore malformed global defaults, fall back to hardcoded
  }

  // Required quality defaults with context7_token_cap
  const requiredQualityDefaults = {
    level: 'fast',
    test_exemptions: ['.md', '.json', 'templates/**', '.planning/**'],
    context7_token_cap: 2000,
  };

  // Bootstrap global defaults.json on first GSD usage (if absent)
  const bootstrapGlobalDefaults = () => {
    if (!fs.existsSync(globalDefaultsPath)) {
      try {
        fs.mkdirSync(gsdHome, { recursive: true });
        fs.writeFileSync(globalDefaultsPath, JSON.stringify({ quality: { level: 'fast' } }, null, 2), 'utf-8');
      } catch (err) {
        // Non-fatal: silently skip if we cannot write global defaults
      }
    }
  };

  // Check if config already exists — migrate if needed
  if (fs.existsSync(configPath)) {
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      error('Failed to read config.json: ' + err.message);
    }

    let migrated = false;
    let reason = 'already_exists';

    if (config.quality === undefined) {
      // Auto-migrate: add quality block using user defaults for level if available
      config.quality = {
        ...requiredQualityDefaults,
        ...(userDefaults.quality || {}),
      };
      migrated = true;
      reason = 'quality_section_added';
    } else if (config.quality.context7_token_cap === undefined) {
      // Add missing context7_token_cap
      config.quality.context7_token_cap = requiredQualityDefaults.context7_token_cap;
      migrated = true;
      reason = 'context7_token_cap_added';
    }

    if (migrated) {
      try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      } catch (err) {
        error('Failed to write config.json: ' + err.message);
      }
      bootstrapGlobalDefaults();
      const result = { created: false, migrated: true, reason };
      output(result, raw, 'migrated');
      return;
    }

    const result = { created: false, reason: 'already_exists' };
    output(result, raw, 'exists');
    return;
  }

  // Create default config (user-level defaults override hardcoded defaults)
  const hardcoded = {
    model_profile: 'balanced',
    commit_docs: true,
    search_gitignored: false,
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: false,
    },
    parallelization: true,
    brave_search: hasBraveSearch,
    quality: requiredQualityDefaults,
  };
  const defaults = {
    ...hardcoded,
    ...userDefaults,
    workflow: { ...hardcoded.workflow, ...(userDefaults.workflow || {}) },
    quality: { ...hardcoded.quality, ...(userDefaults.quality || {}) },
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2), 'utf-8');
    bootstrapGlobalDefaults();
    const result = { created: true, path: '.planning/config.json' };
    output(result, raw, 'created');
  } catch (err) {
    error('Failed to create config.json: ' + err.message);
  }
}

function cmdConfigSet(cwd, keyPath, value, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-set <key.path> <value>');
  }

  // Parse value (handle booleans and numbers)
  let parsedValue = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(value) && value !== '') parsedValue = Number(value);

  // Load existing config or start with empty object
  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    error('Failed to read config.json: ' + err.message);
  }

  // Set nested value using dot notation (e.g., "workflow.research")
  const keys = keyPath.split('.');
  let current = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] === undefined || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = parsedValue;

  // Write back
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    const result = { updated: true, key: keyPath, value: parsedValue };
    output(result, raw, `${keyPath}=${parsedValue}`);
  } catch (err) {
    error('Failed to write config.json: ' + err.message);
  }
}

function cmdConfigGet(cwd, keyPath, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');

  if (!keyPath) {
    error('Usage: config-get <key.path>');
  }

  let config = {};
  try {
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } else {
      error('No config.json found at ' + configPath);
    }
  } catch (err) {
    if (err.message.startsWith('No config.json')) throw err;
    error('Failed to read config.json: ' + err.message);
  }

  // Warn when required config sections are absent
  const requiredSections = ['quality'];
  for (const section of requiredSections) {
    if (config[section] === undefined) {
      process.stderr.write(
        `Warning: config.json missing required section "${section}" — run config-ensure-section to fix\n`
      );
    }
  }

  // Traverse dot-notation path (e.g., "workflow.auto_advance")
  const keys = keyPath.split('.');
  let current = config;
  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      error(`Key not found: ${keyPath}`);
    }
    current = current[key];
  }

  if (current === undefined) {
    error(`Key not found: ${keyPath}`);
  }

  output(current, raw, String(current));
}

function cmdSetQuality(cwd, level, options, raw) {
  const validLevels = ['fast', 'standard', 'strict'];
  if (!validLevels.includes(level)) {
    error(`Invalid quality level "${level}". Valid levels: ${validLevels.join(', ')}`);
  }

  if (options && options.global) {
    // Write to ~/.gsd/defaults.json (or GSD_HOME/defaults.json)
    const homedir = require('os').homedir();
    const gsdHome = process.env.GSD_HOME || path.join(homedir, '.gsd');
    const globalDefaultsPath = path.join(gsdHome, 'defaults.json');

    let defaults = {};
    try {
      if (fs.existsSync(globalDefaultsPath)) {
        defaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
      }
    } catch (err) { /* start fresh */ }

    if (!defaults.quality) defaults.quality = {};
    defaults.quality.level = level;

    fs.mkdirSync(gsdHome, { recursive: true });
    fs.writeFileSync(globalDefaultsPath, JSON.stringify(defaults, null, 2), 'utf-8');

    const result = { updated: true, level, scope: 'global' };
    output(result, raw, `quality.level=${level} (global)`);
    return;
  }

  // Local project update
  const configPath = path.join(cwd, '.planning', 'config.json');
  if (!fs.existsSync(configPath)) {
    error('No .planning/config.json found. Run config-ensure-section first.');
  }

  let config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (!config.quality) config.quality = {};
  config.quality.level = level;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  const result = { updated: true, level, scope: 'project' };
  output(result, raw, `quality.level=${level}`);
}

module.exports = {
  cmdConfigEnsureSection,
  cmdConfigSet,
  cmdConfigGet,
  cmdSetQuality,
};
