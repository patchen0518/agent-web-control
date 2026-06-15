import { Rnd } from 'react-rnd';

export function FloatingWindow({
  id,
  title,
  visible,
  zIndex,
  closeable,
  onClose,
  onFocus,
  defaultPosition,
  defaultSize,
  children,
}) {
  if (!visible) return null;

  return (
    <Rnd
      default={{
        x: defaultPosition?.x ?? 100,
        y: defaultPosition?.y ?? 80,
        width: defaultSize?.width ?? 640,
        height: defaultSize?.height ?? 420,
      }}
      minWidth={240}
      minHeight={160}
      style={{ zIndex, position: 'absolute' }}
      onMouseDown={onFocus}
      dragHandleClassName="window-titlebar"
      bounds="parent"
    >
      <div className="window">
        <div className="window-titlebar">
          <span className="window-title">{title}</span>
          {closeable && (
            <button
              className="window-btn close"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
        <div className="window-body">
          {children}
        </div>
      </div>
    </Rnd>
  );
}
