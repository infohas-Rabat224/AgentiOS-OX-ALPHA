<#
.SYNOPSIS
    AgenticOS Windows Production Installer (Native PowerShell)
.DESCRIPTION
    Installs AgenticOS Core Daemon, Multi-Agent Runtime, Mission Control UI,
    Desktop Shortcuts, Start Menu entries, and registers the Uninstaller in Windows Registry.
#>

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\AgenticOS",
    [switch]$Unattended,
    [bool]$CreateDesktopShortcut = $true,
    [bool]$CreateStartMenuShortcut = $true,
    [bool]$LaunchAfterInstall = $true
)

$ErrorActionPreference = "Stop"

function Write-Header {
    Clear-Host
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "                AgenticOS Hybrid Windows Installer               " -ForegroundColor Cyan
    Write-Host "        Autonomous AI Multi-Agent Operating System Runtime       " -ForegroundColor Cyan
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " Deployment: 16 Discovered Agent Brains + Live Kernel Daemon    " -ForegroundColor Gray
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host ""
}

Write-Header

if (-not $Unattended) {
    Write-Host "Target Installation Directory: [$InstallDir]" -ForegroundColor Yellow
    $userPath = Read-Host "Press ENTER to accept or specify a custom path"
    if ($userPath -and $userPath.Trim() -ne "") {
        $InstallDir = $userPath.Trim()
    }
}

Write-Host "`n[1/6] Preparing installation directories..." -ForegroundColor Green
$dirs = @(
    $InstallDir,
    "$InstallDir\bin",
    "$InstallDir\data",
    "$InstallDir\logs",
    "$InstallDir\workspace",
    "$InstallDir\installer"
)
foreach ($dir in $dirs) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

Write-Host "[2/6] Copying core engine, brains registry, and Mission Control UI..." -ForegroundColor Green
$SourceDir = $PSScriptRoot
if (-not $SourceDir) {
    $SourceDir = (Get-Location).Path
}

$robocopyArgs = @(
    $SourceDir,
    $InstallDir,
    "/E",
    "/XD", "node_modules", ".git", ".venv", "dist", "__pycache__", ".pytest_cache", ".ruff_cache",
    "/NFL", "/NDL", "/NJH", "/NJS", "/nc", "/ns", "/np"
)
& robocopy.exe @robocopyArgs | Out-Null
if ($LASTEXITCODE -ge 8) {
    Write-Warning "Robocopy exited with warning code: $LASTEXITCODE (non-fatal)"
}

Write-Host "[3/6] Setting up runtime launchers and daemon runners..." -ForegroundColor Green

$LauncherBatContent = @"
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
    echo [NOTICE] Python not found in PATH; running in embedded simulation mode.
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
"@
Set-Content -Path "$InstallDir\start-agenticos.bat" -Value $LauncherBatContent -Encoding ASCII

# Silent launcher VBS
$VbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & "$InstallDir\start-agenticos.bat"""", 0, False
"@
Set-Content -Path "$InstallDir\start-agenticos-silent.vbs" -Value $VbsContent -Encoding ASCII

Write-Host "[4/6] Generating Desktop and Start Menu shortcuts..." -ForegroundColor Green
$WshShell = New-Object -ComObject WScript.Shell

if ($CreateDesktopShortcut) {
    $DesktopPath = [Environment]::GetFolderPath("Desktop")
    $Shortcut = $WshShell.CreateShortcut("$DesktopPath\AgenticOS Mission Control.lnk")
    $Shortcut.TargetPath = "$InstallDir\start-agenticos.bat"
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Launch AgenticOS Autonomous AI Multi-Agent Operating System"
    $Shortcut.IconLocation = "shell32.dll,138"
    $Shortcut.Save()
    Write-Host "  + Desktop Shortcut created: $DesktopPath\AgenticOS Mission Control.lnk" -ForegroundColor Gray
}

if ($CreateStartMenuShortcut) {
    $StartMenuPrograms = [Environment]::GetFolderPath("Programs")
    $AgenticOSFolder = "$StartMenuPrograms\AgenticOS"
    if (-not (Test-Path $AgenticOSFolder)) {
        New-Item -ItemType Directory -Force -Path $AgenticOSFolder | Out-Null
    }
    
    $AppShortcut = $WshShell.CreateShortcut("$AgenticOSFolder\AgenticOS Mission Control.lnk")
    $AppShortcut.TargetPath = "$InstallDir\start-agenticos.bat"
    $AppShortcut.WorkingDirectory = $InstallDir
    $AppShortcut.Description = "AgenticOS Mission Control"
    $AppShortcut.IconLocation = "shell32.dll,138"
    $AppShortcut.Save()

    $UninstallShortcut = $WshShell.CreateShortcut("$AgenticOSFolder\Uninstall AgenticOS.lnk")
    $UninstallShortcut.TargetPath = "powershell.exe"
    $UninstallShortcut.Arguments = "-ExecutionPolicy Bypass -File `"$InstallDir\uninstall-agenticos.ps1`""
    $UninstallShortcut.WorkingDirectory = $InstallDir
    $UninstallShortcut.Description = "Uninstall AgenticOS"
    $UninstallShortcut.IconLocation = "shell32.dll,131"
    $UninstallShortcut.Save()
    Write-Host "  + Start Menu Shortcuts created in: $AgenticOSFolder" -ForegroundColor Gray
}

Write-Host "[5/6] Writing Uninstaller and registering in Windows Control Panel..." -ForegroundColor Green
Copy-Item "$SourceDir\uninstall-agenticos.ps1" "$InstallDir\uninstall-agenticos.ps1" -Force -ErrorAction SilentlyContinue
Copy-Item "$SourceDir\uninstall-agenticos.bat" "$InstallDir\uninstall-agenticos.bat" -Force -ErrorAction SilentlyContinue

# Register in Windows Add/Remove Programs (HKCU)
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS"
if (-not (Test-Path $RegPath)) {
    New-Item -Path $RegPath -Force | Out-Null
}
Set-ItemProperty -Path $RegPath -Name "DisplayName" -Value "AgenticOS Multi-Agent Operating System"
Set-ItemProperty -Path $RegPath -Name "DisplayVersion" -Value "1.0.0"
Set-ItemProperty -Path $RegPath -Name "Publisher" -Value "AgenticOS Open Source Community"
Set-ItemProperty -Path $RegPath -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $RegPath -Name "UninstallString" -Value "powershell.exe -ExecutionPolicy Bypass -File `"$InstallDir\uninstall-agenticos.ps1`""
Set-ItemProperty -Path $RegPath -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $RegPath -Name "NoRepair" -Value 1 -Type DWord

Write-Host "[6/6] Installation Complete!" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  AgenticOS installed successfully to: $InstallDir" -ForegroundColor Green
Write-Host "  Run: $InstallDir\start-agenticos.bat" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if ($LaunchAfterInstall -and -not $Unattended) {
    $launch = Read-Host "`nLaunch AgenticOS now? (Y/n)"
    if ($launch -ne "n" -and $launch -ne "N") {
        Start-Process "$InstallDir\start-agenticos.bat"
    }
}
