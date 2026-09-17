<#
.SYNOPSIS
    AgenticOS Windows Uninstall Root Wrapper
.DESCRIPTION
    Executes scripts/uninstall-windows.ps1 with all passed arguments.
#>
[CmdletBinding()]
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\AgenticOS",
    [bool]$CleanEnvVars = $true,
    [switch]$RemoveCacheOnly,
    [switch]$Silent
)

$scriptPath = Join-Path $PSScriptRoot "scripts\uninstall-windows.ps1"
if (-not (Test-Path $scriptPath)) {
    Write-Error "Could not find $scriptPath"
    exit 1
}

& $scriptPath @PSBoundParameters
