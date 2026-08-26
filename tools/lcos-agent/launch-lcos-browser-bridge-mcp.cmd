@echo off
rem LCOS browser bridge MCP launcher: stdio MCP server wrapping browser-harness (Python).
rem Daemon lifecycle is owned by browser-harness itself (ensure_daemon in run.py).
setlocal EnableExtensions
where python.exe >nul 2>nul && goto run
echo LCOS browser bridge: python.exe not found in PATH. 1>&2
exit /b 127

:run
python.exe "%~dp0..\lcos-browser-bridge\mcp_server.py"
exit /b %ERRORLEVEL%