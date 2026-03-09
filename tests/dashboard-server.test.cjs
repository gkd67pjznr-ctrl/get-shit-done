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
