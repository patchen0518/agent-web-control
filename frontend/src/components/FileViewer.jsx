import { Editor, DiffEditor } from '@monaco-editor/react';

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

const MONACO_OPTIONS = {
  readOnly: true,
  minimap: { enabled: false },
  fontSize: 13,
  scrollBeyondLastLine: false,
  renderLineHighlight: 'none',
  lineNumbersMinChars: 4,
};

export function FileViewer({ tabs, activeTab, onTabClick, onTabClose }) {
  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div className="content-area">
      {tabs.length > 0 && (
        <div className="tabs-bar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`tab${tab.id === activeTab ? ' active' : ''}`}
              onClick={() => onTabClick(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
              {tab.type === 'diff' && <span className="tab-mode">diff</span>}
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id); }}
                title="Close"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="content-body">
        {!active ? (
          <div className="content-empty">
            <span className="content-empty-title">No file open</span>
            <span className="content-empty-hint">Select a file or changed file from the sidebar</span>
          </div>
        ) : active.binary ? (
          <div className="content-empty">
            <span className="content-empty-title">Binary file</span>
            <span className="content-empty-hint">{active.path}</span>
          </div>
        ) : active.type === 'diff' ? (
          <DiffEditor
            height="100%"
            language={detectLanguage(active.path)}
            original={active.original}
            modified={active.modified}
            theme="vs-dark"
            options={{ ...MONACO_OPTIONS, renderSideBySide: true }}
          />
        ) : (
          <Editor
            height="100%"
            language={detectLanguage(active.path)}
            value={active.content ?? ''}
            theme="vs-dark"
            options={MONACO_OPTIONS}
          />
        )}
      </div>
    </div>
  );
}
