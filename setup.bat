@echo off
setlocal
set "THIS_BAT=%~f0"
set "PRISM_DIR=%~dp0"

if /i not "%~1"=="--hosted" (
    start "Prism Configure" "%ComSpec%" /c call "%THIS_BAT%" --hosted %*
    exit /b
)
shift

chcp 65001 >nul
title Prism Configure
cls

set "RUNTIME_DIR=%PRISM_DIR%runtime"

if exist "%RUNTIME_DIR%\node\node.exe" (
    set "PATH=%RUNTIME_DIR%\node;%PATH%"
    goto run
)

where node >nul 2>&1
if %errorlevel% equ 0 goto run

echo   Node.js not found. Run install.bat first.
pause
exit /b 1

:run
cd /d "%PRISM_DIR%"
node "%PRISM_DIR%installer.mjs" --configure-only
