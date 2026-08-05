import json
import os
import subprocess
from flask import Flask, request, Response, stream_with_context
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

client = OpenAI(base_url="http://localhost:8081/v1", api_key="sk-gemini")
MODEL = "gemini-3.6-flash"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute a PowerShell terminal command on the user's computer.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The PowerShell command string"}
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
            "description": "Create or overwrite a file on disk with content.",
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
            "description": "List top-level files and subdirectories in a directory (shallow 1-level view). Do NOT scan recursively.",
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

MAX_OUTPUT_LEN = 2500

def execute_tool(name, args):
    try:
        if isinstance(args, str):
            args = json.loads(args)
            
        if name == "run_command":
            cmd = args.get("command")
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
            filepath = args.get("filepath")
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            if len(content) > MAX_OUTPUT_LEN:
                content = content[:MAX_OUTPUT_LEN] + "\n...[File truncated for speed]"
            return content

        elif name == "write_file":
            filepath = args.get("filepath")
            content = args.get("content")
            os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Successfully wrote file to {filepath}"

        elif name == "list_dir":
            path = args.get("path", ".")
            if not os.path.exists(path):
                return f"Directory {path} does not exist."
            
            # Shallow listing (1 level), filtering out heavy noise folders
            ignored = {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}
            items = []
            for entry in os.scandir(path):
                if entry.name in ignored:
                    continue
                kind = "[DIR]" if entry.is_dir() else "[FILE]"
                items.append(f"{kind} {entry.name}")
                if len(items) >= 40: # Max 40 items
                    items.append("... [More files truncated]")
                    break
                    
            return "\n".join(items) if items else "Directory is empty."
            
        return f"Unknown tool: {name}"
    except subprocess.TimeoutExpired:
        return "Command timed out after 15 seconds."
    except Exception as e:
        return f"Tool execution failed: {str(e)}"

@app.route('/api/chat', methods=['POST'])
def chat():
    data = request.json
    messages = data.get('messages', [])
    requested_model = data.get('model', MODEL)
    
    def generate():
        nonlocal messages
        
        yield f"data: {json.dumps({'thinking': 'Analyzing your request & planning steps...'})}\n\n"
        
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
            
            if msg.tool_calls:
                messages.append(msg.model_dump() if hasattr(msg, 'model_dump') else dict(msg))
                
                for tool_call in msg.tool_calls:
                    tool_name = tool_call.function.name
                    tool_args = tool_call.function.arguments
                    
                    yield f"data: {json.dumps({'thinking': f'Step {step}: Tool `{tool_name}` requested with `{tool_args}`'})}\n\n"
                    yield f"data: {json.dumps({'system': f'Executing {tool_name}...'})}\n\n"
                    
                    result = execute_tool(tool_name, tool_args)
                    
                    yield f"data: {json.dumps({'thinking': f'Completed `{tool_name}` ({len(result)} chars returned)'})}\n\n"
                    
                    messages.append({
                        "role": "tool",
                        "name": tool_name,
                        "tool_call_id": tool_call.id,
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
