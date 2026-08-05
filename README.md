# 🚀 1B Gemini Local Agent

> **An autonomous, zero-cost AI coding agent powered by Google Gemini (1 Billion+ Token Context), equipped with local terminal execution, filesystem access, live reasoning drawers, and session handoffs.**

---

## 🌟 Key Features

- **♾️ 1 Billion+ Token Context Window (Zero Cost)**: Leverages Google Gemini via reverse-engineered Web2API proxy. No per-token charges or credit limits.
- **🧠 Live Collapsible Thought Process Drawer**: Streams reasoning steps, tool selections, and step-by-step thinking in a sleek interactive UI drawer.
- **💻 Native Local System Access**:
  - `run_command`: Executes PowerShell terminal commands (install packages, build code, run scripts).
  - `write_file`: Directly creates or overwrites local code files on your system.
  - `read_file`: Reads workspace files.
  - `list_dir`: Shallow directory inspection (1-level deep, noise-filtered).
- **🔄 Session Handoff Engine (`handoff.py`)**: Seamlessly captures active conversation history from Antigravity/previous sessions so the local agent never starts from scratch.
- **🎨 Premium Google Gemini Dark UI**: Styled using modern Google Gemini design tokens, sparkling gradient logos, user profile DP, and smooth animations.
- **🎛️ Dynamic Model Selector**: Switch on-the-fly between:
  - `Gemini 3.6 Flash` *(Fast & Agentic)*
  - `Gemini 3.5 Flash Thinking` *(Deep Reasoning)*
  - `Gemini 3.1 Pro`
  - `Gemini Flash Lite`
- **⚡ Safe Execution Boundaries**: Enforces 15-second command timeouts, 2,500-character output truncation, and 40-item file listing caps to prevent hanging or deep recursive loops.
- **🖥️ 1-Click Desktop Launcher**: Launch proxy, handoff context, backend server, and open browser UI in one click via `master_launch.bat` or Desktop shortcut.

---

## 📁 Repository Structure

```
1B-gemini-Local-Agent/
├── gemini-chatbox/               # Agent Web Workspace & Backend
│   ├── index.html                # Premium Google Gemini Web UI
│   ├── style.css                 # Dark theme design system
│   ├── app.js                    # SSE streaming & Thought Process UI handler
│   ├── agent_backend.py          # Python Flask server & Native OpenAI tool loop
│   ├── handoff.py                # Context transcript extractor & handoff manager
│   ├── master_launch.bat         # Master 1-click execution script
│   └── handoff.bat               # Terminal handoff script
├── gemini-web2api/               # Reverse-Engineered Gemini Web Proxy Server
│   ├── gemini_web2api.py         # Main OpenAI-compatible proxy server (Port 8081)
│   ├── config.json               # Proxy server configuration
│   └── start_server.bat          # Standalone proxy launch script
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start

### 1. Requirements
- Python 3.8+
- Dependencies: `pip install flask flask-cors openai httpx`

### 2. One-Click Launch (Recommended)
Simply double-click **`master_launch.bat`** (or your Desktop shortcut).

It will automatically:
1. Check if `gemini-web2api` proxy is running on port `8081` (and launch it in background if off).
2. Extract and package conversation context (`handoff.py`).
3. Boot up the Agent Backend on port `5000`.
4. Open the Gemini Agent UI directly in your browser.

---

## 🛠️ Manual Start (Optional)

If you prefer to start components manually in separate terminals:

**Terminal 1: Start Web2API Proxy**
```powershell
cd gemini-web2api
python gemini_web2api.py
```

**Terminal 2: Run Agent Handoff & Backend**
```powershell
cd gemini-chatbox
python handoff.py
python agent_backend.py
```

Open `gemini-chatbox/index.html` in your browser.

---

## 🤝 System Architecture

```
┌──────────────────────────┐        SSE Stream        ┌──────────────────────────┐
│   Gemini Web UI          │ ◄──────────────────────► │   Agent Backend (Flask)  │
│   (index.html / app.js)  │                          │   (agent_backend.py:5000)│
└──────────────────────────┘                          └────────────┬─────────────┘
                                                                   │
                                                                   │ Native OpenAI Tools
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │  Gemini Web2API Proxy    │
                                                      │  (gemini_web2api.py:8081)│
                                                      └────────────┬─────────────┘
                                                                   │
                                                                   │ Reverse-Engineered Web RPC
                                                                   ▼
                                                      ┌──────────────────────────┐
                                                      │   Google Gemini Web      │
                                                      │   (gemini.google.com)    │
                                                      └──────────────────────────┘
```

---

## 📜 License

MIT License. Free for open-source & personal development.
