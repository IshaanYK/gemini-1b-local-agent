<p align="center">
  <img src="hero_banner.gif" width="100%" alt="1B Gemini Local Agent Banner">
</p>

<p align="center">
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent/stargazers"><img src="https://img.shields.io/github/stars/IshaanYK/gemini-1b-local-agent?style=for-the-badge&logo=github&color=gold" alt="GitHub Stars"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/Context-1B%2B%20Tokens-purple?style=for-the-badge&logo=google" alt="Context"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/Cost-Zero%20%240-brightgreen?style=for-the-badge" alt="Cost"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/Gemini-3.8%20Pro%20%2F%20Deep%20Reasoning-blue?style=for-the-badge&logo=google-gemini" alt="Model"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/API%20Keys-None%20Required-success?style=for-the-badge" alt="No API Keys"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/Skills-74%20Built--in-orange?style=for-the-badge" alt="Skills"></a>
  <a href="https://github.com/IshaanYK/gemini-1b-local-agent"><img src="https://img.shields.io/badge/License-MIT-red?style=for-the-badge" alt="License"></a>
</p>

> ⭐ **If you find this project useful or interesting, please give it a Star on GitHub!** It takes 1 second and helps keep development 100% free and open-source.

---

# 🚀 1B Gemini Local Agent

> **An autonomous, zero-cost AI coding agent powered by Google Gemini 3.8 Pro with Deep Reasoning (1 Billion+ Token Context), equipped with 6 local system tools, 74 design & engineering skills, Apple HIG UI, live reasoning drawers, and 1-click desktop launching — completely unlimited without API keys.**

---

## 🆚 Why 1B Gemini Agent vs Other Assistants?

| Feature | 🚀 1B Gemini Local Agent | Claude Code | Cursor | Cline |
| :--- | :---: | :---: | :---: | :---: |
| **Model & Intelligence** | **Gemini 3.8 Pro (Deep Reasoning)** | Claude 3.7 Sonnet | Claude 3.5 / GPT-4o | Model dependent |
| **Monthly Cost** | **$0 (100% Free)** | $20 – $100+/mo | $20/mo | BYOK API costs |
| **API Keys Needed** | **None (Unlimited Web Proxy)** | Yes ($$$) | Yes ($$$) | Yes ($$$) |
| **Context Window** | **1 Billion+ Tokens** | 200k Tokens | 128k – 200k Tokens | Model dependent |
| **Local Tool Execution** | **Native OS / PowerShell** | Bash / CLI | In-editor only | Extension sandbox |
| **Design Framework** | **Apple HIG & Glassmorphism** | CLI Terminal | VS Code Native | Webview |
| **Agentic Loops** | **Up to 10 Autonomous Steps** | Agent Loop | Composer | Agent loop |
| **Built-in Skills** | **74 Curated UI/UX & Tech Skills** | None (Prompts only) | Rules files | Rules files |
| **1-Click Launch** | **Desktop Launcher (.bat)** | Terminal command | App launch | VS Code install |

---

## 🌟 Key Features

- **🧠 Gemini 3.8 Pro with Unlimited Deep Reasoning**: Full chain-of-thought thinking and reasoning capability with live thought-process drawers in the UI.
- **🔓 100% Unlimited Without API Keys**: Interfaces with Gemini Web via an OpenAI-compatible Web2API proxy. Zero billing, no credit exhaustion, no per-token charges.
- **♾️ 1 Billion+ Token Context Window (Zero Cost)**: Ingest entire codebases and massive document sets without hitting context barriers.
- **⚡ 10-Step Autonomous Agentic Loop**: Automatically chains up to 10 consecutive tool actions per turn (`Create file` ➔ `Write code` ➔ `Run PowerShell command` ➔ `Verify output`).
- **💻 6 Native Local System Tools**:
  - `run_command`: Executes PowerShell terminal commands (install packages, build code, run scripts).
  - `write_file`: Directly creates or overwrites local code files on your system.
  - `replace_file_content`: Modifies existing code in-place without rewriting full files.
  - `grep_search`: Searches codebases and workspace files for text queries/patterns.
  - `read_file`: Reads workspace files.
  - `list_dir`: Shallow directory inspection (1-level deep, noise-filtered).
- **🎨 Apple HIG & Linear Glassmorphism UI**:
  - OLED dark mode (`#000000`) with frosted glass panels (`backdrop-filter: blur(25px)`).
  - macOS window control buttons (🔴 🟡 🟢) in sidebar and code header bars.
  - Responsive mobile drawer navigation with tap backdrop overlay.
  - 1-click **Copy** button on all code snippets.
  - Built-in **KaTeX** math engine & text sanitizer for clean shortcut rendering.
- **📚 74 Included Design & Engineering Skills**: Packed with design skills (`design-md-apple`, `design-md-stripe`, `design-md-linear.app`, `design-md-figma`) and technical guides.
- **🔄 Session Handoff Engine (`handoff.py`)**: Seamlessly captures active conversation history from Antigravity/previous sessions so your agent never loses context.
- **🖥️ 1-Click Desktop Launcher**: Launch proxy, handoff context, backend server, and open browser UI in one click via `Launch_Gemini_Agent.bat` or Desktop shortcut.

---

## 🛠️ Local Agent Tool Suite

| Tool | Purpose | Example Directive |
|---|---|---|
| `run_command` | Execute PowerShell commands | *"Run python app.py"* |
| `write_file` | Create or overwrite files | *"Create test.py on Desktop"* |
| `replace_file_content` | Edit code in-place | *"Replace print statement in app.py"* |
| `grep_search` | Search codebase for text | *"Grep for 'call agent'"* |
| `read_file` | Read file contents | *"Read package.json"* |
| `list_dir` | Inspect folder contents | *"Check my Desktop folder"* |

---

## 📁 Repository Structure

```
1B-gemini-Local-Agent/
├── hero_banner.gif               # Animated Hero Banner
├── Launch_Gemini_Agent.bat       # 1-Click Master Desktop Launcher
├── skills/                       # 74 Built-in Design & Engineering Skills
│   ├── design-md-apple/          # Apple HIG Design System
│   ├── design-md-stripe/         # Stripe SaaS Design System
│   ├── design-md-linear.app/     # Linear App Design System
│   └── ...                       # 71 additional specialized skills
├── gemini-chatbox/               # Agent Web Workspace & Backend
│   ├── index.html                # Apple HIG Glassmorphism Web UI
│   ├── style.css                 # Apple OLED dark theme design system
│   ├── app.js                    # SSE streaming, KaTeX & Thought Process UI
│   ├── agent_backend.py          # Python Flask server & 6-tool OpenAI loop
│   ├── handoff.py                # Context transcript extractor & handoff manager
│   └── master_launch.bat         # Terminal launcher script
├── gemini-web2api/               # Reverse-Engineered Gemini Web Proxy Server
│   ├── gemini_web2api.py         # Main OpenAI-compatible proxy server (Port 8081)
│   ├── config.json               # Proxy server configuration
│   └── start_server.bat          # Standalone proxy launch script
└── README.md                     # Project documentation
```

---

## 🚀 Quick Start

### 1. First-Time Setup (Automated)
Run the first-time setup script to automatically install all dependencies and set up permissions:
```bat
SETUP.bat
```
*(Or manually: `pip install -r requirements.txt`)*

### 2. One-Click Launch (Recommended)
Simply double-click **`Launch_Gemini_Agent.bat`** (or your Desktop shortcut).

It will automatically:
1. Auto-detect Python and start `gemini-web2api` proxy on port `8081` in background.
2. Auto-initialize permissions so tool calling and file operations are ready instantly.
3. Extract and package conversation context (`handoff.py`).
4. Boot up the Agent Backend on port `5000`.
5. Open the Gemini Agent UI at `http://127.0.0.1:5000` directly in your browser.

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
                                                                   │ 6 Native Tools
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
                                                      └────────────┬─────────────┘
```

---

## ⭐ Star History

If you found this project helpful, please consider giving it a star! It lets other developers discover the repository and supports ongoing open-source updates.

<p align="center">
  <a href="https://star-history.com/#IshaanYK/gemini-1b-local-agent&Date">
    <img src="https://api.star-history.com/svg?repos=IshaanYK/gemini-1b-local-agent&type=Date" alt="Star History Chart" width="100%">
  </a>
</p>

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

MIT License. Free for open-source & personal development.
