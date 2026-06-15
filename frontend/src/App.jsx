import { useState, useEffect } from 'react';
import { useWindowManager } from './hooks/useWindowManager';
import { FloatingWindow } from './components/FloatingWindow';
import { MainTerminal } from './components/MainTerminal';
import { DiffViewer } from './components/DiffViewer';
import { McpAuditLog } from './components/McpAuditLog';
import { Dock } from './components/Dock';
import { CommandPalette } from './components/CommandPalette';
import { useWebSocket } from './context/WebSocketContext';

const INITIAL_WINDOWS = [
  {
    id: 'terminal',
    title: 'Terminal',
    label: 'Term',
    icon: '>_',
    closeable: false,
    visible: true,
    zIndex: 10,
    defaultPosition: { x: 60, y: 20 },
    defaultSize: { width: 820, height: 520 },
  },
  {
    id: 'diff',
    title: 'Diff Viewer',
    label: 'Diff',
    icon: '±',
    closeable: true,
    visible: false,
    zIndex: 10,
    defaultPosition: { x: 900, y: 20 },
    defaultSize: { width: 700, height: 500 },
  },
  {
    id: 'mcp',
    title: 'MCP Audit Log',
    label: 'MCP',
    icon: '⚙',
    closeable: true,
    visible: false,
    zIndex: 10,
    defaultPosition: { x: 60, y: 560 },
    defaultSize: { width: 620, height: 360 },
  },
];

const COMPONENTS = {
  terminal: <MainTerminal />,
  diff: <DiffViewer />,
  mcp: <McpAuditLog />,
};

export default function App() {
  const { windows, toggle, hide, bringToFront } = useWindowManager(INITIAL_WINDOWS);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { connected } = useWebSocket();

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="app">
      <Dock windows={windows} onToggle={toggle} connected={connected} />
      <div className="canvas">
        {windows.map((win) => (
          <FloatingWindow
            key={win.id}
            {...win}
            onClose={() => hide(win.id)}
            onFocus={() => bringToFront(win.id)}
          >
            {COMPONENTS[win.id]}
          </FloatingWindow>
        ))}
      </div>
      {paletteOpen && (
        <CommandPalette
          windows={windows}
          onToggle={toggle}
          onClose={() => setPaletteOpen(false)}
        />
      )}
    </div>
  );
}
