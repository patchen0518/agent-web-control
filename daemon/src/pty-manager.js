'use strict';

const pty = require('node-pty');

class PtyManager {
  constructor(command, args, cwd) {
    this._exitHandlers = [];

    this._pty = pty.spawn(command, args, {
      name: 'xterm-256color',
      // Start at a standard 80×24; the browser sends pty_resize immediately
      // on connect and becomes the sole authority on dimensions.
      cols: 80,
      rows: 24,
      cwd,
      env: process.env,
    });

    // PTY output → physical terminal stdout
    this._pty.onData((data) => {
      process.stdout.write(data);
      this._onData && this._onData(data);
    });

    this._pty.onExit(({ exitCode }) => {
      this._exitHandlers.forEach((h) => h(exitCode));
    });

    // Physical terminal stdin → PTY stdin (when running interactively)
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (chunk) => {
        this._pty.write(chunk.toString());
      });
    }

    // Intentionally NOT syncing to the physical terminal's resize events.
    // The browser xterm.js is the sole authority on PTY dimensions; letting
    // the physical window resize override those settings causes the PTY column
    // count to diverge from what xterm renders, garbling cursor-positioned UI.
  }

  // Register a callback invoked for every byte of PTY output.
  onData(handler) {
    this._onData = handler;
  }

  // Write input data to the PTY (called for both physical terminal and WebSocket input).
  write(data) {
    this._pty.write(data);
  }

  // Resize the PTY — called when the browser terminal reports a resize.
  resize(cols, rows) {
    if (cols > 0 && rows > 0) {
      this._pty.resize(cols, rows);
    }
  }

  onExit(handler) {
    this._exitHandlers.push(handler);
  }
}

module.exports = { PtyManager };
