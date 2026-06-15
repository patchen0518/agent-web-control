'use strict';

// MCP proxy stub.
// Full intercept (sitting between the agent and MCP servers over stdio JSON-RPC)
// is deferred to Milestone 3. The class interface is defined here so the rest of
// the daemon can call it without changes when the implementation lands.

class McpProxy {
  constructor(broadcast) {
    this._broadcast = broadcast;
  }

  // Called when a tool invocation is intercepted.
  onToolCall(toolName, request) {
    console.log(`[mcp] tool call: ${toolName}`);
    this._pendingCalls = this._pendingCalls || new Map();
    this._pendingCalls.set(toolName, { toolName, request, startedAt: Date.now() });
  }

  // Called when the corresponding tool response arrives.
  onToolResponse(toolName, response) {
    const pending = this._pendingCalls?.get(toolName);
    const latencyMs = pending ? Date.now() - pending.startedAt : 0;
    console.log(`[mcp] tool response: ${toolName} (${latencyMs}ms)`);

    this._broadcast({
      type: 'mcp_audit_log',
      tool_name: toolName,
      request: pending?.request ?? {},
      response,
      latency_ms: latencyMs,
    });

    this._pendingCalls?.delete(toolName);
  }
}

module.exports = { McpProxy };
