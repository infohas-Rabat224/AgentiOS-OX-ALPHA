<#
.SYNOPSIS
    AgenticOS Windows Clean Uninstallation & System Cleanup Script
.DESCRIPTION
    Safely terminates background agent daemons and processes, cleans up all
    AgenticOS environment variables (User & Process scopes), removes temporary
    caches and build artifacts, clears project-related configuration files from the
    Windows system, purges Desktop and Start Menu shortcuts, and deregisters
    from the Windows Registry.
.PARAMETER InstallDir
    Target directory of AgenticOS to remove (defaults to %LOCALAPPDATA%\AgenticOS).
.PARAMETER CleanEnvVars
    Whether to remove all AGENTICOS_* environment variables and clean User PATH.
.PARAMETER RemoveCacheOnly
    Switch to only purge temporary caches without removing the entire installation.
.PARAMETER Silent
    Run without interactive confirmation prompts.
#>

[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\AgenticOS",
    [bool]$CleanEnvVars = $true,
    [switch]$RemoveCacheOnly,
    [switch]$Silent
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host "         AgenticOS Windows Clean Uninstallation Script           " -ForegroundColor Yellow
Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host " Target Directory: $InstallDir" -ForegroundColor Gray
Write-Host " Mode: $(if ($RemoveCacheOnly) { 'Purge Temporary Caches Only' } else { 'Complete Removal & Environment Reset' })" -ForegroundColor Gray
Write-Host "=================================================================" -ForegroundColor Yellow
Write-Host ""

if (-not $Silent -and -not $RemoveCacheOnly) {
    $confirm = Read-Host "Are you sure you want to completely uninstall AgenticOS and purge all project configurations? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "Uninstallation canceled by user." -ForegroundColor Yellow
        exit 0
    }
}

# =============================================================================
# 1. Safely Stop Running AgenticOS Daemons & Processes
# =============================================================================
Write-Host "`n[1/6] Safely terminating active agent daemons and background processes..." -ForegroundColor Yellow

$agentProcesses = Get-Process | Where-Object { 
    ($_.ProcessName -match "python|node|uvicorn|tsx|cmd") -and 
    ($_.Path -like "*AgenticOS*" -or $_.CommandLine -like "*agentic_os*" -or $_.CommandLine -like "*agenticos*" -or $_.CommandLine -like "*omniroute*")
}

if ($agentProcesses) {
    foreach ($p in $agentProcesses) {
        Write-Host "  - Terminating PID $($p.Id) ($($p.ProcessName))..." -ForegroundColor Gray
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
    Write-Host "  + Terminated $($agentProcesses.Count) active AgenticOS processes." -ForegroundColor Green
} else {
    Write-Host "  + No running AgenticOS daemon or UI processes found." -ForegroundColor Gray
}

# =============================================================================
# 2. Safely Clean Up All AgenticOS Environment Variables & User PATH
# =============================================================================
if ($CleanEnvVars) {
    Write-Host "`n[2/6] Safely cleaning up all AgenticOS environment variables and PATH..." -ForegroundColor Yellow
    
    $allAgenticEnvVars = @(
        "AGENTICOS_HOME",
        "AGENTICOS_PORT",
        "AGENTICOS_KERNEL_URL",
        "AGENTICOS_ENV",
        "AGENTICOS_CONFIG_DIR",
        "AGENTICOS_DATA_DIR",
        "AGENTICOS_LOGS_DIR",
        "AGENTICOS_CACHE_DIR",
        "AGENTICOS_DAEMON_PID",
        "AGENTICOS_OMNIR_PORT",
        "AGENTICOS_SECRET_KEY"
    )

    # 1. Remove User-scoped Environment Variables
    foreach ($varName in $allAgenticEnvVars) {
        $existingVal = [System.Environment]::GetEnvironmentVariable($varName, [System.EnvironmentVariableTarget]::User)
        if ($existingVal) {
            [System.Environment]::SetEnvironmentVariable($varName, $null, [System.EnvironmentVariableTarget]::User)
            Write-Host "  - Removed User Env Var: $varName" -ForegroundColor Gray
        }
        # Clear current process environment as well
        if (Test-Path "env:$varName") {
            Remove-Item "env:$varName" -ErrorAction SilentlyContinue
        }
    }

    # 2. Clean up Machine-scoped environment variables if set with elevation
    foreach ($varName in $allAgenticEnvVars) {
        try {
            $machineVal = [System.Environment]::GetEnvironmentVariable($varName, [System.EnvironmentVariableTarget]::Machine)
            if ($machineVal) {
                [System.Environment]::SetEnvironmentVariable($varName, $null, [System.EnvironmentVariableTarget]::Machine)
                Write-Host "  - Removed Machine Env Var: $varName" -ForegroundColor Gray
            }
        } catch {
            # Non-admin ignore
        }
    }

    # 3. Clean User PATH
    $binDir = "$InstallDir\bin"
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
    if ($userPath -and ($userPath -like "*$binDir*" -or $userPath -like "*AgenticOS*")) {
        $cleanPath = ($userPath -split ';' | Where-Object { 
            $_ -ne $binDir -and 
            $_ -notlike "*AgenticOS\bin*" -and 
            $_ -ne "" 
        }) -join ';'
        [System.Environment]::SetEnvironmentVariable("Path", $cleanPath, [System.EnvironmentVariableTarget]::User)
        Write-Host "  - Cleaned AgenticOS bin entry from User PATH" -ForegroundColor Gray
    }
}

# =============================================================================
# 3. Remove Temporary Caches & Build Artifacts
# =============================================================================
Write-Host "`n[3/6] Removing temporary caches and intermediate artifacts..." -ForegroundColor Yellow

$cacheLocations = @(
    "$InstallDir\cache",
    "$InstallDir\logs",
    "$InstallDir\.runtime",
    "$InstallDir\.pytest_cache",
    "$InstallDir\node_modules\.vite",
    "$env:LOCALAPPDATA\AgenticOS\cache",
    "$env:LOCALAPPDATA\Temp\AgenticOS*",
    "$env:LOCALAPPDATA\Temp\agenticos*",
    "$env:TEMP\AgenticOS*",
    "$env:TEMP\agenticos*"
)

foreach ($loc in $cacheLocations) {
    if (Test-Path $loc) {
        Remove-Item -Path $loc -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  - Purged Cache: $loc" -ForegroundColor Gray
    }
}

# Clean Python __pycache__ inside project
if (Test-Path $InstallDir) {
    Get-ChildItem -Path $InstallDir -Filter "__pycache__" -Recurse -Directory -ErrorAction SilentlyContinue | 
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

if ($RemoveCacheOnly) {
    Write-Host "`n[COMPLETED] AgenticOS temporary caches cleared successfully." -ForegroundColor Green
    exit 0
}

# =============================================================================
# 4. Clear Project-Related Configuration Files from the Windows System
# =============================================================================
Write-Host "`n[4/6] Clearing project-related configuration files..." -ForegroundColor Yellow

$configLocations = @(
    "$env:APPDATA\AgenticOS",
    "$env:LOCALAPPDATA\AgenticOS\config",
    "$env:USERPROFILE\.agenticos",
    "$env:USERPROFILE\.config\agenticos",
    "$env:USERPROFILE\.agenticos_history",
    "$env:USERPROFILE\.agenticos_credentials"
)

foreach ($cfg in $configLocations) {
    if (Test-Path $cfg) {
        Remove-Item -Path $cfg -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  - Removed Configuration: $cfg" -ForegroundColor Gray
    }
}

# =============================================================================
# 5. Remove Desktop and Start Menu Shortcuts & Registry Keys
# =============================================================================
Write-Host "`n[5/6] Removing Desktop and Start Menu shortcuts and Registry keys..." -ForegroundColor Yellow

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$desktopShortcuts = @(
    "$DesktopPath\AgenticOS Mission Control.lnk",
    "$DesktopPath\AgenticOS.lnk"
)
foreach ($sc in $desktopShortcuts) {
    if (Test-Path $sc) {
        Remove-Item $sc -Force -ErrorAction SilentlyContinue
        Write-Host "  - Removed Desktop shortcut: $sc" -ForegroundColor Gray
    }
}

$StartMenuPrograms = [Environment]::GetFolderPath("Programs")
$AgenticOSFolder = "$StartMenuPrograms\AgenticOS"
if (Test-Path $AgenticOSFolder) {
    Remove-Item $AgenticOSFolder -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  - Removed Start Menu folder: $AgenticOSFolder" -ForegroundColor Gray
}

# Registry uninstall entry removal
$regPaths = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AgenticOS",
    "HKCU:\Software\AgenticOS"
)
foreach ($rPath in $regPaths) {
    if (Test-Path $rPath) {
        Remove-Item -Path $rPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  - Removed Registry key: $rPath" -ForegroundColor Gray
    }
}

# =============================================================================
# 6. Remove Installation Directory Files
# =============================================================================
Write-Host "`n[6/6] Purging installation directory files..." -ForegroundColor Yellow
if (Test-Path $InstallDir) {
    try {
        # Exclude self if running directly inside InstallDir
        $currentScript = $MyInvocation.MyCommand.Definition
        Get-ChildItem -Path $InstallDir -Exclude (Split-Path -Leaf $currentScript) | 
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

        Write-Host "  - Purged installation directory: $InstallDir" -ForegroundColor Gray
    } catch {
        Write-Warning "Could not immediately remove locked files in $InstallDir: $_"
    }
}

Write-Host "`n=================================================================" -ForegroundColor Green
Write-Host "  AgenticOS Uninstallation Complete!                             " -ForegroundColor Green
Write-Host "  * All environment variables removed                            " -ForegroundColor Green
Write-Host "  * Temporary caches purged                                      " -ForegroundColor Green
Write-Host "  * System configuration files cleared                           " -ForegroundColor Green
Write-Host "  * Shortcuts and Registry keys removed                          " -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Green
