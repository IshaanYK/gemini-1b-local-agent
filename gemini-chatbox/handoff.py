import json
import os
import subprocess
import webbrowser
import time

TRANSCRIPT_PATH = r"C:\Users\ISHAAN SEN\.gemini\antigravity-ide\brain\10d1440f-f6da-4b60-ac6a-cb48de2aaeb8\.system_generated\logs\transcript.jsonl"
CONTEXT_FILE = "handoff_context.json"
UI_FILE = "index.html"

def main():
    print("Packaging Antigravity context for Gemini 1B...")
    
    context_messages = []
    
    if os.path.exists(TRANSCRIPT_PATH):
        with open(TRANSCRIPT_PATH, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            # Extract just user inputs and model planner responses for context
            for line in lines:
                try:
                    data = json.loads(line)
                    if data.get('type') == 'USER_INPUT':
                        context_messages.append({"role": "user", "content": data.get('content', '')})
                    elif data.get('type') == 'PLANNER_RESPONSE':
                        # We don't include tool calls in handoff to avoid formatting issues, just the text
                        content = data.get('content', '')
                        if content:
                            context_messages.append({"role": "assistant", "content": content})
                except Exception:
                    pass
    
    if not context_messages:
        context_messages.append({"role": "system", "content": "You are Gemini 1B Agent. You have terminal access to the user's computer via tools."})
    else:
        # Prepend system message
        sys_msg = "You are Gemini 1B Agent. You have terminal and file access to the user's computer via tools. Here is the conversation history between the user and their previous AI assistant (Antigravity). Continue the work where they left off."
        context_messages.insert(0, {"role": "system", "content": sys_msg})
        
    with open(CONTEXT_FILE, 'w', encoding='utf-8') as f:
        json.dump(context_messages, f)
        
    print(f"Context saved to {CONTEXT_FILE}.")
    
    # Open UI
    ui_path = os.path.abspath(UI_FILE)
    print(f"Opening {ui_path} in your browser...")
    webbrowser.open(f"file:///{ui_path}")

if __name__ == "__main__":
    main()
