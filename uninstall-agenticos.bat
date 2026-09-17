@echo off
title AgenticOS Windows Uninstaller
cd /d "%~dp0"

echo =================================================================
echo                 AgenticOS Hybrid Windows Uninstaller
echo =================================================================
echo.

echo Launching PowerShell Uninstaller...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-agenticos.ps1"

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Uninstallation encountered an issue.
    pause
    exit /b %errorLevel%
)

echo.
echo Uninstallation completed successfully.
pause
exit /b 0
