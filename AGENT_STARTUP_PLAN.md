# 📋 Agent Startup & Clone Health SOP: Execution Plan for B1 Gemini Local Agent

This document defines the **Standard Operating Procedure (SOP)** and autonomous diagnostic protocol for any AI agent or engineer cloning **B1 Gemini Local Agent** on a new machine. Follow these sequential phases to guarantee zero-defect startup, avoid known network/port errors, and achieve immediate operational readiness.

---

## 🏛️ System Architecture Topology

B1 operates on a decoupled, two-tier architecture:

```
┌────────────────────────────────────────────────────────┐
│             Web UI / Workspace (Browser)               │
│                  http://127.0.0.1:5000                 │
└───────────────────────────▲────────────────────────────┘
                            │ SSE Stream / JSON RPC
┌───────────────────────────▼────────────────────────────┐
│          Flask Agent Backend (agent_backend.py)        │
│                        Port: 5000                      │
│   - Self-RAG Query Analyzer                            │
│   - Memory & Profile Store (core/memory_manager.py)     │
│   - Local Tool Engine (PowerShell, File R/W, AST Graph)│
│   - Grounding Guardian & Epistemic Audit               │
└───────────────────────────▲────────────────────────────┘
                            │ OpenAI Protocol (/v1)
┌───────────────────────────▼────────────────────────────┐
│      Gemini Web2API Reverse Proxy (gemini_web2api.py)  │
│                        Port: 8081                      │
│   - Zero-Auth RPC Stream Engine                        │
│   - Models: gemini-2.0-flash, gemini-2.0-pro-exp       │
│   - Optional Gemini Session Cookies / Direct API       │
└────────────────────────────────────────────────────────┘
```

---

## ⚡ The 6-Phase Agent Startup Plan

### Phase 1: Environment & Port Pre-Flight Check

Before launching services, check for port collisions and stale background processes.

1. **Verify Python Runtime**:
   ```bash
   python --version
   ```
   *Requirement*: Python 3.9 through 3.12 (64-bit).

2. **Inspect Port Availability (5000 and 8081)**:
   ```powershell
   # Windows PowerShell
   Get-NetTCPConnection -LocalPort 5000, 8081 -State Listen -ErrorAction SilentlyContinue
   ```
   - If ports are occupied by stale instances from previous runs:
     ```powershell
     # Terminate stale listeners if needed
     Get-Process -Name python, pythonw -ErrorAction SilentlyContinue | Stop-Process -Force
     ```

---

### Phase 2: Dependency & Configuration Scaffolding

Ensure all local configuration files, permissions, and dependencies exist before boot.

1. **Install Python Packages**:
   ```bash
   pip install -r requirements.txt
   ```
   *Critical packages*: `flask`, `flask-cors`, `openai`, `httpx`, `requests`, `beautifulsoup4`, `sentence-transformers`, `edge-tts`, `pypdf`.

2. **Scaffold `.env` File**:
   If `.env` does not exist, copy from template:
   ```bash
   copy .env.example .env
   ```
   *Default settings*:
   ```env
   BACKEND_PORT=5000
   PROXY_PORT=8081
   GEMINI_COOKIES=
   GEMINI_API_KEY=
   ```

3. **Scaffold Proxy `config.json`**:
   ```bash
   copy gemini-web2api\config.example.json gemini-web2api\config.json
   ```

4. **Initialize Tool Permissions**:
   The agent requires local filesystem and execution permissions. Ensure `gemini-chatbox/permissions.json` exists:
   ```json
   {
     "granted": true,
     "permissions": {
       "read_files": true,
       "write_files": true,
       "run_commands": true,
       "list_directories": true,
       "search_files": true
     },
     "version": "2.0"
   }
   ```

---

### Phase 3: Service Startup Sequence (Strict Order)

> [!IMPORTANT]
> **Strict Launch Order**: The Web2API Proxy (:8081) MUST be listening before the Flask Backend (:5000) initializes, otherwise client connections fail during handshake.

1. **Step 1: Launch Web2API Proxy (Port 8081)**:
   ```bash
   cd gemini-web2api
   python gemini_web2api.py
   ```
   *Verification*: Wait until port 8081 is listening:
   ```bash
   curl -s http://127.0.0.1:8081/v1/models
   ```
   Expected response: JSON listing `gemini-2.0-flash`, `gemini-2.0-pro-exp`, etc.

2. **Step 2: Launch Agent Backend (Port 5000)**:
   ```bash
   cd gemini-chatbox
   python agent_backend.py
   ```
   *Verification*: Verify backend responds:
   ```bash
   curl -s http://127.0.0.1:5000/api/permission-status
   ```

3. **Step 3: Open Browser UI**:
   Navigate to:
   ```
   http://127.0.0.1:5000/
   ```

---

### Phase 4: First-Time User Onboarding Calibration

When a user clones the repository for the first time:
1. `gemini-chatbox/storage/user_profile.json` does not exist initially.
2. The UI automatically displays the **1-Minute Developer Calibration Modal**:
   - **Developer Identity**: Name, title/role (e.g. Lead Architect, Fullstack Engineer).
   - **Primary Tech Stack**: Pre-selects preferred technologies (Python, TypeScript, React, etc.).
   - **Design Aesthetic Theme**: Choose from Linear Obsidian, Stripe Clean, Apple Glassmorphic, or Monochrome Slate.
   - **Autonomy Level**: ReAct autonomous tool loop approval.
3. Upon completion, the profile is saved to `storage/user_profile.json` and mirrored in SQLite memory for continuous personalization.

---

### Phase 5: Common Clone Pitfalls & Autonomous Fixes

| Symptom / Error | Root Cause | Autonomous Resolution SOP |
| :--- | :--- | :--- |
| **`Execution Error: network error` in chat UI** | Unhandled exception inside `/api/chat` streaming generator or closed socket. | 1. Check `backend.log`.<br>2. Ensure `core/memory_manager.py` exports `profile = memory.profile`.<br>3. Verify port 8081 proxy is running and responding. |
| **`Connection Refused: 127.0.0.1:8081`** | Web2API proxy is stopped or crashed. | Restart proxy: `cd gemini-web2api && python gemini_web2api.py`. |
| **`Address already in use: 5000`** | Stale Python process holding port. | Run `Get-NetTCPConnection -LocalPort 5000 \| Select-Object OwningProcess` and kill the PID. |
| **`ModuleNotFoundError: No module named 'flask'`** | Virtualenv not active or dependencies missing. | Run `pip install -r requirements.txt`. |
| **Onboarding modal doesn't appear** | Stale local profile or browser cache. | Clear browser `localStorage` or delete `gemini-chatbox/storage/user_profile.json` to trigger onboarding. |
| **Desktop shortcut missing** | Newly cloned repo without shortcut run. | Run `SETUP.bat` or the PowerShell shortcut generator script. |

---

### Phase 6: Automated Self-Test Script

An AI agent or user can verify the entire stack automatically by running `check_health.py` from the root directory:

```bash
python check_health.py
```

This automated validator inspects:
- [x] Python version & dependency imports
- [x] `.env` and `config.json` presence
- [x] Tool permission grants
- [x] Proxy connectivity (:8081)
- [x] Backend connectivity (:5000)
- [x] End-to-end model completion test

---

## 🛠️ 1-Click Startup Scripts Reference

- **`START_AGENT.bat`**: Starts Web2API proxy, launches backend, and opens default browser in 1 click.
- **`SETUP.bat`**: First-time setup — installs `requirements.txt`, creates `.env`, and configures tool permissions.
- **`Launch_Gemini_Agent.bat`**: Alternate background launcher with context handoff.
