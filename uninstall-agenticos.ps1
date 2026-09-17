<#
.SYNOPSIS
    AgenticOS Windows Uninstallation Script
.DESCRIPTION
    Safely stops running background agent daemons, cleans up desktop/start menu
    shortcuts, removes registry entries from Add/Remove Programs, and deletes application files.
#>

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\AgenticOS",
    [switch]$Silent
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "                 Uninstalling AgenticOS...                       " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow

# 1. Terminate running processes originating from the install directory
Write-Host "[1/4] Stopping running agent daemons and processes..." -ForegroundColor Gray
Get-Process | Where-Object { 
    ($_.ProcessName -match "python|node|uvicorn|tsx") -and 
    ($_.Path -like "*AgenticOS*" -or $_.CommandLine -like "*agentic_os*" -or $_.CommandLine -like "*mission-control*")
} | Stop-Process -Force -ErrorAction SilentlyContinue

# 2. Remove desktop and Start Menu shortcuts
Write-Host "[2/4] Removing Desktop and Start Menu shortcuts..." -ForegroundColor Gray
$DesktopPath = [Environment]::GetFolderPath("Desktop")
if (Test-Path "$DesktopPath\AgenticOS Mission Control.lnk") {
    Remove-Item "$DesktopPath\AgenticOS Mission Control.lnk" -Force
}

$StartMenuPrograms = [Environment]::GetFolderPath("Programs")
if (Test-Path "$StartMenuPrograms\AgenticOS") {
    Remove-Item "$StartMenuPrograms\AgenticOS" -Recurse -Force
}

# 3. Clean Windows Registry Add/Remove Programs
Write-Host "[3/4] Cleaning Windows Registry entry..." -ForegroundColor Gray
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS"
if (Test-Path $RegPath) {
    Remove-Item -Path $RegPath -Recurse -Force
}

# 4. Remove installation files (skip if uninstaller is running directly inside it, queue delete on reboot or delete children)
Write-Host "[4/4] Removing installation directory files..." -ForegroundColor Gray
if (Test-Path $InstallDir) {
    Get-ChildItem -Path $InstallDir -Exclude "uninstall-agenticos.*" | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "=================================================================" -ForegroundColor Green
Write-Host "  AgenticOS has been cleanly and successfully uninstalled.      " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
