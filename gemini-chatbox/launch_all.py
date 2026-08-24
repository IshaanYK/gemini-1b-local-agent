import os
import sys
import time
import socket
import subprocess
import webbrowser

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROXY_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "gemini-web2api"))
INDEX_HTML = os.path.join(BASE_DIR, "index.html")

def is_port_open(port, host="127.0.0.1"):
    try:
        with socket.create_connection((host, port), timeout=0.5):
            return True
    except Exception:
        return False

DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200
CREATE_NO_WINDOW = 0x08000000

flags = (DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW) if os.name == 'nt' else 0

# 1. Start gemini_web2api on port 8081 if not active
if not is_port_open(8081):
    proxy_script = os.path.join(PROXY_DIR, "gemini_web2api.py")
    if os.path.exists(proxy_script):
        log_path = os.path.join(PROXY_DIR, "proxy.log")
        with open(log_path, "a", encoding="utf-8", errors="replace") as f_out:
            subprocess.Popen(
                [sys.executable, proxy_script],
                cwd=PROXY_DIR,
                creationflags=flags,
                stdout=f_out,
                stderr=f_out,
                close_fds=True
            )
        for _ in range(30):
            if is_port_open(8081):
                break
            time.sleep(0.2)

# 2. Start agent_backend on port 5000 if not active
if not is_port_open(5000):
    backend_script = os.path.join(BASE_DIR, "agent_backend.py")
    log_path = os.path.join(BASE_DIR, "backend.log")
    with open(log_path, "a", encoding="utf-8", errors="replace") as f_out:
        subprocess.Popen(
            [sys.executable, backend_script],
            cwd=BASE_DIR,
            creationflags=flags,
            stdout=f_out,
            stderr=f_out,
            close_fds=True
        )
    for _ in range(30):
        if is_port_open(5000):
            break
        time.sleep(0.2)

# 3. Open UI in default browser
webbrowser.open("file:///" + os.path.abspath(INDEX_HTML).replace("\\", "/"))
print("All systems initialized! Backend: 5000 | Proxy: 8081")
