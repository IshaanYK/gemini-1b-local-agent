@echo off
title Gemini Agent — Full Stack Launcher
color 0A
cls

echo.
echo  ============================================
echo       GEMINI LOCAL AGENT — STARTING UP
echo  ============================================
echo.

set "PROXY_DIR=%~dp0..\gemini-web2api"
set "CHATBOX_DIR=%~dp0"

:: Auto-detect Python
set "PYTHON_EXE=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if exist "C:\Program Files\Python311\python.exe" set "PYTHON_EXE=C:\Program Files\Python311\python.exe"

:: Check if proxy (8081) is already running
netstat -ano | findstr ":8081 " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo  [1/3] ^> Proxy  port 8081 already ACTIVE. Skipping.
) else (
    echo  [1/3] ^> Starting gemini_web2api proxy on port 8081...
    start "Gemini Web2API Proxy :8081" cmd /k "cd /d "%PROXY_DIR%" && "%PYTHON_EXE%" gemini_web2api.py"
    ping 127.0.0.1 -n 4 >nul
    echo        Proxy window launched.
)

:: Check if agent backend (5000) is already running
netstat -ano | findstr ":5000 " | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo  [2/3] ^> Backend port 5000 already ACTIVE. Skipping.
) else (
    echo  [2/3] ^> Starting agent_backend on port 5000...
    start "Gemini Agent Backend :5000" cmd /k "cd /d "%CHATBOX_DIR%" && "%PYTHON_EXE%" agent_backend.py"
    ping 127.0.0.1 -n 3 >nul
    echo        Backend window launched.
)

:: Open the UI in browser
echo  [3/3] ^> Opening chatbox in browser...
ping 127.0.0.1 -n 2 >nul
start "" "http://127.0.0.1:5000"

echo.
echo  ============================================
echo   ALL SYSTEMS GO. Close this window anytime.
echo  ============================================
echo.
echo   Web2API Proxy  : http://127.0.0.1:8081
echo   Agent Backend  : http://127.0.0.1:5000
echo   Chat UI        : http://127.0.0.1:5000
echo.
pause
