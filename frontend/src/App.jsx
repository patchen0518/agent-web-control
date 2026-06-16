import { useState, useEffect } from 'react';
import { FileTree } from './components/FileTree';
import { SourceChanges } from './components/SourceChanges';
import { FileViewer } from './components/FileViewer';
import { MainTerminal } from './components/MainTerminal';
import { useWebSocket } from './context/WebSocketContext';

export default function App() {
  const { connected, subscribe, send } = useWebSocket();

  const [tree, setTree] = useState([]);
  const [changes, setChanges] = useState({});
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [filesOpen, setFilesOpen] = useState(true);
  const [changesOpen, setChangesOpen] = useState(true);

  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [agentWidth, setAgentWidth] = useState(420);

  function startSidebarResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    function onMove(e) {
      setSidebarWidth(Math.max(140, Math.min(520, startW + (e.clientX - startX))));
    }
    function onUp() {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startAgentResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = agentWidth;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    function onMove(e) {
      // dragging left widens the agent panel
      setAgentWidth(Math.max(240, Math.min(800, startW + (startX - e.clientX))));
    }
    function onUp() {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // File tree from daemon
  useEffect(() => subscribe('file_tree', (p) => setTree(p.tree)), [subscribe]);

  // Accumulate changed files; keep open diff tabs live
  useEffect(() => {
    return subscribe('file_diff_update', (p) => {
      setChanges((prev) => ({ ...prev, [p.path]: { original: p.original, modified: p.modified } }));
      setTabs((prev) =>
        prev.map((t) =>
          t.id === `diff:${p.path}`
            ? { ...t, original: p.original, modified: p.modified }
            : t
        )
      );
    });
  }, [subscribe]);

  // File content response → open or update a file tab
  useEffect(() => {
    return subscribe('file_content_response', (p) => {
      const id = `file:${p.path}`;
      const label = p.path.split('/').pop();
      setTabs((prev) => {
        const exists = prev.find((t) => t.id === id);
        if (exists) {
          return prev.map((t) => (t.id === id ? { ...t, content: p.content, binary: p.binary } : t));
        }
        return [...prev, { id, label, type: 'file', path: p.path, content: p.content, binary: p.binary }];
      });
      setActiveTab(id);
    });
  }, [subscribe]);

  function openFile(filePath) {
    const id = `file:${filePath}`;
    const existing = tabs.find((t) => t.id === id);
    if (existing) { setActiveTab(id); return; }
    send({ type: 'file_content_request', path: filePath });
  }

  function openDiff(filePath) {
    const id = `diff:${filePath}`;
    const existing = tabs.find((t) => t.id === id);
    if (existing) { setActiveTab(id); return; }
    const change = changes[filePath];
    if (!change) return;
    const label = filePath.split('/').pop();
    setTabs((prev) => [...prev, { id, label, type: 'diff', path: filePath, ...change }]);
    setActiveTab(id);
  }

  function closeTab(id) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTab === id) setActiveTab(next.length ? next[next.length - 1].id : null);
      return next;
    });
  }

  const activeFilePath = activeTab?.startsWith('file:') ? activeTab.slice(5) : null;
  const changeCount = Object.keys(changes).length;

  return (
    <div className="app">
      {/* Left sidebar */}
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className={`sidebar-section files${filesOpen ? '' : ' collapsed'}`}>
          <div className="sidebar-header" onClick={() => setFilesOpen((v) => !v)}>
            <span className="sidebar-chevron">{filesOpen ? '▾' : '▸'}</span>
            Files
          </div>
          {filesOpen && (
            <div className="sidebar-scroll">
              <FileTree tree={tree} activeFile={activeFilePath} onFileClick={openFile} />
            </div>
          )}
        </div>

        <div className={`sidebar-section changes${changesOpen ? '' : ' collapsed'}`}>
          <div className="sidebar-header" onClick={() => setChangesOpen((v) => !v)}>
            <span className="sidebar-chevron">{changesOpen ? '▾' : '▸'}</span>
            Source Changes
            {changeCount > 0 && <span className="sidebar-badge">{changeCount}</span>}
          </div>
          {changesOpen && (
            <div className="sidebar-scroll">
              <SourceChanges changes={changes} onDiffClick={openDiff} />
            </div>
          )}
        </div>
      </div>

      {/* Divider: sidebar ↔ content */}
      <div className="resize-divider" onMouseDown={startSidebarResize} />

      {/* Middle: file / diff viewer */}
      <FileViewer
        tabs={tabs}
        activeTab={activeTab}
        onTabClick={setActiveTab}
        onTabClose={closeTab}
      />

      {/* Divider: content ↔ agent */}
      <div className="resize-divider" onMouseDown={startAgentResize} />

      {/* Right: agent terminal */}
      <div className="agent-panel" style={{ width: agentWidth }}>
        <div className="agent-header">
          <span>Agent Terminal</span>
          <span className={`agent-status${connected ? ' connected' : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
        </div>
        <div className="agent-terminal">
          <MainTerminal />
        </div>
      </div>
    </div>
  );
}
