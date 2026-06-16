import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWebSocket } from '../context/WebSocketContext';

export function MainTerminal() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const shiftEnterRef = useRef(false);
  const { connected, subscribe, send } = useWebSocket();

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'SF Mono', 'Fira Mono', 'Cascadia Code', monospace",
      theme: {
        background: '#141414',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: 'rgba(255,255,255,0.2)',
        black: '#1e1e1e',
        brightBlack: '#555',
        red: '#c0392b',
        brightRed: '#e74c3c',
        green: '#27ae60',
        brightGreen: '#2ecc71',
        yellow: '#d4ac0d',
        brightYellow: '#f1c40f',
        blue: '#0e9de2',
        brightBlue: '#3498db',
        magenta: '#8e44ad',
        brightMagenta: '#9b59b6',
        cyan: '#16a085',
        brightCyan: '#1abc9c',
        white: '#d4d4d4',
        brightWhite: '#ecf0f1',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    // Wait for custom fonts AND layout before fitting so character-width
    // calculation uses the real glyph metrics, not the fallback monospace.
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) requestAnimationFrame(() => fitAddon.fit());
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Shift+Enter → newline only when shiftEnter is enabled in Claude Code settings
    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown' && e.key === 'Enter' && e.shiftKey) {
        if (shiftEnterRef.current) {
          send({ type: 'pty_input', data: '\x1b[27;2;13~' });
          return false;
        }
      }
      return true;
    });

    // Keystrokes → daemon PTY stdin
    const disposeOnData = term.onData((data) => {
      send({ type: 'pty_input', data });
    });

    // Terminal resize → daemon PTY resize
    const disposeOnResize = term.onResize(({ cols, rows }) => {
      send({ type: 'pty_resize', cols, rows });
    });

    // Keep terminal fitted when the container is resized
    const container = containerRef.current;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => fitAddonRef.current?.fit());
    });
    ro.observe(container);

    return () => {
      cancelled = true;
      ro.disconnect();
      disposeOnData.dispose();
      disposeOnResize.dispose();
      term.dispose();
    };
  }, [send]);

  // Resync PTY dimensions each time the WebSocket connection is established.
  // The initial fit() may fire before the socket is open, dropping the resize
  // message and leaving the PTY at its default 80×24. Sending it here on every
  // connect guarantees the PTY matches xterm's actual column/row count.
  useEffect(() => {
    if (!connected || !termRef.current || !fitAddonRef.current) return;
    fitAddonRef.current.fit();
    const { cols, rows } = termRef.current;
    send({ type: 'pty_resize', cols, rows });
  }, [connected, send]);

  // Apply agent config (shiftEnter setting) and show startup banner
  useEffect(() => {
    return subscribe('agent_config', (payload) => {
      shiftEnterRef.current = !!payload.shiftEnter;
      if (termRef.current && payload.dashboardUrl) {
        const shiftStatus = payload.shiftEnter ? 'Shift+Enter: multiline enabled' : 'Shift+Enter: disabled';
        termRef.current.writeln(`\r\x1b[36m[Claude Web] Dashboard: ${payload.dashboardUrl}  |  ${shiftStatus}\x1b[0m\r`);
      }
    });
  }, [subscribe]);

  // Stream PTY output from daemon into the terminal
  useEffect(() => {
    return subscribe('pty_output', (payload) => {
      termRef.current?.write(payload.data);
    });
  }, [subscribe]);

  // Graceful shutdown message when agent exits
  useEffect(() => {
    return subscribe('agent_exit', () => {
      const term = termRef.current;
      if (!term) return;
      term.writeln('\r\n\x1b[1;36m╔═══════════════════════════════════════╗\x1b[0m');
      term.writeln('\x1b[1;36m║        Dashboard closed                ║\x1b[0m');
      term.writeln('\x1b[1;36m║  The agent session has ended.          ║\x1b[0m');
      term.writeln('\x1b[1;36m╚═══════════════════════════════════════╝\x1b[0m\r');
    });
  }, [subscribe]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
