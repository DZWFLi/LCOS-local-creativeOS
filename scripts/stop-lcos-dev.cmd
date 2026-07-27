@echo off
chcp 65001 >nul
setlocal

set "LCOS_REPO=%~dp0.."

if not exist "%LCOS_REPO%\package.json" (
  echo [LCOS] Repository not found:
  echo %LCOS_REPO%
  pause
  exit /b 1
)

cd /d "%LCOS_REPO%"
call npm.cmd run dev:stop
exit /b %ERRORLEVEL%
