import json
import os
import re
import subprocess
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
            "description": "Create or overwrite a file on local disk with code or text content.",
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
            "name": "list_dir",
            "description": "List top-level files and subdirectories in a directory (shallow 1-level view).",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (e.g. Desktop/sem 4 or C:\\Users\\...)"}
                },
                "required": ["path"]
            }
        }
    }
]

MAX_OUTPUT_LEN = 2500

def resolve_path(p):
    if not p:
        return USER_HOME
    p = p.strip()
    # Resolve relative desktop paths like "desktop/sem 4" or "sem 4"
    if p.lower().startswith("desktop"):
        sub = p[7:].lstrip("\\/")
        return os.path.join(USER_DESKTOP, sub) if sub else USER_DESKTOP
    if p.startswith("~"):
        sub = p[1:].lstrip("\\/")
        return os.path.join(USER_HOME, sub) if sub else USER_HOME
    if not os.path.isabs(p):
        # Check desktop first if folder exists there
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
            result = subprocess.run(["powershell", "-Command", cmd], capture_output=True, text=True, timeout=15)
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

        elif name == "list_dir":
            raw_path = args.get("path", ".")
            path = resolve_path(raw_path)
            
            if not os.path.exists(path):
                # Try finding under desktop if not found
                dt_alt = os.path.join(USER_DESKTOP, raw_path)
                if os.path.exists(dt_alt):
                    path = dt_alt
                else:
                    return f"Directory '{raw_path}' does not exist on your computer."
            
            # Shallow listing (1 level), filtering out heavy noise folders
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
        return "Command timed out after 15 seconds."
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

def extract_fallback_tool(content):
    """Fallback tool parser in case model outputs tool_call or json in text."""
    if not content:
        return None, None
    # Check ```tool_call ... ``` or ```json ... ```
    pattern = r"```(?:tool_call|json)?\s*(\{[\s\S]*?\})\s*```"
    match = re.search(pattern, content)
    if match:
        try:
            data = json.loads(match.group(1))
            name = data.get("name") or data.get("tool")
            args = data.get("arguments") or data.get("args") or {}
            if name and name in ["run_command", "read_file", "write_file", "list_dir"]:
                return name, args
        except Exception:
            pass
    return None, None

SYSTEM_INSTRUCTION = """You are Gemini Agent, an autonomous software engineering agent with direct local system access.
When the user asks to inspect a folder, read a file, write code, or execute commands:
YOU MUST USE YOUR SYSTEM TOOLS (`list_dir`, `read_file`, `write_file`, `run_command`).
NEVER state that you lack access to local files or commands — YOU HAVE NATIVE TOOL ACCESS.

Examples:
- User: "check my sem 4 folder on desktop" -> Call `list_dir(path="Desktop/sem 4")`
- User: "run python test.py" -> Call `run_command(command="python test.py")`
"""

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    requested_model = data.get('model', MODEL)
    
    # Ensure system directive is present
    if not messages or messages[0].get('role') != 'system':
        messages.insert(0, {"role": "system", "content": SYSTEM_INSTRUCTION})
    else:
        messages[0]['content'] = SYSTEM_INSTRUCTION + "\n\n" + messages[0]['content']
    
    def generate():
        nonlocal messages
        
        yield f"data: {json.dumps({'thinking': 'Analyzing request & preparing tool actions...'})}\n\n"
        
        for step in range(1, 6):
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
                # Check text fallback
                fallback_name, fallback_args = extract_fallback_tool(msg.content)
                if fallback_name:
                    tool_calls_to_process.append((fallback_name, fallback_args, "fallback_1"))
            
            if tool_calls_to_process:
                messages.append(msg.model_dump() if hasattr(msg, 'model_dump') else dict(msg))
                
                for tool_name, tool_args, tool_id in tool_calls_to_process:
                    yield f"data: {json.dumps({'thinking': f'Step {step}: Running `{tool_name}` on local system...'})}\n\n"
                    yield f"data: {json.dumps({'system': f'Executing {tool_name}...'})}\n\n"
                    
                    result = execute_tool(tool_name, tool_args)
                    
                    yield f"data: {json.dumps({'thinking': f'Finished `{tool_name}` ({len(result)} chars returned)'})}\n\n"
                    
                    messages.append({
                        "role": "tool",
                        "name": tool_name,
                        "tool_call_id": tool_id,
                        "content": str(result)
                    })
                continue
            else:
                content = msg.content or ""
                yield f"data: {json.dumps({'thinking': 'Formulating final response...'})}\n\n"
                
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
