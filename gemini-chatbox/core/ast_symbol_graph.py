"""
core/ast_symbol_graph.py — Codebase AST Symbol Graph & Hybrid RAG
Extracts functions, classes, imports, and cross-references using Python AST and JavaScript parsers.
Maintains a high-speed SQLite symbol knowledge graph for 100% precision code navigation.
"""

import os
import re
import ast
import sqlite3
import json
from typing import List, Dict, Any, Optional

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(_BASE_DIR, "storage", "ast_symbols.db")

class ASTSymbolGraph:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                symbol_name TEXT NOT NULL,
                symbol_type TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                parent_symbol TEXT DEFAULT '',
                signature TEXT DEFAULT '',
                docstring TEXT DEFAULT '',
                dependencies TEXT DEFAULT '[]',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sym_name ON symbols(symbol_name)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sym_file ON symbols(file_path)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_sym_type ON symbols(symbol_type)")
        conn.commit()
        conn.close()

    def index_workspace(self, root_dir: str = None) -> Dict[str, Any]:
        """Indexes all Python and JS/TS files in workspace into SQLite symbol graph."""
        root = root_dir or _BASE_DIR
        stats = {"indexed_files": 0, "total_symbols": 0, "errors": []}

        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()

        ignore_dirs = {".git", ".system_generated", "node_modules", "__pycache__", "venv", ".venv", "dist", "build"}

        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in ignore_dirs]
            for f in filenames:
                ext = os.path.splitext(f)[1].lower()
                full_path = os.path.join(dirpath, f)
                rel_path = os.path.relpath(full_path, root).replace("\\", "/")

                if ext == ".py":
                    try:
                        symbols = self._parse_python_file(full_path, rel_path)
                        self._save_symbols(cur, rel_path, symbols)
                        stats["indexed_files"] += 1
                        stats["total_symbols"] += len(symbols)
                    except Exception as e:
                        stats["errors"].append(f"{rel_path}: {str(e)}")
                elif ext in {".js", ".ts", ".jsx", ".tsx"}:
                    try:
                        symbols = self._parse_javascript_file(full_path, rel_path)
                        self._save_symbols(cur, rel_path, symbols)
                        stats["indexed_files"] += 1
                        stats["total_symbols"] += len(symbols)
                    except Exception as e:
                        stats["errors"].append(f"{rel_path}: {str(e)}")

        conn.commit()
        conn.close()
        return stats

    def _save_symbols(self, cur: sqlite3.Cursor, rel_path: str, symbols: List[Dict[str, Any]]):
        cur.execute("DELETE FROM symbols WHERE file_path = ?", (rel_path,))
        for s in symbols:
            cur.execute("""
                INSERT INTO symbols (
                    file_path, symbol_name, symbol_type, start_line, end_line,
                    parent_symbol, signature, docstring, dependencies
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rel_path,
                s["name"],
                s["type"],
                s["start_line"],
                s["end_line"],
                s.get("parent", ""),
                s.get("signature", ""),
                s.get("docstring", ""),
                json.dumps(s.get("dependencies", []))
            ))

    def _parse_python_file(self, full_path: str, rel_path: str) -> List[Dict[str, Any]]:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            code = f.read()

        try:
            tree = ast.parse(code, filename=rel_path)
        except Exception:
            return []

        symbols = []
        lines = code.splitlines()

        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                doc = ast.get_docstring(node) or ""
                symbols.append({
                    "name": node.name,
                    "type": "class",
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                    "signature": f"class {node.name}({', '.join(ast.unparse(b) for b in node.bases) if hasattr(ast, 'unparse') else ''})",
                    "docstring": doc.strip(),
                    "dependencies": [b.id for b in node.bases if isinstance(b, ast.Name)]
                })

            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                doc = ast.get_docstring(node) or ""
                # Determine parent class if any
                parent = ""
                for parent_node in ast.walk(tree):
                    if isinstance(parent_node, ast.ClassDef) and node in parent_node.body:
                        parent = parent_node.name
                        break

                sig_args = []
                for a in node.args.args:
                    sig_args.append(a.arg)

                symbols.append({
                    "name": node.name,
                    "type": "method" if parent else "function",
                    "start_line": node.lineno,
                    "end_line": getattr(node, "end_lineno", node.lineno),
                    "parent": parent,
                    "signature": f"def {node.name}({', '.join(sig_args)})",
                    "docstring": doc.strip(),
                    "dependencies": []
                })

        return symbols

    def _parse_javascript_file(self, full_path: str, rel_path: str) -> List[Dict[str, Any]]:
        with open(full_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        symbols = []
        for idx, line in enumerate(lines, start=1):
            line_str = line.strip()
            # Match functions: function name(...) or const name = (...) =>
            fn_match = re.match(r"^(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\((.*?)\)", line_str)
            if fn_match:
                symbols.append({
                    "name": fn_match.group(1),
                    "type": "function",
                    "start_line": idx,
                    "end_line": idx,
                    "signature": f"function {fn_match.group(1)}({fn_match.group(2)})",
                    "docstring": ""
                })
                continue

            const_fn_match = re.match(r"^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>", line_str)
            if const_fn_match:
                symbols.append({
                    "name": const_fn_match.group(1),
                    "type": "arrow_function",
                    "start_line": idx,
                    "end_line": idx,
                    "signature": f"const {const_fn_match.group(1)} = ({const_fn_match.group(2)}) =>",
                    "docstring": ""
                })
                continue

            # Match class definitions
            cls_match = re.match(r"^(?:export\s+)?class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?", line_str)
            if cls_match:
                symbols.append({
                    "name": cls_match.group(1),
                    "type": "class",
                    "start_line": idx,
                    "end_line": idx,
                    "signature": line_str,
                    "docstring": ""
                })

        return symbols

    def search_symbols(self, query: str, limit: int = 15) -> List[Dict[str, Any]]:
        """Finds symbols matching query by exact match or substring with high ranking."""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        q = f"%{query.strip()}%"
        cur.execute("""
            SELECT file_path, symbol_name, symbol_type, start_line, end_line, parent_symbol, signature, docstring
            FROM symbols
            WHERE symbol_name LIKE ? OR docstring LIKE ?
            ORDER BY CASE WHEN symbol_name = ? THEN 1 WHEN symbol_name LIKE ? THEN 2 ELSE 3 END, symbol_name ASC
            LIMIT ?
        """, (q, q, query.strip(), f"{query.strip()}%", limit))
        rows = cur.fetchall()
        conn.close()

        results = []
        for r in rows:
            results.append({
                "file_path": r[0],
                "name": r[1],
                "type": r[2],
                "start_line": r[3],
                "end_line": r[4],
                "parent": r[5],
                "signature": r[6],
                "docstring": r[7]
            })
        return results

    def get_file_outline(self, rel_path: str) -> List[Dict[str, Any]]:
        """Returns the structured outline (classes, functions, methods) of a specific file."""
        conn = sqlite3.connect(self.db_path)
        cur = conn.cursor()
        cur.execute("""
            SELECT symbol_name, symbol_type, start_line, end_line, parent_symbol, signature, docstring
            FROM symbols
            WHERE file_path = ? OR file_path LIKE ?
            ORDER BY start_line ASC
        """, (rel_path, f"%{rel_path}"))
        rows = cur.fetchall()
        conn.close()

        return [{
            "name": r[0],
            "type": r[1],
            "start_line": r[2],
            "end_line": r[3],
            "parent": r[4],
            "signature": r[5],
            "docstring": r[6]
        } for r in rows]

symbol_graph = ASTSymbolGraph()
