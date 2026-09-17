@echo off
setlocal EnableDelayedExpansion
title AgenticOS Windows 1-Click Installer
cd /d "%~dp0"

echo =================================================================
echo                 AgenticOS Hybrid Windows Installer
echo         Autonomous AI Multi-Agent Operating System Runtime
echo =================================================================
echo.

:: Check for administrative rights
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [OK] Running with Administrator privileges.
) else (
    echo [INFO] Running as standard user. Installing to LocalAppData...
)

echo.
echo Launching PowerShell Installer engine with execution bypass...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agenticos.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Installation failed or was canceled.
    pause
    exit /b %errorLevel%
)

exit /b 0
