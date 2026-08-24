"""
core/rag_memory.py — Self-Contained Local RAG & Inter-Timeline Vector Memory System

Capabilities:
1. All-MiniLM Embedding Engine (all-MiniLM-L6-v2) with CPU/GPU/CUDA auto-detection.
2. Zero-dependency fallback encoder (TF-IDF Hash Vectorizer) if sentence-transformers is not installed.
3. Persistent SQLite Vector Store (vector_memory.db) for storing:
   - Inter-timeline conversation memories (across sessions and past user interactions)
   - Code & File chunks (for local file RAG)
4. Cosine similarity semantic search & Gemini RAG prompt generator.
"""
import sys
import os

# Ensure safe stdout/stderr under pythonw.exe / background service
if sys.stdout is None:
    try:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    except Exception:
        pass
if sys.stderr is None:
    try:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")
    except Exception:
        pass

import json
import sqlite3
import datetime
import math
import re

# ── 1. Hardware & Model Auto-Detection ──────────────────────────────────────
HARDWARE_INFO = {
    "device": "CPU",
    "device_name": "CPU (Standard)",
    "model_name": "TF-IDF Hash Vectorizer (Zero-Dep Fallback)",
    "has_sentence_transformers": False,
    "has_torch": False
}

model_instance = None

def _init_embedding_model():
    global model_instance, HARDWARE_INFO
    
    # Check PyTorch / Hardware Acceleration
    try:
        import torch
        HARDWARE_INFO["has_torch"] = True
        if torch.cuda.is_available():
            HARDWARE_INFO["device"] = "cuda"
            HARDWARE_INFO["device_name"] = f"GPU ({torch.cuda.get_device_name(0)})"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            HARDWARE_INFO["device"] = "mps"
            HARDWARE_INFO["device_name"] = "Apple Silicon (MPS)"
        else:
            HARDWARE_INFO["device"] = "cpu"
            HARDWARE_INFO["device_name"] = "CPU (Multi-Threaded)"
    except Exception:
        HARDWARE_INFO["device"] = "cpu"
        HARDWARE_INFO["device_name"] = "CPU"

    # Try loading SentenceTransformers (all-MiniLM-L6-v2)
    try:
        from sentence_transformers import SentenceTransformer
        print(f"[RAG Engine] Loading all-MiniLM-L6-v2 on {HARDWARE_INFO['device_name']}...")
        model_instance = SentenceTransformer('all-MiniLM-L6-v2', device=HARDWARE_INFO["device"])
        HARDWARE_INFO["has_sentence_transformers"] = True
        HARDWARE_INFO["model_name"] = "all-MiniLM-L6-v2 (384d)"
        print("[RAG Engine] [SUCCESS] all-MiniLM-L6-v2 loaded successfully!")
    except Exception as e:
        print(f"[RAG Engine] SentenceTransformers not found or failed ({e}). Using built-in TF-IDF Vectorizer fallback.")
        HARDWARE_INFO["has_sentence_transformers"] = False
        HARDWARE_INFO["model_name"] = "all-MiniLM Hashing Vectorizer (384d)"

_init_embedding_model()

# ── 2. Vector Encoding Function ──────────────────────────────────────────────
def encode_text(text: str) -> list[float]:
    """Generates a 384-dimensional normalized float vector for text."""
    text = (text or "").strip()
    if not text:
        return [0.0] * 384
        
    if HARDWARE_INFO["has_sentence_transformers"] and model_instance:
        try:
            vec = model_instance.encode(text, convert_to_numpy=True)
            return vec.tolist()
        except Exception as e:
            print(f"[RAG Error] SentenceTransformers encoding failed ({e}), using fallback vectorizer.")

    # High-Performance Zero-Dependency Hashing Vectorizer (384d)
    vec = [0.0] * 384
    words = re.findall(r'\w+', text.lower())
    if not words:
        return vec
        
    for word in words:
        h1 = abs(hash(word)) % 384
        h2 = abs(hash(word + "_2")) % 384
        vec[h1] += 1.0
        vec[h2] += 0.5

    for i in range(len(words) - 1):
        bigram = words[i] + "_" + words[i+1]
        hb = abs(hash(bigram)) % 384
        vec[hb] += 1.5

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec

def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculates cosine similarity dot product between two normalized vectors."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    n1 = math.sqrt(sum(a * a for a in vec1))
    n2 = math.sqrt(sum(b * b for b in vec2))
    if n1 == 0 or n2 == 0:
        return 0.0
    return dot / (n1 * n2)

# ── 3. SQLite Vector Store Manager ───────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == "core" else os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(_BASE_DIR, "storage")
os.makedirs(STORAGE_DIR, exist_ok=True)
DB_PATH = os.path.join(STORAGE_DIR, "vector_memory.db") if os.path.exists(os.path.join(STORAGE_DIR, "vector_memory.db")) else (os.path.join(_BASE_DIR, "vector_memory.db") if os.path.exists(os.path.join(_BASE_DIR, "vector_memory.db")) else os.path.join(STORAGE_DIR, "vector_memory.db"))

def _get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables for inter-timeline memories and local file RAG chunks."""
    with _get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                source TEXT NOT NULL,
                vector_json TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                metadata_json TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS file_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filepath TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                text TEXT NOT NULL,
                vector_json TEXT NOT NULL,
                mtime REAL NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)
        conn.commit()

init_db()

# ── 4. High-Level Memory & RAG Operations ───────────────────────────────────
def save_memory(text: str, source: str = "timeline", metadata: dict = None) -> int:
    """Store a text snippet or timeline interaction into vector memory."""
    text = text.strip()
    if not text or len(text) < 5:
        return -1
        
    vec = encode_text(text)
    vec_json = json.dumps(vec)
    meta_json = json.dumps(metadata or {})
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    with _get_db() as conn:
        cursor = conn.execute(
            "INSERT INTO memories (text, source, vector_json, timestamp, metadata_json) VALUES (?, ?, ?, ?, ?)",
            (text, source, vec_json, ts, meta_json)
        )
        conn.commit()
        return cursor.lastrowid

def search_memory(query: str, top_k: int = 4, min_score: float = 0.15) -> list[dict]:
    """Semantic vector search across timeline memories and file chunks."""
    query = query.strip()
    if not query:
        return []
        
    q_vec = encode_text(query)
    results = []
    
    with _get_db() as conn:
        rows = conn.execute("SELECT id, text, source, vector_json, timestamp, metadata_json FROM memories").fetchall()
        for r in rows:
            try:
                vec = json.loads(r["vector_json"])
                score = cosine_similarity(q_vec, vec)
                if score >= min_score:
                    results.append({
                        "id": r["id"],
                        "type": "memory",
                        "source": r["source"],
                        "text": r["text"],
                        "score": round(score, 4),
                        "timestamp": r["timestamp"],
                        "metadata": json.loads(r["metadata_json"] or "{}")
                    })
            except Exception:
                pass
                
        f_rows = conn.execute("SELECT id, filepath, chunk_index, text, vector_json, timestamp FROM file_chunks").fetchall()
        for r in f_rows:
            try:
                vec = json.loads(r["vector_json"])
                score = cosine_similarity(q_vec, vec)
                if score >= min_score:
                    results.append({
                        "id": r["id"],
                        "type": "file_chunk",
                        "source": r["filepath"],
                        "text": r["text"],
                        "score": round(score, 4),
                        "timestamp": r["timestamp"],
                        "metadata": {"chunk": r["chunk_index"]}
                    })
            except Exception:
                pass

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]

def index_file_content(filepath: str, chunk_size: int = 500, overlap: int = 100) -> int:
    """Chunk and index a local file for RAG document retrieval."""
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        return 0
        
    mtime = os.path.getmtime(filepath)
    
    with _get_db() as conn:
        existing = conn.execute("SELECT mtime FROM file_chunks WHERE filepath = ? LIMIT 1", (filepath,)).fetchone()
        if existing and abs(existing["mtime"] - mtime) < 1.0:
            return 0
            
        conn.execute("DELETE FROM file_chunks WHERE filepath = ?", (filepath,))
        conn.commit()

    try:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception:
        return 0
        
    if not content.strip():
        return 0
        
    chunks = []
    start = 0
    while start < len(content):
        end = start + chunk_size
        chunk_text = content[start:end].strip()
        if len(chunk_text) > 20:
            chunks.append(chunk_text)
        start += (chunk_size - overlap)
        
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    indexed_count = 0
    
    with _get_db() as conn:
        for idx, text in enumerate(chunks):
            vec = encode_text(text)
            vec_json = json.dumps(vec)
            conn.execute(
                "INSERT INTO file_chunks (filepath, chunk_index, text, vector_json, mtime, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
                (filepath, idx, text, vec_json, mtime, ts)
            )
            indexed_count += 1
        conn.commit()
        
    return indexed_count

def get_rag_prompt_context(query: str, top_k: int = 3) -> str:
    """Retrieves relevant timeline memories and formats a context block for Gemini."""
    memories = search_memory(query, top_k=top_k, min_score=0.20)
    if not memories:
        return ""
        
    lines = ["\n[RAG VECTOR MEMORY & INTER-TIMELINE KNOWLEDGE]"]
    lines.append(f"Model: {HARDWARE_INFO['model_name']} | Hardware: {HARDWARE_INFO['device_name']}")
    lines.append("Relevant past interactions and indexed local knowledge retrieved for this query:")
    
    for idx, m in enumerate(memories, 1):
        if m["type"] == "memory":
            lines.append(f"  Memory #{idx} (Score: {m['score']} | {m['timestamp']}): {m['text'][:350]}")
        else:
            lines.append(f"  File Chunk #{idx} (Score: {m['score']} | Path: {os.path.basename(m['source'])}): {m['text'][:350]}")
            
    lines.append("Use these retrieved memories to maintain cross-session continuity and satisfy the user's task.\n")
    return "\n".join(lines)

def get_system_status() -> dict:
    """Return status of RAG engine, device, model, and memory count."""
    with _get_db() as conn:
        mem_count = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        chunk_count = conn.execute("SELECT COUNT(*) FROM file_chunks").fetchone()[0]
        
    return {
        "device": HARDWARE_INFO["device"].upper(),
        "device_name": HARDWARE_INFO["device_name"],
        "model_name": HARDWARE_INFO["model_name"],
        "has_sentence_transformers": HARDWARE_INFO["has_sentence_transformers"],
        "memories_count": mem_count,
        "file_chunks_count": chunk_count,
        "db_path": DB_PATH
    }
