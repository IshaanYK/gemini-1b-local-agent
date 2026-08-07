@echo off
title Gemini Agent — Full Stack Launcher
color 0A
cls

echo.
echo  ============================================
echo       GEMINI LOCAL AGENT — STARTING UP
echo  ============================================
echo.

set "PROXY_DIR=C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-web2api"
set "CHATBOX_DIR=C:\Users\ISHAAN SEN\.gemini\antigravity-ide\scratch\gemini-chatbox"

:: Check if proxy (8081) is already running
netstat -ano | findstr ":8081 " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo  [1/3] ^> Proxy  port 8081 already ACTIVE. Skipping.
) else (
    echo  [1/3] ^> Starting gemini_web2api proxy on port 8081...
    start "Gemini Web2API Proxy :8081" cmd /k "cd /d "%PROXY_DIR%" && python gemini_web2api.py"
    timeout /t 4 /nobreak >nul
    echo        Proxy window launched.
)

:: Check if agent backend (5000) is already running
netstat -ano | findstr ":5000 " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo  [2/3] ^> Backend port 5000 already ACTIVE. Skipping.
) else (
    echo  [2/3] ^> Starting agent_backend on port 5000...
    start "Gemini Agent Backend :5000" cmd /k "cd /d "%CHATBOX_DIR%" && python agent_backend.py"
    timeout /t 3 /nobreak >nul
    echo        Backend window launched.
)

:: Open the UI in browser
echo  [3/3] ^> Opening chatbox in browser...
timeout /t 2 /nobreak >nul
start "" "%CHATBOX_DIR%\index.html"

echo.
echo  ============================================
echo   ALL SYSTEMS GO. Close this window anytime.
echo  ============================================
echo.
echo   Web2API Proxy  : http://localhost:8081
echo   Agent Backend  : http://localhost:5000
echo   Chat UI        : file://...index.html
echo.
pause
