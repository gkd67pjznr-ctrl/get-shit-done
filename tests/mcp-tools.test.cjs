'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { registerGsdTools } = require('../get-shit-done/bin/lib/mcp-server.cjs');

// ─── Helper: capture tool handlers via mock server ────────────────────────────

function captureMockTools(cache, loadRegistry) {
  const capturedTools = {};
  const mockServer = {
    tool(name, _desc, _schema, handler) {
      capturedTools[name] = handler;
    },
  };
  registerGsdTools(mockServer, cache, loadRegistry || (() => {}));
  return capturedTools;
}

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const tmpProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-unit-test-'));

const testCache = new Map([
  ['myproject', {
    name: 'myproject',
    path: tmpProjectDir,
    health: 'green',
    tracking: true,
    state: { current_phase: '01', status: 'in-progress' },
    milestones: [],
  }],
]);

// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe('MCP tool: list-projects', () => {
  it('empty cache returns empty array; populated cache returns project names', async () => {
    const emptyTools = captureMockTools(new Map());
    const emptyResult = await emptyTools['list-projects']({});
    const emptyData = JSON.parse(emptyResult.content[0].text);
    assert.ok(Array.isArray(emptyData), 'result should be an array');
    assert.equal(emptyData.length, 0, 'empty cache should return empty array');

    const tools = captureMockTools(testCache);
    const result = await tools['list-projects']({});
    const data = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(data), 'result should be an array');
    assert.equal(data[0].name, 'myproject', 'should include project name');
  });
});

describe('MCP tool: get-project-state', () => {
  it('unknown name returns NOT_FOUND; known name returns project detail', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-project-state']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    const foundResult = await tools['get-project-state']({ name: 'myproject' });
    const foundData = JSON.parse(foundResult.content[0].text);
    assert.equal(foundData.name, 'myproject', 'known project should return its name');
  });
});

describe('MCP tool: get-gate-health', () => {
  it('unknown name returns NOT_FOUND; project with no gate file returns gateData:null; aggregate with no projects returns projectCount:0', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-gate-health']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // Project exists but has no gate-executions.jsonl — Bug 1 fix verification
    const noGateResult = await tools['get-gate-health']({ name: 'myproject' });
    const noGateData = JSON.parse(noGateResult.content[0].text);
    assert.equal(noGateData.name, 'myproject', 'should include project name');
    assert.equal(noGateData.gateData, null, 'should return gateData:null when no gate file exists');

    // Aggregate with empty cache
    const emptyTools = captureMockTools(new Map());
    const aggResult = await emptyTools['get-gate-health']({});
    const aggData = JSON.parse(aggResult.content[0].text);
    assert.equal(aggData.projectCount, 0, 'aggregate with empty cache should return projectCount:0');
  });
});

describe('MCP tool: get-observations', () => {
  it('unknown project returns NOT_FOUND; known project with no file returns count:0', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-observations']({ name: 'nonexistent', type: 'corrections' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // Project exists but has no corrections.jsonl file
    const noFileResult = await tools['get-observations']({ name: 'myproject', type: 'corrections' });
    const noFileData = JSON.parse(noFileResult.content[0].text);
    assert.equal(noFileData.count, 0, 'missing file should return count:0');
    assert.ok(Array.isArray(noFileData.entries), 'entries should be an array');
    assert.equal(noFileData.entries.length, 0, 'entries should be empty');
  });
});

describe('MCP tool: get-sessions', () => {
  it('unknown project returns NOT_FOUND; empty cache with no name returns count:0', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-sessions']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // No name arg — cross-project with empty sessions
    const emptyTools = captureMockTools(new Map());
    const allResult = await emptyTools['get-sessions']({});
    const allData = JSON.parse(allResult.content[0].text);
    assert.equal(allData.count, 0, 'cross-project with no sessions should return count:0');
  });
});

describe('MCP tool: get-skill-metrics', () => {
  it('unknown project returns NOT_FOUND; empty cache returns skills:{}', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-skill-metrics']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // Known project with no skill-metrics.json returns empty skills object
    const foundResult = await tools['get-skill-metrics']({ name: 'myproject' });
    const foundData = JSON.parse(foundResult.content[0].text);
    assert.ok('skills' in foundData, 'result should have skills field');
    assert.deepEqual(foundData.skills, {}, 'no skill-metrics.json should yield empty skills object');
  });
});

describe('MCP tool: get-cost-metrics', () => {
  it('unknown project returns NOT_FOUND; known project with no cost file returns sessionCount:0', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-cost-metrics']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // Known project with no cost-log.jsonl
    const noFileResult = await tools['get-cost-metrics']({ name: 'myproject' });
    const noFileData = JSON.parse(noFileResult.content[0].text);
    assert.equal(noFileData.sessionCount, 0, 'no cost file should return sessionCount:0');
    assert.equal(noFileData.totalCostUsd, 0, 'no cost file should return totalCostUsd:0');
  });
});

describe('MCP tool: get-git-status', () => {
  it('unknown project returns NOT_FOUND; known project returns shape with branch/dirtyFiles/recentCommits', async () => {
    const tools = captureMockTools(testCache);

    const missingResult = await tools['get-git-status']({ name: 'nonexistent' });
    const missingData = JSON.parse(missingResult.content[0].text);
    assert.equal(missingData.code, 'NOT_FOUND', 'unknown project should return NOT_FOUND');

    // Known project — test shape not specific values (tmpdir may not be a git repo)
    const foundResult = await tools['get-git-status']({ name: 'myproject' });
    const foundData = JSON.parse(foundResult.content[0].text);
    assert.ok('branch' in foundData, 'result should have branch field');
    assert.ok('dirtyFiles' in foundData, 'result should have dirtyFiles field');
    assert.ok('recentCommits' in foundData, 'result should have recentCommits field');
  });
});

// ─── Integration Test: real /mcp endpoint ─────────────────────────────────────

function httpPost(port, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: 'localhost',
      port,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json, text/event-stream',
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => { responseBody += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}

function waitForServerReady(port, retries = 15, delayMs = 100) {
  return new Promise((resolve, reject) => {
    function attempt(n) {
      http.get(`http://localhost:${port}/api/projects`, (res) => {
        res.resume();
        resolve();
      }).on('error', (err) => {
        if (n <= 0) return reject(err);
        setTimeout(() => attempt(n - 1), delayMs);
      });
    }
    attempt(retries);
  });
}

describe('MCP integration: /mcp endpoint', () => {
  let serverHandle;
  let serverPort;

  before(async () => {
    serverPort = 40000 + Math.floor(Math.random() * 10000);
    const serverModule = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'server.cjs'));
    serverHandle = serverModule.startDashboardServer(serverPort, {});
    await waitForServerReady(serverPort);
  });

  after(async () => {
    if (serverHandle) {
      await serverHandle.close();
    }
  });

  it('POST /mcp with initialize request returns 200 and protocolVersion', async () => {
    const res = await httpPost(serverPort, '/mcp', {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' },
      },
      id: 1,
    });

    assert.equal(res.status, 200, 'Expected HTTP 200 from /mcp');
    // Response may be a JSON object or SSE stream containing protocolVersion
    assert.ok(
      res.body.includes('protocolVersion'),
      `Expected protocolVersion in response body, got: ${res.body.slice(0, 200)}`
    );
  });
});
