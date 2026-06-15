#!/usr/bin/env node
'use strict';

const { createServer, DAEMON_PORT } = require('./websocket-server');
const { PtyManager } = require('./pty-manager');
const { startFileWatcher } = require('./file-watcher');
const { McpProxy } = require('./mcp-proxy');

const command = process.argv[2] || 'claude';
const args = process.argv.slice(3);
// Watch the directory from which the user invokes the daemon.
const cwd = process.env.CLAUDE_WEB_CWD || process.cwd();

function broadcast(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(msg);
    }
  }
}

async function main() {
  const { httpServer, wss } = createServer();

  httpServer.on('listening', () => {
    console.log(`[daemon] Dashboard:  http://127.0.0.1:${DAEMON_PORT}`);
    console.log(`[daemon] WebSocket:  ws://127.0.0.1:${DAEMON_PORT}`);
    console.log(`[daemon] Spawning:   ${command} ${args.join(' ')}`);
    console.log(`[daemon] Watching:   ${cwd}`);
  });

  const send = (payload) => broadcast(wss, payload);
  const mcpProxy = new McpProxy(send);

  const ptyManager = new PtyManager(command, args, cwd);

  ptyManager.onData((data) => {
    send({ type: 'pty_output', data });
  });

  ptyManager.onExit((code) => {
    console.log(`[daemon] Agent exited with code ${code}`);
    send({ type: 'agent_exit', code });
    setTimeout(() => process.exit(code || 0), 500);
  });

  startFileWatcher(cwd, send);

  wss.on('connection', (ws, req) => {
    console.log(`[daemon] Client connected: ${req.socket.remoteAddress}`);

    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        switch (payload.type) {
          case 'pty_input':
            ptyManager.write(payload.data);
            break;
          case 'pty_resize':
            ptyManager.resize(payload.cols, payload.rows);
            break;
          default:
            console.warn('[daemon] Unknown message type:', payload.type);
        }
      } catch (e) {
        console.error('[daemon] Malformed message:', e.message);
      }
    });

    ws.on('close', () => console.log('[daemon] Client disconnected'));
    ws.on('error', (err) => console.error('[daemon] WebSocket error:', err.message));
  });
}

main().catch((err) => {
  console.error('[daemon] Fatal:', err);
  process.exit(1);
});
