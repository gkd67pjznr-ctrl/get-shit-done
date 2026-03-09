'use strict';

const { describe, it, test, after, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const { runGsdToolsFull, cleanup } = require('./helpers.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createRegistryProject() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-test-proj-'));
  const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-test-home-'));

  // Create .planning/ structure
  const planningDir = path.join(projectDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'PROJECT.md'),
    '# Test Project\n\nA test project for server tests.\n',
    'utf-8'
  );

  fs.writeFileSync(
    path.join(planningDir, 'STATE.md'),
    '# State\n\n## Current Position\n\nPhase: 01\nStatus: in-progress\nProgress: [██░░░░░░░░] 20%\n',
    'utf-8'
  );

  fs.writeFileSync(
    path.join(planningDir, 'ROADMAP.md'),
    '# Roadmap\n\n- [x] Phase 01 - Setup\n- [ ] Phase 02 - Implementation\n',
    'utf-8'
  );

  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ mode: 'yolo', concurrent: false }, null, 2),
    'utf-8'
  );

  return { projectDir, gsdHome };
}

function writeRegistry(gsdHome, projects) {
  const dashDir = path.join(gsdHome, '.gsd');
  fs.mkdirSync(dashDir, { recursive: true });
  fs.writeFileSync(
    path.join(dashDir, 'dashboard.json'),
    JSON.stringify({ projects }, null, 2),
    'utf-8'
  );
}

function randomPort() {
  return 40000 + Math.floor(Math.random() * 10000);
}

function startTestServer(port, opts = {}) {
  const serverModule = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'server.cjs'));
  return serverModule.startDashboardServer(port, opts);
}

function httpGet(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${urlPath}`, (res) => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
  });
}

function waitForSSEEvent(port, eventType, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`SSE timeout: no ${eventType} event within ${timeoutMs}ms`)),
      timeoutMs
    );
    const req = http.get(`http://localhost:${port}/api/events`, (res) => {
      let buf = '';
      res.on('data', chunk => {
        buf += chunk.toString();
        if (buf.includes(`event: ${eventType}`)) {
          clearTimeout(timer);
          req.destroy();
          resolve(buf);
        }
      });
      res.on('error', () => {});
    });
    req.on('error', err => {
      if (err.code !== 'ECONNRESET') {
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}

function waitForServerReady(port, retries = 10, delayMs = 100) {
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

// ─── SRV-01: Server starts and serves REST ───────────────────────────────────

describe('gsd dashboard serve starts HTTP server', () => {
  it('server starts and GET /api/projects returns HTTP 200 with JSON array', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, [
      { name: 'test-proj', display_name: 'Test Project', path: projectDir, added: new Date().toISOString() },
    ]);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const res = await httpGet(port, '/api/projects');
      assert.equal(res.status, 200, 'Expected 200');
      const data = JSON.parse(res.body);
      assert.ok(Array.isArray(data), 'Expected array');
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });

  it('server starts on the specified port', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, []);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const res = await httpGet(port, '/api/projects');
      assert.equal(res.status, 200);
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });

  it('GET /api/projects/:name returns project detail or 404', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, [
      { name: 'test-proj', display_name: 'Test Project', path: projectDir, added: new Date().toISOString() },
    ]);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const found = await httpGet(port, '/api/projects/test-proj');
      assert.equal(found.status, 200);
      const body = JSON.parse(found.body);
      assert.ok(body.name, 'Expected name field');

      const missing = await httpGet(port, '/api/projects/nonexistent');
      assert.equal(missing.status, 404);
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });
});

// ─── SRV-02: SSE live refresh ─────────────────────────────────────────────────

describe('SSE live refresh broadcasts project-update event', () => {
  it('GET /api/events responds with text/event-stream and initial heartbeat', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, []);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const chunk = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SSE heartbeat timeout')), 3000);
        const req = http.get(`http://localhost:${port}/api/events`, (res) => {
          assert.ok(
            res.headers['content-type'] && res.headers['content-type'].includes('text/event-stream'),
            'Expected text/event-stream'
          );
          let buf = '';
          res.on('data', chunk => {
            buf += chunk.toString();
            if (buf.includes(':ok')) {
              clearTimeout(timer);
              req.destroy();
              resolve(buf);
            }
          });
          res.on('error', () => {});
        });
        req.on('error', err => {
          if (err.code !== 'ECONNRESET') { clearTimeout(timer); reject(err); }
        });
      });
      assert.ok(chunk.includes(':ok'), 'Expected :ok heartbeat');
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });

  it('modifying a .planning/ file triggers project-update SSE event within 2000ms', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, [
      { name: 'watch-proj', display_name: 'Watch Project', path: projectDir, added: new Date().toISOString() },
    ]);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const eventPromise = waitForSSEEvent(port, 'project-update', 2000);
      // Give SSE connection a moment to establish before triggering file change
      await new Promise(r => setTimeout(r, 200));
      fs.appendFileSync(path.join(projectDir, '.planning', 'STATE.md'), '\n# Updated\n');
      await eventPromise;
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });
});

// ─── SRV-03: File watchers on .planning/ directories ─────────────────────────

describe('file watchers on .planning/ directories', () => {
  it('stale project path does not crash the server', async () => {
    const port = randomPort();
    const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-stale-home-'));
    writeRegistry(gsdHome, [
      { name: 'stale-proj', display_name: 'Stale Project', path: '/nonexistent/path/does-not-exist', added: new Date().toISOString() },
    ]);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const res = await httpGet(port, '/api/projects');
      assert.equal(res.status, 200);
    } finally {
      await handle.close();
      cleanup(gsdHome);
    }
  });

  it('adding a new file to .planning/ triggers SSE event', async () => {
    const port = randomPort();
    const { projectDir, gsdHome } = createRegistryProject();
    writeRegistry(gsdHome, [
      { name: 'new-file-proj', display_name: 'New File Project', path: projectDir, added: new Date().toISOString() },
    ]);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const eventPromise = waitForSSEEvent(port, 'project-update', 2000);
      await new Promise(r => setTimeout(r, 200));
      fs.writeFileSync(path.join(projectDir, '.planning', 'NOTES.md'), '# Notes\n', 'utf-8');
      await eventPromise;
    } finally {
      await handle.close();
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });
});

// ─── SRV-04: Port flag configures server port ─────────────────────────────────

describe('--port flag configures server port', () => {
  it('server listens on the exact port passed to startDashboardServer', async () => {
    const port = 41234 + Math.floor(Math.random() * 1000);
    const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-port-home-'));
    writeRegistry(gsdHome, []);

    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd') });
    await waitForServerReady(port);

    try {
      const res = await httpGet(port, '/api/projects');
      assert.equal(res.status, 200);
    } finally {
      await handle.close();
      cleanup(gsdHome);
    }
  });
});

// ─── CLI integration: gsd dashboard serve port validation ────────────────────

describe('gsd dashboard serve CLI integration', () => {
  it('--port abc exits non-zero with error', () => {
    const result = runGsdToolsFull(['dashboard', 'serve', '--port', 'abc']);
    assert.strictEqual(result.success, false, 'Should fail with invalid port');
    assert.ok(
      (result.stderr && result.stderr.includes('Invalid port')) ||
      (result.error && result.error.includes('Invalid port')),
      'Error message must mention invalid port'
    );
  });

  it('--port 0 exits non-zero with error', () => {
    const result = runGsdToolsFull(['dashboard', 'serve', '--port', '0']);
    assert.strictEqual(result.success, false, 'Should fail with invalid port 0');
  });

  it('--port 99999 exits non-zero with error', () => {
    const result = runGsdToolsFull(['dashboard', 'serve', '--port', '99999']);
    assert.strictEqual(result.success, false, 'Should fail with out-of-range port');
  });
});

// ─── Multi-milestone parseProjectData() ───────────────────────────────────────

function createMilestoneProject() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-ms-proj-'));
  const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-ms-home-'));

  const milestonesDir = path.join(projectDir, '.planning', 'milestones');

  for (const version of ['v1.0', 'v2.0']) {
    const msDir = path.join(milestonesDir, version);
    fs.mkdirSync(msDir, { recursive: true });

    fs.writeFileSync(
      path.join(msDir, 'STATE.md'),
      `# State\n\n## Current Position\n\nPhase: 01\nStatus: in-progress\nProgress: [████░░░░░░] 40%\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(msDir, 'ROADMAP.md'),
      `# Roadmap\n\n- [x] Phase 01 - Setup\n- [ ] Phase 02 - Implementation\n`,
      'utf-8'
    );
    fs.writeFileSync(
      path.join(msDir, 'REQUIREMENTS.md'),
      `# Requirements\n\n- [x] REQ-01 Something\n- [ ] REQ-02 Another\n`,
      'utf-8'
    );
  }

  // Add a phases directory for v2.0 with a plan file
  const phasesDir = path.join(milestonesDir, 'v2.0', 'phases', '01-setup');
  fs.mkdirSync(phasesDir, { recursive: true });
  fs.writeFileSync(path.join(phasesDir, '01-01-PLAN.md'), '# Plan\n', 'utf-8');

  return { projectDir, gsdHome };
}

describe('parseProjectData includes multi-milestone data', () => {
  it('parseProjectData() returns milestones array with correct count', () => {
    const { projectDir, gsdHome } = createMilestoneProject();
    try {
      const serverModule = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'server.cjs'));
      const data = serverModule.parseProjectData({
        name: 'ms-test',
        display_name: 'MS Test',
        path: projectDir,
        added: new Date().toISOString(),
      });
      assert.ok(Array.isArray(data.milestones), 'milestones should be an array');
      assert.equal(data.milestones.length, 2, 'should have 2 milestone entries');
      for (const ms of data.milestones) {
        assert.ok('name' in ms, 'milestone should have name');
        assert.ok('active' in ms, 'milestone should have active');
        assert.ok('state' in ms, 'milestone should have state');
        assert.ok('roadmap' in ms, 'milestone should have roadmap');
        assert.ok('requirements' in ms, 'milestone should have requirements');
        assert.ok('phases_summary' in ms, 'milestone should have phases_summary');
      }
    } finally {
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });

  it('milestones array is empty for project with flat .planning/ layout', () => {
    const { projectDir, gsdHome } = createRegistryProject();
    try {
      const serverModule = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'server.cjs'));
      const data = serverModule.parseProjectData({
        name: 'flat-test',
        display_name: 'Flat Test',
        path: projectDir,
        added: new Date().toISOString(),
      });
      assert.ok(Array.isArray(data.milestones), 'milestones should be an array');
      assert.equal(data.milestones.length, 0, 'should have 0 milestone entries for flat layout');
    } finally {
      cleanup(projectDir);
      cleanup(gsdHome);
    }
  });
});

// ─── Static file serving ──────────────────────────────────────────────────────

function httpGetRaw(port, rawPath) {
  // Use raw TCP socket to send path without client-side URL normalization
  // Resolves 'localhost' to handle both IPv4 and IPv6 environments
  return new Promise((resolve, reject) => {
    const net = require('net');
    const dns = require('dns');
    dns.lookup('localhost', (err, address) => {
      if (err) { reject(err); return; }
      const sock = new net.Socket();
      let data = '';
      sock.connect(port, address, () => {
        sock.write(`GET ${rawPath} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`);
      });
      sock.on('data', chunk => { data += chunk.toString(); });
      sock.on('end', () => {
        const statusMatch = data.match(/^HTTP\/1\.1 (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;
        const headerBody = data.split('\r\n\r\n');
        const headers = {};
        for (const line of headerBody[0].split('\r\n').slice(1)) {
          const idx = line.indexOf(':');
          if (idx > -1) headers[line.slice(0, idx).toLowerCase().trim()] = line.slice(idx + 1).trim();
        }
        resolve({ status, headers, body: headerBody[1] || '' });
      });
      sock.on('error', reject);
      sock.setTimeout(3000, () => sock.destroy(new Error('timeout')));
    });
  });
}

describe('static file serving', () => {
  it('GET / returns 200 with text/html content-type', async () => {
    const port = randomPort();
    const tmpDashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-'));
    fs.writeFileSync(path.join(tmpDashDir, 'index.html'), '<html><body>test</body></html>', 'utf-8');
    const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-home-'));
    writeRegistry(gsdHome, []);
    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd'), dashboardDir: tmpDashDir });
    await waitForServerReady(port);
    try {
      const res = await httpGet(port, '/');
      assert.equal(res.status, 200, 'Expected 200');
      assert.ok(res.headers['content-type'] && res.headers['content-type'].includes('text/html'), 'Expected text/html');
    } finally {
      await handle.close();
      cleanup(tmpDashDir);
      cleanup(gsdHome);
    }
  });

  it('GET /nonexistent-page returns 200 (SPA fallback to index.html)', async () => {
    const port = randomPort();
    const tmpDashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-'));
    fs.writeFileSync(path.join(tmpDashDir, 'index.html'), '<html><body>spa</body></html>', 'utf-8');
    const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-home-'));
    writeRegistry(gsdHome, []);
    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd'), dashboardDir: tmpDashDir });
    await waitForServerReady(port);
    try {
      const res = await httpGet(port, '/nonexistent-page');
      assert.equal(res.status, 200, 'Expected 200 SPA fallback');
    } finally {
      await handle.close();
      cleanup(tmpDashDir);
      cleanup(gsdHome);
    }
  });

  it('path traversal attempt returns 403', async () => {
    const port = randomPort();
    const tmpDashDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-'));
    fs.writeFileSync(path.join(tmpDashDir, 'index.html'), '<html><body>test</body></html>', 'utf-8');
    const gsdHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-srv-dash-home-'));
    writeRegistry(gsdHome, []);
    const handle = startTestServer(port, { gsdHome: path.join(gsdHome, '.gsd'), dashboardDir: tmpDashDir });
    await waitForServerReady(port);
    try {
      const res = await httpGetRaw(port, '/../../etc/passwd');
      assert.equal(res.status, 403, 'Expected 403 for path traversal');
    } finally {
      await handle.close();
      cleanup(tmpDashDir);
      cleanup(gsdHome);
    }
  });
});
