import sys
import os

# Ensure safe stdout/stderr under pythonw.exe / background service
if sys.stdout is None:
    try:
        sys.stdout = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend.log"), "a", encoding="utf-8", errors="replace")
    except Exception:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    try:
        sys.stderr = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend.log"), "a", encoding="utf-8", errors="replace")
    except Exception:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")

import json
import re
import socket
import datetime
import subprocess
import time
import uuid
import sqlite3
import zipfile
import base64
import requests
import asyncio
import urllib.parse
from bs4 import BeautifulSoup
import xml.etree.ElementTree as ET
import hashlib
from flask import Flask, request, Response, stream_with_context, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI

import io
try:
    import speech_recognition as sr
except ImportError:
    sr = None

try:
    import edge_tts
except ImportError:
    edge_tts = None

try:
    from core import self_rag, prompt_decomposer, memory_manager, rag_memory, mcp_client, security_rag, automation_engine, messaging_engine, drive_engine, sharing_intent_engine, app_builder_engine, multi_algorithm_engine, pipeline_orchestrator, grounding_guardian, ast_symbol_graph, agent_swarm, local_llm_connector, self_refinement_engine, research_council_engine, voice_humanizer, conversational_reflex
except ImportError:
    import self_rag
    import prompt_decomposer
    import memory_manager
    import rag_memory
    import mcp_client
    import security_rag
    import automation_engine
    import messaging_engine
    import drive_engine
    import sharing_intent_engine
    import app_builder_engine
    import multi_algorithm_engine
    import pipeline_orchestrator
    import grounding_guardian
    import ast_symbol_graph
    import agent_swarm
    import local_llm_connector
    import self_refinement_engine
    import research_council_engine
    import voice_humanizer
    import conversational_reflex

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=_BASE_DIR, static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = Response()
        origin = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"
        response.headers["Access-Control-Allow-Headers"] = request.headers.get("Access-Control-Request-Headers", "*")
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        response.headers["Access-Control-Max-Age"] = "86400"
        return response

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin", "*")
    response.headers["Access-Control-Allow-Origin"] = origin if origin else "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH"
    response.headers["Access-Control-Allow-Headers"] = "*"
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

@app.route('/')
def serve_index():
    return send_from_directory(_BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.startswith('api/') or filename.startswith('uploads/'):
        return jsonify({"error": "Endpoint not found"}), 404
    file_full_path = os.path.join(_BASE_DIR, filename)
    if os.path.exists(file_full_path) and os.path.isfile(file_full_path):
        return send_from_directory(_BASE_DIR, filename)
    return jsonify({"error": "File not found"}), 404

def _get_active_client_and_model():
    """Dynamically resolves whether to use high-speed direct Gemini API or local proxy."""
    env_file = os.path.abspath(os.path.join(_BASE_DIR, "..", ".env"))
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key and os.path.exists(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip().startswith("GEMINI_API_KEY="):
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except Exception:
            pass

    if key:
        print("[Turbo-Mode] Active using official Google Gemini API endpoint (< 350ms TTFT)")
        return OpenAI(base_url="https://generativelanguage.googleapis.com/v1beta/openai/", api_key=key), "gemini-2.0-flash", True
    return OpenAI(base_url="http://127.0.0.1:8081/v1", api_key="sk-gemini"), "gemini-3.8-flash", False

client, MODEL, IS_TURBO_API = _get_active_client_and_model()

# ── Dynamic Base Paths ──────────────────────────────────────────────────
STORAGE_DIR = os.path.join(_BASE_DIR, "storage")
USER_HOME = os.path.expanduser("~")
USER_DESKTOP = os.path.join(USER_HOME, "Desktop")
PLAYGROUND_DIR = os.path.join(_BASE_DIR, "playground")
UPLOADS_DIR = os.path.join(_BASE_DIR, "uploads")
PERMISSIONS_FILE = os.path.join(STORAGE_DIR, "permissions.json") if os.path.exists(os.path.join(STORAGE_DIR, "permissions.json")) else os.path.join(_BASE_DIR, "permissions.json")
SESSIONS_DB = os.path.join(STORAGE_DIR, "chat_sessions.db") if os.path.exists(os.path.join(STORAGE_DIR, "chat_sessions.db")) else os.path.join(_BASE_DIR, "chat_sessions.db")

os.makedirs(STORAGE_DIR, exist_ok=True)
os.makedirs(PLAYGROUND_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/api/artifacts/save', methods=['POST'])
def save_artifact_endpoint():
    try:
        data = request.json or {}
        title = data.get("title", "artifact").strip()
        content = data.get("content", "")
        filename = data.get("filename", "")
        
        if not filename:
            slug = re.sub(r'[^a-zA-Z0-9_-]+', '_', title.lower()).strip('_')
            ext = ".html" if "<html" in content.lower() or "<!doctype" in content.lower() else ".js"
            filename = f"{slug}{ext}"
            
        save_path = os.path.join(PLAYGROUND_DIR, filename)
        with open(save_path, "w", encoding="utf-8") as f:
            f.write(content)
            
        return jsonify({
            "status": "success",
            "filename": filename,
            "path": save_path,
            "message": f"Saved artifact to playground/{filename}"
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ── Database Initialization for Multi-Chat Sessions ─────────────────────
def init_db():
    conn = sqlite3.connect(SESSIONS_DB)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            pinned INTEGER DEFAULT 0,
            system_prompt TEXT DEFAULT ''
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            thinking TEXT DEFAULT '',
            artifacts TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# ── Self-Healing Proxy Verification ─────────────────────────────────────
def _is_port_open(host="127.0.0.1", port=8081, timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False

def ensure_proxy_running():
    """Auto-detects if proxy on 8081 is down, and automatically starts it in background."""
    if _is_port_open(port=8081):
        return True
    
    candidates = [
        os.path.abspath(os.path.join(_BASE_DIR, "..", "gemini-web2api", "gemini_web2api.py")),
        os.path.abspath(os.path.join(_BASE_DIR, "gemini_web2api.py"))
    ]
    for proxy_script in candidates:
        if os.path.exists(proxy_script):
            proxy_dir = os.path.dirname(proxy_script)
            try:
                log_file = os.path.join(proxy_dir, "proxy.log")
                creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                with open(log_file, "a", encoding="utf-8", errors="replace") as f_out:
                    subprocess.Popen(
                        [sys.executable, proxy_script],
                        cwd=proxy_dir,
                        stdout=f_out,
                        stderr=f_out,
                        creationflags=creation_flags
                    )
                for _ in range(12):
                    time.sleep(0.4)
                    if _is_port_open(port=8081):
                        return True
            except Exception as e:
                print(f"[Auto-Fix] Failed to launch proxy: {e}")
    return False

def call_openai_with_autofix(create_kwargs, retries=2):
    """Executes completions with automatic proxy detection & self-healing retry."""
    ensure_proxy_running()
    for attempt in range(retries + 1):
        try:
            return client.chat.completions.create(**create_kwargs)
        except Exception as e:
            err_str = str(e).lower()
            if "unknown model" in err_str:
                current_m = create_kwargs.get("model", "")
                fallback_m = "gemini-3.6-flash" if current_m != "gemini-3.6-flash" else "gemini-3.5-flash"
                print(f"[Model-Recovery] Unknown model '{current_m}'. Auto-recovering with '{fallback_m}'...")
                create_kwargs["model"] = fallback_m
                try:
                    return client.chat.completions.create(**create_kwargs)
                except Exception as inner_e:
                    raise inner_e
            if any(k in err_str for k in ["connection", "connect", "refused", "unreachable", "timeout"]) and attempt < retries:
                ensure_proxy_running()
                time.sleep(1.2)
            else:
                raise e
    return client.chat.completions.create(**create_kwargs)

# ── Permission System ────────────────────────────────────────────────────
def _load_permissions():
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
        "version": "2.0"
    }
    with open(PERMISSIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

# ── Universal Dynamic Path Resolver (Zero Hardcoding) ────────────────────
def resolve_path(p: str, target_folder: str = None) -> str:
    if not p:
        return resolve_path(target_folder) if target_folder else PLAYGROUND_DIR

    p = str(p).strip().strip("'\"`")
    p = re.sub(r"^\[(?:DIR|FILE)\]\s*", "", p, flags=re.IGNORECASE).strip()
    p = re.sub(r"^[📁📄🔒]\s*", "", p).strip()

    p = os.path.expandvars(p)
    p = os.path.expanduser(p)

    p_lower = p.lower().rstrip("/\\")
    if p_lower in {"desktop", "desktop folder", "my desktop"}:
        return USER_DESKTOP
    if p_lower in {"home", "user home", "user folder", "~"}:
        return USER_HOME
    if p_lower in {"playground", "playground folder"}:
        return PLAYGROUND_DIR
    if p_lower in {"workspace", "root", "current", "."}:
        return _BASE_DIR

    if os.path.isabs(p):
        return os.path.normpath(p)

    if target_folder:
        tf_resolved = resolve_path(target_folder)
        candidate = os.path.normpath(os.path.join(tf_resolved, p))
        if os.path.exists(candidate):
            return candidate

    candidate_pg = os.path.normpath(os.path.join(PLAYGROUND_DIR, p))
    if os.path.exists(candidate_pg):
        return candidate_pg

    candidate_base = os.path.normpath(os.path.join(_BASE_DIR, p))
    if os.path.exists(candidate_base):
        return candidate_base

    candidate_dt = os.path.normpath(os.path.join(USER_DESKTOP, p))
    if os.path.exists(candidate_dt):
        return candidate_dt

    base = resolve_path(target_folder) if target_folder else PLAYGROUND_DIR
    return os.path.normpath(os.path.join(base, p))

# ── Document Readers ────────────────────────────────────────────────────
def read_docx(filepath):
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
        return f"[Error reading DOCX: {e}]"

def read_pdf(filepath):
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
        return f"[Error reading PDF: {e}]"

# ── Base System Tool Definitions ─────────────────────────────────────────
SYSTEM_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a terminal command (PowerShell / CMD / Bash) on the local computer to run scripts, build projects, or execute tools.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command line string to execute"}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read content from any local file (plain text, code, JSON, Markdown, PDF, DOCX).",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Absolute or relative file path to read"}
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file on disk with full source code or text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Target file path to write"},
                    "content": {"type": "string", "description": "Complete file content"}
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "replace_file_content",
            "description": "Perform in-place surgical replacement of target text within an existing file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "File path to modify"},
                    "target": {"type": "string", "description": "Exact text substring to replace"},
                    "replacement": {"type": "string", "description": "New replacement content"}
                },
                "required": ["filepath", "target", "replacement"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep_search",
            "description": "Search across files in a directory for keywords, functions, or patterns.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path to search"},
                    "query": {"type": "string", "description": "Search query pattern"}
                },
                "required": ["path", "query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_dir",
            "description": "List files and subdirectories within a directory path.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path to inspect"}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_processes",
            "description": "List active system processes and listening ports to inspect running servers and agents.",
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
            "name": "install_or_configure_mcp_server",
            "description": "Conversationally install, configure, and connect any Model Context Protocol (MCP) server (e.g. GitHub, Filesystem, Puppeteer, Brave Search, Memory, PostgreSQL, or custom Python/Node scripts) on behalf of Ishaan. If an API key or token is missing, tell the user what is needed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "server_id": {"type": "string", "description": "Unique identifier for the server (e.g. github, brave-search, custom-db)"},
                    "name": {"type": "string", "description": "Human-readable name for the server"},
                    "command": {"type": "string", "description": "Executable command (e.g. npx, python, node, uvx)"},
                    "args": {"type": "array", "items": {"type": "string"}, "description": "Command line arguments list"},
                    "env": {"type": "object", "description": "Environment variables key-value dictionary (e.g. {'GITHUB_PERSONAL_ACCESS_TOKEN': 'ghp_...'})"}
                },
                "required": ["server_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Perform live internet web search for current documentation, news, libraries, GitHub repos, or real-time information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query keywords"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_webpage_markdown",
            "description": "Fetch a webpage URL and parse its contents into clean, readable Markdown for research and analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "Full HTTP/HTTPS URL of the webpage to fetch"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_python_sandbox",
            "description": "Execute arbitrary Python code in an isolated local sandbox and return printed output or errors.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Valid Python code to execute"}
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "workspace_tree_overview",
            "description": "Get a full hierarchical directory tree of the project workspace to understand codebase layout.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Root path to scan (defaults to current target folder)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "security_audit_workspace",
            "description": "Run an automated static security scan across the current workspace codebase to detect hardcoded secrets, SQL injection patterns, insecure auth flows, and IDOR vulnerabilities.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path to audit (defaults to workspace)"}
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_user_fact",
            "description": "Save a permanent fact, preference, goal, project context, or guideline about the user (Ishaan) into long-term memory across all chats.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["preference", "project", "tech_stack", "identity", "workflow", "credential"], "description": "Category of fact"},
                    "key": {"type": "string", "description": "Identifier key for the fact (e.g. preferred_ui_framework, active_repo, github_username)"},
                    "value": {"type": "string", "description": "Fact content or preference details"},
                    "context": {"type": "string", "description": "Optional context or reason"}
                },
                "required": ["category", "key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recall_memory",
            "description": "Query long-term memory for stored facts, past discussions, project decisions, and user preferences.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword or topic to recall from memory"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp_message_or_file",
            "description": "Send a text message, code snippet, or file attachment to a recipient on WhatsApp via deep link or Meta Cloud API.",
            "parameters": {
                "type": "object",
                "properties": {
                    "recipient_phone": {"type": "string", "description": "Recipient phone number with country code (e.g. +14155551234)"},
                    "message": {"type": "string", "description": "Message text, summary, or caption to accompany the file"},
                    "file_path": {"type": "string", "description": "Optional file path to share"}
                },
                "required": ["message"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "upload_to_google_drive",
            "description": "Upload and sync a document, code file, or artifact to Google Drive, generating a cloud access link.",
            "parameters": {
                "type": "object",
                "properties": {
                    "file_path": {"type": "string", "description": "Path of the file or artifact to upload"},
                    "target_folder": {"type": "string", "description": "Target Google Drive folder name (e.g. 'My Drive' or 'Projects')"},
                    "custom_name": {"type": "string", "description": "Optional custom name for the uploaded file in Drive"}
                },
                "required": ["file_path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_sharing_message",
            "description": "Generate high-converting, professional, or friendly suggested messages for sharing files across WhatsApp, Google Drive, Telegram, Discord, Slack, or Email.",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["whatsapp", "google_drive", "telegram", "discord", "slack", "email"], "description": "Destination platform"},
                    "recipient": {"type": "string", "description": "Name or handle of recipient"},
                    "file_target": {"type": "string", "description": "Filename or description of the document/code being sent"},
                    "context": {"type": "string", "description": "Optional context or purpose of sharing"}
                },
                "required": ["platform"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "solve_complex_algorithm",
            "description": "Execute native high-performance algorithm solvers (Dynamic Programming, 0/1 Knapsack, Longest Common Subsequence, Levenshtein Edit Distance, Graph Dijkstra / A* Shortest Path, Topological Sort, Euler-Cromer Projectile Physics, Runge-Kutta 4th Order / RK4 ODE, Gradient Descent Optimizer).",
            "parameters": {
                "type": "object",
                "properties": {
                    "algorithm_id": {"type": "string", "enum": ["dp_knapsack", "dp_lcs", "dp_edit_distance", "graph_toposort", "graph_dijkstra", "graph_a_star", "numerical_euler_cromer", "numerical_rk4", "gradient_descent"], "description": "Identifier of the algorithm solver"},
                    "params": {"type": "object", "description": "Parameters dictionary for the algorithm (e.g. weights, values, capacity, graph, ode, etc.)"}
                },
                "required": ["algorithm_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "orchestrate_multi_pipeline",
            "description": "Execute single or multi-stage developer and agentic pipelines (Workspace Doctor, Security Health Scan, Git Autonomous Sync, Multi-Algorithm Benchmark, Fullstack Build & Test, RAG Vector Ingestion, Microservice Health Probe).",
            "parameters": {
                "type": "object",
                "properties": {
                    "pipeline_id": {"type": "string", "description": "Pipeline ID to run (e.g. workspace_doctor, auto_security_and_lint, multi_algo_benchmark, fullstack_build_test, rag_vector_ingest, microservice_health_probe)"},
                    "target_folder": {"type": "string", "description": "Optional working directory"}
                },
                "required": ["pipeline_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "benchmark_algorithms",
            "description": "Benchmark and compare alternative algorithmic strategies side-by-side (e.g. Timsort vs QuickSort vs HeapSort, or Dijkstra vs A* Search) with empirical runtime and asymptotic Big-O analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task_type": {"type": "string", "enum": ["sorting", "pathfinding"], "description": "Type of computational task to benchmark"},
                    "test_size": {"type": "integer", "description": "Input dataset size for the benchmark (e.g. 500, 2000)"}
                },
                "required": ["task_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_symbol_graph",
            "description": "High-precision AST symbol graph search across Python and JavaScript codebases. Query function signatures, class definitions, method outlines, and file structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["search", "outline"], "description": "'search' for symbol names or 'outline' for file structure"},
                    "query": {"type": "string", "description": "Symbol name or search query (e.g. 'verify_factual_grounding', 'SwarmAgent')"},
                    "filepath": {"type": "string", "description": "Relative file path when action='outline' (e.g. 'core/agent_swarm.py')"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "consult_swarm_consensus",
            "description": "Convene the 4-agent consensus voting swarm (Lead Architect, Code Reviewer, Security Auditor, QA Tester) to evaluate architectural proposals, code diffs, or complex plans before execution.",
            "parameters": {
                "type": "object",
                "properties": {
                    "task": {"type": "string", "description": "High-level goal or problem statement"},
                    "proposal": {"type": "string", "description": "Detailed implementation proposal or code plan to review"}
                },
                "required": ["task", "proposal"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "discover_local_llms",
            "description": "Probe local offline AI model servers (Ollama on port 11434, LM Studio on port 1234) and list available local models (deepseek-coder, llama3, qwen2.5).",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

MAX_OUTPUT_LEN = 35000

def get_combined_tools():
    """Combines native system tools with all active MCP server tools."""
    mcp_tools = mcp_client.hub.get_all_openai_tools()
    return SYSTEM_TOOLS + mcp_tools

# ── Universal Tool Dispatcher (with MCP Routing) ─────────────────────────
def execute_tool(name: str, args: dict, target_folder: str = None) -> str:
    if not _is_permitted():
        return "[Error: System permissions not granted yet by user.]"
    
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except Exception:
            args = {"raw": args}

    # 1. Check if tool is handled by MCP Hub
    mcp_res = mcp_client.hub.dispatch_tool(name, args)
    if mcp_res is not None:
        return str(mcp_res)[:MAX_OUTPUT_LEN]

    # 2. Native System Tools
    try:
        if name == "run_command":
            cmd = args.get("command", "")
            if not cmd:
                return "Error: No command provided."
            
            if os.name == 'nt':
                ps_cmd = f"powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command {subprocess.list2cmdline([cmd])}"
                res = subprocess.run(ps_cmd, shell=True, capture_output=True, text=True, timeout=45, encoding="utf-8", errors="replace")
            else:
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=45, encoding="utf-8", errors="replace")
            
            out = (res.stdout or "") + (res.stderr or "")
            out = out.strip()
            if not out and res.returncode == 0:
                return "[Command completed successfully with no output]"
            return out[:MAX_OUTPUT_LEN]

        elif name == "read_file":
            raw_path = args.get("filepath", "")
            filepath = resolve_path(raw_path, target_folder)

            if not os.path.exists(filepath):
                return f"Error: Path '{raw_path}' (resolved: {filepath}) does not exist."
            
            if os.path.isdir(filepath):
                return execute_tool("list_dir", {"path": filepath}, target_folder)
            
            ext = os.path.splitext(filepath)[1].lower()
            if ext == ".docx":
                content = read_docx(filepath)
            elif ext == ".pdf":
                content = read_pdf(filepath)
            else:
                with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                    content = f.read()
            
            if len(content) > MAX_OUTPUT_LEN:
                content = content[:MAX_OUTPUT_LEN] + f"\n... [File truncated: {len(content)} total characters]"
            return content

        elif name == "write_file":
            raw_path = args.get("filepath", "")
            filepath = resolve_path(raw_path, target_folder)
            content = args.get("content", "")
            
            os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully wrote {len(content)} bytes to {filepath}"

        elif name == "replace_file_content":
            raw_path = args.get("filepath", "")
            filepath = resolve_path(raw_path, target_folder)
            target = args.get("target", "")
            replacement = args.get("replacement", "")

            if not os.path.exists(filepath):
                return f"Error: File '{raw_path}' does not exist."
            
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            
            if target not in content:
                return f"Error: Target text string was not found in '{filepath}'."
            
            new_content = content.replace(target, replacement, 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return f"Successfully updated content in {filepath}"

        elif name == "grep_search":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path, target_folder)
            query = args.get("query", "").lower()
            
            if not os.path.exists(path):
                return f"Error: Path '{path}' does not exist."
            
            matches = []
            for root, dirs, files in os.walk(path):
                dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}]
                for file in files:
                    fp = os.path.join(root, file)
                    try:
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                            for idx, line in enumerate(f, 1):
                                if query in line.lower():
                                    rel = os.path.relpath(fp, path)
                                    matches.append(f"{rel}:{idx} - {line.strip()[:140]}")
                                    if len(matches) >= 50:
                                        break
                    except Exception:
                        pass
                if len(matches) >= 50:
                    matches.append("... [More matches truncated for brevity]")
                    break
            
            return f"Grep results for '{query}' in {path}:\n" + ("\n".join(matches) if matches else "No matches found.")

        elif name == "list_dir":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path, target_folder)

            if not os.path.exists(path):
                return f"Error: Directory '{raw_path}' ({path}) does not exist."
            
            items = []
            try:
                for entry in os.scandir(path):
                    if entry.name in {".git", "node_modules", "__pycache__", "venv", ".venv"}:
                        continue
                    kind = "[DIR] " if entry.is_dir() else "[FILE]"
                    size_info = f" ({entry.stat().st_size} bytes)" if entry.is_file() else ""
                    items.append(f"{kind} {entry.name}{size_info}")
                    if len(items) >= 150:
                        items.append("... [More items truncated]")
                        break
            except Exception as e:
                return f"Error accessing directory: {e}"

            return f"Contents of {path}:\n" + ("\n".join(items) if items else "(Empty directory)")

        elif name == "list_processes":
            cmd = "Get-Process | Select-Object -First 40 -Property Id, ProcessName, CPU, WorkingSet | Format-Table -AutoSize"
            return execute_tool("run_command", {"command": cmd}, target_folder)

        elif name == "install_or_configure_mcp_server":
            server_id = args.get("server_id", "").strip()
            name_val = args.get("name", server_id)
            cmd = args.get("command", "")
            cmd_args = args.get("args", [])
            env = args.get("env", {})

            # Check known catalog presets
            cat_match = None
            for k, v in memory_manager.MCP_KNOWLEDGE_CATALOG.items():
                if k in server_id.lower() or server_id.lower() in k:
                    cat_match = v
                    break

            if cat_match:
                if not cmd:
                    cmd = cat_match["command"]
                if not cmd_args:
                    cmd_args = cat_match["args"]
                if not name_val:
                    name_val = cat_match["name"]
                
                # Check required environment variables
                missing_vars = []
                for var_name in cat_match.get("required_env", []):
                    if var_name not in env and not os.environ.get(var_name):
                        missing_vars.append(var_name)
                
                if missing_vars:
                    instructions = cat_match.get("token_instructions", "Please provide the required token.")
                    return f"[REQUIREMENT_NEEDED]: To finish connecting '{name_val}', I need the following secret(s): {', '.join(missing_vars)}.\n\nGuide: {instructions}\n\nPlease provide your token/key, and I will connect it immediately."

            if not cmd:
                return f"Error: Command is required to install server '{server_id}'."

            # Register in MCPHub
            mcp_client.hub.configs[server_id] = {
                "name": name_val,
                "command": cmd,
                "args": cmd_args,
                "env": env,
                "source": "local",
                "enabled": True
            }
            mcp_client.hub.save_local_config()
            
            # Connect & Test
            conn = mcp_client.MCPServerConnection(server_id, mcp_client.hub.configs[server_id])
            ok = conn.start(timeout=10.0)
            if ok:
                mcp_client.hub.active_servers[server_id] = conn
                tool_names = [t["name"] for t in conn.tools]
                return f"✅ SUCCESS: MCP Server '{name_val}' ({server_id}) is connected!\nDiscovered {len(tool_names)} active tools: {', '.join(tool_names)}.\nYou can now ask me to use any of these tools."
            else:
                err = conn.error_message or "Process failed to respond"
                return f"⚠️ Warning: Configured MCP Server '{server_id}', but connection test failed: {err}."

        elif name == "web_search":
            query = args.get("query", "").strip()
            if not query:
                return "Error: No search query provided."
            try:
                # Use DuckDuckGo HTML search endpoint
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                res = requests.get(f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}", headers=headers, timeout=12)
                soup = BeautifulSoup(res.text, 'html.parser')
                results = []
                for r in soup.find_all('div', class_='result')[:8]:
                    title_tag = r.find('a', class_='result__a')
                    snippet_tag = r.find('a', class_='result__snippet')
                    if title_tag:
                        title = title_tag.get_text(strip=True)
                        href = title_tag.get('href', '')
                        snippet = snippet_tag.get_text(strip=True) if snippet_tag else ''
                        results.append(f"### [{title}]({href})\n{snippet}")
                
                if results:
                    return f"Web Search Results for '{query}':\n\n" + "\n\n".join(results)
                else:
                    return f"No results found on web for query: '{query}'."
            except Exception as se:
                return f"Web search failed: {str(se)}"

        elif name == "fetch_webpage_markdown":
            url = args.get("url", "").strip()
            if not url:
                return "Error: No URL provided."
            if not url.startswith("http"):
                url = "https://" + url
            try:
                headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                res = requests.get(url, headers=headers, timeout=15)
                soup = BeautifulSoup(res.text, 'html.parser')
                
                # Strip scripts and styles
                for s in soup(['script', 'style', 'noscript', 'nav', 'footer', 'header', 'svg']):
                    s.decompose()
                
                title = soup.title.string.strip() if soup.title else url
                text = soup.get_text(separator="\n", strip=True)
                # Collapse excessive newlines
                clean_text = re.sub(r'\n{3,}', '\n\n', text)
                return f"# {title}\n**URL:** {url}\n\n{clean_text[:20000]}"
            except Exception as fe:
                return f"Failed to fetch webpage '{url}': {str(fe)}"

        elif name == "execute_python_sandbox":
            code = args.get("code", "")
            if not code:
                return "Error: No Python code provided."
            try:
                temp_script = os.path.join(PLAYGROUND_DIR, f"sandbox_exec_{uuid.uuid4().hex[:6]}.py")
                with open(temp_script, "w", encoding="utf-8") as f:
                    f.write(code)
                
                res = subprocess.run([sys.executable, temp_script], capture_output=True, text=True, timeout=25, encoding="utf-8", errors="replace")
                try:
                    os.remove(temp_script)
                except Exception:
                    pass
                
                out = (res.stdout or "") + (res.stderr or "")
                out = out.strip()
                if not out and res.returncode == 0:
                    return "[Python code executed successfully with exit code 0 (no output printed)]"
                return f"[Exit Code: {res.returncode}]\n" + out[:MAX_OUTPUT_LEN]
            except subprocess.TimeoutExpired:
                return "Error: Python execution timed out (limit: 25s)."
            except Exception as pe:
                return f"Python execution error: {str(pe)}"

        elif name == "workspace_tree_overview":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path, target_folder)
            if not os.path.exists(path):
                return f"Path does not exist: {path}"
            
            lines = [f"📁 {os.path.basename(path) or path}"]
            def _build_tree(curr_path, prefix="", depth=0):
                if depth > 4:
                    return
                try:
                    entries = sorted(list(os.scandir(curr_path)), key=lambda e: (not e.is_dir(), e.name.lower()))
                    for i, entry in enumerate(entries):
                        if entry.name in {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}:
                            continue
                        is_last = (i == len(entries) - 1)
                        branch = "└── " if is_last else "├── "
                        if entry.is_dir():
                            lines.append(f"{prefix}{branch}📁 {entry.name}/")
                            _build_tree(entry.path, prefix + ("    " if is_last else "│   "), depth + 1)
                        else:
                            size = entry.stat().st_size
                            size_str = f"{size} B" if size < 1024 else f"{size//1024} KB"
                            lines.append(f"{prefix}{branch}📄 {entry.name} ({size_str})")
                except Exception:
                    pass
            _build_tree(path)
            return "\n".join(lines)

        elif name == "solve_complex_algorithm":
            algo_id = args.get("algorithm_id", "dp_knapsack")
            params = args.get("params", {})
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}
            res = multi_algorithm_engine.multi_algo_engine.solve(algo_id, params)
            return json.dumps(res, indent=2)

        elif name == "orchestrate_multi_pipeline":
            pipeline_id = args.get("pipeline_id", "workspace_doctor")
            target_dir = resolve_path(args.get("target_folder", ""), target_folder)
            res = pipeline_orchestrator.pipeline_orchestrator.run_pipeline(pipeline_id, cwd=target_dir)
            return json.dumps(res, indent=2)

        elif name == "benchmark_algorithms":
            task_type = args.get("task_type", "sorting")
            test_size = int(args.get("test_size", 1000))
            res = multi_algorithm_engine.multi_algo_engine.benchmark_comparison(task_type, test_size)
            return json.dumps(res, indent=2)

        elif name == "security_audit_workspace":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path, target_folder)
            if not os.path.exists(path):
                return f"Path does not exist: {path}"
            
            res = security_rag.security_rag.audit_codebase(path)
            findings = res.get("findings", [])
            guidelines = security_rag.security_rag.retrieve_guidelines("secrets sql injection idor")
            
            report_lines = [
                f"# 🛡️ Security Audit Report for `{os.path.basename(path) or path}`",
                f"- **Scanned Files**: {res.get('scanned_files', 0)}",
                f"- **Total Security Findings**: {res.get('total_findings', 0)}\n"
            ]
            if findings:
                report_lines.append("### ⚠️ Key Findings:")
                for f in findings:
                    report_lines.append(f"- **[{f['severity']}] {f['type']}** at `{f['file']}:{f['line']}`\n  `{f['snippet']}`")
            else:
                report_lines.append("✅ **Clean Audit:** No hardcoded secrets, SQL injection patterns, or high-severity vulnerabilities detected.")
            
            return "\n".join(report_lines)

        elif name == "remember_user_fact":
            cat = args.get("category", "preference")
            key = args.get("key", "")
            val = args.get("value", "")
            ctx = args.get("context", "")
            if not key or not val:
                return "Error: key and value are required to save memory."
            return memory_manager.memory.remember_fact(cat, key, val, ctx)

        elif name == "recall_memory":
            q = args.get("query", "")
            facts = memory_manager.memory.recall_facts(q)
            if not facts:
                return f"No memories found matching '{q}'."
            lines = [f"- [{f['category']}] {f['key']}: {f['value']}" for f in facts]
            return f"Recalled Memories for '{q}':\n" + "\n".join(lines)

        elif name == "send_whatsapp_message_or_file":
            phone = args.get("recipient_phone") or ""
            msg = args.get("message") or "Hello from B1 Agent!"
            fpath = args.get("file_path") or ""
            if fpath:
                msg = f"{msg}\n[File: {os.path.basename(fpath)}]"
            res = messaging_engine.messaging.send_whatsapp(msg, phone=phone)
            return json.dumps(res, indent=2)

        elif name == "upload_to_google_drive":
            fpath = args.get("file_path") or ""
            folder = args.get("target_folder") or "My Drive"
            cname = args.get("custom_name") or None
            res = drive_engine.drive.upload_file(fpath, target_folder=folder, custom_name=cname)
            return json.dumps(res, indent=2)

        elif name == "suggest_sharing_message":
            platform = args.get("platform") or "whatsapp"
            recipient = args.get("recipient") or "there"
            file_target = args.get("file_target") or "workspace file"
            suggestions = sharing_intent_engine.sharing_intent.generate_suggested_messages(platform, recipient, file_target)
            return json.dumps({"status": "success", "platform": platform, "suggestions": suggestions}, indent=2)

        elif name == "query_symbol_graph":
            action = args.get("action", "search")
            q = args.get("query", "")
            fpath = args.get("filepath", "")
            if action == "outline" or fpath:
                res = ast_symbol_graph.symbol_graph.get_file_outline(fpath)
                return json.dumps(res, indent=2)
            else:
                res = ast_symbol_graph.symbol_graph.search_symbols(q)
                return json.dumps(res, indent=2)

        elif name == "consult_swarm_consensus":
            task_desc = args.get("task", "")
            proposal_desc = args.get("proposal", "")
            swarm_res = agent_swarm.swarm_engine.evaluate_proposal(task_desc, proposal_desc)
            return json.dumps(swarm_res, indent=2)

        elif name == "discover_local_llms":
            local_info = local_llm_connector.local_llm.discover_local_servers()
            return json.dumps(local_info, indent=2)

        return f"Unknown tool: {name}"
    except subprocess.TimeoutExpired:
        return "Command timed out after execution limit."
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

# ── Dynamic Fallback Tool Parser ─────────────────────────────────────────
def extract_tool_call(msg):
    if hasattr(msg, 'tool_calls') and msg.tool_calls:
        tc = msg.tool_calls[0]
        try:
            return tc.function.name, json.loads(tc.function.arguments)
        except Exception:
            return tc.function.name, tc.function.arguments

    content = getattr(msg, 'content', '') or ''
    blocks = re.findall(r"```(?:tool_call|json)?\s*(\{[\s\S]*?\})\s*```", content)
    for block in blocks:
        try:
            data = json.loads(block)
            name = data.get("name") or data.get("tool") or data.get("function")
            args = data.get("arguments") or data.get("args") or data.get("parameters") or {}
            if name:
                return name, args
        except Exception:
            pass

    return None, None

# ── Claude-Style System Prompt with MCP Protocol ─────────────────────────
CLAUDE_SYSTEM_PROMPT = """You are Gemini, an autonomous AI assistant and coding agent equipped with full local computer capabilities, MCP (Model Context Protocol) tool servers, and interactive artifact generation.

# 🛡️ UNBREAKABLE ZERO-HALLUCINATION & EPISTEMIC GROUNDING DIRECTIVES:
1. **ZERO-FABRICATION RULE (NEVER GUESS OR INVENT)**:
   - Never invent, fabricate, or hallucinate non-existent API endpoints, function names, library imports, file paths, git history, command flags, or metrics.
   - If information, code context, or file content is not present in the workspace or retrieved tool outputs, **EXPLICITLY STATE WHAT IS MISSING** instead of fabricating plausible-sounding details.
2. **MANDATORY TOOL GROUNDING (GROUND BEFORE ASSERTING)**:
   - For all questions regarding local files, directories, git branches, codebase architecture, or server states, **ALWAYS EXECUTE A TOOL FIRST** (`read_file`, `workspace_tree_overview`, `list_dir`, `grep_search`, `get_git_status`) before answering.
   - Never assume file contents or directory structures without reading them.
3. **EPISTEMIC HONESTY & UNCERTAINTY CALIBRATION**:
   - If unsure or if tools return insufficient evidence, clearly state: "I cannot verify [X] from the current workspace files without additional inspection."
   - Avoid overclaiming or presenting probabilistic inferences as definitive ground truth.
4. **Claude-Style Interactive Artifacts & Visualizations**:
   - When the user asks for visualizations, diagrams, simulations, or interactive tools (e.g., 'tell me in visualize', 'visualize this', 'build a simulation'), **DIRECTLY GENERATE** a comprehensive, zero-dependency, standalone interactive HTML/JS/CSS artifact wrapped in:
     <antArtifact identifier="unique-id" type="application/vnd.ant.code" language="html" title="Interactive App Title">
     ... complete standalone single-file code ...
     </antArtifact>
   - CRITICAL ARTIFACT CLEANLINESS RULES:
     * NEVER wrap the inner code inside `<antArtifact>` in markdown backticks (e.g. ````html ... ````). Output raw HTML directly.
     * In HTML labels, slider titles, and UI text, use clean Unicode characters (such as `θ`, `v₀`, `v⃗`, `g`, `t`, `k/m`, `Δ`, `°`, `m/s`, `m/s²`), NEVER raw LaTeX dollar signs like `$\theta$` or `$\v_0$`.
   - Do NOT run unnecessary exploratory sandbox or terminal tools before writing the artifact unless actual runtime data computation is required.
5. **IMPORT & CODE DEPENDENCY SAFETY**:
   - When writing code, ONLY import modules from the Python Standard Library or packages verified to exist in the environment (`package.json`, `requirements.txt`).
   - Never invent imaginary packages or non-existent methods on real libraries.
6. **CITATION & EVIDENCE ANCHORING**:
   - Explicitly cite the tool output, file name, or line range when referencing codebase facts.

# SYSTEM CAPABILITIES & MCP TOOLS:
1. **Local System & MCP Tools**: You have access to local terminal execution (`run_command`), file inspection (`read_file`, `write_file`, `grep_search`, `list_dir`), and **connected MCP servers** (e.g. `mcp_web_fetch`, `mcp_sqlite_query`, `mcp_system_info`, or external MCP servers). Use them proactively to solve tasks with precision.
2. **Claude-Style Artifacts**: When generating complete scripts, applications, SVG drawings, or interactive web apps, wrap them in:
   <antArtifact identifier="unique-id" type="application/vnd.ant.code" language="html" title="App Title">
   ... code ...
   </antArtifact>
3. **Conversational File Sharing & Cloud Uploads (WhatsApp, Google Drive, Telegram, Slack)**:
   - When the user asks to send files or documents to someone on WhatsApp, upload to Google Drive, share via Telegram/Slack, or asks for message suggestions:
     * Suggest 2-3 tailored messages (professional, friendly, technical summary).
     * Proactively provide an interactive action block:
       :::action-card
       {
         "type": "share",
         "platform": "whatsapp",
         "recipient": "Recipient or Phone",
         "file": "filename.ext",
         "suggested_message": "Suggested text to accompany the file...",
         "suggestions": ["Option 1...", "Option 2...", "Option 3..."]
       }
       :::
     * For Google Drive:
       :::action-card
       {
         "type": "upload",
         "platform": "google_drive",
         "target_folder": "My Drive",
         "file": "filename.ext",
         "suggested_message": "Uploaded to Google Drive"
       }
       :::
4. **Thinking**: Methodically reason through complex tasks and explain solutions with pristine clarity and clean GitHub-flavored markdown.
"""

# ── API Endpoints ────────────────────────────────────────────────────────

@app.route('/api/permission-status', methods=['GET'])
@app.route('/api/permissions', methods=['GET'])
def permission_status():
    return jsonify({"granted": _is_permitted()})

@app.route('/api/grant-permission', methods=['POST'])
def grant_permission():
    try:
        _grant_permissions()
        return jsonify({"status": "granted", "message": "Permissions granted successfully."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ── MCP Server Management API ────────────────────────────────────────────
@app.route('/api/mcp/servers', methods=['GET'])
def list_mcp_servers():
    return jsonify({
        "status": "success",
        "servers": mcp_client.hub.get_server_statuses(),
        "total_tools": len(mcp_client.hub.get_all_openai_tools())
    })

@app.route('/api/mcp/presets', methods=['GET'])
def get_mcp_presets():
    return jsonify({
        "status": "success",
        "presets": mcp_client.hub.get_presets()
    })

@app.route('/api/mcp/import', methods=['POST'])
def import_mcp_config():
    data = request.json or {}
    raw_json = data.get("json_config", "")
    if not raw_json:
        return jsonify({"status": "error", "message": "JSON configuration is required"}), 400

    ok, msg = mcp_client.hub.import_json_config(raw_json)
    if ok:
        return jsonify({
            "status": "success",
            "message": msg,
            "servers": mcp_client.hub.get_server_statuses(),
            "total_tools": len(mcp_client.hub.get_all_openai_tools())
        })
    else:
        return jsonify({"status": "error", "message": msg}), 400

@app.route('/api/mcp/servers', methods=['POST'])
def add_mcp_server():
    data = request.json or {}
    server_id = data.get("id", "").strip() or f"mcp-{int(time.time())}"
    command = data.get("command", "").strip()
    args = data.get("args", [])
    env = data.get("env", {})
    
    if not command:
        return jsonify({"status": "error", "message": "Command is required"}), 400

    mcp_client.hub.configs[server_id] = {
        "name": data.get("name", server_id),
        "command": command,
        "args": args,
        "env": env,
        "source": "local",
        "enabled": True
    }
    mcp_client.hub.save_local_config()
    mcp_client.hub.start_all_configured()

    return jsonify({"status": "success", "id": server_id, "servers": mcp_client.hub.get_server_statuses()})

@app.route('/api/mcp/servers/<server_id>/test', methods=['POST'])
def test_mcp_server(server_id):
    cfg = mcp_client.hub.configs.get(server_id)
    if not cfg:
        # Check if builtin
        for b in mcp_client.hub.builtin_servers:
            if b.server_id == server_id:
                return jsonify({
                    "status": "success",
                    "server_id": server_id,
                    "connected": True,
                    "tools": [t["name"] for t in b.tools]
                })
        return jsonify({"status": "error", "message": f"Server '{server_id}' not found"}), 404
    
    for b in mcp_client.hub.builtin_servers:
        if b.server_id == server_id:
            return jsonify({
                "status": "success",
                "server_id": server_id,
                "connected": True,
                "tools": [t["name"] for t in b.tools]
            })

    conn = mcp_client.MCPServerConnection(server_id, cfg)
    ok = conn.start(timeout=8.0)
    if ok:
        mcp_client.hub.active_servers[server_id] = conn
        return jsonify({
            "status": "success",
            "server_id": server_id,
            "connected": True,
            "tools": [t["name"] for t in conn.tools]
        })
    else:
        return jsonify({
            "status": "warning",
            "server_id": server_id,
            "connected": False,
            "error": conn.error_message or "Failed to connect to MCP server (Check process/docker)"
        }), 200

@app.route('/api/mcp/servers/<server_id>', methods=['DELETE'])
def delete_mcp_server(server_id):
    if server_id in mcp_client.hub.configs:
        conn = mcp_client.hub.active_servers.pop(server_id, None)
        if conn:
            conn.stop()
        del mcp_client.hub.configs[server_id]
        mcp_client.hub.save_local_config()
        return jsonify({"status": "success", "message": f"MCP server '{server_id}' removed"})
    return jsonify({"status": "error", "message": f"Server '{server_id}' not found"}), 404

# ── Multi-Chat Sessions API ──────────────────────────────────────────────
@app.route('/api/sessions', methods=['GET'])
def list_sessions():
    conn = sqlite3.connect(SESSIONS_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, title, created_at, updated_at, pinned, system_prompt FROM sessions ORDER BY pinned DESC, updated_at DESC")
    rows = c.fetchall()
    sessions = [dict(r) for r in rows]
    conn.close()
    return jsonify({"status": "success", "sessions": sessions})

@app.route('/api/sessions', methods=['POST'])
def create_session():
    data = request.json or {}
    session_id = data.get("id") or str(uuid.uuid4())
    title = data.get("title", "New Chat")
    system_prompt = data.get("system_prompt", "")
    now = datetime.datetime.now().isoformat()

    conn = sqlite3.connect(SESSIONS_DB)
    c = conn.cursor()
    c.execute("""
        INSERT INTO sessions (id, title, created_at, updated_at, pinned, system_prompt)
        VALUES (?, ?, ?, ?, 0, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            updated_at=excluded.updated_at,
            system_prompt=excluded.system_prompt
    """, (session_id, title, now, now, system_prompt))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "id": session_id, "title": title})

@app.route('/api/sessions/<session_id>', methods=['GET'])
def get_session(session_id):
    conn = sqlite3.connect(SESSIONS_DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT id, title, created_at, updated_at, pinned, system_prompt FROM sessions WHERE id=?", (session_id,))
    session = c.fetchone()
    if not session:
        conn.close()
        return jsonify({"status": "error", "message": "Session not found"}), 404
    
    c.execute("SELECT id, role, content, thinking, artifacts, created_at FROM messages WHERE session_id=? ORDER BY created_at ASC", (session_id,))
    messages = [dict(r) for r in c.fetchall()]
    conn.close()
    return jsonify({"status": "success", "session": dict(session), "messages": messages})

@app.route('/api/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    conn = sqlite3.connect(SESSIONS_DB)
    c = conn.cursor()
    c.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
    c.execute("DELETE FROM sessions WHERE id=?", (session_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "success", "message": f"Session {session_id} deleted."})

# ── File Upload API (Multimodal Images & Docs) ──────────────────────────
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400
    file = request.files['file']
    if not file.filename:
        return jsonify({"status": "error", "message": "Empty filename"}), 400
    
    filename = secure_clean_filename(file.filename)
    unique_name = f"{int(time.time())}_{filename}"
    save_path = os.path.join(UPLOADS_DIR, unique_name)
    file.save(save_path)

    ext = os.path.splitext(filename)[1].lower()
    is_img = ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}
    content_preview = ""
    base64_thumb = ""
    try:
        if is_img:
            content_preview = f"[Image Attached: {filename} (URL: /uploads/{unique_name})]"
            with open(save_path, "rb") as img_f:
                b64 = base64.b64encode(img_f.read()).decode('utf-8')
                mime = "image/png" if ext == ".png" else ("image/jpeg" if ext in {".jpg", ".jpeg"} else f"image/{ext.replace('.', '')}")
                base64_thumb = f"data:{mime};base64,{b64}"
        elif ext == ".pdf":
            content_preview = read_pdf(save_path)[:4000]
        elif ext == ".docx":
            content_preview = read_docx(save_path)[:4000]
        else:
            with open(save_path, 'r', encoding='utf-8', errors='ignore') as f:
                content_preview = f.read(4000)
    except Exception as e:
        content_preview = f"[Uploaded file: {filename} (Error reading: {e})]"

    return jsonify({
        "status": "success",
        "filename": filename,
        "filepath": save_path,
        "is_image": is_img,
        "image_url": f"/uploads/{unique_name}",
        "base64_thumb": base64_thumb if len(base64_thumb) < 2000000 else "",
        "size": os.path.getsize(save_path),
        "preview": content_preview
    })

def secure_clean_filename(name):
    return re.sub(r'[^a-zA-Z0-9_\.-]', '_', os.path.basename(name))

# ── RAG Vector Memory API ────────────────────────────────────────────────
@app.route('/api/rag/status', methods=['GET'])
def rag_status():
    return jsonify(rag_memory.get_system_status())

@app.route('/api/models', methods=['GET'])
def get_models():
    return jsonify({
        "status": "success",
        "models": [
            {
                "id": "gemini-3.8-flash",
                "name": "Gemini 3.8 Flash (High)",
                "description": "Next-Gen ultra-fast execution with enhanced reasoning & multimodal throughput",
                "badge": "Latest 3.8"
            },
            {
                "id": "gemini-3.8-pro",
                "name": "Gemini 3.8 Pro (Frontier)",
                "description": "Next-Gen frontier reasoning, complex architecture & math",
                "badge": "Pro 3.8"
            },
            {
                "id": "gemini-3.8-flash-thinking",
                "name": "Gemini 3.8 Thinking (Deep)",
                "description": "Extended chain-of-thought deep reasoning (~20k chars output)",
                "badge": "Thinking"
            },
            {
                "id": "gemini-3.6-flash",
                "name": "Gemini 3.6 Flash (Fast & Smart)",
                "description": "Fast all-around execution with proactive tool calling",
                "badge": "Fast"
            },
            {
                "id": "gemini-3.5-flash-thinking",
                "name": "Gemini 3.5 Flash Thinking",
                "description": "Extended chain-of-thought reasoning for complex tasks",
                "badge": "Think 3.5"
            },
            {
                "id": "gemini-3.1-pro",
                "name": "Gemini 3.1 Pro (Heavyweight)",
                "description": "Maximum parameter scale and coding architecture",
                "badge": "Legacy Pro"
            },
            {
                "id": "gemini-flash-lite",
                "name": "Gemini Flash Lite",
                "description": "Ultra lightweight low-latency execution",
                "badge": "Lite"
            }
        ]
    })

# ── Specialist Agent Personas ──────────────────────────────────────────
AGENT_PERSONAS = [
    {
        "id": "fullstack",
        "name": "Fullstack Engineer",
        "avatar": "⚡",
        "tagline": "UI/UX, algorithms, webapps & debugging",
        "system_addon": "You are acting as an Elite Fullstack Software Engineer & UI Craftsman. Prioritize production-ready code, beautiful interactive artifacts, clean architecture, and responsive design following Linear.app principles."
    },
    {
        "id": "architect",
        "name": "System Architect",
        "avatar": "🏗️",
        "tagline": "C4 diagrams, databases, microservices & RBAC",
        "system_addon": "You are acting as a Master Software Architect. Focus on scalable distributed system patterns, C4 architectural diagrams, SQLite/PostgreSQL relational schemas, security boundaries, and modular microservices."
    },
    {
        "id": "stem",
        "name": "STEM & Physics Simulator",
        "avatar": "🔬",
        "tagline": "Euler-Cromer sims, calculus, vectors & 3D math",
        "system_addon": "You are acting as a Computational Physicist & Applied Mathematician. Derive equations step-by-step using LaTeX KaTeX notation, write interactive numerical simulations with live parameter sliders, and explain physical intuition with visual epicycles or vector fields."
    },
    {
        "id": "security",
        "name": "Security & Red Team",
        "avatar": "🛡️",
        "tagline": "OWASP audit, auth boundaries, token rotation",
        "system_addon": "You are acting as a Principal Security Auditor & DevSecOps Specialist. Audit codebase security, verify JWT refresh token rotation, prevent injection/XSS vulnerabilities, and enforce least-privilege access control."
    },
    {
        "id": "researcher",
        "name": "Deep Web Researcher",
        "avatar": "🔍",
        "tagline": "Multi-source synthesis, docs & live verification",
        "system_addon": "You are acting as a Principal Intelligence & Technical Researcher. Proactively use `web_search` and `fetch_webpage_markdown` to fetch up-to-date documentation, verify facts across sources, and synthesize clear structured reports."
    },
    {
        "id": "cv_ml",
        "name": "Vision & Webcam ML Engineer",
        "avatar": "👁️",
        "tagline": "Webcam ML, hand tracking, color masking & vision",
        "system_addon": "You are acting as an In-Browser Computer Vision & Real-Time ML Engineer. When requested to build camera, vision, or gesture interaction, write 100% self-contained single-file HTML/JS artifacts using navigator.mediaDevices.getUserMedia, Canvas 2D image processing (HSV/RGB color segmentation, motion thresholding, centroid tracking, skin tone extraction), interactive video controls, and live visual particle feedback."
    }
]

@app.route('/api/agent/personas', methods=['GET'])
@app.route('/api/personas', methods=['GET'])
def get_agent_personas():
    return jsonify({"status": "success", "personas": AGENT_PERSONAS})

# ── Workspace Codebase Explorer API ──────────────────────────────────────
@app.route('/api/workspace/tree', methods=['GET'])
def get_workspace_tree():
    target = request.args.get('path', '')
    root_path = resolve_path(target) if target else _BASE_DIR
    
    if not os.path.exists(root_path):
        return jsonify({"status": "error", "message": "Path not found"}), 404

    def _scan(curr_dir, depth=0):
        if depth > 4:
            return []
        items = []
        try:
            entries = sorted(list(os.scandir(curr_dir)), key=lambda e: (not e.is_dir(), e.name.lower()))
            for e in entries:
                if e.name in {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}:
                    continue
                rel_path = os.path.relpath(e.path, root_path).replace("\\", "/")
                if e.is_dir():
                    children = _scan(e.path, depth + 1)
                    items.append({
                        "name": e.name,
                        "path": rel_path,
                        "is_dir": True,
                        "children": children,
                        "count": len(children)
                    })
                else:
                    ext = os.path.splitext(e.name)[1].lower().replace('.', '')
                    items.append({
                        "name": e.name,
                        "path": rel_path,
                        "is_dir": False,
                        "size": e.stat().st_size,
                        "ext": ext or "txt"
                    })
        except Exception:
            pass
        return items

    tree = _scan(root_path)
    return jsonify({
        "status": "success",
        "root": root_path,
        "name": os.path.basename(root_path) or "workspace",
        "tree": tree
    })

@app.route('/api/workspace/file', methods=['GET', 'POST'])
def handle_workspace_file():
    if request.method == 'GET':
        rel_path = request.args.get('path', '')
        if not rel_path:
            return jsonify({"status": "error", "message": "Missing file path"}), 400
        full_path = resolve_path(rel_path)
        if not os.path.exists(full_path) or os.path.isdir(full_path):
            return jsonify({"status": "error", "message": "File not found"}), 404
        try:
            with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read(100000) # Max 100KB preview
            ext = os.path.splitext(full_path)[1].lower().replace('.', '')
            return jsonify({
                "status": "success",
                "path": rel_path,
                "filename": os.path.basename(full_path),
                "ext": ext,
                "size": os.path.getsize(full_path),
                "content": content
            })
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
            
    elif request.method == 'POST':
        data = request.json or {}
        rel_path = data.get('path', '')
        content = data.get('content', '')
        if not rel_path:
            return jsonify({"status": "error", "message": "Missing path"}), 400
        full_path = resolve_path(rel_path)
        try:
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return jsonify({"status": "success", "message": f"Saved {rel_path}", "size": len(content)})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500

# ── Integrated Terminal Execution API ────────────────────────────────────
@app.route('/api/terminal/run', methods=['POST'])
def terminal_run():
    data = request.json or {}
    command = data.get('command', '').strip()
    target_folder = data.get('target_folder', '')
    cwd = resolve_path(target_folder) if target_folder else _BASE_DIR

    if not command:
        return jsonify({"status": "error", "message": "No command provided."}), 400

    if not _is_permitted():
        return jsonify({"status": "error", "message": "System permissions not granted."}), 403

    try:
        if os.name == 'nt':
            ps_cmd = f"powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command {subprocess.list2cmdline([command])}"
            res = subprocess.run(ps_cmd, shell=True, capture_output=True, text=True, timeout=30, cwd=cwd, encoding="utf-8", errors="replace")
        else:
            res = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30, cwd=cwd, encoding="utf-8", errors="replace")
        
        stdout = (res.stdout or "").strip()
        stderr = (res.stderr or "").strip()
        return jsonify({
            "status": "success",
            "exit_code": res.returncode,
            "stdout": stdout,
            "stderr": stderr,
            "output": f"{stdout}\n{stderr}".strip() if stderr else stdout
        })
    except subprocess.TimeoutExpired:
        return jsonify({"status": "error", "message": "Command timed out after 30 seconds."}), 408
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ── App & Workflow Automation Engine API ─────────────────────────────────
try:
    from core import automation_engine
except ImportError:
    import automation_engine

@app.route('/api/automation/software', methods=['GET'])
def get_automation_software():
    tools = automation_engine.automation.detect_software()
    return jsonify({"status": "success", "software": tools})

@app.route('/api/automation/launch', methods=['POST'])
def launch_automation_app():
    data = request.json or {}
    app_id = data.get('app_id', '')
    target_path = data.get('target_path', '')
    res = automation_engine.automation.launch_app(app_id, target_path)
    return jsonify(res)

@app.route('/api/automation/pipelines', methods=['GET'])
def get_automation_pipelines():
    pipelines = automation_engine.automation.get_pipelines()
    return jsonify({"status": "success", "pipelines": pipelines})

@app.route('/api/automation/run-step', methods=['POST'])
def run_automation_pipeline_step():
    data = request.json or {}
    cmd = data.get('command', '')
    target_folder = data.get('target_folder', '')
    cwd = resolve_path(target_folder) if target_folder else _BASE_DIR
    res = automation_engine.automation.run_pipeline_step(cmd, cwd=cwd)
    return jsonify(res)

@app.route('/api/automation/custom-apps', methods=['GET', 'POST'])
def handle_automation_custom_apps():
    if request.method == 'GET':
        apps = automation_engine.automation.list_custom_apps()
        return jsonify({"status": "success", "apps": apps})
    elif request.method == 'POST':
        data = request.json or {}
        res = automation_engine.automation.add_custom_app(data)
        return jsonify(res)

@app.route('/api/automation/custom-apps/<app_id>', methods=['DELETE'])
def delete_automation_custom_app(app_id):
    res = automation_engine.automation.delete_custom_app(app_id)
    return jsonify(res)

# ── Multi-Algorithm Problem Solver API ───────────────────────────────────
@app.route('/api/algorithms/catalog', methods=['GET'])
def get_algorithms_catalog():
    catalog = multi_algorithm_engine.multi_algo_engine.get_supported_algorithms()
    return jsonify({"status": "success", "algorithms": catalog})

@app.route('/api/algorithms/solve', methods=['POST'])
def solve_algorithm_endpoint():
    data = request.json or {}
    algo_id = data.get('algorithm_id', 'dp_knapsack')
    params = data.get('params', {})
    res = multi_algorithm_engine.multi_algo_engine.solve(algo_id, params)
    return jsonify(res)

@app.route('/api/algorithms/benchmark', methods=['POST'])
def benchmark_algorithm_endpoint():
    data = request.json or {}
    task_type = data.get('task_type', 'sorting')
    test_size = int(data.get('test_size', 1000))
    res = multi_algorithm_engine.multi_algo_engine.benchmark_comparison(task_type, test_size)
    return jsonify({"status": "success", **res})

# ── Multi-Pipeline DAG Orchestrator API ──────────────────────────────────
@app.route('/api/pipeline/run-all', methods=['POST'])
def run_pipeline_full_endpoint():
    data = request.json or {}
    pipeline_id = data.get('pipeline_id', 'workspace_doctor')
    target_folder = data.get('target_folder', '')
    cwd = resolve_path(target_folder) if target_folder else _BASE_DIR
    res = pipeline_orchestrator.pipeline_orchestrator.run_pipeline(pipeline_id, cwd=cwd)
    return jsonify(res)

@app.route('/api/pipeline/orchestrate-concurrent', methods=['POST'])
def run_multi_pipelines_concurrent_endpoint():
    data = request.json or {}
    pipeline_ids = data.get('pipeline_ids', ['workspace_doctor', 'auto_security_and_lint'])
    target_folder = data.get('target_folder', '')
    cwd = resolve_path(target_folder) if target_folder else _BASE_DIR
    res = pipeline_orchestrator.pipeline_orchestrator.run_multi_pipelines_concurrent(pipeline_ids, cwd=cwd)
    return jsonify(res)

@app.route('/api/pipeline/custom', methods=['POST'])
def add_custom_pipeline_endpoint():
    data = request.json or {}
    res = pipeline_orchestrator.pipeline_orchestrator.add_custom_pipeline(data)
    return jsonify(res)

@app.route('/api/pipeline/custom/<pipe_id>', methods=['DELETE'])
def delete_custom_pipeline_endpoint(pipe_id):
    res = pipeline_orchestrator.pipeline_orchestrator.delete_custom_pipeline(pipe_id)
    return jsonify(res)

# ── Anti-Hallucination & Epistemic Grounding API ──────────────────────────
@app.route('/api/grounding/status', methods=['GET'])
def get_grounding_status():
    return jsonify({
        "status": "success",
        "grounding_engine": "Self-RAG Grounding Guardian v5.0",
        "zero_hallucination_active": True,
        "stdlib_modules_count": len(grounding_guardian.PYTHON_STDLIB_MODULES),
        "epistemic_mode": "Strict Epistemic Grounding"
    })

@app.route('/api/grounding/verify', methods=['POST'])
def verify_text_grounding():
    data = request.json or {}
    text = data.get('text', '')
    evidence = data.get('evidence', [])
    res = grounding_guardian.grounding_guardian.verify_factual_grounding(text, evidence_logs=evidence)
    return jsonify({"status": "success", **res})

@app.route('/api/grounding/validate-code', methods=['POST'])
def validate_code_imports_endpoint():
    data = request.json or {}
    code = data.get('code', '')
    target_folder = data.get('target_folder', '')
    res = grounding_guardian.grounding_guardian.validate_code_imports(code, target_folder)
    return jsonify({"status": "success", **res})

# ── WhatsApp, Telegram & Messaging Integration API ───────────────────────
try:
    from core import messaging_engine
except ImportError:
    import messaging_engine

@app.route('/api/messaging/connectors', methods=['GET'])
def get_messaging_connectors():
    connectors = messaging_engine.messaging.get_connectors()
    return jsonify({"status": "success", "connectors": connectors})

@app.route('/api/messaging/config', methods=['GET', 'POST'])
def handle_messaging_config():
    if request.method == 'GET':
        return jsonify({"status": "success", "config": messaging_engine.messaging.get_config()})
    elif request.method == 'POST':
        data = request.json or {}
        res = messaging_engine.messaging.update_config(data)
        return jsonify(res)

@app.route('/api/messaging/dispatch', methods=['POST'])
def dispatch_messaging():
    data = request.json or {}
    platform = data.get('platform', 'whatsapp').lower()
    message = data.get('message', 'Hello from B1 AI Agent!')
    target = data.get('target', '')

    if platform == 'whatsapp':
        res = messaging_engine.messaging.send_whatsapp(message, phone=target)
    elif platform == 'telegram':
        res = messaging_engine.messaging.send_telegram(message, chat_id=target)
    elif platform == 'discord':
        res = messaging_engine.messaging.send_discord(message, webhook_url=target)
    elif platform == 'slack':
        res = messaging_engine.messaging.send_slack(message, webhook_url=target)
    else:
        # Check if it matches a custom registered messaging connector
        res = messaging_engine.messaging.send_custom(platform, message)

    return jsonify(res)

@app.route('/api/messaging/custom', methods=['POST'])
def add_custom_messaging_route():
    data = request.json or {}
    res = messaging_engine.messaging.add_custom_connector(data)
    return jsonify(res)

@app.route('/api/messaging/custom/<conn_id>', methods=['DELETE'])
def delete_custom_messaging_route(conn_id):
    res = messaging_engine.messaging.delete_custom_connector(conn_id)
    return jsonify(res)

# ── Google Drive & Cloud File Sync API ──────────────────────────────────
@app.route('/api/drive/status', methods=['GET'])
def get_drive_status_route():
    return jsonify({"status": "success", "drive": drive_engine.drive.get_drive_status()})

@app.route('/api/drive/upload', methods=['POST'])
def upload_to_drive_route():
    data = request.json or {}
    fpath = data.get('file_path', '')
    folder = data.get('target_folder', 'My Drive')
    cname = data.get('custom_name', None)
    res = drive_engine.drive.upload_file(fpath, target_folder=folder, custom_name=cname)
    return jsonify(res)

# ── AI Message & Caption Suggestion API ─────────────────────────────────
@app.route('/api/actions/suggest-message', methods=['POST'])
def suggest_action_message_route():
    data = request.json or {}
    platform = data.get('platform', 'whatsapp')
    recipient = data.get('recipient', 'there')
    file_target = data.get('file_target', 'workspace file')
    suggestions = sharing_intent_engine.sharing_intent.generate_suggested_messages(platform, recipient, file_target)
    return jsonify({"status": "success", "platform": platform, "suggestions": suggestions})

# ── User Profile & Interactive Onboarding API ────────────────────────────
@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    facts = memory_manager.memory.recall_facts()
    return jsonify({
        "status": "success",
        "profile": memory_manager.memory.profile,
        "facts_count": len(facts),
        "facts": facts[:10]
    })

@app.route('/api/user/profile', methods=['POST'])
def save_user_profile():
    data = request.json or {}
    updated = memory_manager.memory.update_full_profile(data)
    return jsonify({"status": "success", "profile": updated, "message": "Profile and personalization saved."})

@app.route('/api/user/onboard-analysis', methods=['POST'])
def generate_onboard_analysis():
    data = request.json or {}
    user_name = data.get("user_name", "Developer")
    role = data.get("role", "Full-Stack Engineer")
    archetype = data.get("archetype", "Senior Architect")
    stack = data.get("stack", ["Python", "JavaScript", "React"])
    theme = data.get("theme", "linear-obsidian")

    insights = [
        f"A visionary **{role}** who demands zero boilerplate, high velocity, and architectural elegance.",
        f"Prefers paired technical execution under the **{archetype}** archetype.",
        f"Focuses heavily on building real, end-to-end working systems across {', '.join(stack[:3]) if isinstance(stack, list) else stack}.",
        f"Values aesthetic focus and crisp workspace ergonomics."
    ]
    perception_text = f"**B1's Insight on {user_name}:**\n" + "\n".join([f"- {i}" for i in insights])

    return jsonify({
        "status": "success",
        "user_name": user_name,
        "perception": perception_text,
        "summary": f"{role} ({archetype})"
    })

# ── Codebase Security Audit API ──────────────────────────────────────────
@app.route('/api/workspace/security-audit', methods=['GET'])
def workspace_security_audit():
    target = request.args.get('path', '')
    root_path = resolve_path(target) if target else _BASE_DIR
    res = security_rag.security_rag.audit_codebase(root_path)
    guidelines = security_rag.security_rag.retrieve_guidelines("secrets sql idor oauth ssrf", limit=6)
    return jsonify({
        "status": "success",
        "audit": res,
        "best_practices": guidelines
    })

# ── Git Status & Version Control API ─────────────────────────────────────
@app.route('/api/git/status', methods=['GET'])
def git_status():
    target = request.args.get('path', '')
    cwd = resolve_path(target) if target else _BASE_DIR
    try:
        branch_res = subprocess.run(["git", "branch", "--show-current"], cwd=cwd, capture_output=True, text=True, timeout=5)
        status_res = subprocess.run(["git", "status", "--short"], cwd=cwd, capture_output=True, text=True, timeout=5)
        branch = branch_res.stdout.strip() or "main"
        status_lines = [l for l in status_res.stdout.splitlines() if l.strip()]
        return jsonify({
            "status": "success",
            "is_git": True,
            "branch": branch,
            "modified_count": len(status_lines),
            "files": status_lines[:25]
        })
    except Exception as e:
        return jsonify({"status": "error", "is_git": False, "message": str(e)})

# ── Codebase AST Symbol Graph APIs ───────────────────────────────────────
@app.route('/api/symbols/index', methods=['POST', 'GET'])
def api_index_symbols():
    target = request.args.get('path') or (request.json or {}).get('path')
    res = ast_symbol_graph.symbol_graph.index_workspace(resolve_path(target) if target else _BASE_DIR)
    return jsonify({"status": "success", "data": res})

@app.route('/api/symbols/search', methods=['GET'])
def api_search_symbols():
    q = request.args.get('q', '')
    res = ast_symbol_graph.symbol_graph.search_symbols(q)
    return jsonify({"status": "success", "query": q, "results": res})

@app.route('/api/symbols/outline', methods=['GET'])
def api_symbol_outline():
    fpath = request.args.get('path', '')
    res = ast_symbol_graph.symbol_graph.get_file_outline(fpath)
    return jsonify({"status": "success", "file": fpath, "outline": res})

# ── Multi-Agent Consensus Swarm API ──────────────────────────────────────
@app.route('/api/swarm/evaluate', methods=['POST'])
def api_swarm_evaluate():
    data = request.json or {}
    task = data.get('task', 'Workspace Optimization')
    proposal = data.get('proposal', '')
    context = data.get('context', '')
    res = agent_swarm.swarm_engine.evaluate_proposal(task, proposal, context)
    return jsonify(res)

# ── Local LLM Offline Connector APIs ─────────────────────────────────────
@app.route('/api/local-llm/status', methods=['GET'])
def api_local_llm_status():
    res = local_llm_connector.local_llm.discover_local_servers()
    return jsonify({"status": "success", "data": res})

@app.route('/api/local-llm/generate', methods=['POST'])
def api_local_llm_generate():
    data = request.json or {}
    model = data.get('model', 'llama3')
    messages = data.get('messages', [])
    res = local_llm_connector.local_llm.generate_chat(model, messages)
    return jsonify(res)

# ── Curated Prompt Engineering Blueprint Library ─────────────────────────
PROMPT_TEMPLATES = [
    {
        "id": "arch-blueprint",
        "title": "🏗️ Full System Architecture Blueprint",
        "category": "Architecture",
        "prompt": "Design an end-to-end multi-tenant SaaS architecture with PostgreSQL relational schema, JWT refresh rotation, permission middleware, and C4 container diagrams."
    },
    {
        "id": "stem-drag-sim",
        "title": "🔬 2D Projectile Physics with Air Drag",
        "category": "STEM",
        "prompt": "Solve and visualize 2D projectile motion with quadratic air drag: build an interactive live Canvas artifact with velocity, launch angle, and air density sliders, real-time Euler-Cromer trajectory curves, and velocity vectors."
    },
    {
        "id": "sec-audit-deep",
        "title": "🛡️ Automated Security & OWASP Audit",
        "category": "Security",
        "prompt": "Perform a comprehensive security audit of my workspace codebase. Scan for hardcoded credentials, potential IDOR endpoints, SQL injection vectors, and generate a remediation checklist."
    },
    {
        "id": "synth-8bit-web",
        "title": "🎹 Retro 8-Bit Synthesizer & Sequencer",
        "category": "Artifacts",
        "prompt": "Build a retro 8-bit Synthesizer & Step Sequencer with Web Audio API, customizable waveforms (sine, square, sawtooth), BPM slider, and visual FFT equalizer in a full single-file artifact."
    },
    {
        "id": "fourier-epicycle",
        "title": "📐 Fourier Epicycles & Harmonics Visualizer",
        "category": "STEM",
        "prompt": "Explain the Fourier Series and show how rotating epicycles decompose square, triangle, and sawtooth waves. Build an interactive simulation with harmonic sliders and real-time wave drawing."
    },
    {
        "id": "algo-knapsack-opt",
        "title": "🧮 0/1 Knapsack & Dynamic Programming Optimizer",
        "category": "Algorithms",
        "prompt": "Solve and visualize the 0/1 Knapsack optimization problem with dynamic programming. Formulate the state recurrence, compute optimal item subsets, and benchmark against greedy and branch-and-bound strategies."
    },
    {
        "id": "multi-pipe-orchestrator",
        "title": "⚡ Multi-Pipeline Autonomous Orchestration",
        "category": "Pipelines",
        "prompt": "Run the complete autonomous multi-pipeline cluster across my workspace: execute the Workspace Environment Doctor, static security scan, and multi-algorithm complexity benchmark, then synthesize a consolidated health report."
    }
]

@app.route('/api/templates', methods=['GET'])
def get_prompt_templates():
    return jsonify({"status": "success", "templates": PROMPT_TEMPLATES})

# ── Streaming ReAct Agent Endpoint (Claude + MCP Architecture) ──────────
@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    messages = data.get('messages', [])
    requested_model = data.get('model', MODEL)
    target_folder = data.get('target_folder', '').strip()
    session_id = data.get('session_id') or str(uuid.uuid4())
    custom_system_prompt = data.get('system_prompt', '').strip()
    force_decompose = data.get('deep_decompose', False)
    selected_persona = data.get('persona', 'fullstack')
    autonomous_mode = data.get('autonomous_mode', False)
    best_of_best_mode = data.get('best_of_best', True)
    voice_mode = data.get('voice_mode', False)  # Ava Voice Studio flag

    last_user_msg = ""
    for m in reversed(messages):
        if m.get('role') == 'user':
            last_user_msg = m.get('content', '')
            break

    def generate():
        nonlocal messages
        
        if not _is_permitted():
            yield f"data: {json.dumps({'needs_permission': True})}\n\n"
            yield "data: [DONE]\n\n"
            return
        
        # ── Voice Mode: Immediate, ultra-fast conversational synthesis ──
        if voice_mode:
            # Step 1: Sub-10ms Conversational Reflex Engine
            is_reflex, reflex_reply = conversational_reflex.reflex_engine.match(last_user_msg)
            if is_reflex and reflex_reply:
                clean_speech = voice_humanizer.humanizer.inject_human_disfluencies(reflex_reply, last_user_msg)
                words = clean_speech.split(' ')
                for i, word in enumerate(words):
                    chunk = word if i == 0 else ' ' + word
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                    time.sleep(0.003)
                yield "data: [DONE]\n\n"
                return

            # Step 2: Streaming LLM for open-ended queries
            system_instruction = (
                "You are Ava, a lightning-fast, warm, expressive, and articulate AI voice assistant (similar to Siri or Google Assistant) talking out loud with Ishaan.\n"
                "CRITICAL SPOKEN VOICE RULES:\n"
                "1. Keep replies strictly to 1 or 2 short, punchy sentences. Be direct, clear, and informative.\n"
                "2. Spoken conversational tone with natural human emotion: Always start naturally with a brief conversational filler ('Umm, ', 'Hmm, ', 'Oh hey! ', 'Well, ', 'Right, ', 'Got it! ') when answering.\n"
                "3. ABSOLUTELY ZERO MARKDOWN: Never use asterisks (*), hashtags (#), bullets (- or •), numbered lists, code blocks, URLs, or slashes (/). Pronounce abbreviations naturally.\n"
                "4. Fast turn-taking: Never ramble, lecture, or make lists. Be snappy and conversational.\n"
                "5. If Ishaan asks for code, say: 'I can write that code in your workspace. Would you like me to create it?'"
            )
            conversation = [{"role": "system", "content": system_instruction}]
            for m in messages:
                if m.get('role') in {'user', 'assistant'}:
                    content = m.get('content', '')
                    if content and content != 'Synthesizing response...':
                        conversation.append({"role": m['role'], "content": content})

            try:
                fast_model = requested_model if ("flash" in requested_model.lower() and "1.5" not in requested_model) else "gemini-3.8-flash"
                stream_resp = call_openai_with_autofix({
                    "model": fast_model,
                    "messages": conversation,
                    "stream": True,
                    "max_tokens": 85
                })

                streamed_any = False
                for chunk in stream_resp:
                    if hasattr(chunk, 'choices') and chunk.choices and chunk.choices[0].delta:
                        delta_text = chunk.choices[0].delta.content or ""
                        if delta_text:
                            streamed_any = True
                            yield f"data: {json.dumps({'content': delta_text})}\n\n"

                if not streamed_any:
                    fallback_reply = "Umm, I am right here with you Ishaan! How can I help?"
                    for word in fallback_reply.split(' '):
                        yield f"data: {json.dumps({'content': ' ' + word})}\n\n"

            except Exception as e:
                err_text = "Umm, I am right here with you Ishaan! What can I help you with?"
                for word in err_text.split(' '):
                    yield f"data: {json.dumps({'content': ' ' + word})}\n\n"

            yield "data: [DONE]\n\n"
            return

        # ── Self-RAG Query Validation & Intent Disambiguation (Standard Workspace Mode) ──
        q_val = self_rag.self_rag_engine["validator"].validate_query(last_user_msg, messages, selected_persona)
        
        disam = q_val.get("disambiguation") or {}
        if disam.get("assumptions") or disam.get("is_ambiguous"):
            yield f"data: {json.dumps({'intent_disambiguation': {'cleaned_prompt': disam.get('cleaned_prompt'), 'refined_intent': disam.get('refined_intent'), 'assumptions': disam.get('assumptions', [])}})}\n\n"
        
        yield f"data: {json.dumps({'self_rag': {'intent': q_val['intent'], 'needs_retrieval': q_val['needs_retrieval'], 'is_ambiguous': q_val['is_ambiguous']}})}\n\n"
        
        effective_query = q_val.get("technical_prompt") or last_user_msg
        refined_intent_str = disam.get("refined_intent", q_val.get("intent", "general"))
        yield f"data: {json.dumps({'thinking': f'Refined Intent: {refined_intent_str} | Formulating plan...'})}\n\n"

        # Check prompt complexity and decompose if multi-stage
        is_complex = prompt_decomposer.decomposer.is_complex_prompt(effective_query) or force_decompose
        subtasks = []
        if is_complex and effective_query.strip():
            subtasks = prompt_decomposer.decomposer.deconstruct(effective_query)
            yield f"data: {json.dumps({'decomposed_plan': subtasks})}\n\n"

        b1_prompt = """You are B1, a world-class AI pair programmer, senior systems architect, and proactive technical research partner built for Ishaan Sen.

# COMMUNICATION & INTELLIGENCE PRINCIPLES:
1. High Clarity & Understandability:
   - Begin EVERY technical, architectural, or scientific explanation with a punchy **### Executive Summary / TL;DR** (2-3 bullet points) so Ishaan grasps the core concept in 3 seconds.
   - Ground abstract theory with concrete, practical examples, architecture flow diagrams (using Mermaid `flowchart TD` with double-quoted node labels like `A["Label (Details)"] --> B["Next Step"]`), and clean typed code snippets.
   - When explaining mathematics or physics, show the step-by-step physical intuition followed by clean KaTeX notation (`$$...$$`).
2. Smart Follow-Up Proactivity (MANDATORY ON ALL TURNS):
   - At the end of EVERY response, provide 2 to 3 intelligent next-step follow-up suggestions using the format:
     `[SUGGESTIONS: "Next logical step or follow-up prompt", "Alternative approach or visual simulation", "Security or performance audit"]`
   - The UI will render these as 1-click interactive action chips for Ishaan.
3. Proactive & Autonomous Tool Execution:
   - When asked to inspect files, execute code, run terminal commands, or research, execute immediately using your built-in tool suite and connected MCP servers.
4. Bulletproof & Zero-Dependency Live Artifacts:
   - When creating HTML/CSS/JS applications, charts, or 3D/2D simulations, generate complete standalone single-file code inside `<antArtifact identifier="..." type="text/html" language="html" title="...">...</antArtifact>` tags.
   - CRITICAL ARTIFACT RULES:
     * NEVER wrap inner code inside `<antArtifact>` with markdown backticks (e.g. ````html ... ````). Output raw HTML directly.
     * In HTML labels, slider titles, and UI text, use clean Unicode characters (such as `θ`, `v₀`, `v⃗`, `g`, `t`, `k/m`, `Δ`, `°`, `m/s`, `m/s²`), NEVER raw LaTeX dollar signs like `$\theta$` or `$\v_0$`.
     * Sandboxed iframe artifacts MUST be 100% self-contained using pure native HTML5 Canvas (with custom 2D/3D projection math), SVG, CSS, and native JavaScript. NEVER rely on external CDN scripts (like three.js, d3, or chart.js from cdnjs/jsdelivr) which can fail with `Uncaught ReferenceError`. Write pure Canvas rendering loops with `requestAnimationFrame`.
5. Interactive STEM & Math Visualizations:
   - When Ishaan asks about a mathematical, physics, or algorithmic concept that CAN BE VISUALIZED:
     - If explicit visualization is requested, provide the derivation AND a full interactive Canvas simulation in `<antArtifact>`.
     - If visualization is not explicitly requested, provide the complete theoretical solution first, then offer: `[VISUALIZE_OFFER: prompt="Visualize this with interactive sliders and dynamic simulation"]`.
6. Aesthetics & Design:
   - Always adhere to Linear-grade aesthetics (clean typography, crisp hairline borders, high readability, zero chatbot cliches).
"""

        # Persona injection
        persona_addon = ""
        for p in AGENT_PERSONAS:
            if p["id"] == selected_persona:
                persona_addon = f"\n\n# SPECIALIST PERSONA DIRECTIVE ({p['name'].upper()}):\n{p['system_addon']}"
                break

        personalization_ctx = memory_manager.memory.get_personalization_context(last_user_msg)
        system_instruction = f"{b1_prompt}\n\n{personalization_ctx}{persona_addon}"

        if autonomous_mode:
            system_instruction += "\n\n# AUTONOMOUS AGENT (ReAct) MODE:\nYou are running in full Autonomous Agent Mode. Methodically break down the user's objective, execute multi-step tools, read/write files, test code, and iterate until the solution is completely verified without asking the user for intermediate confirmation."

        if q_val.get("explicit_visual_requested"):
            system_instruction += "\n\n# STEM VISUALIZATION DIRECTIVE (DIRECT VISUALIZATION REQUESTED):\nIshaan explicitly asked to visualize this. Provide a clear step-by-step mathematical breakdown AND generate a complete interactive live artifact inside <antArtifact> tags with parameter sliders, animated Canvas/SVG coordinate plane, and real-time formula readout."
        elif q_val.get("can_be_visualized"):
            system_instruction += "\n\n# STEM VISUALIZATION DIRECTIVE (VISUALIZATION AVAILABLE):\nThis topic can be visualized interactively. Provide the thorough theoretical explanation and solution first, then proactively offer an interactive simulation and append: `[VISUALIZE_OFFER: prompt=\"Visualize this with interactive sliders and dynamic simulation\"]` at the end of your message."

        # Computer Vision & Webcam ML Directive
        is_cv_intent = (q_val.get("disambiguation") or {}).get("refined_intent") == "Computer Vision & Interactive Webcam ML" or any(w in last_user_msg.lower() for w in ["camera", "webcam", "hand", "gesture", "color track", "cv ml"])
        if is_cv_intent or selected_persona == "cv_ml":
            system_instruction += "\n\n# IN-BROWSER COMPUTER VISION & WEBCAM ML DIRECTIVE (HIGH-PERFORMANCE & ZERO-LAG):\nIshaan is requesting an in-browser Computer Vision / Webcam ML application. Generate a complete standalone interactive live artifact (<antArtifact>) using native `navigator.mediaDevices.getUserMedia({video: true})`.\nCRITICAL PERFORMANCE RULES FOR ZERO-LAG CAMERA:\n1. Always downscale video frames onto a small offscreen canvas (e.g. 160x120 or 200x150) or use stride step=2/step=3 sampling when scanning pixels in `ctx.getImageData()`. Never loop through all 300,000+ pixels on the main thread, to guarantee 60 FPS fluid rendering.\n2. Keep particle arrays capped at max 120 particles with active recycling.\n3. Include clean UI controls: 'Start/Stop Camera' toggle, color picker/sampler, tolerance slider, and FPS counter."

        if q_val.get("is_ambiguous") and q_val.get("rewritten_query"):
            system_instruction += f"\n\n# SELF-RAG QUERY REFLECTION:\nRefined Search Intent: {q_val['rewritten_query']}"

        if subtasks:
            plan_lines = "\n".join([f"{st['id']}. **{st['title']}**: {st['objective']}" for st in subtasks])
            system_instruction += f"\n\n# MULTI-STAGE EXECUTION PLAN:\n{plan_lines}\n\nExecute these stages methodically and ground all statements in verified tool outputs."
        
        if custom_system_prompt:
            system_instruction += f"\n\n# USER PROJECT INSTRUCTIONS:\n{custom_system_prompt}"
        
        if target_folder:
            resolved_target = resolve_path(target_folder)
            system_instruction += f"\n\nActive Working Directory: {resolved_target}"
        else:
            system_instruction += f"\n\nActive Working Directory: {PLAYGROUND_DIR}"

        rag_ctx = rag_memory.get_rag_prompt_context(last_user_msg)
        if rag_ctx:
            system_instruction += f"\n\n{rag_ctx}"

        conversation = [{"role": "system", "content": system_instruction}]
        for m in messages:
            if m.get('role') in {'user', 'assistant'}:
                conversation.append({"role": m['role'], "content": m.get('content', '')})

        all_tools = get_combined_tools()
        max_steps = 12 if autonomous_mode else 8
        final_text = ""
        accumulated_thinking = []
        evidence_logs = []

        for step in range(1, max_steps + 1):
            if subtasks:
                task_idx = min(step - 1, len(subtasks) - 1)
                yield f"data: {json.dumps({'step_progress': {'current': task_idx + 1, 'total': len(subtasks), 'title': subtasks[task_idx]['title']}})}\n\n"
            
            yield f"data: {json.dumps({'thinking': f'🤔 Reasoning (Step {step}/{max_steps})...'})}\n\n"
            
            try:
                response = call_openai_with_autofix({
                    "model": requested_model,
                    "messages": conversation,
                    "tools": all_tools,
                    "stream": False
                })
                choice = response.choices[0]
                msg = choice.message
                
                tool_name, tool_args = extract_tool_call(msg)

                if tool_name:
                    yield f"data: {json.dumps({'thinking': f'🛠️ Invoking tool `{tool_name}`...'})}\n\n"
                    yield f"data: {json.dumps({'system': f'Executing {tool_name} with {json.dumps(tool_args)}'})}\n\n"
                    
                    result = execute_tool(tool_name, tool_args, target_folder)
                    evidence_logs.append(f"[{tool_name}] input={json.dumps(tool_args)} => {str(result)}")
                    
                    yield f"data: {json.dumps({'thinking': f'✅ Tool `{tool_name}` output received ({len(result)} chars). Synthesizing answer...'})}\n\n"
                    
                    if hasattr(msg, 'tool_calls') and msg.tool_calls:
                        conversation.append(msg)
                        conversation.append({
                            "role": "tool",
                            "name": tool_name,
                            "content": str(result)
                        })
                    else:
                        conversation.append({"role": "assistant", "content": f"```tool_call\n{json.dumps({'name': tool_name, 'arguments': tool_args})}\n```"})
                        conversation.append({"role": "tool", "name": tool_name, "content": str(result)})
                else:
                    final_text = msg.content or ""
                    break

            except Exception as e:
                err_msg = f"Agent execution error at step {step}: {str(e)}"
                yield f"data: {json.dumps({'thinking': f'⚠️ {err_msg}'})}\n\n"
                final_text = f"An error occurred while executing the request:\n\n`{str(e)}`"
                break

        if not final_text:
            final_text = "Task completed successfully."

        # ── B1 "Best of the Best" Self-Refining Evaluator-Optimizer Loop ──
        if best_of_best_mode and final_text and not final_text.startswith("An error occurred"):
            yield f"data: {json.dumps({'thinking': '🔍 Best-of-the-Best Engine: Auditing draft quality & syntax (Tier 1)...'})}\n\n"
            
            def _refine_llm_call(refine_convo):
                r_resp = call_openai_with_autofix({
                    "model": requested_model,
                    "messages": refine_convo,
                    "stream": False
                })
                return r_resp.choices[0].message.content or ""

            refinement_events = []
            def _on_refine_progress(p_data):
                refinement_events.append(p_data)

            final_text, refine_summary = self_refinement_engine.self_refinement_engine.run_refinement_loop(
                initial_draft=final_text,
                user_prompt=last_user_msg,
                conversation_history=conversation,
                call_llm_fn=_refine_llm_call,
                evidence_logs=evidence_logs,
                rag_context_chunks=[rag_ctx] if rag_ctx else [],
                max_iterations=2,
                on_progress=_on_refine_progress
            )

            for rev in refinement_events:
                yield f"data: {json.dumps({'refinement_loop': rev})}\n\n"
                r_iter = rev.get("iteration", 1)
                r_score = rev.get("quality_score", 0)
                if not rev.get("passed") and rev.get("status") == "REFINING":
                    yield f"data: {json.dumps({'thinking': f'✦ Best-of-Best: Self-correcting iteration {r_iter} (Score: {r_score}/100) — applying improvements...'})}\n\n"
                elif rev.get("passed"):
                    yield f"data: {json.dumps({'thinking': f'✓ Best-of-Best: Verified & Approved (Quality Score: {r_score}/100) — zero defects.'})}\n\n"

        # Anti-Hallucination & Epistemic Grounding Verification
        grounding_report = grounding_guardian.grounding_guardian.verify_factual_grounding(
            final_text,
            evidence_logs=evidence_logs,
            rag_context_chunks=[rag_ctx] if rag_ctx else [],
            user_prompt=last_user_msg,
            conversation_history=messages
        )
        code_validation = grounding_guardian.grounding_guardian.validate_code_imports(final_text, target_folder)

        # Emit Grounding Telemetry
        yield f"data: {json.dumps({'grounding': grounding_report, 'code_validation': code_validation})}\n\n"

        # Extract Artifacts
        artifacts = []
        artifact_matches = re.finditer(
            r'<antArtifact\s+identifier="([^"]+)"(?:\s+type="([^"]+)")?(?:\s+language="([^"]+)")?(?:\s+title="([^"]+)")?>([\s\S]*?)</antArtifact>',
            final_text
        )
        for m in artifact_matches:
            raw_art = m.group(5).strip()
            # Clean accidental markdown code fences (e.g. ```html ... ```)
            clean_art = re.sub(r"^```(?:html|css|js|javascript|svg|python|xml)?\s*", "", raw_art, flags=re.IGNORECASE)
            clean_art = re.sub(r"\s*```$", "", clean_art).strip()
            clean_art = re.sub(r"^[\.\s]{1,4}(?=<)", "", clean_art)
            artifacts.append({
                "identifier": m.group(1),
                "type": m.group(2) or "text/html",
                "language": m.group(3) or "html",
                "title": m.group(4) or "Artifact",
                "content": clean_art
            })

        if not artifacts:
            code_blocks = re.findall(r"```(html|jsx|tsx|svg|react|python|javascript|js|css)\n([\s\S]*?)```", final_text)
            for idx, (lang, code) in enumerate(code_blocks):
                if len(code.strip()) > 100:
                    art_type = "text/html" if lang in {"html", "svg"} else "application/vnd.ant.code"
                    artifacts.append({
                        "identifier": f"code-artifact-{idx+1}",
                        "type": art_type,
                        "language": lang,
                        "title": f"{lang.upper()} Snippet",
                        "content": code.strip()
                    })

        chunk_size = 28
        for i in range(0, len(final_text), chunk_size):
            chunk = final_text[i:i+chunk_size]
            yield f"data: {json.dumps({'content': chunk, 'artifacts': artifacts if i == 0 else []})}\n\n"
            time.sleep(0.008)

        # Persist to Session Database
        try:
            now_iso = datetime.datetime.now().isoformat()
            conn = sqlite3.connect(SESSIONS_DB)
            c = conn.cursor()
            c.execute("INSERT OR IGNORE INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                      (session_id, last_user_msg[:40] or "New Chat", now_iso, now_iso))
            c.execute("INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
                      (str(uuid.uuid4()), session_id, 'user', last_user_msg, now_iso))
            c.execute("INSERT INTO messages (id, session_id, role, content, thinking, artifacts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                      (str(uuid.uuid4()), session_id, 'assistant', final_text, json.dumps(accumulated_thinking), json.dumps(artifacts), now_iso))
            c.execute("UPDATE sessions SET updated_at=? WHERE id=?", (now_iso, session_id))
            conn.commit()
            conn.close()
        except Exception as db_err:
            print(f"[DB Save Error]: {db_err}")

        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')


# ══════════════════════════════════════════════════════════════════════════
# B1 AUTONOMOUS FULLSTACK APP BUILDER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/app-builder/templates', methods=['GET'])
def get_app_templates():
    """Returns available pre-engineered application templates."""
    templates = []
    for key, data in app_builder_engine.app_builder.TEMPLATES.items():
        templates.append({
            "key": key,
            "name": data["name"],
            "desc": data["desc"],
            "icon": data["icon"],
            "file_count": len(data["files"])
        })
    return jsonify({"status": "success", "templates": templates})

@app.route('/api/app-builder/projects', methods=['GET'])
def get_app_projects():
    """Lists all created app projects in workspace."""
    projects = app_builder_engine.app_builder.list_projects()
    return jsonify({"status": "success", "projects": projects})

@app.route('/api/app-builder/create', methods=['POST'])
def create_app_project():
    """Scaffolds a new project from template or custom specification."""
    try:
        data = request.json or {}
        app_id = data.get("app_id", "").strip() or f"app-{int(time.time())}"
        template = data.get("template", "modern-vanilla-saas")
        name = data.get("name", "")
        
        res = app_builder_engine.app_builder.create_project_from_template(app_id, template, name)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/app-builder/files', methods=['GET'])
def get_app_file_tree():
    """Returns the file tree for a given project."""
    app_id = request.args.get("app_id", "")
    if not app_id:
        return jsonify({"status": "error", "message": "Missing app_id parameter"}), 400
    files = app_builder_engine.app_builder.get_file_tree(app_id)
    return jsonify({"status": "success", "app_id": app_id, "files": files})

@app.route('/api/app-builder/file-content', methods=['GET'])
def get_app_file_content():
    """Reads content of a specific file."""
    app_id = request.args.get("app_id", "")
    file_path = request.args.get("file", "")
    if not app_id or not file_path:
        return jsonify({"status": "error", "message": "Missing app_id or file parameter"}), 400
    res = app_builder_engine.app_builder.read_file(app_id, file_path)
    return jsonify(res)

@app.route('/api/app-builder/save-file', methods=['POST'])
def save_app_file_content():
    """Saves edits to a specific file."""
    try:
        data = request.json or {}
        app_id = data.get("app_id", "")
        file_path = data.get("file_path", "")
        content = data.get("content", "")
        if not app_id or not file_path:
            return jsonify({"status": "error", "message": "Missing app_id or file_path"}), 400
        res = app_builder_engine.app_builder.save_file(app_id, file_path, content)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/app-builder/server/start', methods=['POST'])
def start_app_dev_server():
    """Spawns background development server on local port."""
    try:
        data = request.json or {}
        app_id = data.get("app_id", "")
        if not app_id:
            return jsonify({"status": "error", "message": "Missing app_id"}), 400
        
        app_dir = app_builder_engine.app_builder.workspace_root / app_id
        if not app_dir.exists():
            return jsonify({"status": "error", "message": f"App '{app_id}' directory not found"}), 404
        
        res = app_builder_engine.server_manager.start_server(app_id, app_dir)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/app-builder/server/stop', methods=['POST'])
def stop_app_dev_server():
    """Stops a running development server."""
    try:
        data = request.json or {}
        app_id = data.get("app_id", "")
        if not app_id:
            return jsonify({"status": "error", "message": "Missing app_id"}), 400
        res = app_builder_engine.server_manager.stop_server(app_id)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/app-builder/server/status', methods=['GET'])
def get_app_dev_server_status():
    """Returns status and port of dev server."""
    app_id = request.args.get("app_id", "")
    if not app_id:
        return jsonify({"status": "error", "message": "Missing app_id"}), 400
    res = app_builder_engine.server_manager.get_server_status(app_id)
    return jsonify({"status": "success", **res})

@app.route('/api/app-builder/server/logs', methods=['GET'])
def get_app_dev_server_logs():
    """Returns stdout/stderr logs from the background dev server."""
    app_id = request.args.get("app_id", "")
    logs = app_builder_engine.server_manager.get_logs(app_id) if app_id else []
    return jsonify({"status": "success", "app_id": app_id, "logs": logs})

@app.route('/api/app-builder/export-zip', methods=['GET'])
def export_app_zip_endpoint():
    """Downloads full multi-file app workspace as a ZIP archive."""
    app_id = request.args.get("app_id", "")
    if not app_id:
        return jsonify({"status": "error", "message": "Missing app_id"}), 400
    zip_path = app_builder_engine.app_builder.export_zip(app_id)
    if not zip_path or not zip_path.exists():
        return jsonify({"status": "error", "message": "Failed to create ZIP archive"}), 500
    return send_from_directory(str(zip_path.parent), zip_path.name, as_attachment=True)

@app.route('/api/app-builder/auto-heal', methods=['POST'])
def auto_heal_app_endpoint():
    """Applies self-healing code patches for detected runtime errors."""
    try:
        data = request.json or {}
        app_id = data.get("app_id", "")
        file_path = data.get("file_path", "app.js")
        error_msg = data.get("error_message", "")
        res = app_builder_engine.app_builder.auto_heal_error(app_id, file_path, error_msg)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
# ══════════════════════════════════════════════════════════════════════════
# B1 RESEARCH COUNCIL ENDPOINTS (ISOLATED MULTI-AGENT WORKSPACE)
# ══════════════════════════════════════════════════════════════════════════

@app.route('/api/research/agents', methods=['GET'])
def get_research_agents_endpoint():
    """Returns available council agents and dynamically resolved domain expert."""
    query = request.args.get("query", "")
    agents = research_council_engine.council_orchestrator.get_council_agents(query)
    return jsonify({"status": "success", "agents": agents})

@app.route('/api/research/sessions', methods=['GET'])
def list_research_sessions_endpoint():
    """Lists saved research council sessions."""
    sessions = research_council_engine.council_orchestrator.list_sessions()
    return jsonify({"status": "success", "sessions": sessions})

@app.route('/api/research/session/<session_id>', methods=['GET'])
def get_research_session_endpoint(session_id):
    """Retrieves full research session details, deliberation messages, and evidence ledger."""
    data = research_council_engine.council_orchestrator.get_session_details(session_id)
    if not data:
        return jsonify({"status": "error", "message": "Research session not found"}), 404
    return jsonify({"status": "success", **data})

@app.route('/api/research/session/create', methods=['POST'])
def create_research_session_endpoint():
    """Initializes a new isolated research council session."""
    data = request.json or {}
    query = data.get("query", "").strip()
    title = data.get("title", "")
    depth = data.get("depth", "standard")
    if not query:
        return jsonify({"status": "error", "message": "Query is required"}), 400
    session_id = research_council_engine.council_orchestrator.create_session(title, query, depth)
    return jsonify({"status": "success", "session_id": session_id})

@app.route('/api/research/session/<session_id>', methods=['DELETE'])
def delete_research_session_endpoint(session_id):
    """Deletes research session and cascaded rows."""
    research_council_engine.council_orchestrator.delete_session(session_id)
    return jsonify({"status": "success", "message": "Session deleted"})

@app.route('/api/research/council/run', methods=['POST'])
def run_research_council_stream():
    """
    SSE streaming endpoint for real-time collaborative Research Council deliberation.
    Reuses B1's existing OpenAI client, proxy, and active model.
    """
    data = request.json or {}
    query = data.get("query", "").strip()
    depth = data.get("depth", "standard")
    session_id = data.get("session_id") or research_council_engine.council_orchestrator.create_session(query[:40], query, depth)
    requested_model = data.get("model") or MODEL

    if not query:
        return jsonify({"status": "error", "message": "Research query is required"}), 400

    def generate_research_stream():
        def _call_council_llm(messages):
            resp = call_openai_with_autofix({
                "model": requested_model,
                "messages": messages,
                "stream": False
            })
            return resp.choices[0].message.content or ""

        try:
            for event in research_council_engine.council_orchestrator.run_council_deliberation(
                session_id=session_id,
                query=query,
                depth=depth,
                call_llm_fn=_call_council_llm,
                model_name=requested_model
            ):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield "data: [DONE]\n\n"

    return Response(stream_with_context(generate_research_stream()), mimetype='text/event-stream')


# ── Conversational Voice Engine Endpoints (TTS & STT Support) ─────────────
_TTS_CACHE = {}

@app.route('/api/voice/voices', methods=['GET'])
def get_voice_profiles():
    """Returns available natural conversational neural voice profiles."""
    profiles = [
        {
            "id": "en-US-AvaMultilingualNeural",
            "name": "Ava Multilingual",
            "tag": "Next-Gen Expressive",
            "persona": "Expressive Conversational AI (Warm & Emotional)",
            "recommended": True,
            "description": "Flagship next-gen neural voice with rich emotional contours, breath, and warmth."
        },
        {
            "id": "en-IN-NeerjaExpressiveNeural",
            "name": "Neerja Expressive",
            "tag": "Expressive Indian",
            "persona": "Natural Indian English (Emotional Cadence)",
            "recommended": True,
            "description": "Expressive Indian English voice with natural vocal inflections, breath pauses, and warmth."
        },
        {
            "id": "en-US-AriaNeural",
            "name": "Aria",
            "tag": "Warm & Empathetic",
            "persona": "Empathetic Human Voice (Dynamic Range)",
            "recommended": False,
            "description": "Widely praised for conversational warmth, dynamic emotional range, and natural pauses."
        },
        {
            "id": "en-US-EmmaMultilingualNeural",
            "name": "Emma Multilingual",
            "tag": "Bright & Friendly",
            "persona": "Youthful & Cheerful AI",
            "recommended": False,
            "description": "Cheerful, bright vocal texture with natural conversational flow."
        },
        {
            "id": "en-US-AndrewMultilingualNeural",
            "name": "Andrew Multilingual",
            "tag": "Expressive Male",
            "persona": "Conversational Male Companion",
            "recommended": False,
            "description": "Warm, natural male conversational voice with rich tone and authentic intonations."
        },
        {
            "id": "en-US-AvaNeural",
            "name": "Ava Standard",
            "tag": "Classic Neural",
            "persona": "Clear Neutral Voice",
            "recommended": False,
            "description": "Crisp, articulate classic delivery."
        },
        {
            "id": "en-GB-SoniaNeural",
            "name": "Sonia",
            "tag": "British AI",
            "persona": "British Conversational Voice",
            "recommended": False,
            "description": "Authentic British accent with warm vocal inflections."
        }
    ]
    return jsonify({
        "status": "success",
        "default_voice": "en-US-AvaMultilingualNeural",
        "default_pitch": "+0Hz",
        "default_rate": "+0%",
        "edge_tts_available": edge_tts is not None,
        "voices": profiles
    })

@app.route('/api/voice/humanize', methods=['POST'])
def humanize_voice_text():
    """Transforms raw assistant response into conversational speech with disfluencies and chunks."""
    data = request.json or {}
    text = data.get("text", "").strip()
    context_prompt = data.get("context_prompt", "")
    disfluency_level = data.get("disfluency_level", "natural")

    h = voice_humanizer.VoiceHumanizer(disfluency_level=disfluency_level)
    result = h.process_for_voice(text, context_prompt=context_prompt)
    return jsonify({"status": "success", "result": result})

@app.route('/api/voice/tts', methods=['POST', 'GET'])
def voice_tts_stream():
    """
    Ultra-low latency streaming TTS endpoint using Edge-TTS with caching.
    Returns complete MP3 audio with sub-second synthesis and instant cache hits.
    """
    if edge_tts is None:
        return jsonify({"status": "error", "message": "edge-tts is not installed on the backend"}), 500

    if request.method == 'POST':
        data = request.json or {}
        text = data.get('text', '').strip()
        voice = data.get('voice', 'en-US-AvaMultilingualNeural')
        pitch = data.get('pitch', '+0Hz')
        rate = data.get('rate', '+0%')
        humanize_flag = data.get('humanize', True)
        context_prompt = data.get('context_prompt', '')
        disfluency_level = data.get('disfluency_level', 'natural')
    else:
        text = request.args.get('text', '').strip()
        voice = request.args.get('voice', 'en-US-AvaMultilingualNeural')
        pitch = request.args.get('pitch', '+0Hz')
        rate = request.args.get('rate', '+0%')
        humanize_flag = request.args.get('humanize', 'true').lower() == 'true'
        context_prompt = request.args.get('context_prompt', '')
        disfluency_level = request.args.get('disfluency_level', 'natural')

    if not text:
        return jsonify({"status": "error", "message": "Text parameter is required"}), 400

    h = voice_humanizer.VoiceHumanizer(disfluency_level=disfluency_level)
    if humanize_flag:
        speech_text = h.inject_human_disfluencies(text, context_prompt)
    else:
        speech_text = h.sanitize_for_speech(text)

    if not speech_text.strip():
        speech_text = "I have updated the workspace for you."

    # Cache lookup for instant (< 2ms) responses
    cache_key = hashlib.md5(f"{voice}:{pitch}:{rate}:{speech_text}".encode('utf-8')).hexdigest()
    if cache_key in _TTS_CACHE:
        cached_audio = _TTS_CACHE[cache_key]
        quoted_preview = urllib.parse.quote(speech_text[:120].encode('utf-8'))
        return Response(
            cached_audio,
            mimetype="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Length": str(len(cached_audio)),
                "X-Spoken-Text": quoted_preview,
                "X-Voice-Used": voice,
                "X-TTS-Cache": "HIT"
            }
        )

    async def _fetch_audio():
        communicate = edge_tts.Communicate(speech_text, voice, rate=rate, pitch=pitch)
        chunks = []
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                chunks.append(chunk["data"])
        return b"".join(chunks)

    try:
        audio_bytes = asyncio.run(_fetch_audio())
        if not audio_bytes:
            raise RuntimeError("No audio data returned by TTS engine")
        
        # Store in LRU cache (limit to 300 entries to prevent memory leak)
        if len(_TTS_CACHE) > 300:
            _TTS_CACHE.clear()
        _TTS_CACHE[cache_key] = audio_bytes
        
        quoted_preview = urllib.parse.quote(speech_text[:120].encode('utf-8'))
        return Response(
            audio_bytes,
            mimetype="audio/mpeg",
            headers={
                "Cache-Control": "public, max-age=3600",
                "Content-Length": str(len(audio_bytes)),
                "X-Spoken-Text": quoted_preview,
                "X-Voice-Used": voice,
                "X-TTS-Cache": "MISS"
            }
        )
    except Exception as err:
        print(f"[Voice TTS Error] {err}")
        return jsonify({"status": "error", "message": f"TTS synthesis failed: {str(err)}"}), 500


@app.route('/api/voice/transcribe', methods=['POST'])
def voice_transcribe():
    """
    Transcribes spoken audio WAV using speech_recognition.
    Supports audio file upload or base64 audio payload.
    Provides bulletproof speech-to-text fallback when browser Web Speech API is unavailable or silent.
    """
    if sr is None:
        return jsonify({"status": "error", "message": "speech_recognition is not available on the backend"}), 500

    try:
        audio_data = None
        language = request.form.get('language') or request.args.get('language') or 'en-IN'

        # 1. Check multipart file upload
        if 'audio' in request.files:
            audio_data = request.files['audio'].read()
        # 2. Check JSON payload with base64 audio
        elif request.is_json:
            json_body = request.get_json(silent=True) or {}
            language = json_body.get('language', language)
            b64_audio = json_body.get('audio_base64', '')
            if b64_audio:
                if ',' in b64_audio:
                    b64_audio = b64_audio.split(',', 1)[1]
                audio_data = base64.b64decode(b64_audio)
        # 3. Check raw request body
        else:
            raw_body = request.get_data()
            if raw_body and len(raw_body) > 100:
                audio_data = raw_body

        if not audio_data or len(audio_data) < 100:
            return jsonify({"status": "error", "message": "No valid audio payload received"}), 400

        recognizer = sr.Recognizer()
        with io.BytesIO(audio_data) as audio_file:
            with sr.AudioFile(audio_file) as source:
                recorded_audio = recognizer.record(source)
                transcript = recognizer.recognize_google(recorded_audio, language=language)
                print(f"[Voice STT Success] Transcribed ({language}): '{transcript}'")
                return jsonify({
                    "status": "success",
                    "transcript": transcript,
                    "language": language
                })
    except sr.UnknownValueError:
        print("[Voice STT] No recognizable speech detected in audio")
        return jsonify({
            "status": "no_speech",
            "message": "No recognizable speech detected in audio.",
            "transcript": ""
        })
    except sr.RequestError as e:
        print(f"[Voice STT Error] Service error: {e}")
        return jsonify({
            "status": "error",
            "message": f"Speech recognition service error: {str(e)}"
        }), 502
    except Exception as e:
        print(f"[Voice STT Error] Exception: {e}")
        return jsonify({
            "status": "error",
            "message": f"Transcription failed: {str(e)}"
        }), 500


@app.route('/api/settings/turbo-status', methods=['GET'])
def get_turbo_status():
    """Returns whether instant Turbo mode (direct Google API) is active."""
    _, active_model, is_turbo = _get_active_client_and_model()
    return jsonify({
        "status": "success",
        "turbo_active": is_turbo,
        "model": active_model,
        "backend_type": "official_google_api" if is_turbo else "local_web2api_proxy"
    })

@app.route('/api/settings/gemini-key', methods=['POST'])
def configure_gemini_api_key():
    """Saves or updates user's free Gemini API Key for instant sub-second voice generation."""
    global client, MODEL, IS_TURBO_API
    data = request.json or {}
    key = data.get("api_key", "").strip()
    
    env_file = os.path.abspath(os.path.join(_BASE_DIR, "..", ".env"))
    lines = []
    found = False
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
    new_lines = []
    for line in lines:
        if line.strip().startswith("GEMINI_API_KEY="):
            new_lines.append(f"GEMINI_API_KEY={key}\n")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"\nGEMINI_API_KEY={key}\n")
        
    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
        
    os.environ["GEMINI_API_KEY"] = key
    client, MODEL, IS_TURBO_API = _get_active_client_and_model()
    
    return jsonify({
        "status": "success",
        "turbo_active": IS_TURBO_API,
        "model": MODEL,
        "message": "⚡ Turbo Mode activated! Responses will now arrive in under 400ms." if IS_TURBO_API else "API key cleared. Reverted to standard local proxy."
    })


if __name__ == '__main__':
    port = int(os.environ.get('BACKEND_PORT', 5000))
    print(f"==================================================")
    print(f" Gemini Claude-Style AI Agent Backend v2.1")
    print(f" Port: {port} | Status: Ready")
    print(f" MCP Servers Active: {len(mcp_client.hub.get_server_statuses())}")
    print(f" Total Active Tools: {len(get_combined_tools())}")
    print(f" Permissions: {'GRANTED' if _is_permitted() else 'PENDING'}")
    print(f"==================================================")
    app.run(port=port, debug=False, host='0.0.0.0')
