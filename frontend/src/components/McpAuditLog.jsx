import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

export function McpAuditLog() {
  const { subscribe } = useWebSocket();
  const [entries, setEntries] = useState([]);
  const [expanded, setExpanded] = useState({});
  const bottomRef = useRef(null);

  useEffect(() => {
    return subscribe('mcp_audit_log', (payload) => {
      setEntries((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          tool_name: payload.tool_name,
          request: payload.request,
          response: payload.response,
          latency_ms: payload.latency_ms,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    });
  }, [subscribe]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) {
    return <div className="empty-state">No MCP calls recorded yet.</div>;
  }

  function toggleEntry(id) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px' }}>
      {entries.map((entry) => (
        <div key={entry.id} className="audit-entry">
          <div className="audit-header" onClick={() => toggleEntry(entry.id)}>
            <span className="audit-tool">{entry.tool_name}</span>
            <span className="audit-meta">{entry.latency_ms}ms &bull; {entry.timestamp}</span>
            <span className="audit-chevron">{expanded[entry.id] ? '▲' : '▼'}</span>
          </div>
          {expanded[entry.id] && (
            <div className="audit-body">
              <div className="audit-section-label">Request</div>
              <pre className="audit-json">{JSON.stringify(entry.request, null, 2)}</pre>
              <div className="audit-section-label">Response</div>
              <pre className="audit-json">{JSON.stringify(entry.response, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
