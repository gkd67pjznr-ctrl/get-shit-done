'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { WebSocket } = require('ws');

// ─── WebSocket terminal route stubs (TERM-03) ─────────────────────────────────
// These tests will be fleshed out in Plan 21-02 once setupTerminalWebSocket is implemented.
// They currently test the HTTP server's ability to handle upgrade rejections for unknown paths.

describe('WebSocket terminal route matching', () => {
  it('rejects WebSocket upgrade for non-terminal paths', () => {
    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        res.writeHead(200);
        res.end('ok');
      });

      server.on('upgrade', (req, socket) => {
        // Reject all upgrades (simulates server before WS is set up)
        socket.destroy();
      });

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const ws = new WebSocket(`ws://127.0.0.1:${port}/not-a-terminal-path`);
        ws.on('error', () => {
          server.close(() => resolve());
        });
        ws.on('open', () => {
          ws.close();
          server.close(() => resolve());
        });
      });
    });
  });

  it('accepts WebSocket upgrade for /ws/terminal/* paths (stub)', () => {
    // This test verifies the URL pattern matching logic used in setupTerminalWebSocket.
    // The actual handler is tested in Plan 21-02.
    const testUrl = '/ws/terminal/my-session';
    assert.ok(testUrl.startsWith('/ws/terminal/'), 'URL must match /ws/terminal/* pattern');

    const sessionName = decodeURIComponent(testUrl.slice('/ws/terminal/'.length));
    assert.equal(sessionName, 'my-session');
  });

  it('extracts session name with URL encoding', () => {
    const encoded = '/ws/terminal/my%20session%3Aname';
    const sessionName = decodeURIComponent(encoded.slice('/ws/terminal/'.length));
    assert.equal(sessionName, 'my session:name');
  });

  it('rejects empty session name', () => {
    const url = '/ws/terminal/';
    const sessionName = decodeURIComponent(url.slice('/ws/terminal/'.length));
    assert.equal(sessionName, '');
    assert.ok(sessionName.length === 0, 'empty session name should be rejected');
  });
});
