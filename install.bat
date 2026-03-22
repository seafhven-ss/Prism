@echo off
setlocal
set "THIS_BAT=%~f0"
set "PRISM_DIR=%~dp0"
set "PRISM_DIR_NORM=%~dp0"
if "%PRISM_DIR_NORM:~-1%"=="\" set "PRISM_DIR_NORM=%PRISM_DIR_NORM:~0,-1%"

if /i not "%~1"=="--hosted" (
    start "Prism Installer" "%ComSpec%" /c call "%THIS_BAT%" --hosted %*
    exit /b
)
shift

chcp 65001 >nul
title Prism Installer
cls

set "RUNTIME_DIR=%PRISM_DIR%runtime"
set "BRIDGE_DIR=%RUNTIME_DIR%\installer-bridge"

if exist "%RUNTIME_DIR%\node\node.exe" (
    set "PATH=%RUNTIME_DIR%\node;%PATH%"
    goto has_node
)

where node >nul 2>&1
if %errorlevel% equ 0 goto has_node

echo.
echo   Preparing Node.js ...
echo.
mkdir "%RUNTIME_DIR%\node" 2>nul
curl -L -# -o "%RUNTIME_DIR%\node-dl.zip" "https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip"
if %errorlevel% neq 0 (
    echo.
    echo   Node.js download failed. Please install it manually:
    echo   https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo   Extracting Node.js ...
powershell -NoProfile -Command "Expand-Archive -Path '%RUNTIME_DIR%\node-dl.zip' -DestinationPath '%RUNTIME_DIR%\node-tmp' -Force"
for /d %%d in ("%RUNTIME_DIR%\node-tmp\node-*") do xcopy "%%d\*" "%RUNTIME_DIR%\node\" /E /Y /Q >nul
rd /s /q "%RUNTIME_DIR%\node-tmp" 2>nul
del "%RUNTIME_DIR%\node-dl.zip" 2>nul
if not exist "%RUNTIME_DIR%\node\node.exe" (
    echo   Node.js extract failed.
    pause
    exit /b 1
)
set "PATH=%RUNTIME_DIR%\node;%PATH%"

:has_node
cd /d "%PRISM_DIR%"

mkdir "%BRIDGE_DIR%" 2>nul
del /q "%BRIDGE_DIR%\launch-napcat.req" "%BRIDGE_DIR%\launch-napcat.ack" "%BRIDGE_DIR%\launch-prism.req" "%BRIDGE_DIR%\launch-prism.ack" "%BRIDGE_DIR%\stop.req" 2>nul
powershell -NoProfile -Command "$projectDir = \"%PRISM_DIR_NORM%\"; $scriptPath = Join-Path $projectDir 'installer-bridge.ps1'; Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',$scriptPath,'-ProjectDir',$projectDir) -WindowStyle Hidden" >nul

node "%PRISM_DIR%installer.mjs" %*
set "NODE_EXIT=%ERRORLEVEL%"

> "%BRIDGE_DIR%\stop.req" echo stop
exit /b %NODE_EXIT%
