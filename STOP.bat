@echo off
title QuickSight Kiosk — Stopping
color 0C
echo.
echo  Stopping QuickSight Kiosk servers...
echo.

:: Kill Node.js server processes
taskkill /fi "WindowTitle eq QS Kiosk -- Overall Info" /f >nul 2>&1
taskkill /fi "WindowTitle eq QS Kiosk -- Stats per Department" /f >nul 2>&1

:: Also catch any stray node processes on our ports (in case titles changed)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /pid %%p /f >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    taskkill /pid %%p /f >nul 2>&1
)

echo  Servers stopped.
echo.
echo  Note: Chrome kiosk windows must be closed manually.
echo  Press Alt+F4 on each monitor, or press Ctrl+Alt+Delete
echo  if the keyboard is unresponsive in kiosk mode.
echo.
timeout /t 3 /nobreak >nul
