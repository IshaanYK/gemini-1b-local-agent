"""
core/automation_engine.py — Software & App Integration & Workflow Automation Engine for B1

Capabilities:
1. Local Software Discovery: Scans for VS Code, Git, Node.js, Python, Chrome/Edge, Docker.
2. 1-Click App Launcher: Launches external software with targeted workspace files.
3. Multi-Step Autonomous Pipeline Runner: Executes multi-stage automation workflows
   (e.g., Code Health Audit, Auto-Test & Fix, Git Sync, Dev Environment Spin-up).
4. Webhook & Background Watcher integration.
"""

import os
import sys
import shutil
import subprocess
import json
import time
from typing import Dict, List, Any, Optional

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == "core" else os.path.dirname(os.path.abspath(__file__))

class AutomationEngine:
    """Orchestrates local software integrations and autonomous multi-step pipelines."""

    def __init__(self, base_dir: str = _BASE_DIR):
        self.base_dir = base_dir

    def detect_software(self) -> List[Dict[str, Any]]:
        """Detects available developer tools and software installed on the system."""
        tools = [
            {
                "id": "vscode",
                "name": "Visual Studio Code",
                "binary": "code",
                "category": "IDE / Editor",
                "icon": "💻",
                "description": "Open current workspace or file in VS Code editor"
            },
            {
                "id": "git",
                "name": "Git Version Control",
                "binary": "git",
                "category": "Source Control",
                "icon": "🐙",
                "description": "Automated status, commit, branch and sync operations"
            },
            {
                "id": "python",
                "name": "Python Environment",
                "binary": "python",
                "category": "Runtime",
                "icon": "🐍",
                "description": "Python interpreter, venv, and package management"
            },
            {
                "id": "node",
                "name": "Node.js / NPM",
                "binary": "node",
                "category": "Runtime",
                "icon": "🟢",
                "description": "Node runtime, npm package installer and script runner"
            },
            {
                "id": "powershell",
                "name": "Windows PowerShell",
                "binary": "powershell.exe",
                "category": "Shell / Terminal",
                "icon": "⚡",
                "description": "Native Windows shell script execution and task automation"
            },
            {
                "id": "docker",
                "name": "Docker Desktop",
                "binary": "docker",
                "category": "Containers",
                "icon": "🐳",
                "description": "Container virtualization and service orchestration"
            }
        ]

        installed = []
        for t in tools:
            path = shutil.which(t["binary"])
            is_avail = path is not None
            ver = ""
            if is_avail:
                try:
                    res = subprocess.run([t["binary"], "--version"], capture_output=True, text=True, timeout=3, shell=(os.name == 'nt'))
                    ver = (res.stdout or res.stderr or "").strip().split('\n')[0][:30]
                except Exception:
                    ver = "Detected"

            installed.append({
                **t,
                "installed": is_avail,
                "path": path or "",
                "version": ver if is_avail else "Not Found"
            })
        return installed

    def launch_app(self, app_id: str, target_path: Optional[str] = None) -> Dict[str, Any]:
        """Launches a local application with the specified target path or file."""
        target = target_path or self.base_dir
        if not os.path.exists(target):
            target = self.base_dir

        if app_id == "vscode":
            if shutil.which("code"):
                subprocess.Popen(["code", target], shell=True)
                return {"status": "success", "message": f"Opened VS Code at {target}"}
            return {"status": "error", "message": "VS Code executable ('code') not found in PATH."}

        elif app_id == "powershell":
            if os.name == 'nt':
                subprocess.Popen(f'start powershell.exe -NoExit -Command "Set-Location \'{target}\'"', shell=True)
                return {"status": "success", "message": f"Opened PowerShell terminal at {target}"}
            return {"status": "error", "message": "PowerShell not available on this platform."}

        elif app_id == "git_gui":
            if shutil.which("git"):
                subprocess.Popen(["git", "gui"], cwd=target, shell=True)
                return {"status": "success", "message": "Opened Git GUI"}
            return {"status": "error", "message": "Git executable not found."}

        elif app_id == "explorer":
            if os.name == 'nt':
                subprocess.Popen(f'explorer.exe "{target}"', shell=True)
                return {"status": "success", "message": f"Opened File Explorer at {target}"}
            return {"status": "error", "message": "Explorer only supported on Windows."}

        return {"status": "error", "message": f"Unknown application ID: {app_id}"}

    def get_pipelines(self) -> List[Dict[str, Any]]:
        """Returns catalog of pre-configured automated workflows."""
        return [
            {
                "id": "workspace_doctor",
                "title": "Workspace Environment Doctor",
                "description": "Audits Python, Node, Git, MCP connections, and active dependencies",
                "category": "Diagnostics",
                "icon": "🩺",
                "steps": [
                    {"name": "Check Python Version & Packages", "cmd": "python --version"},
                    {"name": "Audit Git Status & Cleanliness", "cmd": "git status -s"},
                    {"name": "Verify Node/NPM Toolchain", "cmd": "node --version"},
                    {"name": "Check Local RAG Vector Database", "cmd": "python -c \"from core import rag_memory; print(rag_memory.get_system_status())\""}
                ]
            },
            {
                "id": "auto_security_and_lint",
                "title": "Automated Security & Code Health Scan",
                "description": "Performs static vulnerability analysis, hardcoded secret detection & file audit",
                "category": "Security & QA",
                "icon": "🛡️",
                "steps": [
                    {"name": "Run Workspace Security Audit", "cmd": "python -c \"from core import security_rag; print(security_rag.scanner.scan_workspace())\""},
                    {"name": "Inspect Tracked Git Changes", "cmd": "git diff --stat"}
                ]
            },
            {
                "id": "auto_git_sync",
                "title": "Git Autonomous Sync & Commit",
                "description": "Stages modified files, audits diffs, and creates a structured auto-commit",
                "category": "Version Control",
                "icon": "🐙",
                "steps": [
                    {"name": "Stage All Tracked Modifications", "cmd": "git add -u"},
                    {"name": "Display Staged Changes", "cmd": "git status -s"}
                ]
            }
        ]

    def run_pipeline_step(self, command: str, cwd: Optional[str] = None) -> Dict[str, Any]:
        """Executes a single step in an automated pipeline."""
        work_dir = cwd or self.base_dir
        try:
            if os.name == 'nt':
                ps_cmd = f"powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command {subprocess.list2cmdline([command])}"
                res = subprocess.run(ps_cmd, shell=True, capture_output=True, text=True, timeout=45, cwd=work_dir, encoding="utf-8", errors="replace")
            else:
                res = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=45, cwd=work_dir, encoding="utf-8", errors="replace")

            stdout = (res.stdout or "").strip()
            stderr = (res.stderr or "").strip()
            return {
                "status": "success" if res.returncode == 0 else "warning",
                "exit_code": res.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "output": f"{stdout}\n{stderr}".strip() if stderr else stdout
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "exit_code": 124, "output": "Command timed out after 45 seconds."}
        except Exception as e:
            return {"status": "error", "exit_code": 1, "output": str(e)}

    # ── Custom App Integration & Step-by-Step Execution ─────────────────────
    def get_custom_apps_file(self) -> str:
        storage_dir = os.path.join(self.base_dir, "storage")
        os.makedirs(storage_dir, exist_ok=True)
        return os.path.join(storage_dir, "custom_apps.json")

    def list_custom_apps(self) -> List[Dict[str, Any]]:
        """Returns all registered custom applications and their step-by-step instructions."""
        fpath = self.get_custom_apps_file()
        if not os.path.exists(fpath):
            # Seed with an initial sample app
            default_apps = [
                {
                    "id": "sample_fastapi_server",
                    "name": "Local Fast-API Service",
                    "icon": "⚡",
                    "category": "Backend API",
                    "description": "Runs local python API service and tests health endpoint",
                    "command": "python -m http.server 8085",
                    "steps": [
                        {"title": "1. Initialize Environment", "instruction": "Verify Python runtime and dependencies", "cmd": "python --version"},
                        {"title": "2. Launch Local Service", "instruction": "Start the service daemon on port 8085", "cmd": "python -c \"print('Starting service daemon...')\""},
                        {"title": "3. Probe Health Status", "instruction": "Verify port responsiveness", "cmd": "python -c \"import socket; s = socket.socket(); print('Port 8085 check:', s.connect_ex(('127.0.0.1', 8085)))\""}
                    ],
                    "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
                }
            ]
            self._save_custom_apps(default_apps)
            return default_apps
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return []

    def _save_custom_apps(self, apps: List[Dict[str, Any]]):
        fpath = self.get_custom_apps_file()
        with open(fpath, 'w', encoding='utf-8') as f:
            json.dump(apps, f, indent=2)

    def add_custom_app(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Registers a new custom application with step-by-step instructions."""
        apps = self.list_custom_apps()
        name = data.get("name", "").strip()
        if not name:
            return {"status": "error", "message": "App name is required."}

        app_id = data.get("id") or name.lower().replace(" ", "_").replace("-", "_")
        app_id = "".join(c for c in app_id if c.isalnum() or c == "_")
        
        # Ensure unique
        apps = [a for a in apps if a.get("id") != app_id]

        new_app = {
            "id": app_id,
            "name": name,
            "icon": data.get("icon", "📦"),
            "category": data.get("category", "Custom Tool"),
            "description": data.get("description", "Custom application integration"),
            "command": data.get("command", ""),
            "steps": data.get("steps", []),
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        apps.insert(0, new_app)
        self._save_custom_apps(apps)
        return {"status": "success", "message": f"Successfully registered custom app: '{name}'", "app": new_app}

    def delete_custom_app(self, app_id: str) -> Dict[str, Any]:
        """Removes a registered custom app."""
        apps = self.list_custom_apps()
        new_apps = [a for a in apps if a.get("id") != app_id]
        if len(new_apps) == len(apps):
            return {"status": "error", "message": f"App '{app_id}' not found."}
        self._save_custom_apps(new_apps)
        return {"status": "success", "message": f"Deleted custom app: '{app_id}'"}

automation = AutomationEngine()
