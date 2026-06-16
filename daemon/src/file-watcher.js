'use strict';

const chokidar = require('chokidar');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

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

async function buildFileTree(dir, cwd, depth = 0) {
  if (depth > 6) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const filtered = entries.filter(
    (e) => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'dist'
  );
  const nodes = await Promise.all(
    filtered.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(cwd, fullPath);
      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, cwd, depth + 1);
        return { name: entry.name, path: relPath, type: 'dir', children };
      }
      return { name: entry.name, path: relPath, type: 'file' };
    })
  );
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function seedChanges(cwd, send) {
  let stdout = '';
  try {
    ({ stdout } = await execAsync('git status --porcelain', { cwd }));
  } catch {
    return; // not a git repo or git unavailable
  }
  const lines = stdout.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('!!')) continue; // ignored files
    // Handle renames: "R old -> new" — take the destination
    const filePath = line.slice(3).split(' -> ').pop().trim();
    const fullPath = path.join(cwd, filePath);
    try {
      const payload = await getFileDiffContent(fullPath, cwd);
      send({ type: 'file_diff_update', ...payload });
    } catch {}
  }
}

function startFileWatcher(cwd, broadcast) {
  const watcher = chokidar.watch(cwd, {
    ignored: /(^|[/\\])(\.|node_modules|dist)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
  });

  const handleChange = debounce(async (filePath) => {
    try {
      const payload = await getFileDiffContent(filePath, cwd);
      broadcast({ type: 'file_diff_update', ...payload });
    } catch {}
  }, 150);

  const handleTreeChange = debounce(async () => {
    try {
      const tree = await buildFileTree(cwd, cwd);
      broadcast({ type: 'file_tree', tree });
    } catch {}
  }, 300);

  watcher
    .on('change', (fp) => handleChange(fp, fp))
    .on('add', (fp) => { handleChange(fp, fp); handleTreeChange('tree'); })
    .on('unlink', () => handleTreeChange('tree'))
    .on('addDir', () => handleTreeChange('tree'))
    .on('unlinkDir', () => handleTreeChange('tree'))
    .on('error', (err) => console.error('[watcher] Error:', err.message));

  return watcher;
}

module.exports = { startFileWatcher, buildFileTree, seedChanges };
