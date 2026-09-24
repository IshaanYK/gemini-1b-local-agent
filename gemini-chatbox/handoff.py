import json
import os
import subprocess
import webbrowser
import time

import glob

CONTEXT_FILE = "handoff_context.json"
UI_FILE = "index.html"

def get_latest_transcript_path():
    brain_dir = os.path.expanduser(r"~/.gemini/antigravity-ide/brain")
    pattern = os.path.join(brain_dir, "*", ".system_generated", "logs", "transcript.jsonl")
    files = glob.glob(pattern)
    if not files:
        return None
    files.sort(key=lambda f: os.path.getmtime(f), reverse=True)
    return files[0]

def main():
    print("Packaging Antigravity context for Gemini 1B...")
    
    context_messages = []
    transcript_path = get_latest_transcript_path()
    
    if transcript_path and os.path.exists(transcript_path):
        print(f"Using transcript: {transcript_path}")
        with open(transcript_path, 'r', encoding='utf-8') as f:
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
    print("Opening Gemini Agent Studio at http://127.0.0.1:5000 in your browser...")
    webbrowser.open("http://127.0.0.1:5000")

if __name__ == "__main__":
    main()
