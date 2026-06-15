'use strict';

const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const DAEMON_PORT = parseInt(process.env.DAEMON_PORT || '8765', 10);
const DIST_DIR = path.resolve(__dirname, '../../frontend/dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff':  'font/woff',
};

function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end(); return;
  }

  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(DIST_DIR, urlPath);

  // Prevent path traversal outside dist/
  if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
    res.writeHead(403); res.end(); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback — any unmatched path (e.g. deep client-side routes) gets index.html
      fs.readFile(path.join(DIST_DIR, 'index.html'), (err2, html) => {
        if (err2) {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Frontend not built. Run: npm run build --workspace=frontend\n');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function createServer() {
  // Origins allowed to open a WebSocket — includes both the daemon's own HTTP server
  // and the Vite dev server used during frontend development.
  const allowedOrigins = new Set([
    `http://localhost:${DAEMON_PORT}`,
    `http://127.0.0.1:${DAEMON_PORT}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]);

  const httpServer = http.createServer(serveStatic);

  const wss = new WebSocketServer({
    server: httpServer,
    verifyClient({ req }) {
      const origin = req.headers.origin;
      if (!origin) return true; // direct / non-browser client
      if (allowedOrigins.has(origin)) return true;
      console.warn(`[ws] Rejected connection from disallowed origin: ${origin}`);
      return false;
    },
  });

  // Bind exclusively to loopback — no external access.
  httpServer.listen(DAEMON_PORT, '127.0.0.1');

  return { httpServer, wss };
}

module.exports = { createServer, DAEMON_PORT };
