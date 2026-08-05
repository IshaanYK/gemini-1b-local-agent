@echo off
title Gemini Agent Launcher
cd /d "%~dp0"

echo ====================================================
echo             STARTING GEMINI AGENT
echo ====================================================

:: Check if gemini-web2api proxy is running on port 8081
netstat -ano | findstr :8081 >nul
if %errorlevel% neq 0 (
    echo Starting Gemini Web2API Proxy Server in background...
    start /min "Gemini Web2API Proxy" cmd /k "cd /d \"C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-web2api\" && python gemini_web2api.py"
    timeout /t 3 >nul
) else (
    echo [OK] Gemini Web2API Proxy is already active on port 8081.
)

echo.
echo Packaging conversation context...
python handoff.py

echo.
echo ====================================================
echo  Gemini Agent is now ACTIVE on http://localhost:5000
echo  Keep this window open while chatting in browser.
echo ====================================================
echo.

python agent_backend.py
pause
