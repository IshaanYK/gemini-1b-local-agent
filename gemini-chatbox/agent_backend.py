import json
import os
import re
import socket
import datetime
import subprocess
import time
import urllib.request
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

client = OpenAI(base_url="http://127.0.0.1:8081/v1", api_key="sk-gemini")
MODEL = "gemini-3.6-flash"

# ── Dynamic paths — work on ANY user's PC ───────────────────────────────
USER_HOME    = os.path.expanduser("~")
USER_DESKTOP = os.path.join(USER_HOME, "Desktop")
# Playground lives next to this script file
_BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
PLAYGROUND_DIR = os.path.join(_BASE_DIR, "playground")
HISTORY_FILE   = os.path.join(PLAYGROUND_DIR, "playground_history.json")
PERMISSIONS_FILE = os.path.join(_BASE_DIR, "permissions.json")

os.makedirs(PLAYGROUND_DIR, exist_ok=True)

# ── Self-Healing Auto-Fix Proxy Manager ────────────────────────────────
def _is_port_open(host="127.0.0.1", port=8081, timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def ensure_proxy_running():
    """Auto-detects if proxy on 8081 is down, and automatically starts it in the background!"""
    if _is_port_open(port=8081):
        return True
    
    print("[Auto-Fix] Proxy on port 8081 is DOWN! Automatically launching gemini_web2api.py...")
    proxy_script = os.path.abspath(os.path.join(_BASE_DIR, "..", "gemini-web2api", "gemini_web2api.py"))
    if not os.path.exists(proxy_script):
        proxy_script = os.path.abspath(os.path.join(_BASE_DIR, "gemini_web2api.py"))
    
    if os.path.exists(proxy_script):
        proxy_dir = os.path.dirname(proxy_script)
        try:
            log_file = os.path.join(proxy_dir, "proxy.log")
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            with open(log_file, "a") as f_out:
                subprocess.Popen(
                    ["python", proxy_script],
                    cwd=proxy_dir,
                    stdout=f_out,
                    stderr=f_out,
                    creationflags=creation_flags
                )
            for _ in range(10):
                time.sleep(0.5)
                if _is_port_open(port=8081):
                    print("[Auto-Fix] ✅ Proxy successfully auto-started on port 8081!")
                    return True
        except Exception as e:
            print(f"[Auto-Fix Error] Failed to launch proxy: {e}")
    return False

def call_openai_with_autofix(create_kwargs, retries=2):
    """Executes OpenAI completions with automatic proxy detection & self-healing retry on connection errors."""
    ensure_proxy_running()
    for attempt in range(retries + 1):
        try:
            return client.chat.completions.create(**create_kwargs)
        except Exception as e:
            err_str = str(e).lower()
            if any(k in err_str for k in ["connection", "connect", "refused", "unreachable", "timeout"]) and attempt < retries:
                print(f"[Auto-Fix Retry {attempt + 1}/{retries}] Proxy connection issue: {e}. Healing proxy...")
                ensure_proxy_running()
                time.sleep(1.5)
            else:
                raise e
    return client.chat.completions.create(**create_kwargs)

# ── Permission System ────────────────────────────────────────────────────
def _load_permissions():
    """Return the permissions dict, or None if not yet granted."""
    if not os.path.exists(PERMISSIONS_FILE):
        return None
    try:
        with open(PERMISSIONS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data if data.get('granted') else None
    except Exception:
        return None

def _is_permitted():
    return _load_permissions() is not None

def _grant_permissions():
    """Write permissions.json to grant all access."""
    data = {
        "granted": True,
        "granted_at": datetime.datetime.now().isoformat(),
        "machine": socket.gethostname(),
        "permissions": {
            "read_files": True,
            "write_files": True,
            "run_commands": True,
            "list_directories": True,
            "search_files": True
        },
        "version": "1.0"
    }
    with open(PERMISSIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def log_playground_history(action, filepath, content="", meta=""):
    """Log persistent code history and file actions into playground registry."""
    try:
        history = []
        if os.path.exists(HISTORY_FILE):
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        import datetime
        entry = {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": action,
            "filepath": filepath,
            "filename": os.path.basename(filepath),
            "snippet": content[:300] if content else "",
            "meta": meta
        }
        history.insert(0, entry)
        history = history[:100]
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2)
    except Exception as e:
        print(f"Error logging playground history: {e}")

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a PowerShell command on the user's local Windows system with administrative privileges.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "PowerShell command string"}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_processes",
            "description": "List all running processes on the Windows system, automatically identifying listening ports and classifying processes into AI Agents, Web/Backend Servers, MCP Servers, System Services, and User Applications.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read contents of any local file or directory (supports plain text, DOCX, PDF, JSON, Python, JS, HTML, or reading all files in a folder).",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "File or directory path"}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file on local disk with complete code or text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Target file path"},
                    "content": {"type": "string", "description": "File content"}
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "replace_file_content",
            "description": "Edit an existing file in-place by replacing a target snippet with new content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Target file path"},
                    "target": {"type": "string", "description": "Exact text string to replace"},
                    "replacement": {"type": "string", "description": "New replacement text"}
                },
                "required": ["filepath", "target", "replacement"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep_search",
            "description": "Search across files in a directory or codebase for a text pattern, keyword, or query string.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory to search"},
                    "query": {"type": "string", "description": "Search query string"}
                },
                "required": ["path", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List top-level files and subdirectories in any local directory across all drives.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path"}
                },
                "required": ["path"]
            }
        }
    }
]

MAX_OUTPUT_LEN = 30000

def read_docx(filepath):
    """Extract full text from DOCX file."""
    try:
        with zipfile.ZipFile(filepath) as z:
            xml_content = z.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            text = []
            for elem in tree.iter():
                if elem.tag.endswith('t') and elem.text:
                    text.append(elem.text)
                elif elem.tag.endswith('p'):
                    text.append('\n')
            return ''.join(text).strip()
    except Exception as e:
        return f"[Error reading DOCX '{os.path.basename(filepath)}': {e}]"

def read_pdf(filepath):
    """Extract full text from PDF file."""
    try:
        import pypdf
        reader = pypdf.PdfReader(filepath)
        text = [page.extract_text() or "" for page in reader.pages]
        res = "\n".join(text).strip()
        if res:
            return res
    except Exception:
        pass
    try:
        with open(filepath, 'rb') as f:
            content = f.read()
        strings = re.findall(rb'\((.*?)\)', content)
        text = [s.decode('utf-8', errors='ignore') for s in strings if len(s) > 3]
        return "\n".join(text[:150]).strip() if text else "[PDF text extraction failed]"
    except Exception as e:
        return f"[Error reading PDF '{os.path.basename(filepath)}': {e}]"

def resolve_path(p, target_folder=None):
    if not p:
        return resolve_path(target_folder) if target_folder else PLAYGROUND_DIR
    p = str(p).strip().strip("'\"`")
    
    # Strip markdown / tree / formatting prefixes
    p = re.sub(r"^\[(?:DIR|FILE)\]\s*", "", p, flags=re.IGNORECASE).strip()
    p = re.sub(r"^[📁📄🔒]\s*", "", p).strip()
    
    # Normalize drive letters: "g drive", "g:", "g:\", "g/", "drive g" -> "G:\"
    m_drive = re.match(r"^(?:drive\s+([a-zA-Z])|([a-zA-Z])\s+drive|([a-zA-Z]):?\\?)$", p, re.IGNORECASE)
    if m_drive:
        letter = (m_drive.group(1) or m_drive.group(2) or m_drive.group(3)).upper()
        dp = f"{letter}:\\"
        if os.path.exists(dp):
            return dp

    if p.lower() in {"desktop", "desktop folder"}:
        return USER_DESKTOP
    if p.lower() in {"home", "user home", "user folder"}:
        return USER_HOME
    if p.lower().startswith("playground"):
        sub = p[10:].lstrip("\\/")
        return os.path.join(PLAYGROUND_DIR, sub) if sub else PLAYGROUND_DIR

    # Explicit Windows drive letter paths like G:\folder or C:\Users\...
    if len(p) >= 2 and p[1] == ":":
        letter = p[0].upper()
        rest = p[2:].lstrip("\\/")
        abs_p = f"{letter}:\\{rest}" if rest else f"{letter}:\\"
        return abs_p

    # Check inside target_folder if target_folder is set
    if target_folder:
        tf_res = target_folder if (len(target_folder) >= 2 and target_folder[1] == ":") else resolve_path(target_folder)
        if os.path.exists(tf_res) and os.path.isdir(tf_res):
            sub_p = os.path.join(tf_res, p)
            if os.path.exists(sub_p):
                return sub_p

    # Universal search across local drives & user folders
    if not os.path.isabs(p):
        for search_base in ["G:\\", USER_DESKTOP, USER_HOME, PLAYGROUND_DIR, r"C:\Users\ISHAAN SEN\Desktop\Arise"]:
            if os.path.exists(search_base):
                candidate = os.path.join(search_base, p)
                if os.path.exists(candidate):
                    return candidate
                try:
                    for item in os.listdir(search_base):
                        if item.lower() == p.lower():
                            return os.path.join(search_base, item)
                except Exception:
                    pass

    return p

def execute_tool(name, args):
    try:
        if isinstance(args, str):
            args = json.loads(args)
            
        if name == "run_command":
            cmd = args.get("command", "")
            result = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, timeout=30)
            output = result.stdout
            if result.stderr:
                output += "\nError: " + result.stderr
            if not output.strip():
                output = "Command executed with no output."
            if len(output) > MAX_OUTPUT_LEN:
                output = output[:MAX_OUTPUT_LEN] + "\n...[Output truncated for size limit]"
            log_playground_history("run", cmd, output[:200], meta="Executed CLI command")
            return output

        elif name == "list_processes":
            ps_script = """
            $proc = Get-CimInstance Win32_Process | Select-Object ProcessId, Name, CommandLine
            $ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Select-Object OwningProcess, LocalPort, LocalAddress
            $portMap = @{}
            foreach ($pt in $ports) {
                if ($pt.OwningProcess) {
                    if (-not $portMap.ContainsKey($pt.OwningProcess)) { $portMap[$pt.OwningProcess] = @() }
                    $portMap[$pt.OwningProcess] += "$($pt.LocalAddress):$($pt.LocalPort)"
                }
            }
            $results = foreach ($p in $proc) {
                $pPorts = if ($portMap.ContainsKey($p.ProcessId)) { ($portMap[$p.ProcessId] | Select-Object -Unique) -join ", " } else { "None" }
                [PSCustomObject]@{
                    PID = $p.ProcessId
                    Name = $p.Name
                    CommandLine = $p.CommandLine
                    ListeningPorts = $pPorts
                }
            }
            $results | ConvertTo-Json -Compress
            """
            result = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True, timeout=35)
            raw_json = result.stdout.strip()
            try:
                data = json.loads(raw_json)
                if isinstance(data, dict):
                    data = [data]
                
                agents = []
                servers = []
                mcp_servers = []
                services = []
                apps = []
                
                for item in data:
                    pid = item.get("PID")
                    name = item.get("Name") or ""
                    cmd = item.get("CommandLine") or ""
                    ports = item.get("ListeningPorts") or "None"
                    
                    cmd_lower = cmd.lower()
                    name_lower = name.lower()
                    
                    entry = f"PID {pid} | {name} | Ports: {ports} | Command: {cmd[:120] if cmd else 'N/A'}"
                    
                    if "chrome-devtools-mcp" in cmd_lower or "cloud-run-mcp" in cmd_lower or "mcp_proxy_bundle" in cmd_lower or "mcp" in cmd_lower:
                        mcp_servers.append(entry)
                    elif any(k in cmd_lower or k in name_lower for k in ["agent_backend", "gemini-chatbox", "language_server", "pyrefly", "agy", "agent", "runner"]):
                        agents.append(entry)
                    elif any(k in cmd_lower or k in name_lower for k in ["gemini_web2api", "python", "node", "uvicorn", "gunicorn", "nginx", "apache", "httpd", "flask", "express"]) or ports != "None":
                        servers.append(entry)
                    elif name_lower in ["svchost.exe", "backgroundtaskhost.exe", "conhost.exe", "wmiprvse.exe"]:
                        services.append(entry)
                    else:
                        apps.append(entry)
                
                output = []
                output.append("=== SYSTEM PROCESS & AGENT/SERVER AUDIT ===")
                output.append(f"\n🤖 AI AGENTS ({len(agents)} detected):")
                output.append("\n".join(agents) if agents else "None")
                
                output.append(f"\n🔌 MCP SERVERS ({len(mcp_servers)} detected):")
                output.append("\n".join(mcp_servers) if mcp_servers else "None")
                
                output.append(f"\n🌐 WEB & BACKEND SERVERS ({len(servers)} detected):")
                output.append("\n".join(servers) if servers else "None")
                
                output.append(f"\n⚙️ SYSTEM SERVICES & DAEMONS ({len(services)} detected):")
                output.append("\n".join(services[:20]) + (f"\n...[{len(services)-20} more services truncated]" if len(services) > 20 else ""))
                
                output.append(f"\n🖥️ USER APPLICATIONS ({len(apps)} detected):")
                output.append("\n".join(apps[:20]) + (f"\n...[{len(apps)-20} more apps truncated]" if len(apps) > 20 else ""))
                
                res = "\n".join(output)
                log_playground_history("list_processes", "System Processes", res[:200], meta="Audited running processes, agents, and servers")
                return res
            except Exception as ex:
                return f"Process listing output:\n{raw_json[:3000]}\n(Parsing note: {ex})"

        elif name == "read_file":
            raw_path = args.get("filepath")
            filepath = resolve_path(raw_path)
            
            if not os.path.exists(filepath):
                return f"File or directory '{raw_path}' ({filepath}) does not exist on your computer."

            if os.path.isdir(filepath):
                items = os.listdir(filepath)
                out = [f"=== READING ALL FILES IN DIRECTORY: {filepath} ({len(items)} items) ===\n"]
                for f in items:
                    if f.startswith("~$") or f.startswith("."):
                        continue
                    fp = os.path.join(filepath, f)
                    if os.path.isfile(fp):
                        out.append(f"\n==================================================")
                        out.append(f"FILE: {f}")
                        out.append(f"==================================================")
                        ext = os.path.splitext(f)[1].lower()
                        if ext == ".docx":
                            content = read_docx(fp)
                        elif ext == ".pdf":
                            content = read_pdf(fp)
                        else:
                            try:
                                with open(fp, 'r', encoding='utf-8', errors='ignore') as tf:
                                    content = tf.read(10000)
                            except Exception as e:
                                content = f"[Cannot read file: {e}]"
                        out.append(content)
                    else:
                        out.append(f"[DIRECTORY] {f}")
                res = "\n".join(out)
                if len(res) > MAX_OUTPUT_LEN:
                    res = res[:MAX_OUTPUT_LEN] + "\n...[Output truncated for size limit]"
                log_playground_history("read_dir", filepath, res[:200], meta=f"Read folder contents")
                return res

            ext = os.path.splitext(filepath)[1].lower()
            if ext == ".docx":
                content = read_docx(filepath)
            elif ext == ".pdf":
                content = read_pdf(filepath)
            else:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

            if len(content) > MAX_OUTPUT_LEN:
                content = content[:MAX_OUTPUT_LEN] + "\n...[File truncated for size limit]"
            log_playground_history("read", filepath, content[:200], meta=f"Read file")
            return content

        elif name == "write_file":
            filepath = resolve_path(args.get("filepath"))
            content = args.get("content", "")
            os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            log_playground_history("write", filepath, content, meta=f"Wrote {len(content)} bytes")
            return f"Successfully wrote file to {filepath}"

        elif name == "replace_file_content":
            filepath = resolve_path(args.get("filepath"))
            target = args.get("target", "")
            replacement = args.get("replacement", "")
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            if target not in content:
                return f"Error: Target string not found in {filepath}"
            new_content = content.replace(target, replacement, 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            log_playground_history("edit", filepath, new_content, meta=f"Replaced text in {os.path.basename(filepath)}")
            return f"Successfully updated content in {filepath}"

        elif name == "grep_search":
            path = resolve_path(args.get("path", "."))
            query = args.get("query", "").lower()
            matches = []
            for root, dirs, files in os.walk(path):
                dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv", ".venv"}]
                for file in files:
                    fp = os.path.join(root, file)
                    try:
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                            for idx, line in enumerate(f, 1):
                                if query in line.lower():
                                    matches.append(f"{os.path.basename(fp)}:{idx} - {line.strip()[:120]}")
                                    if len(matches) >= 40:
                                        break
                    except Exception:
                        pass
                if len(matches) >= 40:
                    matches.append("... [More matches truncated for speed]")
                    break
            return f"Grep results for '{query}' in {path}:\n" + ("\n".join(matches) if matches else "No matches found.")

        elif name == "list_dir":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path)
            
            if not os.path.exists(path):
                return f"Directory '{raw_path}' ({path}) does not exist on your computer."
            
            is_hidden_target = ".gemini" in path or raw_path.startswith(".")
            ignored = {".git", "node_modules", "__pycache__", "venv", ".venv"} if is_hidden_target else {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}
            
            items = []
            for entry in os.scandir(path):
                if entry.name in ignored and not is_hidden_target:
                    continue
                kind = "[DIR]" if entry.is_dir() else "[FILE]"
                items.append(f"{kind} {entry.name}")
                if len(items) >= 100:
                    items.append("... [More files truncated for speed]")
                    break
                    
            return f"Contents of {path}:\n" + ("\n".join(items) if items else "Directory is empty.")

        elif name == "create_and_run_script":
            filepath = resolve_path(args.get("filepath"))
            content = args.get("content", "")
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            log_playground_history("create", filepath, content, meta=f"Created {os.path.basename(filepath)}")
            
            if filepath.endswith(".py"):
                cmd = f"python '{filepath}'"
            elif filepath.endswith(".js"):
                cmd = f"node '{filepath}'"
            elif filepath.endswith(".bat") or filepath.endswith(".ps1"):
                cmd = f"& '{filepath}'"
            else:
                cmd = f"Get-Content '{filepath}'"
                
            out = execute_tool("run_command", {"command": cmd})
            return f"### File Created & Executed: `{filepath}`\n\n**File Content Written:**\n```python\n{content}\n```\n\n**Execution Command:** `{cmd}`\n\n**Execution Output:**\n```\n{out}\n```"
            
        return f"Unknown tool: {name}"
    except subprocess.TimeoutExpired:
        return "Command timed out after 30 seconds."
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

def extract_fallback_tool(content):
    if not content:
        return None, None
        
    valid_names = {"run_command", "list_processes", "read_file", "write_file", "replace_file_content", "grep_search", "list_dir"}

    blocks = re.findall(r"```(?:tool_call|json)?\s*(\{[\s\S]*?\})\s*```", content)
    for block in blocks:
        try:
            data = json.loads(block)
            name = data.get("name") or data.get("tool") or data.get("function") or data.get("action")
            args = data.get("arguments") or data.get("args") or data.get("parameters") or data.get("params") or {}
            if not args and isinstance(data, dict):
                args = {k: v for k, v in data.items() if k not in ("name", "tool", "function", "action")}
            if name and name in valid_names:
                return name, args
        except Exception:
            pass

    raw_matches = re.findall(r"(\{[\s\S]*?\})", content)
    for raw in raw_matches:
        try:
            data = json.loads(raw)
            name = data.get("name") or data.get("tool") or data.get("function") or data.get("action")
            if name and name in valid_names:
                args = data.get("arguments") or data.get("args") or data.get("parameters") or data.get("params") or {}
                if not args:
                    args = {k: v for k, v in data.items() if k not in ("name", "tool", "function", "action")}
                return name, args
        except Exception:
            pass

    return None, None

def extract_path_from_text(text, target_folder=None):
    if not text:
        return resolve_path(target_folder) if target_folder else None

    clean_text = re.sub(r"\[(?:DIR|FILE)\]\s*", "", text, flags=re.IGNORECASE).strip()
    clean_text = re.sub(r"^[📁📄🔒]\s*", "", clean_text).strip()

    # Pattern 0: Direct drive reference ("g drive", "c drive", "read g drive", "g:", "drive g")
    m_drive = re.search(r"\b(?:drive\s+([a-zA-Z])|([a-zA-Z])\s+drive|([a-zA-Z]):?\\?)\b", clean_text, re.IGNORECASE)
    if m_drive:
        letter = (m_drive.group(1) or m_drive.group(2) or m_drive.group(3)).upper()
        dp = f"{letter}:\\"
        if os.path.exists(dp):
            for item in os.listdir(dp):
                if item.lower() in clean_text.lower() and len(item) > 2:
                    sub = os.path.join(dp, item)
                    if os.path.exists(sub):
                        return sub
            return dp

    # Pattern 1: Target folder children
    if target_folder:
        resolved_tf = resolve_path(target_folder)
        if os.path.exists(resolved_tf) and os.path.isdir(resolved_tf):
            for item in os.listdir(resolved_tf):
                if item.lower() in clean_text.lower() and len(item) > 2:
                    sub = os.path.join(resolved_tf, item)
                    if os.path.exists(sub):
                        return sub

    # Pattern 2: Quoted paths
    quoted_matches = re.findall(r"[\"']([a-zA-Z]:\\[^\"']+)[\"']", clean_text)
    for q in quoted_matches:
        q_clean = q.strip()
        if os.path.exists(q_clean):
            return q_clean

    # Pattern 3: Absolute Windows paths
    win_matches = re.findall(r"([a-zA-Z]:\\[^\s\"'`<>]+)", clean_text)
    for w in win_matches:
        w_clean = re.sub(r"[\.,!\?\);:]+$", "", w.strip())
        if os.path.exists(w_clean):
            return w_clean

    # Pattern 4: Search across Desktop, G:\, and user folders
    for base in [USER_DESKTOP, "G:\\", r"C:\Users\ISHAAN SEN\Desktop\Arise"]:
        if os.path.exists(base):
            try:
                for entry in os.listdir(base):
                    if entry.lower() in clean_text.lower() and len(entry) > 2:
                        return os.path.join(base, entry)
            except Exception:
                pass

    # Pattern 5: Words matching existing path
    words = [w.strip("[](),'\"`") for w in clean_text.split()]
    for w in words:
        if len(w) > 2 and w.lower() not in {"the", "user", "file", "files", "folder", "read", "check", "open", "list", "show", "view", "what", "is", "in", "and", "saying", "code"}:
            resolved = resolve_path(w, target_folder)
            if os.path.exists(resolved):
                return resolved

    return resolve_path(target_folder) if target_folder else None

def infer_intent_tool(user_text, target_folder=None):
    """Dynamic intent parser: grants universal access to list, read, inspect, and audit files across all drives."""
    if not user_text and not target_folder:
        return None, None
    text = (user_text or "").strip()
    text_lower = text.lower()

    # 0. System Process / Agent / Server Audit Intent
    process_keywords = ["process", "processes", "running processes", "agents or servers", "show processes", "list processes", "running agents", "running servers", "what processes"]
    if any(k in text_lower for k in process_keywords):
        return "list_processes", {}

    # 0.5 Create & Run Script Intent
    if any(k in text_lower for k in ["create", "make", "write", "generate"]) and any(s in text_lower for s in ["script", "file", ".py", ".js", ".bat", ".ps1"]) and any(r in text_lower for r in ["run", "execute", "run it", "execute it"]):
        fn_match = re.search(r"(\b[\w-]+\.(?:py|js|bat|txt|ps1)\b)", text, re.IGNORECASE)
        filename = fn_match.group(1) if fn_match else "test.py"
        dest_folder = USER_DESKTOP if "desktop" in text_lower else (resolve_path(target_folder) if target_folder else PLAYGROUND_DIR)
        target_filepath = os.path.join(dest_folder, filename)
        
        if filename.endswith(".py"):
            code_content = f'# {filename} — Auto-generated test script\nimport sys, os\nprint("[SUCCESS] Test script {filename} executed successfully!")\nprint("Python version:", sys.version.split()[0])\nprint("Current directory:", os.getcwd())\n'
        elif filename.endswith(".js"):
            code_content = f'// {filename} — Auto-generated test script\nconsole.log("[SUCCESS] Test script {filename} executed successfully!");\nconsole.log("Node version:", process.version);\n'
        else:
            code_content = f'@echo off\necho Test script {filename} executed successfully!\n'
            
        return "create_and_run_script", {"filepath": target_filepath, "content": code_content}

    # 1. CLI Commands
    cli_cmdlets = (
        "get-childitem", "gci", "dir", "ls", "get-process", "gps", "get-service",
        "cat", "type", "select-string", "grep", "python", "node", "npm", "git",
        "cd", "echo", "mkdir", "remove-item", "rm", "tree", "powershell", "cmd"
    )
    if any(text_lower.startswith(c) for c in cli_cmdlets) or any(flag in text_lower for flag in ["-recurse", "-path", "-filter", "-force", " -c ", " | ", " > "]):
        return "run_command", {"command": text}

    # 2. Inspection / Reading Intent
    inspect_keywords = ["read", "what is in", "what's in", "show", "list", "check", "open", "scan", "contents of", "view", "inspect", "find", "audit", "search", "hardcode"]
    is_inspect = any(k in text_lower for k in inspect_keywords)
    
    extracted_path = extract_path_from_text(text, target_folder if is_inspect else None)
    if extracted_path:
        if os.path.isdir(extracted_path):
            if any(w in text_lower for w in ["read", "read file", "read the file", "read files", "contents", "content"]):
                return "read_file", {"filepath": extracted_path}
            return "list_dir", {"path": extracted_path}
        elif os.path.isfile(extracted_path):
            return "read_file", {"filepath": extracted_path}

    if is_inspect and target_folder:
        resolved_tf = resolve_path(target_folder)
        if os.path.exists(resolved_tf):
            if os.path.isdir(resolved_tf):
                if any(w in text_lower for w in ["read", "read file", "read files", "contents", "content"]):
                    return "read_file", {"filepath": resolved_tf}
                return "list_dir", {"path": resolved_tf}
            else:
                return "read_file", {"filepath": resolved_tf}

    return None, None

SYSTEM_INSTRUCTION = """Environment: Unrestricted Autonomous Developer Agent & Local Virtual Sandbox.
You are an Autonomous AI Developer Agent operating with FULL ADMINISTRATIVE SYSTEM ACCESS across all drives (C:\\, D:\\, G:\\, etc.).
The user has granted you total authority to inspect folders, read files, write code, modify files, run terminal commands, search codebases, audit processes, and perform automated testing.

CRITICAL DIRECTIVES:
1. NEVER output disclaimers stating you lack execution access, cannot browse local files, or need text pasted—you HAVE full system access.
2. ALWAYS execute tools immediately (`list_processes`, `list_dir`, `read_file`, `grep_search`, `run_command`, `write_file`) when asked to inspect processes, read files, audit code, or execute commands.
3. When asked to list running processes or identify AI agents/servers, execute `list_processes` immediately to retrieve listening ports, process names, and command lines, then format a categorized breakdown in clean Markdown.
4. When asked to check code for errors or hardcoding, search for hardcoded paths (e.g. C:\\ or G:\\) or unhandled exceptions, read source files, and summarize exact line numbers and fixes in clean GitHub-flavored Markdown.
"""

@app.route('/api/grant-permission', methods=['POST'])
def grant_permission():
    """Called by the frontend when user clicks Allow in the permission modal."""
    try:
        _grant_permissions()
        return {"status": "granted", "message": "Permissions granted. Agent is ready."}
    except Exception as e:
        return {"status": "error", "message": str(e)}, 500

@app.route('/api/permission-status', methods=['GET'])
def permission_status():
    return {"granted": _is_permitted()}

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    requested_model = data.get('model', MODEL)
    target_folder = data.get('target_folder', '').strip()
    
    last_user_msg = ""
    for m in reversed(messages):
        if m.get('role') == 'user':
            last_user_msg = m.get('content', '')
            break

    def generate():
        nonlocal messages

        # ── Permission gate — block all tool use until user grants access ──
        if not _is_permitted():
            yield f"data: {json.dumps({'needs_permission': True})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        yield f"data: {json.dumps({'thinking': 'Autonomous Agent Loop Initializing...'})}\n\n"
        
        # Step 1: Single tool direct execution
        inferred_name, inferred_args = infer_intent_tool(last_user_msg, target_folder)
        
        if inferred_name and (inferred_name in {"create_and_run_script", "list_processes"} or not any(k in last_user_msg.lower() for k in ["create app", "modify code", "agent mode"])):
            yield f"data: {json.dumps({'thinking': f'Executing local tool `{inferred_name}`...'})}\n\n"
            yield f"data: {json.dumps({'system': f'Executing {inferred_name}...'})}\n\n"
            
            tool_result = execute_tool(inferred_name, inferred_args)
            
            yield f"data: {json.dumps({'thinking': f'Finished `{inferred_name}` ({len(tool_result)} chars output). Formatting response...'})}\n\n"
            
            summarize_messages = [
                {"role": "user", "content": f"Format and display the following content clearly in Markdown. Make sure ALL text, mathematical symbols, equations, code snippets, and structural details are fully visible and preserved:\n\n{tool_result}"}
            ]
            
            try:
                response = call_openai_with_autofix({
                    "model": requested_model,
                    "messages": summarize_messages,
                    "stream": False
                })
                content = response.choices[0].message.content or ""
            except Exception as e:
                content = f"### Execution Output\n\n```\n{tool_result}\n```"

            for i in range(0, len(content), 20):
                chunk = content[i:i+20]
                yield f"data: {json.dumps({'content': chunk})}\n\n"
                
            yield "data: [DONE]\n\n"
            return

        # Step 2: Multi-step Autonomous Agent Loop
        system_content = SYSTEM_INSTRUCTION
        if target_folder:
            resolved_target = resolve_path(target_folder)
            system_content += f"\nActive Target Project Directory: {resolved_target}"

        conversation = [{"role": "system", "content": system_content}] + [m for m in messages if m.get('role') != 'system']
        
        max_steps = 6
        final_text = ""
        
        for step in range(1, max_steps + 1):
            yield f"data: {json.dumps({'thinking': f'Step {step}/{max_steps}: Analyzing next action...'})}\n\n"
            
            try:
                response = call_openai_with_autofix({
                    "model": requested_model,
                    "messages": conversation,
                    "tools": TOOLS,
                    "stream": False
                })
                choice = response.choices[0]
                msg = choice.message
                
                tool_name, tool_args = None, None
                if msg.tool_calls:
                    tc = msg.tool_calls[0]
                    tool_name, tool_args = tc.function.name, tc.function.arguments
                else:
                    tool_name, tool_args = extract_fallback_tool(msg.content)

                if tool_name:
                    yield f"data: {json.dumps({'thinking': f'Step {step}: Executing `{tool_name}`...'})}\n\n"
                    yield f"data: {json.dumps({'system': f'[Step {step}] Executing {tool_name}'})}\n\n"
                    
                    result = execute_tool(tool_name, tool_args)
                    
                    yield f"data: {json.dumps({'thinking': f'Step {step}: `{tool_name}` finished ({len(result)} bytes output).'})}\n\n"
                    
                    conversation.append({"role": "assistant", "content": f"Used tool `{tool_name}` with args {tool_args}"})
                    conversation.append({"role": "user", "content": f"Tool `{tool_name}` execution result:\n```\n{result}\n```\nAnalyze result. If work is done and verified with testing, provide final summary. If not, continue next tool step."})
                else:
                    raw_content = msg.content or ""
                    refusal_triggers = [
                        "don't have direct access", "cannot access", "don't have access", "virtual sandbox",
                        "don't have the capability", "ai collaborator without", "operating without execution access",
                        "cannot run local file", "cannot inspect", "operating as a language model",
                        "don't have active local terminal", "without execution access", "share the contents",
                        "cannot run local", "unable to browse", "please share"
                    ]
                    if any(ref_t in raw_content.lower() for ref_t in refusal_triggers):
                        fallback_path = extract_path_from_text(last_user_msg, target_folder) or (
                            r"G:\Arise_System" if os.path.exists(r"G:\Arise_System") else (
                            "G:\\" if os.path.exists("G:\\") else resolve_path(target_folder or "Desktop")
                            )
                        )
                        if os.path.exists(fallback_path):
                            if any(w in last_user_msg.lower() for w in ["hardcode", "error", "bug", "audit", "find"]):
                                tool_result = execute_tool("grep_search", {"path": fallback_path, "query": ":\\"})
                                tool_result += "\n" + execute_tool("list_dir", {"path": fallback_path})
                            else:
                                tool_result = execute_tool("read_file" if os.path.isfile(fallback_path) else "list_dir", {"path": fallback_path, "filepath": fallback_path})
                            final_text = f"### Automatic System Access Output for `{fallback_path}`\n\n{tool_result}"
                        else:
                            final_text = execute_tool("run_command", {"command": f"Get-ChildItem '{USER_DESKTOP}'"})
                    else:
                        final_text = raw_content or "Task completed."
                    break

            except Exception as e:
                final_text = f"Agent Loop Error at Step {step}: {str(e)}"
                break

        if not final_text:
            final_text = "Completed autonomous agent sequence."

        yield f"data: {json.dumps({'thinking': 'Synthesizing final report...'})}\n\n"
        
        for i in range(0, len(final_text), 20):
            chunk = final_text[i:i+20]
            yield f"data: {json.dumps({'content': chunk})}\n\n"
            
        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/api/playground', methods=['GET'])
def get_playground():
    files = []
    if os.path.exists(PLAYGROUND_DIR):
        for entry in os.scandir(PLAYGROUND_DIR):
            if entry.name != "playground_history.json" and not entry.name.startswith("."):
                files.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_dir": entry.is_dir(),
                    "size": entry.stat().st_size if entry.is_file() else 0
                })
    
    history = []
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                history = json.load(f)
        except Exception:
            pass

    return {
        "status": "success",
        "playground_dir": PLAYGROUND_DIR,
        "files": files,
        "history": history
    }

@app.route('/api/playground/file', methods=['POST'])
def read_playground_file():
    data = request.json or {}
    filename = data.get("filename", "")
    filepath = resolve_path(os.path.join(PLAYGROUND_DIR, filename) if filename else data.get("filepath", ""))
    if os.path.exists(filepath) and os.path.isfile(filepath):
        ext = os.path.splitext(filepath)[1].lower()
        if ext == ".docx":
            content = read_docx(filepath)
        elif ext == ".pdf":
            content = read_pdf(filepath)
        else:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        return {"status": "success", "filepath": filepath, "content": content}
    return {"status": "error", "message": f"File '{filename}' not found."}, 404

@app.route('/api/playground/run', methods=['POST'])
def run_playground_script():
    data = request.json or {}
    filename = data.get("filename", "")
    filepath = resolve_path(os.path.join(PLAYGROUND_DIR, filename) if filename else data.get("filepath", ""))
    if os.path.exists(filepath):
        if filepath.endswith(".py"):
            cmd = f"python '{filepath}'"
        elif filepath.endswith(".js"):
            cmd = f"node '{filepath}'"
        elif filepath.endswith(".bat"):
            cmd = f"& '{filepath}'"
        else:
            cmd = f"Get-Content '{filepath}'"
        
        output = execute_tool("run_command", {"command": cmd})
        return {"status": "success", "command": cmd, "output": output}
    return {"status": "error", "message": f"Script '{filename}' not found."}, 404

if __name__ == '__main__':
    port = int(os.environ.get('BACKEND_PORT', 5000))
    print(f"Starting Gemini 1B Agent Backend on port {port}...")
    print(f"Permissions: {'GRANTED' if _is_permitted() else 'NOT YET GRANTED — user will see permission prompt'}")
    app.run(port=port, debug=False)
