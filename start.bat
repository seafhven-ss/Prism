@echo off
setlocal
chcp 65001 >nul
title Prism

set "PRISM_DIR=%~dp0"
set "RUNTIME_DIR=%PRISM_DIR%runtime"
set "PATH=%PRISM_DIR%bin;%PATH%"

if exist "%RUNTIME_DIR%\python\python.exe" (
    set "PATH=%RUNTIME_DIR%\python;%RUNTIME_DIR%\python\Scripts;%PATH%"
)

if exist "%RUNTIME_DIR%\node\node.exe" (
    set "PATH=%RUNTIME_DIR%\node;%PATH%"
)

where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   Node.js not found. Run install.bat first.
    echo.
    pause
    exit /b 1
)

where kimi >nul 2>&1
if errorlevel 1 (
    echo.
    echo   KIMI CLI not found. Run install.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "%PRISM_DIR%.env" (
    echo.
    echo   Config not found. Run install.bat first.
    echo.
    pause
    exit /b 1
)

if not exist "%PRISM_DIR%dist\index.js" (
    echo.
    echo   Runtime files are missing. Reinstall Prism.
    echo.
    pause
    exit /b 1
)

if not exist "%PRISM_DIR%node_modules\ws" (
    echo.
    echo   Runtime dependency ws is missing. Reinstall Prism.
    echo.
    pause
    exit /b 1
)

if not exist "%RUNTIME_DIR%\napcat\prism-napcat.bat" (
    echo.
    echo   NapCat launcher not found. Run install.bat first.
    echo.
    pause
    exit /b 1
)

cd /d "%PRISM_DIR%"

powershell -NoProfile -Command "$client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1',3001); $client.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo.
    echo   Starting NapCat ...
    echo.
    call "%PRISM_DIR%napcat-start.bat"
) else (
    echo.
    echo   NapCat is already running.
    echo.
)

echo.
echo   Starting Prism ...
echo.
call node ".\dist\index.js"

echo.
echo   Prism stopped. Press any key to exit.
pause >nul
