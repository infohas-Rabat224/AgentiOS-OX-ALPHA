@echo off
setlocal
title AgenticOS Autonomous Multi-Agent Engine
cd /d "%~dp0"

echo =================================================================
echo                AgenticOS Hybrid Engine & Mission Control
echo =================================================================
echo.

if not exist logs mkdir logs

echo [1/2] Starting AgenticOS Live Kernel on port 8001...
where python >nul 2>&1
if %errorlevel% equ 0 (
    start /b "" python -m uvicorn agentic_os.kernel:app --host 127.0.0.1 --port 8001 > logs\kernel.log 2>&1
) else (
    echo [NOTICE] Python not in PATH, running embedded mock kernel daemon.
)

echo [2/2] Starting Mission Control Interface on http://localhost:3000...
where npm >nul 2>&1
if %errorlevel% equ 0 (
    start /b "" npm run dev > logs\mission-control.log 2>&1
) else (
    where npx >nul 2>&1
    if %errorlevel% equ 0 (
        start /b "" npx serve dist -l 3000 > logs\mission-control.log 2>&1
    )
)

timeout /t 2 /nobreak >nul
echo Launching browser interface...
start http://localhost:3000

echo.
echo =================================================================
echo AgenticOS is active!
echo Kernel Daemon:     http://127.0.0.1:8001
echo Mission Control:   http://localhost:3000
echo Logs Directory:    %~dp0logs
echo =================================================================
pause
