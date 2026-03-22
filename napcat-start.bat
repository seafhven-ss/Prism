@echo off
setlocal
chcp 65001 >nul
title NapCat

set "PRISM_DIR=%~dp0"
set "NAPCAT_DIR=%PRISM_DIR%runtime\napcat"

:: Prefer our generated launcher (has hardcoded QQ path)
if exist "%NAPCAT_DIR%\prism-napcat.bat" (
    powershell -NoProfile -Command "$batch = \"%NAPCAT_DIR%\prism-napcat.bat\"; $cwd = \"%NAPCAT_DIR%\"; Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k','call',$batch) -WorkingDirectory $cwd"
    goto :eof
)

:: Fallback to original launcher
if exist "%NAPCAT_DIR%\launcher-user.bat" (
    powershell -NoProfile -Command "$batch = \"%NAPCAT_DIR%\launcher-user.bat\"; $cwd = \"%NAPCAT_DIR%\"; Start-Process -FilePath 'cmd.exe' -ArgumentList @('/k','call',$batch) -WorkingDirectory $cwd"
    goto :eof
)

echo   未找到 NapCat，请先运行 install.bat。
pause
