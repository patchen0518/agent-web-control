import { useState, useCallback, useRef } from 'react';

export function useWindowManager(initialWindows) {
  const [windows, setWindows] = useState(initialWindows);
  const maxZRef = useRef(100);

  const toggle = useCallback((id) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  }, []);

  const hide = useCallback((id) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: false } : w))
    );
  }, []);

  const bringToFront = useCallback((id) => {
    maxZRef.current += 1;
    const z = maxZRef.current;
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, zIndex: z } : w))
    );
  }, []);

  return { windows, toggle, hide, bringToFront };
}
