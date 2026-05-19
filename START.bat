@echo off
title QuickSight Kiosk -- Launcher
color 0A

:: ============================================================
::  LOG EVERYTHING to a file so we can debug if the window closes
:: ============================================================
set LOGFILE=%~dp0kiosk-launch.log
echo === Kiosk Launch Log -- %date% %time% === > "%LOGFILE%"

:: ============================================================
::  CHECK 1: Is Node.js installed and on PATH?
:: ============================================================
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed or NOT on PATH. >> "%LOGFILE%"
    color 0C
    echo.
    echo  ERROR: Node.js is not installed or not on PATH.
    echo.
    echo  Please install it from https://nodejs.org
    echo  Choose the "LTS" version, then restart this script.
    echo.
    echo  Full log: %LOGFILE%
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo [OK] Node.js found: %NODE_VER% >> "%LOGFILE%"
echo  Node.js: %NODE_VER% >> "%LOGFILE%"

:: ============================================================
::  CHECK 2: Are npm dependencies installed?
:: ============================================================
if not exist "%~dp0kiosk\node_modules" (
    echo [ERROR] kiosk\node_modules not found. Run SETUP.bat first. >> "%LOGFILE%"
    color 0C
    echo.
    echo  ERROR: Dependencies not installed.
    echo  Please run SETUP.bat first.
    echo.
    echo  Full log: %LOGFILE%
    echo.
    pause
    exit /b 1
)
echo [OK] Dependencies found >> "%LOGFILE%"

:: ============================================================
::  CHECK 3: Is .env present?
:: ============================================================
if not exist "%~dp0kiosk\.env" (
    echo [ERROR] kiosk\.env not found. >> "%LOGFILE%"
    color 0C
    echo.
    echo  ERROR: kiosk\.env is missing.
    echo  Please run SETUP.bat first.
    echo.
    pause
    exit /b 1
)
echo [OK] .env file found >> "%LOGFILE%"

:: ============================================================
::  CHECK 4: Find Chrome
:: ============================================================
set CHROME=""
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)
if %CHROME%=="" (
    echo [WARNING] Chrome not found in default locations. >> "%LOGFILE%"
    echo  WARNING: Chrome not found in default locations. >> "%LOGFILE%"
) else (
    echo [OK] Chrome found >> "%LOGFILE%"
)

:: ============================================================
::  SCREEN POSITIONS
::  TV layout (two 57" TVs, stacked vertically):
::    Windows #2 (top TV)  = Info (2 dashboards)  at Y=0
::    Windows #1 (bottom)  = Stats (13 tabs)       at Y=1080
:: ============================================================

set MONITOR1_X=0
set MONITOR1_Y=0
set MONITOR2_X=0
set MONITOR2_Y=1080

set MONITOR1_URL=http://localhost:3000
set MONITOR2_URL=http://localhost:3001

echo.
echo  ================================================
echo   QuickSight Kiosk -- Starting
echo  ================================================
echo.

:: ============================================================
::  STEP 1: Start the two Node.js servers (same codebase, different profiles)
:: ============================================================
echo  Starting Info server (port 3000, profile: info)...
echo  [1/4] Starting Info server... >> "%LOGFILE%"
start "QS Kiosk -- Overall Info" /min cmd /c "cd /d "%~dp0kiosk" && set PORT=3000& set QUICKSIGHT_PROFILE=info&& node server.js"

echo  Starting Stats server (port 3001, profile: stats)...
echo  [2/4] Starting Stats server... >> "%LOGFILE%"
start "QS Kiosk -- Stats per Department" /min cmd /c "cd /d "%~dp0kiosk" && set PORT=3001& set QUICKSIGHT_PROFILE=stats&& node server.js"

:: Give the servers time to start
echo  Waiting for servers to initialise...
timeout /t 5 /nobreak >nul

:: Check if servers actually started
echo.
echo  Checking if servers started...
echo  [3/4] Checking servers... >> "%LOGFILE%"
timeout /t 3 /nobreak >nul
netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  WARNING: Server on port 3000 did not start! >> "%LOGFILE%"
    echo.
    echo  WARNING: Server on port 3000 (Info) did not start.
    echo  Check the minimised server window for errors.
    echo.
) else (
    echo  OK: Server on port 3000 is running.
    echo  [OK] Port 3000 >> "%LOGFILE%"
)

timeout /t 3 /nobreak >nul
netstat -ano | findstr ":3001 " | findstr "LISTENING" >nul 2>&1
if %errorlevel% neq 0 (
    echo  WARNING: Server on port 3001 did not start! >> "%LOGFILE%"
    echo.
    echo  WARNING: Server on port 3001 (Stats) did not start.
    echo  Check the minimised server window for errors.
    echo.
) else (
    echo  OK: Server on port 3001 is running.
    echo  [OK] Port 3001 >> "%LOGFILE%"
)

echo.

:: ============================================================
::  STEP 2: Launch Chrome on each TV
:: ============================================================
if %CHROME%=="" (
    echo  Chrome not found. You must open these URLs manually:
    echo.
    echo    Info (top TV):    %MONITOR1_URL%
    echo    Stats (bottom TV): %MONITOR2_URL%
    echo.
    echo  Full log: %LOGFILE%
    echo.
    pause
    exit /b 0
)

echo  Opening Info on top TV...
echo  [4/4] Opening Chrome on Monitor 1... >> "%LOGFILE%"
start "" %CHROME% ^
    --kiosk %MONITOR1_URL% ^
    --window-position=%MONITOR1_X%,%MONITOR1_Y% ^
    --window-size=1920,1080 ^
    --no-first-run ^
    --no-default-browser-check ^
    --disable-infobars ^
    --disable-session-crashed-bubble ^
    --disable-background-networking ^
    --disable-restore-session-state ^
    --force-device-scale-factor=1

echo  Waiting for top TV to be ready...
timeout /t 6 /nobreak >nul

echo  Opening Stats on bottom TV...
echo  [OK] Opening Chrome on Monitor 2... >> "%LOGFILE%"
start "" %CHROME% ^
    --kiosk %MONITOR2_URL% ^
    --window-position=%MONITOR2_X%,%MONITOR2_Y% ^
    --window-size=1920,1080 ^
    --no-first-run ^
    --no-default-browser-check ^
    --disable-infobars ^
    --disable-session-crashed-bubble ^
    --disable-background-networking ^
    --disable-restore-session-state ^
    --force-device-scale-factor=1

echo.
echo  ================================================
echo   Both monitors should now be showing.
echo.
echo   To STOP: run STOP.bat  (or close this window)
echo.
echo   Server logs are in the minimised windows.
echo   Full launch log: %LOGFILE%
echo  ================================================
echo.

:: Keep this window open so the user can see status
pause
