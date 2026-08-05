@echo off
setlocal
set "SCRIPT=%~dp0mcp-executor-server.mjs"
where node.exe >nul 2>nul || (
  echo LCOS executor MCP: node.exe not found in PATH. 1>&2
  exit /b 127
)
set "LCOS_MCP_ROLE=executor"
node.exe "%SCRIPT%"
