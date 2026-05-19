# ============================================================
#  QuickSight Kiosk -- PowerShell Launcher
#  More reliable than batch for multi-monitor Chrome launching.
#
#  Run: Right-click this file -> "Run with PowerShell"
#       OR: .\START-PS.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$LogFile = Join-Path $ScriptDir "kiosk-launch-ps.log"

function Log {
    param([string]$Msg)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp  $Msg" | Out-File $LogFile -Append -Encoding utf8
    Write-Host $Msg -ForegroundColor Cyan
}

function CheckNode {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "ERROR: Node.js is not installed or not on PATH." -ForegroundColor Red
        Write-Host "Install from https://nodejs.org (LTS version), then restart." -ForegroundColor Yellow
        exit 1
    }
    $ver = node -v 2>$null
    Log "Node.js found: $ver"
}

function CheckDeps {
    $m1 = Join-Path $ScriptDir "monitor1\node_modules"
    $m2 = Join-Path $ScriptDir "monitor2\node_modules"
    if (-not (Test-Path $m1)) {
        Write-Host "ERROR: monitor1\node_modules not found. Run SETUP.bat first." -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $m2)) {
        Write-Host "ERROR: monitor2\node_modules not found. Run SETUP.bat first." -ForegroundColor Red
        exit 1
    }
    Log "Dependencies OK"
}

function CheckEnv {
    $e1 = Join-Path $ScriptDir "monitor1\.env"
    $e2 = Join-Path $ScriptDir "monitor2\.env"
    if (-not (Test-Path $e1)) {
        Write-Host "ERROR: monitor1\.env missing. Run SETUP.bat first." -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $e2)) {
        Write-Host "ERROR: monitor2\.env missing. Run SETUP.bat first." -ForegroundColor Red
        exit 1
    }
    Log ".env files OK"
}

function FindChrome {
    $paths = @(
        "C:\Program Files\Google\Chrome\Application\chrome.exe",
        "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    return $null
}

function StartServer {
    param([string]$Dir, [string]$Title, [int]$Port)
    $fullDir = Join-Path $ScriptDir $Dir
    Log "Starting $Title server (port $Port)..."

    $proc = Start-Process -FilePath "node" -ArgumentList "server.js" `
        -WorkingDirectory $fullDir `
        -WindowStyle Minimized `
        -PassThru

    Log "  PID: $($proc.Id)"
    return $proc
}

function WaitForServer {
    param([int]$Port, [string]$Name, [int]$Timeout = 10)
    Log "Waiting for $Name server on port $Port..."
    $elapsed = 0
    while ($elapsed -lt $Timeout) {
        $listening = netstat -ano | Select-String ":$Port\s+LISTENING"
        if ($listening) {
            Log "  $Name server is ready!"
            return $true
        }
        Start-Sleep -Seconds 1
        $elapsed++
    }
    Log "  WARNING: $Name server did not start within ${Timeout}s"
    return $false
}

function OpenChromeOnMonitor {
    param([string]$ChromePath, [string]$Url, [int]$X, [int]$Y, [string]$Label)

    $args = @(
        "--kiosk", $Url,
        "--window-position=$X,$Y",
        "--window-size=1920,1080",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-infobars",
        "--disable-session-crashed-bubble",
        "--disable-background-networking",
        "--disable-restore-session-state",
        "--force-device-scale-factor=1"
    )

    Log "Opening Chrome ($Label) at position ($X,$Y)..."
    Start-Process -FilePath $ChromePath -ArgumentList $args
}

# ---- Main ----
Log "=== PowerShell Kiosk Launcher ==="

CheckNode
CheckDeps
CheckEnv

$Chrome = FindChrome
if (-not $Chrome) {
    Write-Host "ERROR: Chrome not found. Please install Chrome." -ForegroundColor Red
    Write-Host "Open these URLs manually:" -ForegroundColor Yellow
    Write-Host "  Info (top TV):    http://localhost:3000"
    Write-Host "  Stats (bottom TV): http://localhost:3001"
    Write-Host "Full log: $LogFile"
    Read-Host "Press Enter to exit"
    exit 1
}
Log "Chrome found at: $Chrome"

# Start servers
$server1 = StartServer "monitor1" "Info" 3000
$server2 = StartServer "monitor2" "Stats" 3001

# Wait for servers
$ok1 = WaitForServer 3000 "Info"
$ok2 = WaitForServer 3001 "Stats"

if (-not $ok1 -or -not $ok2) {
    Write-Host "" -ForegroundColor Yellow
    Write-Host "WARNING: One or both servers failed to start." -ForegroundColor Yellow
    Write-Host "Check the minimised server windows for error messages." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "If servers are running, Chrome should still open." -ForegroundColor Yellow
    Write-Host "Press Enter to continue anyway..."
    Read-Host
}

# TV layout: stacked vertically
# Top TV (Windows #2) = Info at Y=0
# Bottom TV (Windows #1) = Stats at Y=1080
$monitor1X = 0; $monitor1Y = 0   # Top TV (Info)
$monitor2X = 0; $monitor2Y = 1080 # Bottom TV (Stats)

# Launch Chrome on each TV
OpenChromeOnMonitor $Chrome "http://localhost:3000" $monitor1X $monitor1Y "Info (top TV)"
Write-Host "  Waiting for top TV to be ready..."
Start-Sleep -Seconds 6

OpenChromeOnMonitor $Chrome "http://localhost:3001" $monitor2X $monitor2Y "Stats (bottom TV)"

Log "=== Launch complete ==="
Write-Host ""
Write-Host "Both monitors should now be showing." -ForegroundColor Green
Write-Host ""
Write-Host "To STOP: run STOP.bat" -ForegroundColor White
Write-Host "Full log: $LogFile" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to close this window"
