@echo off
title Gemini 1B Agent — First-Time Setup
color 0B
cls

echo.
echo  ============================================================
echo    Gemini 1B Local Agent — First-Time Setup
echo  ============================================================
echo.

:: ── Step 1: Install Python dependencies ──────────────────────────────────
echo  [1/3] Installing Python dependencies from requirements.txt...
pip install -r "%~dp0requirements.txt"
if %errorlevel% neq 0 (
    echo.
    echo  Retrying with individual critical packages...
    pip install flask flask-cors openai httpx requests beautifulsoup4 sentence-transformers edge-tts pypdf
    if %errorlevel% neq 0 (
        echo.
        echo  ERROR: pip install failed. Make sure Python 3.9+ is installed and added to PATH.
        pause
        exit /b 1
    )
)
echo         Done.
echo.

:: ── Step 2: Create .env file if not exists ────────────────────────────────
set "ENV_FILE=%~dp0.env"
if exist "%ENV_FILE%" (
    echo  [2/3] .env file already exists. Skipping.
) else (
    echo  [2/3] Creating your .env configuration file...
    copy "%~dp0.env.example" "%ENV_FILE%" >nul
    echo.
    echo  ================================================================
    echo   Ready! Zero API keys required - uses free Gemini Web2API proxy.
    echo   Optional: You can add GEMINI_API_KEY in .env for turbo speed.
    echo  ================================================================
    echo.
)

if not exist "%~dp0gemini-web2api\config.json" (
    if exist "%~dp0gemini-web2api\config.example.json" (
        copy "%~dp0gemini-web2api\config.example.json" "%~dp0gemini-web2api\config.json" >nul 2>&1
    )
)

:: ── Step 3: Create permissions.json (first-time consent) ─────────────────
set "PERM_FILE=%~dp0gemini-chatbox\permissions.json"
set "STORAGE_PERM=%~dp0gemini-chatbox\storage\permissions.json"
if exist "%PERM_FILE%" (
    echo  [3/3] Local tool permissions already configured.
) else (
    echo  [3/3] Enabling local agent tool permissions (run commands, file read/write)...
    if not exist "%~dp0gemini-chatbox\storage" mkdir "%~dp0gemini-chatbox\storage" >nul 2>&1
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
    echo         Done.
)

echo.
echo  ============================================================
echo   Setup complete! Launch the agent using:
echo     - Double-click Launch_Gemini_Agent.bat (Recommended)
echo     - Or gemini-chatbox\START_AGENT.bat
echo  ============================================================
echo.
pause
