# claude-web

A local web-based "Mission Control" dashboard for CLI AI agents (Claude Code, Gemini CLI, etc.). It wraps the agent in a PTY, streams its terminal output to a browser via WebSocket, and adds read-only observability panels for file diffs and MCP tool calls — without touching the agent's execution loop.

## How it works

```
Physical Terminal ←──────────────────────────────────┐
                                                      │ passthrough
CLI Agent ←── PTY ←── Daemon ──────────────────────┘
                          │
                    WebSocket (8765)
                          │
              Browser (xterm.js + React)
```

The daemon taps the PTY byte stream: raw output goes to your physical terminal unchanged *and* to the browser simultaneously. Browser keystrokes are piped back through the PTY to the agent. Neither side knows the other exists.

## Prerequisites

- Node.js 18+
- `claude` CLI (or any other CLI agent) installed and on your `PATH`

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Build the frontend
npm run build

# 3. Run the daemon from your project directory
cd /your/project
node /path/to/claude-web/daemon/src/index.js claude

# 4. Open http://127.0.0.1:8765 in your browser
```

Or add a shell alias for convenience:

```bash
alias claude-web='node /path/to/claude-web/daemon/src/index.js claude'
```

Then just run `claude-web` from any project directory.

## Commands

```bash
# Install dependencies (root installs both workspaces)
npm install

# Development — runs daemon + Vite dev server concurrently
npm run dev

# Build frontend for production (required before running daemon standalone)
npm run build

# Run daemon only (serves built frontend at http://127.0.0.1:8765)
npm run daemon

# Run daemon against a specific project directory
CLAUDE_WEB_CWD=/path/to/project npm run daemon

# Run daemon on a different port
DAEMON_PORT=9000 npm run daemon

# Wrap a different agent (e.g. Gemini CLI)
node daemon/src/index.js gemini
```

## UI panels

| Panel | Toggle | Description |
|---|---|---|
| **Terminal** | Always visible | Full xterm.js terminal — interactive, ANSI-accurate |
| **Diff Viewer** | Dock / `Cmd+K` | Side-by-side Monaco diff of uncommitted file changes |
| **MCP Audit Log** | Dock / `Cmd+K` | Collapsible log of MCP tool calls with request/response JSON and latency |

All observability panels are **read-only**. The terminal is the only interactive surface.

## Architecture

This is an **npm workspaces monorepo** with two packages:

### `daemon/`

| File | Responsibility |
|---|---|
| `src/index.js` | Entry point; wires all modules together |
| `src/pty-manager.js` | Spawns the agent in a PTY via `node-pty`; pipes to stdout and WebSocket |
| `src/websocket-server.js` | Single HTTP+WebSocket server on port 8765; serves `frontend/dist/` |
| `src/file-watcher.js` | `chokidar` watcher; sends `git show HEAD:<path>` + disk content to browser |
| `src/mcp-proxy.js` | Stub MCP intercept layer (full proxy in Milestone 3) |

### `frontend/`

| File | Responsibility |
|---|---|
| `src/context/WebSocketContext.jsx` | Single WS connection with auto-reconnect; `subscribe(type, handler)` API |
| `src/App.jsx` | Window layout, `Cmd+K` command palette, dock state |
| `src/components/MainTerminal.jsx` | xterm.js terminal with PTY I/O and resize sync |
| `src/components/DiffViewer.jsx` | Monaco `DiffEditor` (read-only) with language auto-detection |
| `src/components/McpAuditLog.jsx` | Expandable MCP call log with latency |
| `src/components/FloatingWindow.jsx` | `react-rnd` wrapper for draggable/resizable windows |

### WebSocket message protocol

| `type` | Direction | Payload |
|---|---|---|
| `pty_output` | daemon → browser | `{ data: string }` |
| `pty_input` | browser → daemon | `{ data: string }` |
| `pty_resize` | browser → daemon | `{ cols, rows }` |
| `agent_exit` | daemon → browser | `{ code: number }` |
| `file_diff_update` | daemon → browser | `{ path, original, modified }` |
| `mcp_audit_log` | daemon → browser | `{ tool_name, request, response, latency_ms }` |

## Security

- Daemon binds exclusively to `127.0.0.1` — no external network access.
- WebSocket server validates the `Origin` header; only the daemon's own port and the Vite dev server ports (5173, 4173) are allowed.
- All file-serving has path traversal prevention (`filePath.startsWith(DIST_DIR)`).

## Troubleshooting

**`posix_spawnp failed` on macOS**

`node-pty`'s prebuild ships without the execute bit on `spawn-helper`. The `postinstall` script in `package.json` fixes this automatically on `npm install`. If you hit it manually:

```bash
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper
```

**Frontend not built**

The daemon returns a 503 with instructions if `frontend/dist/` doesn't exist. Run `npm run build` first.

**WebSocket won't connect during development**

The Vite dev server runs on port 5173 and automatically points to the daemon at `localhost:8765`. Make sure the daemon is running separately (`npm run daemon`) or use `npm run dev` to start both together.
