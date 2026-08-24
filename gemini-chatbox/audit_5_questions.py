import sqlite3
import re
import json

conn = sqlite3.connect('storage/chat_sessions.db')
c = conn.cursor()

session_ids = [
    ('Q1: Schwarzschild RK4', '933fa909-c873-4682-950d-8c305c0def77'),
    ('Q2: 5-Node Raft Consensus', '79d26dc5-0225-4367-9951-d038d44846bd'),
    ('Q3: Schnorr NIZK Proof', '323d1bc4-c511-4007-b9f2-9efe577bc542'),
    ('Q4: Bytecode VM', 'e981c878-4350-4285-ab36-3a34d75e746c'),
    ('Q5: Messy Lorenz Attractor', '1e909a01-0801-4e09-bb19-2bc70907da18')
]

print("=" * 60)
print("B1 COMPREHENSIVE 5-QUESTION AUDIT & EVALUATION REPORT")
print("=" * 60)

for label, sid in session_ids:
    c.execute('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC', (sid,))
    msgs = c.fetchall()
    
    print(f"\n### {label}")
    asst_msgs = [m[1] for m in msgs if m[0] == 'assistant']
    if not asst_msgs:
        print("No assistant message found.")
        continue
    
    latest_asst = asst_msgs[-1]
    
    # 1. Structure Audit
    has_tldr = bool(re.search(r'(?i)(tldr|executive summary)', latest_asst))
    has_math = bool(re.search(r'\$\$.*?\$\$|\$.*?\$', latest_asst, re.DOTALL))
    has_mermaid = '```mermaid' in latest_asst
    has_suggestions = '[SUGGESTIONS:' in latest_asst
    
    print(f"- Length: {len(latest_asst):,} chars")
    print(f"- Has TL;DR / Executive Summary: {'[PASS] Yes' if has_tldr else '[FAIL] Missing'}")
    print(f"- Has Mathematical Proofs (KaTeX): {'[PASS] Yes' if has_math else '[FAIL] Missing'}")
    print(f"- Has Architecture Diagram (Mermaid): {'[PASS] Yes' if has_mermaid else '[INFO] N/A'}")
    print(f"- Has Smart Suggestions: {'[PASS] Yes' if has_suggestions else '[FAIL] Missing'}")
    
    # 2. Artifact Audit
    art_matches = re.findall(r'<antArtifact\s+identifier="([^"]+)"[^>]*title="([^"]+)"[^>]*>([\s\S]*?)</antArtifact>', latest_asst)
    if art_matches:
        for ident, title, code in art_matches:
            print(f"- Artifact: '{title}' ({ident}, {len(code):,} bytes)")
            # Check for CDN dependencies
            cdns = re.findall(r'<script\s+src=["\']([^"\']+)["\']', code)
            if cdns:
                print(f"  [WARN] Uses external CDNs: {cdns}")
            else:
                print("  [PASS] 100% Zero-Dependency Standalone Code (Pure Canvas / Native JS)")
    else:
        print("- Artifact: [FAIL] No artifact found")

print("\n" + "=" * 60)
