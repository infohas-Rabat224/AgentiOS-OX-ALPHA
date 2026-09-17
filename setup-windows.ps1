<#
.SYNOPSIS
    AgenticOS Windows Setup Root Wrapper
.DESCRIPTION
    Executes scripts/setup-windows.ps1 with all passed arguments.
#>
[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\AgenticOS",
    [int]$Port = 3000,
    [int]$KernelPort = 8001,
    [string]$Environment = "production",
    [switch]$Unattended,
    [bool]$ConfigureEnvVars = $true,
    [bool]$AddToPath = $true,
    [bool]$CreateDesktopShortcut = $true,
    [bool]$CreateStartMenuShortcut = $true,
    [bool]$LaunchAfterInstall = $true
)

$scriptPath = Join-Path $PSScriptRoot "scripts\setup-windows.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find $scriptPath"
    exit 1
}

& $scriptPath @PSBoundParameters
