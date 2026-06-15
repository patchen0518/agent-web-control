import { useState, useEffect, useRef } from 'react';

export function CommandPalette({ windows, onToggle, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = windows.filter((w) =>
    w.title.toLowerCase().includes(query.toLowerCase())
  );

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered.length > 0) {
      onToggle(filtered[activeIndex].id);
      onClose();
    }
  }

  function handleSelect(id) {
    onToggle(id);
    onClose();
  }

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Toggle panel..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <ul className="palette-list">
          {filtered.map((win, i) => (
            <li
              key={win.id}
              className={`palette-item ${win.visible ? 'active' : ''} ${i === activeIndex ? 'palette-item-focused' : ''}`}
              onMouseDown={() => handleSelect(win.id)}
            >
              <span className="palette-item-icon">{win.icon}</span>
              <span>{win.title}</span>
              <span className="palette-badge">{win.visible ? 'visible' : 'hidden'}</span>
            </li>
          ))}
          {filtered.length === 0 && (
            <li style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
              No panels match &ldquo;{query}&rdquo;
            </li>
          )}
        </ul>
        <div className="palette-hint">
          ↑↓ navigate &nbsp;&bull;&nbsp; ↵ toggle &nbsp;&bull;&nbsp; Esc close
        </div>
      </div>
    </div>
  );
}
