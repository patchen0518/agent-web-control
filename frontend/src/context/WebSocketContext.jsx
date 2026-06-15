import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

// When served by the daemon itself, connect to the same host.
// When running through the Vite dev server (port 5173/4173), fall back to the daemon's default port.
const VITE_PORTS = new Set(['5173', '4173']);
const daemonPort = import.meta.env.VITE_DAEMON_PORT || '8765';
const WS_URL = import.meta.env.VITE_DAEMON_WS_URL ||
  (VITE_PORTS.has(window.location.port)
    ? `ws://${window.location.hostname}:${daemonPort}`
    : `ws://${window.location.host}`);
const RECONNECT_DELAY_MS = 2000;

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const wsRef = useRef(null);
  const listenersRef = useRef({});
  const reconnectTimerRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      clearTimeout(reconnectTimerRef.current);
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      // onclose fires after onerror — reconnect is handled there.
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        console.warn('[ws] Non-JSON message received');
        return;
      }
      const handlers = listenersRef.current[payload.type];
      if (handlers) handlers.forEach((h) => h(payload));
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const subscribe = useCallback((type, handler) => {
    if (!listenersRef.current[type]) listenersRef.current[type] = [];
    listenersRef.current[type].push(handler);
    return () => {
      listenersRef.current[type] = listenersRef.current[type].filter((h) => h !== handler);
    };
  }, []);

  const send = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ connected, subscribe, send }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('useWebSocket must be used inside WebSocketProvider');
  return ctx;
}
