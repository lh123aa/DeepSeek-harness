@echo off
title DeepSeek Harness - Web UI
cd /d "D:\DeepSeekHNS"

netstat -ano | findstr /C:":3080" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [DeepSeek Harness] Service is already running, opening browser...
    start "" "http://127.0.0.1:3080"
    exit /b 0
)

echo [DeepSeek Harness] Starting: http://127.0.0.1:3080
echo [DeepSeek Harness] Close this window (or press Ctrl+C) to stop the service.
start /b cmd /c "timeout /t 8 /nobreak >nul & start http://127.0.0.1:3080"
node --import tsx/esm apps/cli/src/bin.ts web
echo.
pause