import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useWebSocket } from '../context/WebSocketContext';

export function MainTerminal() {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
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

    // Defer fit until after browser layout so the container has real pixel dimensions
    const rafId = requestAnimationFrame(() => fitAddon.fit());

    termRef.current = term;
    fitAddonRef.current = fitAddon;

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
      cancelAnimationFrame(rafId);
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

  // Stream PTY output from daemon into the terminal
  useEffect(() => {
    return subscribe('pty_output', (payload) => {
      termRef.current?.write(payload.data);
    });
  }, [subscribe]);

  // Show agent exit message in the terminal
  useEffect(() => {
    return subscribe('agent_exit', (payload) => {
      termRef.current?.writeln(`\r\n\x1b[33m[Agent exited with code ${payload.code}]\x1b[0m`);
    });
  }, [subscribe]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden' }}
    />
  );
}
