@echo off
setlocal
set "DEST=E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\.codex-runtime\ollama-setup\OllamaSetup.exe"
set "LOG=E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\.codex-runtime\ollama-setup\download.log"
set "LOGERR=E:\Codex 项目\OS开发\.worktrees\mvp-fast-build\.codex-runtime\ollama-setup\download.log.err"
curl.exe -x http://127.0.0.1:7897 -L -C - --retry 20 --retry-all-errors --connect-timeout 30 -o "%DEST%" https://ollama.com/download/OllamaSetup.exe > "%LOG%" 2> "%LOGERR%"
exit /b %ERRORLEVEL%
