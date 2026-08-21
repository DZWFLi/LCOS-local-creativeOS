#!/usr/bin/env node
process.env.LCOS_MCP_ROLE = "executor";
await import("./mcp-server.mjs");
