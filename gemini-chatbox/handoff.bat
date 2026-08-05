@echo off
cd /d "%~dp0"
echo Packaging context and opening browser...
python handoff.py
echo Starting Gemini Agent Backend on http://localhost:5000...
python agent_backend.py
pause
