#!/usr/bin/env node
'use strict';

const fs = require('fs/promises');
const path = require('path');
const { createServer, DAEMON_PORT } = require('./websocket-server');
const { PtyManager } = require('./pty-manager');
const { startFileWatcher, buildFileTree, seedChanges } = require('./file-watcher');
const { McpProxy } = require('./mcp-proxy');

const command = process.argv[2] || 'claude';
const args = process.argv.slice(3);
const cwd = process.env.CLAUDE_WEB_CWD || process.cwd();

function broadcast(wss, payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
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

  ptyManager.onData((data) => send({ type: 'pty_output', data }));
  ptyManager.onExit((code) => {
    console.log(`[daemon] Agent exited with code ${code}`);
    send({ type: 'agent_exit', code });
    setTimeout(() => process.exit(code || 0), 500);
  });

  startFileWatcher(cwd, send);

  wss.on('connection', async (ws, req) => {
    console.log(`[daemon] Client connected: ${req.socket.remoteAddress}`);

    const sendToClient = (payload) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(payload));
    };

    // Seed the new client: file tree + any uncommitted changes
    buildFileTree(cwd, cwd)
      .then((tree) => sendToClient({ type: 'file_tree', tree }))
      .catch((e) => console.warn('[daemon] File tree error:', e.message));

    seedChanges(cwd, sendToClient).catch(() => {});

    ws.on('message', (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch (e) {
        console.error('[daemon] Malformed message:', e.message);
        return;
      }

      switch (payload.type) {
        case 'pty_input':
          ptyManager.write(payload.data);
          break;

        case 'pty_resize':
          ptyManager.resize(payload.cols, payload.rows);
          break;

        case 'file_content_request': {
          const reqPath = payload.path;
          if (!reqPath || typeof reqPath !== 'string') break;
          const fullPath = path.resolve(cwd, reqPath);
          // Prevent path traversal outside the watched directory
          if (!fullPath.startsWith(cwd + path.sep) && fullPath !== cwd) {
            console.warn('[daemon] Rejected path traversal attempt:', reqPath);
            break;
          }
          fs.readFile(fullPath, 'utf8')
            .then((content) => {
              const binary = content.includes('\0');
              sendToClient({
                type: 'file_content_response',
                path: reqPath,
                content: binary ? null : content,
                binary,
              });
            })
            .catch((err) => console.warn('[daemon] File read error:', err.message));
          break;
        }

        default:
          console.warn('[daemon] Unknown message type:', payload.type);
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
