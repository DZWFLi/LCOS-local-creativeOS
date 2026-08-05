@echo off
setlocal
set "SCRIPT=%~dp0mcp-server.mjs"
where node.exe >nul 2>nul || (
  echo LCOS MCP: node.exe not found in PATH. 1>&2
  exit /b 127
)
set "LCOS_MCP_ROLE=agent"
node.exe "%SCRIPT%"
