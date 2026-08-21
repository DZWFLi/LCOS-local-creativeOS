@echo off
setlocal EnableExtensions
set "SCRIPT=%~dp0mcp-server.mjs"
set "LCOS_MCP_ROLE=agent"
if defined LCOS_NODE_BIN goto run_electron_node
where node.exe >nul 2>nul && goto run_system_node
if defined LOCALAPPDATA (
  for /f "delims=" %%D in ('dir /b /ad /o-n "%LOCALAPPDATA%\LCOS\app-*" 2^>nul') do if not defined LCOS_NODE_BIN set "LCOS_NODE_BIN=%LOCALAPPDATA%\LCOS\%%D\LCOS.exe"
)
if defined LCOS_NODE_BIN goto run_electron_node
echo LCOS MCP: neither node.exe nor an installed LCOS desktop runtime was found. 1>&2
exit /b 127

:run_electron_node
set "ELECTRON_RUN_AS_NODE=1"
"%LCOS_NODE_BIN%" "%SCRIPT%"
exit /b %ERRORLEVEL%

:run_system_node
node.exe "%SCRIPT%"
exit /b %ERRORLEVEL%
