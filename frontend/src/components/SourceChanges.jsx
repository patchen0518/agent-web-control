export function SourceChanges({ changes, onDiffClick }) {
  const paths = Object.keys(changes);

  if (!paths.length) {
    return <div className="sidebar-empty">No changes detected</div>;
  }

  return (
    <div className="changes-list">
      {paths.map((p) => {
        const { original, modified } = changes[p];
        const status = !original ? 'A' : !modified ? 'D' : 'M';
        const parts = p.split('/');
        const name = parts.pop();
        const dir = parts.join('/');

        return (
          <div key={p} className="change-item" onClick={() => onDiffClick(p)} title={p}>
            <span className={`change-badge ${status === 'A' ? 'added' : status === 'D' ? 'deleted' : ''}`}>
              {status}
            </span>
            <span className="change-name">{name}</span>
            {dir && <span className="change-dir">{dir}</span>}
          </div>
        );
      })}
    </div>
  );
}
