import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Terminal } from '@xterm/xterm';
import { AttachAddon } from '@xterm/addon-attach';
import { FitAddon } from '@xterm/addon-fit';

/**
 * Full-screen modal overlay with an interactive xterm.js terminal connected
 * to a tmux session via WebSocket.
 *
 * Props:
 *   sessionName {string} -- tmux session name to attach to
 *   onClose {() => void} -- called when the user closes the modal
 */
export function TerminalModal({ sessionName, onClose }) {
  const containerRef = useRef(null);
  const stateRef = useRef(null); // { term, ws, fitAddon, ro }
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!containerRef.current || !sessionName) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, "DejaVu Sans Mono", monospace',
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#64b5f6',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(
      `${protocol}//${location.host}/ws/terminal/${encodeURIComponent(sessionName)}`
    );
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setConnected(true);
      const attachAddon = new AttachAddon(ws);
      term.loadAddon(attachAddon);
    };

    ws.onerror = () => {
      setError('WebSocket connection failed');
    };

    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4004) setError('Session not found or no longer running');
      else if (e.code === 4009) setError('Session already attached in another window');
      else if (e.code !== 1000 && e.code !== 1001) setError(`Connection closed (${e.code})`);
    };

    // Propagate terminal resize to tmux
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        } catch { /* ignore */ }
      }
    });

    // Resize terminal when container changes size (debounced 100ms)
    let resizeTimer = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => fitAddon.fit(), 100);
    });
    ro.observe(containerRef.current);

    stateRef.current = { term, ws, fitAddon, ro };

    return () => {
      clearTimeout(resizeTimer);
      ro.disconnect();
      ws.close();
      term.dispose();
      stateRef.current = null;
    };
  }, [sessionName]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return html`
    <div class="terminal-overlay" onClick=${onClose}>
      <div class="terminal-container" onClick=${(e) => e.stopPropagation()}>
        <div class="terminal-header">
          <div class="terminal-header-title">
            <div class="terminal-session-dot ${connected ? '' : 'disconnected'}" />
            <span>Session: ${sessionName}</span>
            ${error && html`<span style="color:#f44336; font-size:11px;">${error}</span>`}
          </div>
          <button class="terminal-close-btn" onClick=${onClose}>Close</button>
        </div>
        <div ref=${containerRef} class="terminal-body" />
      </div>
    </div>
  `;
}
