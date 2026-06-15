import { useState, useEffect } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { useWebSocket } from '../context/WebSocketContext';

const EXT_TO_LANG = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', go: 'go', rs: 'rust', rb: 'ruby', java: 'java',
  css: 'css', scss: 'scss', html: 'html', xml: 'xml',
  json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
  md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
  sql: 'sql', graphql: 'graphql',
};

function detectLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop()?.toLowerCase();
  return EXT_TO_LANG[ext] || 'plaintext';
}

export function DiffViewer() {
  const { subscribe } = useWebSocket();
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    return subscribe('file_diff_update', (payload) => {
      setDiff({ path: payload.path, original: payload.original, modified: payload.modified });
    });
  }, [subscribe]);

  if (!diff) {
    return <div className="empty-state">Watching for file changes...</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '4px 10px',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border)',
        fontFamily: "'SF Mono', monospace",
        flexShrink: 0,
      }}>
        {diff.path}
      </div>
      <div style={{ flex: 1 }}>
        <DiffEditor
          height="100%"
          language={detectLanguage(diff.path)}
          original={diff.original}
          modified={diff.modified}
          theme="vs-dark"
          options={{
            readOnly: true,
            renderSideBySide: true,
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            renderLineHighlight: 'none',
          }}
        />
      </div>
    </div>
  );
}
