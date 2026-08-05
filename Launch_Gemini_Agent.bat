@echo off
title Gemini Agent Launcher
cd /d "%~dp0"

echo ====================================================
echo             STARTING GEMINI LOCAL AGENT
echo ====================================================

set "ROOT_DIR=%~dp0"
if exist "%ROOT_DIR%gemini-web2api\gemini_web2api.py" (
    set "PROXY_DIR=%ROOT_DIR%gemini-web2api"
    set "CHATBOX_DIR=%ROOT_DIR%gemini-chatbox"
) else (
    set "PROXY_DIR=C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-web2api"
    set "CHATBOX_DIR=C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-chatbox"
)

:: Step 1: Ensure Web2API proxy is running on 8081
netstat -ano | findstr :8081 >nul
if %errorlevel% neq 0 (
    echo [1/3] Starting Gemini Web2API Proxy...
    start /b "" python "%PROXY_DIR%\gemini_web2api.py"
    timeout /t 3 >nul
) else (
    echo [1/3] Proxy server is active on port 8081.
)

:: Step 2: Handoff context & launch browser UI
echo [2/3] Extracting conversation context...
cd /d "%CHATBOX_DIR%"
python handoff.py

:: Step 3: Run Flask Agent Backend
echo [3/3] Agent Backend active at http://localhost:5000
echo.
python agent_backend.py
pause
