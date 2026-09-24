@echo off
title Gemini Agent Launcher
cd /d "%~dp0"

echo ====================================================
echo             STARTING GEMINI LOCAL AGENT
echo ====================================================

set "ROOT_DIR=%~dp0"
set "PROXY_DIR=%ROOT_DIR%gemini-web2api"
set "CHATBOX_DIR=%ROOT_DIR%gemini-chatbox"

:: Auto-detect Python executable
set "PYTHON_EXE=python"
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if exist "C:\Program Files\Python311\python.exe" set "PYTHON_EXE=C:\Program Files\Python311\python.exe"
if exist "C:\Program Files\Python312\python.exe" set "PYTHON_EXE=C:\Program Files\Python312\python.exe"

:: Auto-grant permissions if fresh clone
set "PERM_FILE=%CHATBOX_DIR%\permissions.json"
set "STORAGE_PERM=%CHATBOX_DIR%\storage\permissions.json"
if not exist "%PERM_FILE%" (
    if not exist "%CHATBOX_DIR%\storage" mkdir "%CHATBOX_DIR%\storage" >nul 2>&1
    (
        echo {
        echo   "granted": true,
        echo   "permissions": {
        echo     "read_files": true,
        echo     "write_files": true,
        echo     "run_commands": true,
        echo     "list_directories": true,
        echo     "search_files": true
        echo   },
        echo   "version": "2.0"
        echo }
    ) > "%PERM_FILE%"
    copy "%PERM_FILE%" "%STORAGE_PERM%" >nul 2>&1
)

:: Step 1: Ensure Web2API proxy is running on 8081 with latest models
netstat -ano | findstr :8081 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [1/3] Proxy port 8081 already active.
) else (
    echo [1/3] Starting Gemini Web2API Proxy on port 8081...
    start "Gemini Web2API Proxy :8081" /b cmd /c "cd /d "%PROXY_DIR%" && "%PYTHON_EXE%" gemini_web2api.py"
    :: Poll up to 6 seconds for port 8081 readiness
    for /l %%i in (1,1,6) do (
        netstat -ano | findstr :8081 | findstr LISTENING >nul
        if %errorlevel% equ 0 goto proxy_ready
        timeout /t 1 >nul
    )
    :proxy_ready
    echo       Proxy ready.
)

:: Step 2: Handoff context & launch browser UI
echo [2/3] Extracting conversation context...
cd /d "%CHATBOX_DIR%"
"%PYTHON_EXE%" handoff.py

:: Step 3: Run Flask Agent Backend
echo [3/3] Agent Backend active at http://127.0.0.1:5000
echo.
"%PYTHON_EXE%" agent_backend.py
pause
