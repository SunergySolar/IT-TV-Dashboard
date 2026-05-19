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

:: Install dependencies once
echo  [1/3] Installing dependencies...
cd /d "%~dp0kiosk"
call npm install --silent
if %errorlevel% neq 0 (
    color 0C
    echo  ERROR: npm install failed.
    pause
    exit /b 1
)
echo        Done.

:: Copy .env.example -> .env if it doesn't exist
echo  [2/3] Creating .env file...
cd /d "%~dp0kiosk"
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo        .env created — FILL THIS IN before starting.
) else (
    echo        .env already exists, skipping.
)

echo  [3/3] Setup complete.
echo.
echo  ================================================
echo   Next steps:
echo  ================================================
echo.
echo   1. Open kiosk\.env  ^& fill in your AWS credentials
echo   2. Open kiosk\config.js  ^& edit profiles if needed
echo   3. Run START.bat to launch both monitors
echo.
pause
