@echo off
setlocal
title AgenticOS Autonomous Multi-Agent Engine
cd /d "%~dp0"

echo =================================================================
echo                AgenticOS Desktop Mission Control
echo =================================================================
echo.

if not exist logs mkdir logs

if exist "%~dp0AgenticOS.exe" (
    echo Launching AgenticOS Native Desktop Application...
    start "" "%~dp0AgenticOS.exe"
    goto :done
)

if exist "%~dp0bin\AgenticOS.exe" (
    echo Launching AgenticOS Native Desktop Application...
    start "" "%~dp0bin\AgenticOS.exe"
    goto :done
)

echo [1/2] Starting AgenticOS Native Kernel...
if exist "%~dp0agenticos-kernel.exe" (
    start /b "" "%~dp0agenticos-kernel.exe" > logs\kernel.log 2>&1
) else if exist "%~dp0bin\agenticos-kernel.exe" (
    start /b "" "%~dp0bin\agenticos-kernel.exe" > logs\kernel.log 2>&1
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        start /b "" python -m agentic_os serve --host 127.0.0.1 --port 8001 > logs\kernel.log 2>&1
    ) else (
        echo [ERROR] No AgenticOS kernel binary found.
    )
)

timeout /t 2 /nobreak >nul
echo [2/2] Opening Mission Control Interface...
start http://127.0.0.1:3000

:done
echo.
echo =================================================================
echo AgenticOS is active!
echo Kernel Daemon:     http://127.0.0.1:8001
echo Mission Control:   http://127.0.0.1:3000
echo Logs Directory:    %~dp0logs
echo =================================================================
timeout /t 3 /nobreak >nul
