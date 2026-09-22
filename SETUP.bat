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
echo  [1/3] Installing Python dependencies (Flask, OpenAI, HTTPX, Sentence-Transformers, Edge-TTS)...
pip install flask flask-cors openai httpx sentence-transformers edge-tts 2>nul
if %errorlevel% neq 0 (
    echo.
    echo  ERROR: pip install failed. Make sure Python is installed and in PATH.
    pause
    exit /b 1
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
    echo   Optional: Open .env and add your Gemini cookies for better
    echo   performance. Leave blank to use the free anonymous proxy.
    echo  ================================================================
    echo.
)

:: ── Step 3: Create permissions.json (first-time consent) ─────────────────
set "PERM_FILE=%~dp0gemini-chatbox\permissions.json"
if exist "%PERM_FILE%" (
    echo  [3/3] Permissions already configured.
) else (
    echo  [3/3] Setting up user permissions...
    echo  You will be asked to grant permissions the first time you run the agent.
)

echo.
echo  ============================================================
echo   Setup complete! Double-click START_AGENT.vbs to launch.
echo  ============================================================
echo.
pause
