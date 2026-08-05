#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export LCOS_MCP_ROLE=executor
exec node "$HERE/mcp-executor-server.mjs"
