import readline from "node:readline";

/**
 * Small transport adapter kept separate from LCOS business handlers.
 * It implements the MCP stdio lifecycle used by Codex and can be replaced
 * by the official SDK without touching tool behavior.
 */
export function serveStdioMcp({ serverInfo, instructions, protocolVersions, tools, callTool }) {
  const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
  const active = new Map();
  let initialized = false;
  const lines = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

  lines.on("line", (line) => {
    if (!line.trim()) return;
    let message;
    try { message = JSON.parse(line); }
    catch {
      writeError(null, -32700, "Parse error");
      return;
    }
    void dispatch(message).catch((error) => {
      if (message?.id !== undefined) writeError(message.id, -32603, error instanceof Error ? error.message : String(error));
    });
  });

  async function dispatch(message) {
    const { id, method, params } = message ?? {};
    if (typeof method !== "string") {
      if (id !== undefined) writeError(id, -32600, "Invalid Request");
      return;
    }
    if (method === "initialize") {
      const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : undefined;
      const protocolVersion = requested && protocolVersions.includes(requested) ? requested : protocolVersions[0];
      initialized = true;
      writeResult(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo,
        instructions,
      });
      return;
    }
    if (method === "notifications/initialized") { initialized = true; return; }
    if (method === "notifications/cancelled" || method === "$/cancelRequest") {
      const requestId = params?.requestId;
      active.get(requestId)?.abort();
      return;
    }
    if (method === "ping") { if (id !== undefined) writeResult(id, {}); return; }
    if (!initialized) {
      if (id !== undefined) writeError(id, -32002, "Server is not initialized");
      return;
    }
    if (method === "tools/list") {
      writeResult(id, { tools });
      return;
    }
    if (method === "tools/call") {
      const name = typeof params?.name === "string" ? params.name : "";
      if (!toolByName.has(name)) { writeError(id, -32602, `Unknown or unavailable tool: ${name}`); return; }
      const controller = new AbortController();
      active.set(id, controller);
      try {
        const result = await callTool(name, params?.arguments ?? {}, controller.signal);
        writeResult(id, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        writeResult(id, {
          content: [{ type: "text", text: message }],
          structuredContent: { ok: false, error: { code: error?.code ?? "TOOL_ERROR", message } },
          isError: true,
        });
      } finally {
        active.delete(id);
      }
      return;
    }
    if (id !== undefined) writeError(id, -32601, "Method not found");
  }
}

function writeResult(id, result) {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function writeError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
