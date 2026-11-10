@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe "%~dp0server.mjs"
  goto done
)
set "BUNDLED_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%BUNDLED_NODE%" (
  "%BUNDLED_NODE%" "%~dp0server.mjs"
  goto done
)
echo Node.js is required to run this offline game.
:done
pause
