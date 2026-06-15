'use strict';

const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

// Debounce rapid file-system events (e.g. editors that write + rename).
function debounce(fn, ms) {
  const timers = new Map();
  return (key, ...args) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => { timers.delete(key); fn(key, ...args); }, ms));
  };
}

async function getFileDiffContent(filePath, cwd) {
  const rel = path.relative(cwd, filePath);

  const [originalResult, modified] = await Promise.all([
    execAsync(`git show HEAD:${rel}`, { cwd }).catch(() => ({ stdout: '' })),
    fs.readFile(filePath, 'utf8').catch(() => ''),
  ]);

  return { path: rel, original: originalResult.stdout, modified };
}

function startFileWatcher(cwd, broadcast) {
  const watcher = chokidar.watch(cwd, {
    ignored: /(^|[/\\])(\.|node_modules)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  const handleChange = debounce(async (filePath) => {
    try {
      const payload = await getFileDiffContent(filePath, cwd);
      broadcast({ type: 'file_diff_update', ...payload });
    } catch (e) {
      // File may have been deleted between the event and the read — ignore.
    }
  }, 150);

  watcher.on('change', (filePath) => handleChange(filePath, filePath));
  watcher.on('add', (filePath) => handleChange(filePath, filePath));

  watcher.on('error', (err) => {
    console.error('[watcher] Error:', err.message);
  });

  return watcher;
}

module.exports = { startFileWatcher };
