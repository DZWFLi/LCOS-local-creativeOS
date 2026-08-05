#!/usr/bin/env sh
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
export LCOS_MCP_ROLE=agent
exec node "$HERE/mcp-server.mjs"
