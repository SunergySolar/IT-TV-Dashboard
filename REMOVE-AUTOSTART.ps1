# ============================================================
#  QuickSight Kiosk — Remove Auto-Start
#  Run as Administrator to remove the Task Scheduler entry.
# ============================================================

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "  ERROR: Run as Administrator." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$taskName = "QuickSightKiosk"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($task) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host ""
    Write-Host "  Auto-start removed. The kiosk will no longer start on login." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "  No task named '$taskName' found — nothing to remove." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to close"
