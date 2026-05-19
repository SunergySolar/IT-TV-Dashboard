@echo off
title QuickSight Kiosk — Setup
color 0A
echo.
echo  ================================================
echo   QuickSight Kiosk — First-Time Setup
echo  ================================================
echo.

:: Check Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: Node.js is not installed.
    echo.
    echo  Please install it from https://nodejs.org
    echo  Choose the "LTS" version, then re-run this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  Node.js found: %NODE_VER%
echo.

:: Install monitor 1 dependencies
echo  [1/4] Installing Monitor 1 dependencies...
cd /d "%~dp0monitor1"
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: npm install failed for Monitor 1.
    pause
    exit /b 1
)
echo        Done.

:: Install monitor 2 dependencies
echo  [2/4] Installing Monitor 2 dependencies...
cd /d "%~dp0monitor2"
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: npm install failed for Monitor 2.
    pause
    exit /b 1
)
echo        Done.

:: Copy .env files if they don't exist yet
echo  [3/4] Creating .env files...
cd /d "%~dp0monitor1"
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo        monitor1\.env created — FILL THIS IN before starting.
) else (
    echo        monitor1\.env already exists, skipping.
)

cd /d "%~dp0monitor2"
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo        monitor2\.env created — FILL THIS IN before starting.
) else (
    echo        monitor2\.env already exists, skipping.
)

echo  [4/4] Setup complete.
echo.
echo  ================================================
echo   Next steps:
echo  ================================================
echo.
echo   1. Open monitor1\.env  ^& fill in your AWS credentials
echo   2. Open monitor2\.env  ^& fill in your AWS credentials
echo   3. Open monitor1\config.js  ^& add your dashboard IDs
echo   4. Open monitor2\config.js  ^& add your 13 tab IDs
echo   5. Run START.bat to launch both monitors
echo.
pause
