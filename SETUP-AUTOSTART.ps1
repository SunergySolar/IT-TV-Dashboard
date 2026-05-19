# ============================================================
#  QuickSight Kiosk — Auto-Start Setup (Task Scheduler)
#  Run this script ONCE as Administrator to register the
#  kiosk so it starts automatically when Windows boots.
#
#  To run:
#    Right-click this file → "Run with PowerShell"
#    When prompted, click Yes to allow admin access.
# ============================================================

param()

# Require admin
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host ""
    Write-Host "  ERROR: This script must be run as Administrator." -ForegroundColor Red
    Write-Host "  Right-click the file and choose 'Run with PowerShell'." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Resolve the folder this script lives in
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$startBat  = Join-Path $scriptDir "START.bat"

if (-not (Test-Path $startBat)) {
    Write-Host ""
    Write-Host "  ERROR: START.bat not found at: $startBat" -ForegroundColor Red
    Write-Host "  Make sure this script is in the same folder as START.bat." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$taskName = "QuickSightKiosk"

Write-Host ""
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host "   QuickSight Kiosk — Registering Auto-Start" -ForegroundColor Cyan
Write-Host "  ================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Script location : $startBat"
Write-Host ""

# Remove existing task if it exists
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "  Removing existing task..."
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Build the task
$action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$startBat`""
$trigger = New-ScheduledTaskTrigger -AtLogOn

# Run as current user (so Chrome can appear on the desktop)
$principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `   # no time limit
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable

Register-ScheduledTask `
    -TaskName  $taskName `
    -Action    $action `
    -Trigger   $trigger `
    -Principal $principal `
    -Settings  $settings `
    -Description "Starts the QuickSight dual-monitor kiosk on login." | Out-Null

Write-Host "  Task registered: '$taskName'" -ForegroundColor Green
Write-Host ""
Write-Host "  The kiosk will now start automatically each time" -ForegroundColor Green
Write-Host "  this Windows user logs in." -ForegroundColor Green
Write-Host ""
Write-Host "  To remove auto-start later, run REMOVE-AUTOSTART.ps1" -ForegroundColor Yellow
Write-Host "  or open Task Scheduler and delete '$taskName'." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to close"
