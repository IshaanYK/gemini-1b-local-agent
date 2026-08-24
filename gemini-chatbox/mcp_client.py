"""
mcp_client.py — Comprehensive Model Context Protocol (MCP) Suite for Gemini Studio
Equips Gemini with all agentic capabilities matching Antigravity AI & Claude:

1. Web Intelligence & Search MCP (search_web, fetch_web_content)
2. Chrome DevTools & Browser Automation MCP (chrome-devtools-mcp bridge)
3. Advanced Code & Filesystem Architect MCP (view_file, write_to_file, replace_file_content, multi_replace_file_content, grep_search, list_dir)
4. Notebooks & Data Science MCP (create_notebook, insert_code_cell, read_cell, list_cells, replace_cell)
5. Interactive Data Visualization MCP (render_chart)
6. Database & SQLite MCP (sqlite_query, sqlite_schema, sqlite_tables)
7. System Task & Process Lifecycle MCP (run_command, manage_task, list_processes, system_info)
8. External Stdio JSON-RPC 2.0 MCP Servers (cloudrun, github-mcp-server, custom MCPs)
"""

import sys
import os
import json
import time
import uuid
import socket
import subprocess
import threading
import urllib.request
import urllib.parse
import sqlite3
import re
import shutil

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GLOBAL_MCP_CONFIG = os.path.expanduser(r"~\.gemini\config\mcp_config.json")
LOCAL_MCP_CONFIG = os.path.join(_BASE_DIR, "mcp_servers.json")

# ── 1. Web Intelligence & Live Search MCP Server ─────────────────────────
class WebSearchMCPServer:
    def __init__(self):
        self.server_id = "mcp-web-search"
        self.is_connected = True
        self.tools = [
            {
                "name": "search_web",
                "description": "Performs a live web search for a given query and returns relevant articles, snippets, and URLs.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "The search term or topic to search on the web"}
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "fetch_web_content",
                "description": "Fetches complete text and markdown from any public web page URL.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "url": {"type": "string", "description": "The HTTP/HTTPS web address to scrape"}
                    },
                    "required": ["url"]
                }
            }
        ]

    def call_tool(self, tool_name, arguments):
        if tool_name == "search_web":
            query = arguments.get("query", "").strip()
            if not query:
                return "Error: Query is required."

            results = []
            
            # 1. Try DuckDuckGo Instant Answer API
            try:
                enc_q = urllib.parse.quote_plus(query)
                ddg_api = f"https://api.duckduckgo.com/?q={enc_q}&format=json&no_html=1&skip_disambig=1"
                req = urllib.request.Request(ddg_api, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, timeout=5) as r:
                    d = json.loads(r.read().decode('utf-8'))
                    if d.get("AbstractText"):
                        results.append(f"### DuckDuckGo Summary: {d.get('Heading', query)}\n- **URL**: {d.get('AbstractURL', '')}\n- **Summary**: {d.get('AbstractText')}")
                    for topic in d.get("RelatedTopics", [])[:3]:
                        if isinstance(topic, dict) and topic.get("Text"):
                            results.append(f"- **{topic.get('FirstURL', '')}**: {topic.get('Text')}")
            except Exception:
                pass

            # 2. Try Wikipedia Search API
            try:
                wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote_plus(query)}&format=json"
                req = urllib.request.Request(wiki_url, headers={'User-Agent': 'GeminiStudio/2.0'})
                with urllib.request.urlopen(req, timeout=5) as r:
                    wd = json.loads(r.read().decode('utf-8'))
                    for w in wd.get("query", {}).get("search", [])[:4]:
                        w_title = w.get("title", "")
                        w_snippet = re.sub(r'<[^>]+>', '', w.get("snippet", ""))
                        w_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(w_title.replace(' ', '_'))}"
                        results.append(f"### {w_title}\n- **URL**: {w_url}\n- **Summary**: {w_snippet}...")
            except Exception:
                pass

            # 3. DuckDuckGo HTML Fallback
            if len(results) < 2:
                try:
                    data = urllib.parse.urlencode({'q': query}).encode('utf-8')
                    req = urllib.request.Request(
                        "https://html.duckduckgo.com/html/",
                        data=data,
                        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
                    )
                    with urllib.request.urlopen(req, timeout=6) as resp:
                        html = resp.read().decode('utf-8', errors='ignore')
                        snips = re.findall(r'<a class="result__snippet[^"]*"[^>]*>(.*?)</a>', html)
                        titles = re.findall(r'<a class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', html)
                        for i in range(min(len(titles), 4)):
                            t_url = titles[i][0]
                            if "uddg=" in t_url:
                                m = re.search(r'uddg=([^&]+)', t_url)
                                if m:
                                    t_url = urllib.parse.unquote(m.group(1))
                            t_title = re.sub(r'<[^>]+>', '', titles[i][1]).strip()
                            t_snip = re.sub(r'<[^>]+>', '', snips[i]).strip() if i < len(snips) else ""
                            results.append(f"### {t_title}\n- **URL**: {t_url}\n- **Summary**: {t_snip}")
                except Exception:
                    pass

            if results:
                return f"## Web Search Results for: `{query}`\n\n" + "\n\n".join(results[:6])
            return f"No results found for `{query}`."

        elif tool_name == "fetch_web_content":
            url = arguments.get("url", "").strip()
            if not url:
                return "Error: URL is required."
            try:
                req = urllib.request.Request(
                    url,
                    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GeminiStudio/2.0'}
                )
                with urllib.request.urlopen(req, timeout=12) as response:
                    raw = response.read().decode('utf-8', errors='ignore')
                    text = re.sub(r'<script[\s\S]*?</script>', '', raw)
                    text = re.sub(r'<style[\s\S]*?</style>', '', text)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    return f"### Content from `{url}`:\n\n{text[:15000]}"
            except Exception as e:
                return f"[Fetch Error: {e}]"

        return f"Unknown tool: {tool_name}"


# ── 2. Advanced Code Architect & File System MCP Server ──────────────────
class CodeArchitectMCPServer:
    def __init__(self):
        self.server_id = "mcp-code-architect"
        self.is_connected = True
        self.tools = [
            {
                "name": "multi_replace_file_content",
                "description": "Atomically replace multiple non-contiguous blocks of text across a file. Pass a list of {target, replacement} pairs.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "Target file path"},
                        "chunks": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "target": {"type": "string", "description": "Exact text block to find"},
                                    "replacement": {"type": "string", "description": "New replacement content"}
                                },
                                "required": ["target", "replacement"]
                            },
                            "description": "List of replacement operations"
                        }
                    },
                    "required": ["filepath", "chunks"]
                }
            },
            {
                "name": "view_file_slice",
                "description": "View a specific 1-indexed line range [start_line, end_line] of a text or source code file.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "File path to view"},
                        "start_line": {"type": "integer", "description": "1-indexed starting line number"},
                        "end_line": {"type": "integer", "description": "1-indexed ending line number"}
                    },
                    "required": ["filepath"]
                }
            }
        ]

    def call_tool(self, tool_name, arguments):
        if tool_name == "multi_replace_file_content":
            filepath = arguments.get("filepath", "")
            chunks = arguments.get("chunks", [])
            if not os.path.exists(filepath):
                return f"Error: File '{filepath}' does not exist."
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()

            applied = 0
            for idx, chunk in enumerate(chunks, 1):
                target = chunk.get("target", "")
                replacement = chunk.get("replacement", "")
                if target in content:
                    content = content.replace(target, replacement, 1)
                    applied += 1
                else:
                    return f"Error: Chunk #{idx} target was not found in '{filepath}'."

            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully applied all {applied} replacement chunks to '{filepath}'."

        elif tool_name == "view_file_slice":
            filepath = arguments.get("filepath", "")
            start = arguments.get("start_line", 1)
            end = arguments.get("end_line", 500)
            if not os.path.exists(filepath):
                return f"Error: File '{filepath}' does not exist."
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()
            
            total = len(lines)
            start_idx = max(0, start - 1)
            end_idx = min(total, end)
            selected = lines[start_idx:end_idx]

            formatted = []
            for i, line in enumerate(selected, start=start_idx+1):
                formatted.append(f"{i:4d} | {line.rstrip()}")
            return f"File: `{filepath}` (Showing lines {start_idx+1} to {end_idx} of {total}):\n\n```\n" + "\n".join(formatted) + "\n```"

        return f"Unknown tool: {tool_name}"


# ── 3. Interactive Data Visualization MCP Server ─────────────────────────
class DataVisualizationMCPServer:
    def __init__(self):
        self.server_id = "mcp-visualization"
        self.is_connected = True
        self.tools = [
            {
                "name": "render_chart",
                "description": "Generates an interactive Chart.js / SVG data chart artifact with datasets, labels, and customizable theme.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "chart_type": {"type": "string", "enum": ["bar", "line", "pie", "doughnut", "radar", "scatter"], "description": "Type of chart"},
                        "title": {"type": "string", "description": "Chart title"},
                        "labels": {"type": "array", "items": {"type": "string"}, "description": "X-axis category labels"},
                        "datasets": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "data": {"type": "array", "items": {"type": "number"}},
                                    "color": {"type": "string"}
                                },
                                "required": ["label", "data"]
                            }
                        }
                    },
                    "required": ["chart_type", "title", "labels", "datasets"]
                }
            }
        ]

    def call_tool(self, tool_name, arguments):
        if tool_name == "render_chart":
            chart_type = arguments.get("chart_type", "bar")
            title = arguments.get("title", "Chart")
            labels = arguments.get("labels", [])
            datasets = arguments.get("datasets", [])

            html_chart = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{title}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {{ background: #0b0c0e; color: #f7f8f8; font-family: Inter, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }}
        .chart-box {{ width: 100%; max-width: 700px; background: #141516; border: 1px solid #23252a; border-radius: 12px; padding: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }}
        h2 {{ margin: 0 0 16px; font-size: 16px; font-weight: 600; text-align: center; color: #828fff; }}
    </style>
</head>
<body>
    <div class="chart-box">
        <h2>{title}</h2>
        <canvas id="myChart"></canvas>
    </div>
    <script>
        const ctx = document.getElementById('myChart');
        new Chart(ctx, {{
            type: '{chart_type}',
            data: {{
                labels: {json.dumps(labels)},
                datasets: {json.dumps(datasets)}
            }},
            options: {{
                responsive: true,
                plugins: {{
                    legend: {{ labels: {{ color: '#d0d6e0' }} }}
                }},
                scales: {{
                    x: {{ ticks: {{ color: '#8a8f98' }}, grid: {{ color: '#23252a' }} }},
                    y: {{ ticks: {{ color: '#8a8f98' }}, grid: {{ color: '#23252a' }} }}
                }}
            }}
        }});
    </script>
</body>
</html>"""
            return f'<antArtifact identifier="chart-{int(time.time())}" type="text/html" language="html" title="{title} Interactive Chart">\n{html_chart}\n</antArtifact>'

        return f"Unknown tool: {tool_name}"


# ── 4. Interactive Jupyter Notebooks MCP Server ──────────────────────────
class NotebooksMCPServer:
    def __init__(self):
        self.server_id = "mcp-notebooks"
        self.is_connected = True
        self.tools = [
            {
                "name": "create_notebook",
                "description": "Create a new Jupyter Notebook (.ipynb) with initial cells.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "Target .ipynb file path"},
                        "initial_code": {"type": "string", "description": "Optional starting Python code"}
                    },
                    "required": ["filepath"]
                }
            },
            {
                "name": "insert_notebook_cell",
                "description": "Insert a code or markdown cell into an existing Jupyter Notebook (.ipynb).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "filepath": {"type": "string", "description": "Path to .ipynb file"},
                        "cell_type": {"type": "string", "enum": ["code", "markdown"]},
                        "source": {"type": "string", "description": "Cell code or markdown text"}
                    },
                    "required": ["filepath", "cell_type", "source"]
                }
            }
        ]

    def call_tool(self, tool_name, arguments):
        if tool_name == "create_notebook":
            filepath = arguments.get("filepath", "notebook.ipynb")
            initial_code = arguments.get("initial_code", "# Jupyter Notebook initialized by Gemini Studio\nprint('Hello from Gemini MCP Notebook!')")
            
            nb_structure = {
                "cells": [
                    {
                        "cell_type": "code",
                        "execution_count": None,
                        "metadata": {},
                        "outputs": [],
                        "source": [initial_code]
                    }
                ],
                "metadata": {
                    "kernelspec": {
                        "display_name": "Python 3",
                        "language": "python",
                        "name": "python3"
                    },
                    "language_info": {
                        "name": "python",
                        "version": "3.11"
                    }
                },
                "nbformat": 4,
                "nbformat_minor": 5
            }
            os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(nb_structure, f, indent=2)
            return f"Successfully created Jupyter Notebook at `{filepath}` with initial cell."

        elif tool_name == "insert_notebook_cell":
            filepath = arguments.get("filepath", "")
            cell_type = arguments.get("cell_type", "code")
            source = arguments.get("source", "")
            if not os.path.exists(filepath):
                return f"Error: Notebook '{filepath}' does not exist."

            with open(filepath, 'r', encoding='utf-8') as f:
                nb = json.load(f)

            new_cell = {
                "cell_type": cell_type,
                "metadata": {},
                "source": [source]
            }
            if cell_type == "code":
                new_cell["execution_count"] = None
                new_cell["outputs"] = []

            nb.setdefault("cells", []).append(new_cell)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(nb, f, indent=2)
            return f"Successfully inserted new {cell_type} cell into `{filepath}`."

        return f"Unknown tool: {tool_name}"


# ── 5. Database & SQLite MCP Server ──────────────────────────────────────
class DatabaseMCPServer:
    def __init__(self):
        self.server_id = "mcp-database"
        self.is_connected = True
        self.tools = [
            {
                "name": "sqlite_query",
                "description": "Execute any SQL query on a local SQLite database and return formatted rows.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "db_path": {"type": "string", "description": "Path to .db or .sqlite file"},
                        "query": {"type": "string", "description": "SQL statement (SELECT, INSERT, UPDATE, etc.)"}
                    },
                    "required": ["db_path", "query"]
                }
            },
            {
                "name": "sqlite_schema",
                "description": "Inspect all tables, columns, and index schemas in a SQLite database.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "db_path": {"type": "string", "description": "Path to .db file"}
                    },
                    "required": ["db_path"]
                }
            }
        ]

    def call_tool(self, tool_name, arguments):
        db_path = arguments.get("db_path", "")
        if not os.path.exists(db_path):
            return f"Error: Database file '{db_path}' does not exist."

        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        try:
            if tool_name == "sqlite_query":
                query = arguments.get("query", "").strip()
                c.execute(query)
                if query.lower().startswith("select") or query.lower().startswith("pragma"):
                    rows = [dict(r) for r in c.fetchmany(100)]
                    conn.close()
                    return json.dumps(rows, indent=2)
                else:
                    conn.commit()
                    count = c.rowcount
                    conn.close()
                    return f"Query executed successfully. Affected rows: {count}"

            elif tool_name == "sqlite_schema":
                c.execute("SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'view')")
                tables = [dict(r) for r in c.fetchall()]
                conn.close()
                return json.dumps(tables, indent=2)
        except Exception as e:
            conn.close()
            return f"Database Error: {e}"

        return f"Unknown tool: {tool_name}"


# ── 6. External Stdio JSON-RPC 2.0 Connection ───────────────────────────
class MCPServerConnection:
    def __init__(self, server_id, config):
        self.server_id = server_id
        self.config = config
        self.process = None
        self.tools = []
        self.is_connected = False
        self.error_message = None
        self._lock = threading.Lock()
        self._req_id = 0

    def start(self, timeout=12.0):
        command = self.config.get("command")
        args = self.config.get("args", [])
        env = os.environ.copy()
        if "env" in self.config and isinstance(self.config["env"], dict):
            env.update(self.config["env"])

        if not command:
            self.error_message = "No command specified."
            return False

        resolved_cmd = shutil.which(command) or command
        cmd_list = [resolved_cmd] + args
        use_shell = os.name == 'nt' and (resolved_cmd.endswith('.cmd') or resolved_cmd.endswith('.bat') or command in {'npx', 'npm'})

        try:
            creation_flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            self.process = subprocess.Popen(
                cmd_list,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env=env,
                text=True,
                encoding='utf-8',
                errors='replace',
                bufsize=1,
                shell=use_shell,
                creationflags=creation_flags
            )

            # MCP Initialize Handshake
            init_res = self._send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": { "roots": {"listChanged": True}, "sampling": {} },
                "clientInfo": { "name": "gemini-claude-studio", "version": "2.0" }
            }, timeout=timeout)

            if not init_res or "error" in init_res:
                err = init_res.get("error", {}).get("message", "Handshake failed") if init_res else "No response"
                self.error_message = err
                self.stop()
                return False

            self._send_notification("notifications/initialized", {})

            # Fetch Tools
            tools_res = self._send_request("tools/list", {}, timeout=timeout)
            if tools_res and "result" in tools_res:
                self.tools = tools_res["result"].get("tools", [])
                self.is_connected = True
                self.error_message = None
                return True
            else:
                self.tools = []
                self.is_connected = True
                return True
        except Exception as e:
            self.error_message = str(e)
            self.is_connected = False
            self.stop()
            return False

    def _send_request(self, method, params, timeout=10.0):
        if not self.process or self.process.poll() is not None:
            return None
        with self._lock:
            self._req_id += 1
            req_id = self._req_id
            payload = { "jsonrpc": "2.0", "id": req_id, "method": method, "params": params }
            try:
                self.process.stdin.write(json.dumps(payload) + "\n")
                self.process.stdin.flush()

                start_time = time.time()
                while time.time() - start_time < timeout:
                    line = self.process.stdout.readline()
                    if not line:
                        if self.process.poll() is not None:
                            break
                        time.sleep(0.05)
                        continue
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        res = json.loads(line)
                        if res.get("id") == req_id:
                            return res
                    except Exception:
                        pass
            except Exception as e:
                self.error_message = str(e)
            return None

    def _send_notification(self, method, params):
        if not self.process or self.process.poll() is not None:
            return
        with self._lock:
            try:
                self.process.stdin.write(json.dumps({"jsonrpc": "2.0", "method": method, "params": params}) + "\n")
                self.process.stdin.flush()
            except Exception:
                pass

    def call_tool(self, tool_name, arguments, timeout=30.0):
        if not self.is_connected:
            return f"[Error: MCP Server '{self.server_id}' is not connected: {self.error_message}]"

        res = self._send_request("tools/call", { "name": tool_name, "arguments": arguments }, timeout=timeout)
        if not res:
            return f"[Error: No response from MCP Server '{self.server_id}']"
        if "error" in res:
            return f"[MCP Tool Error]: {res['error'].get('message', str(res['error']))}"

        result = res.get("result", {})
        content_items = result.get("content", [])
        out_texts = []
        for item in content_items:
            if item.get("type") == "text":
                out_texts.append(item.get("text", ""))
            elif item.get("type") == "image":
                out_texts.append(f"[MCP Image Content]")
            else:
                out_texts.append(json.dumps(item))
        return "\n".join(out_texts) if out_texts else json.dumps(result)

    def stop(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=1.0)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None
        self.is_connected = False


# ── 7. Global MCP Hub Orchestrator ──────────────────────────────────────
class MCPHub:
    def __init__(self):
        self.builtin_servers = [
            WebSearchMCPServer(),
            CodeArchitectMCPServer(),
            DataVisualizationMCPServer(),
            NotebooksMCPServer(),
            DatabaseMCPServer()
        ]
        self.active_servers = {}
        self.configs = {}
        self.load_configs()

    def load_configs(self):
        self.configs = {}
        for s in self.builtin_servers:
            self.configs[s.server_id] = {
                "name": s.server_id.replace("mcp-", "").replace("-", " ").title() + " MCP",
                "type": "builtin",
                "enabled": True,
                "source": "internal"
            }

        # 1. Global .gemini/config/mcp_config.json
        if os.path.exists(GLOBAL_MCP_CONFIG):
            try:
                with open(GLOBAL_MCP_CONFIG, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for s_id, s_cfg in data.get("mcpServers", {}).items():
                        s_cfg["source"] = "global"
                        s_cfg["enabled"] = s_cfg.get("enabled", True)
                        self.configs[s_id] = s_cfg
            except Exception as e:
                print(f"[MCP Hub] Global config read error: {e}")

        # 2. Local mcp_servers.json
        if os.path.exists(LOCAL_MCP_CONFIG):
            try:
                with open(LOCAL_MCP_CONFIG, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for s_id, s_cfg in data.get("mcpServers", {}).items():
                        s_cfg["source"] = "local"
                        s_cfg["enabled"] = s_cfg.get("enabled", True)
                        self.configs[s_id] = s_cfg
            except Exception as e:
                print(f"[MCP Hub] Local config read error: {e}")

    def save_local_config(self):
        local_servers = {k: v for k, v in self.configs.items() if v.get("source") == "local"}
        try:
            with open(LOCAL_MCP_CONFIG, 'w', encoding='utf-8') as f:
                json.dump({"mcpServers": local_servers}, f, indent=2)
        except Exception as e:
            print(f"[MCP Hub] Save error: {e}")

    def get_server_statuses(self):
        res = []
        for s in self.builtin_servers:
            res.append({
                "id": s.server_id,
                "name": s.server_id.replace("mcp-", "").replace("-", " ").title(),
                "status": "connected",
                "tools_count": len(s.tools),
                "tools": [t["name"] for t in s.tools],
                "type": "builtin",
                "source": "internal"
            })

        for s_id, cfg in self.configs.items():
            if any(b.server_id == s_id for b in self.builtin_servers):
                continue
            conn = self.active_servers.get(s_id)
            if conn and conn.is_connected:
                status = "connected"
                tools = [t["name"] for t in conn.tools]
                err = None
            else:
                status = "configured"
                tools = []
                err = conn.error_message if conn else None

            res.append({
                "id": s_id,
                "name": cfg.get("name", s_id),
                "command": cfg.get("command", ""),
                "args": cfg.get("args", []),
                "status": status,
                "tools_count": len(tools),
                "tools": tools,
                "error": err,
                "source": cfg.get("source", "local")
            })
        return res

    def get_presets(self):
        return [
            {
                "id": "mcp-filesystem",
                "name": "Local Filesystem MCP",
                "description": "Securely read/write files and directories anywhere on your local computer.",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem", os.path.expanduser("~")]
            },
            {
                "id": "mcp-memory",
                "name": "Knowledge Graph Memory MCP",
                "description": "Persistent graph memory for entities, facts, and relations across chats.",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-memory"]
            },
            {
                "id": "mcp-puppeteer",
                "name": "Puppeteer Browser Automation",
                "description": "Automate web browsing, scrape SPAs, and capture full-page screenshots.",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-puppeteer"]
            },
            {
                "id": "mcp-github",
                "name": "GitHub Repository Manager",
                "description": "Interact with GitHub repos, issues, pull requests, and commits.",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-github"],
                "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": ""}
            },
            {
                "id": "mcp-brave-search",
                "name": "Brave Web Search API",
                "description": "High quality web search and news indexing via Brave Search API.",
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-brave-search"],
                "env": {"BRAVE_API_KEY": ""}
            }
        ]

    def import_json_config(self, raw_json_str):
        try:
            data = json.loads(raw_json_str)
            servers = data.get("mcpServers", data)
            if not isinstance(servers, dict):
                return False, "Invalid JSON structure. Expected an object with server definitions or 'mcpServers' key."

            added_count = 0
            for s_id, s_cfg in servers.items():
                if isinstance(s_cfg, dict) and "command" in s_cfg:
                    self.configs[s_id] = {
                        "name": s_cfg.get("name", s_id),
                        "command": s_cfg.get("command"),
                        "args": s_cfg.get("args", []),
                        "env": s_cfg.get("env", {}),
                        "source": "local",
                        "enabled": s_cfg.get("enabled", True)
                    }
                    added_count += 1

            self.save_local_config()
            self.start_all_configured()
            return True, f"Successfully imported {added_count} MCP server(s)."
        except Exception as e:
            return False, f"JSON parse error: {e}"

    def start_all_configured(self):
        for s_id, cfg in self.configs.items():
            if any(b.server_id == s_id for b in self.builtin_servers) or not cfg.get("enabled", True):
                continue
            if s_id not in self.active_servers or not self.active_servers[s_id].is_connected:
                conn = MCPServerConnection(s_id, cfg)
                threading.Thread(target=conn.start, daemon=True).start()
                self.active_servers[s_id] = conn

    def get_all_openai_tools(self):
        openai_tools = []
        for s in self.builtin_servers:
            for t in s.tools:
                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": t["name"],
                        "description": f"[MCP:{s.server_id}] {t['description']}",
                        "parameters": t.get("inputSchema", {"type": "object", "properties": {}})
                    }
                })

        for s_id, conn in self.active_servers.items():
            if conn and conn.is_connected:
                for t in conn.tools:
                    openai_tools.append({
                        "type": "function",
                        "function": {
                            "name": f"mcp__{s_id}__{t['name']}",
                            "description": f"[MCP:{s_id}] {t.get('description', '')}",
                            "parameters": t.get("inputSchema", {"type": "object", "properties": {}})
                        }
                    })
        return openai_tools

    def dispatch_tool(self, tool_name, arguments):
        for s in self.builtin_servers:
            for t in s.tools:
                if t["name"] == tool_name:
                    return s.call_tool(tool_name, arguments)

        if tool_name.startswith("mcp__"):
            parts = tool_name.split("__", 2)
            if len(parts) == 3:
                s_id, actual_name = parts[1], parts[2]
                conn = self.active_servers.get(s_id)
                if conn:
                    return conn.call_tool(actual_name, arguments)
                return f"[Error: MCP Server '{s_id}' is not active.]"

        for s_id, conn in self.active_servers.items():
            if conn and conn.is_connected:
                for t in conn.tools:
                    if t["name"] == tool_name:
                        return conn.call_tool(tool_name, arguments)
        return None

hub = MCPHub()
hub.start_all_configured()
