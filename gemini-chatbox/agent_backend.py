import json
import os
import re
import subprocess
import urllib.request
import urllib.parse
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

client = OpenAI(base_url="http://localhost:8081/v1", api_key="sk-gemini")
MODEL = "gemini-3.6-flash"

USER_HOME = r"C:\Users\ISHAAN SEN"
USER_DESKTOP = r"C:\Users\ISHAAN SEN\Desktop"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a PowerShell command on the user's local Windows system.",
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
            "name": "read_file",
            "description": "Read contents of a local file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "File path"}
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
            "description": "Search across files in a directory for a text pattern or query.",
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
            "description": "List top-level files and subdirectories in a directory (shallow 1-level view).",
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

MAX_OUTPUT_LEN = 3000

def resolve_path(p):
    if not p:
        return USER_HOME
    p = p.strip()
    if p.lower().startswith("desktop"):
        sub = p[7:].lstrip("\\/")
        return os.path.join(USER_DESKTOP, sub) if sub else USER_DESKTOP
    if p.startswith("~"):
        sub = p[1:].lstrip("\\/")
        return os.path.join(USER_HOME, sub) if sub else USER_HOME
    if not os.path.isabs(p):
        dt_path = os.path.join(USER_DESKTOP, p)
        if os.path.exists(dt_path):
            return dt_path
        return os.path.join(USER_HOME, p)
    return p

def execute_tool(name, args):
    try:
        if isinstance(args, str):
            args = json.loads(args)
            
        if name == "run_command":
            cmd = args.get("command", "")
            result = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, timeout=20)
            output = result.stdout
            if result.stderr:
                output += "\nError: " + result.stderr
            if not output.strip():
                return "Command executed with no output."
            if len(output) > MAX_OUTPUT_LEN:
                output = output[:MAX_OUTPUT_LEN] + "\n...[Output truncated for speed]"
            return output

        elif name == "read_file":
            filepath = resolve_path(args.get("filepath"))
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if len(content) > MAX_OUTPUT_LEN:
                content = content[:MAX_OUTPUT_LEN] + "\n...[File truncated for speed]"
            return content

        elif name == "write_file":
            filepath = resolve_path(args.get("filepath"))
            content = args.get("content", "")
            os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully wrote file to {filepath}"

        elif name == "replace_file_content":
            filepath = resolve_path(args.get("filepath"))
            target = args.get("target", "")
            replacement = args.get("replacement", "")
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if target not in content:
                return f"Error: Target string not found in {filepath}"
            new_content = content.replace(target, replacement, 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            return f"Successfully updated content in {filepath}"

        elif name == "grep_search":
            path = resolve_path(args.get("path", "."))
            query = args.get("query", "").lower()
            matches = []
            for root, dirs, files in os.walk(path):
                dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}]
                for file in files:
                    fp = os.path.join(root, file)
                    try:
                        with open(fp, 'r', encoding='utf-8', errors='ignore') as f:
                            for idx, line in enumerate(f, 1):
                                if query in line.lower():
                                    matches.append(f"{os.path.basename(fp)}:{idx} - {line.strip()[:120]}")
                                    if len(matches) >= 30:
                                        break
                    except Exception:
                        pass
                if len(matches) >= 30:
                    matches.append("... [More matches truncated for speed]")
                    break
            return f"Grep results for '{query}' in {path}:\n" + ("\n".join(matches) if matches else "No matches found.")

        elif name == "list_dir":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path)
            
            if not os.path.exists(path):
                dt_alt = os.path.join(USER_DESKTOP, raw_path)
                if os.path.exists(dt_alt):
                    path = dt_alt
                else:
                    return f"Directory '{raw_path}' does not exist on your computer."
            
            ignored = {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}
            items = []
            for entry in os.scandir(path):
                if entry.name in ignored:
                    continue
                kind = "[DIR]" if entry.is_dir() else "[FILE]"
                items.append(f"{kind} {entry.name}")
                if len(items) >= 40:
                    items.append("... [More files truncated for speed]")
                    break
                    
            return f"Contents of {path}:\n" + ("\n".join(items) if items else "Directory is empty.")
            
        return f"Unknown tool: {name}"
    except subprocess.TimeoutExpired:
        return "Command timed out after 20 seconds."
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

def extract_fallback_tool(content):
    if not content:
        return None, None
    pattern = r"```(?:tool_call|json)?\s*(\{[\s\S]*?\})\s*```"
    match = re.search(pattern, content)
    if match:
        try:
            data = json.loads(match.group(1))
            name = data.get("name") or data.get("tool")
            args = data.get("arguments") or data.get("args") or {}
            valid_names = ["run_command", "read_file", "write_file", "replace_file_content", "grep_search", "list_dir"]
            if name and name in valid_names:
                return name, args
        except Exception:
            pass
    return None, None

SYSTEM_INSTRUCTION = """You are Antigravity Gemini Agent, an autonomous software engineering pair programmer equipped with native system tools.
You have FULL authority and capabilities to:
- Read local files (`read_file`)
- Write new code files (`write_file`)
- Edit existing code in-place (`replace_file_content`)
- Search codebases (`grep_search`)
- Inspect directories (`list_dir`)
- Execute terminal commands & run scripts (`run_command`)

RULES:
1. Always take initiative! If asked to build, fix, run, or check code, USE YOUR TOOLS immediately.
2. NEVER state that you lack access to local files or commands — YOU HAVE FULL TOOL ACCESS.
"""

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    requested_model = data.get('model', MODEL)
    
    if not messages or messages[0].get('role') != 'system':
        messages.insert(0, {"role": "system", "content": SYSTEM_INSTRUCTION})
    else:
        messages[0]['content'] = SYSTEM_INSTRUCTION + "\n\n" + messages[0]['content']
    
    def generate():
        nonlocal messages
        
        yield f"data: {json.dumps({'thinking': 'Analyzing request & planning autonomous steps...'})}\n\n"
        
        for step in range(1, 11): # Up to 10 autonomous tool steps
            try:
                response = client.chat.completions.create(
                    model=requested_model,
                    messages=messages,
                    tools=TOOLS,
                    stream=False
                )
            except Exception as e:
                error_msg = str(e)
                if "Connection error" in error_msg:
                    error_msg = "Could not connect to gemini-web2api. Make sure start_server.bat is running!"
                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                break
                
            choice = response.choices[0]
            msg = choice.message
            
            tool_calls_to_process = []
            
            if msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_calls_to_process.append((tc.function.name, tc.function.arguments, tc.id))
            else:
                fallback_name, fallback_args = extract_fallback_tool(msg.content)
                if fallback_name:
                    tool_calls_to_process.append((fallback_name, fallback_args, f"fallback_{step}"))
            
            if tool_calls_to_process:
                messages.append(msg.model_dump() if hasattr(msg, 'model_dump') else dict(msg))
                
                for tool_name, tool_args, tool_id in tool_calls_to_process:
                    yield f"data: {json.dumps({'thinking': f'Step {step}: Executing `{tool_name}`...'})}\n\n"
                    yield f"data: {json.dumps({'system': f'Executing {tool_name}...'})}\n\n"
                    
                    result = execute_tool(tool_name, tool_args)
                    
                    yield f"data: {json.dumps({'thinking': f'Finished `{tool_name}` ({len(result)} chars output)'})}\n\n"
                    
                    messages.append({
                        "role": "tool",
                        "name": tool_name,
                        "tool_call_id": tool_id,
                        "content": str(result)
                    })
                continue
            else:
                content = msg.content or ""
                yield f"data: {json.dumps({'thinking': 'Formulating final answer...'})}\n\n"
                
                for i in range(0, len(content), 15):
                    chunk = content[i:i+15]
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                
                messages.append({"role": "assistant", "content": content})
                yield "data: [DONE]\n\n"
                break

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    print("Starting Agent Backend on port 5000...")
    app.run(port=5000, debug=False)
