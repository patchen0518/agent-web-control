export function Dock({ windows, onToggle, connected }) {
  return (
    <div className="dock">
      <div
        className={`dock-status ${connected ? 'connected' : ''}`}
        title={connected ? 'Daemon connected' : 'Daemon disconnected'}
      />
      {windows.map((win) => (
        <button
          key={win.id}
          className={`dock-btn ${win.visible ? 'active' : ''}`}
          onClick={() => onToggle(win.id)}
          title={win.title}
        >
          <span className="dock-icon">{win.icon}</span>
          <span className="dock-label">{win.label}</span>
        </button>
      ))}
    </div>
  );
}
