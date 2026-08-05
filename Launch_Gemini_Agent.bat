@echo off
title 1B Gemini Local Agent Launcher
cd /d "%~dp0"

echo ====================================================
echo             STARTING 1B GEMINI LOCAL AGENT
echo ====================================================

:: Check if gemini-web2api proxy is running on port 8081
netstat -ano | findstr :8081 >nul
if %errorlevel% neq 0 (
    echo Starting Gemini Web2API Proxy Server in background...
    start /min "Gemini Web2API Proxy" cmd /k "cd /d \"%~dp0gemini-web2api\" && python gemini_web2api.py"
    timeout /t 3 >nul
) else (
    echo [OK] Gemini Web2API Proxy is active on port 8081.
)

echo.
cd /d "%~dp0gemini-chatbox"
echo Packaging conversation context...
python handoff.py

echo.
echo ====================================================
echo  Gemini Agent is ACTIVE on http://localhost:5000
echo  Keep this window open while chatting in browser.
echo ====================================================
echo.

python agent_backend.py
pause
