@echo off
title My Expenses
cd /d "%~dp0"

rem Already running: just open it in the browser.
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 3100)).Close(); exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" http://localhost:3100
  exit /b 0
)

if not exist ".next\BUILD_ID" call npm run build || goto stopped

echo My Expenses is starting. Your browser opens it when it is ready.
echo Keep this window open while you use the app. Minimized is fine; closing it stops the app.
echo.
rem Opens the browser once the app accepts connections, while npm start runs in this window.
start "" /b powershell -NoProfile -Command "for ($i = 0; $i -lt 120; $i++) { try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 3100)).Close(); Start-Process 'http://localhost:3100'; exit } catch { Start-Sleep -Milliseconds 500 } }"
call npm start

:stopped
echo.
echo My Expenses has stopped. Press any key to close this window.
pause >nul
