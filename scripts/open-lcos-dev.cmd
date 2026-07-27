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

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [LCOS] npm.cmd was not found in PATH.
  echo Please open this from a shell where Node.js / npm is available.
  pause
  exit /b 1
)

call npm.cmd run dev:open
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [LCOS] Launcher failed with exit code %EXIT_CODE%.
  echo Run in the repo for details:
  echo npm run dev:status
  pause
)

exit /b %EXIT_CODE%
