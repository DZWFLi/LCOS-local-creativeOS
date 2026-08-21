#!/usr/bin/env sh
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export LCOS_MCP_ROLE=executor
if [ -n "${LCOS_NODE_BIN:-}" ]; then
  export ELECTRON_RUN_AS_NODE=1
  exec "$LCOS_NODE_BIN" "$SCRIPT_DIR/mcp-executor-server.mjs"
fi
exec node "$SCRIPT_DIR/mcp-executor-server.mjs"
