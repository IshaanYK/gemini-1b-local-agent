#!/usr/bin/env python3
"""
check_health.py — Autonomous Diagnostic & Health Check Tool for B1 Gemini Local Agent
Verifies environment, dependencies, configuration files, active listening ports,
and performs an end-to-end model query test.
"""

import sys
import os
import socket
import json
import urllib.request
import urllib.error

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def print_header(text):
    print(f"\n{CYAN}=== {text} ==={RESET}")

def report(name, passed, detail=""):
    mark = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
    if passed:
        print(f" {mark} {name}" + (f" -> {detail}" if detail else ""))
    else:
        print(f" {mark} {name}" + (f" -> {detail}" if detail else ""))
    return passed

def is_port_open(port, host="127.0.0.1", timeout=1.5):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False

def check_http_json(url, timeout=3.0):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "B1HealthCheck/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read().decode('utf-8', errors='replace')
            return True, json.loads(data)
    except Exception as e:
        return False, str(e)

def main():
    print(f"{CYAN}============================================================{RESET}")
    print(f"{CYAN}       B1 GEMINI LOCAL AGENT — SYSTEM HEALTH CHECK          {RESET}")
    print(f"{CYAN}============================================================{RESET}")
    all_passed = True

    # 1. Python Runtime
    print_header("1. Python Environment")
    py_ver = sys.version.split()[0]
    ver_ok = sys.version_info >= (3, 9)
    if not report("Python Version >= 3.9", ver_ok, f"Detected: {py_ver}"):
        all_passed = False

    # 2. Critical Package Imports
    print_header("2. Critical Dependencies")
    required_packages = [
        ("flask", "Flask"),
        ("flask_cors", "Flask-CORS"),
        ("openai", "OpenAI SDK"),
        ("requests", "Requests"),
        ("bs4", "BeautifulSoup4"),
        ("httpx", "HTTPX")
    ]
    for mod_name, label in required_packages:
        try:
            __import__(mod_name)
            report(f"Package: {label}", True)
        except ImportError:
            report(f"Package: {label}", False, "Run 'pip install -r requirements.txt'")
            all_passed = False

    # 3. File & Configuration Integrity
    print_header("3. Configuration & Permissions")
    env_path = os.path.join(ROOT_DIR, ".env")
    proxy_config = os.path.join(ROOT_DIR, "gemini-web2api", "config.json")
    chatbox_perm = os.path.join(ROOT_DIR, "gemini-chatbox", "permissions.json")

    report(".env configuration exists", os.path.exists(env_path), "Created" if os.path.exists(env_path) else "Run 'copy .env.example .env'")
    report("Proxy config.json exists", os.path.exists(proxy_config), "Created" if os.path.exists(proxy_config) else "Run SETUP.bat")
    report("Local tool permissions configured", os.path.exists(chatbox_perm), "Active" if os.path.exists(chatbox_perm) else "Run SETUP.bat")

    # 4. Port Connectivity
    print_header("4. Service Ports & Processes")
    proxy_port_alive = is_port_open(8081)
    backend_port_alive = is_port_open(5000)

    report("Web2API Proxy listening on port 8081", proxy_port_alive, "Active" if proxy_port_alive else "Not running (Start with gemini_web2api.py)")
    report("Agent Backend listening on port 5000", backend_port_alive, "Active" if backend_port_alive else "Not running (Start with agent_backend.py)")

    # 5. Service Endpoint Verification
    print_header("5. Live Service Endpoints")
    if proxy_port_alive:
        ok, res = check_http_json("http://127.0.0.1:8081/v1/models")
        if ok and isinstance(res, dict) and "data" in res:
            model_names = [m.get("id") for m in res["data"][:3]]
            report("Proxy /v1/models endpoint", True, f"Found models: {', '.join(model_names)}...")
        else:
            report("Proxy /v1/models endpoint", False, str(res))
            all_passed = False
    else:
        report("Proxy /v1/models endpoint", False, "Skipped — port 8081 not listening")
        all_passed = False

    if backend_port_alive:
        ok, res = check_http_json("http://127.0.0.1:5000/api/permission-status")
        if ok:
            report("Backend /api/permission-status endpoint", True, "Status operational")
        else:
            report("Backend /api/permission-status endpoint", False, str(res))
            all_passed = False
    else:
        report("Backend /api/permission-status endpoint", False, "Skipped — port 5000 not listening")
        all_passed = False

    # 6. End-to-End LLM Completion Test
    if proxy_port_alive:
        print_header("6. End-to-End Model Query Test")
        try:
            from openai import OpenAI
            client = OpenAI(base_url="http://127.0.0.1:8081/v1", api_key="sk-gemini")
            response = client.chat.completions.create(
                model="gemini-2.0-flash",
                messages=[{"role": "user", "content": "Respond in two words: 'B1 Ready'"}],
                max_tokens=20,
                stream=False
            )
            reply = response.choices[0].message.content.strip()
            report("Model Query Handshake (gemini-2.0-flash)", True, f"Response: '{reply}'")
        except Exception as e:
            report("Model Query Handshake", False, str(e))
            all_passed = False

    # Summary
    print(f"\n{CYAN}============================================================{RESET}")
    if all_passed and proxy_port_alive and backend_port_alive:
        print(f"{GREEN}[SUCCESS] ALL SYSTEMS OPERATIONAL! B1 Local Agent is ready to use.{RESET}")
        print(f"  Access UI: {CYAN}http://127.0.0.1:5000/{RESET}")
    else:
        print(f"{YELLOW}! Notice: Some checks require attention.{RESET}")
        print("  To launch all services automatically, run: START_AGENT.bat")
    print(f"{CYAN}============================================================{RESET}\n")

if __name__ == "__main__":
    main()
