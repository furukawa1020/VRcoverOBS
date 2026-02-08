@echo off
cd /d "%~dp0"
echo ==========================================
echo Starting VRabater Gateway...
echo ==========================================
node index.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gateway crashed with exit code %ERRORLEVEL%
    pause
)
pause
