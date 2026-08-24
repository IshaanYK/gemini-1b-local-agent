import sqlite3
import os
import re
from typing import List, Dict, Any

class SecurityKnowledgeRAG:
    """RAG system for indexing standard OWASP, CWE, and security design patterns."""
    
    def __init__(self, db_path: str = "storage/security_knowledge.db"):
        self.db_path = db_path
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._init_db()
        self._seed_default_guidelines()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS security_guidelines (
                id TEXT PRIMARY KEY,
                category TEXT,
                title TEXT,
                description TEXT,
                impact TEXT,
                remediation TEXT,
                cwe_id TEXT
            )
        """)
        conn.commit()
        conn.close()

    def _seed_default_guidelines(self):
        """Populates baseline OWASP Top 10 patterns for defensive auditing."""
        defaults = [
            (
                "IDOR-01",
                "Access Control",
                "Broken Object Level Authorization (IDOR)",
                "Failure to validate user ownership before performing operations on specific object IDs.",
                "Unauthorized data modification or leakage across tenants.",
                "Ensure every query filters by WHERE id = ? AND owner_id = ? at the data layer.",
                "CWE-639"
            ),
            (
                "SSRF-01",
                "Network & SSRF",
                "Server-Side Request Forgery",
                "Backend fetches external URLs provided by users without network boundary restrictions.",
                "Internal service exposure and cloud metadata theft.",
                "Use a DNS-pinning HTTP client, reject private IP ranges (10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16).",
                "CWE-918"
            ),
            (
                "OAUTH-01",
                "Authentication",
                "OAuth 2.0 State Parameter Absence",
                "Missing or static state parameter in authorization code flow.",
                "Account takeover via login CSRF.",
                "Generate cryptographically random, session-bound state tokens and verify them upon callback.",
                "CWE-352"
            ),
            (
                "SECRETS-01",
                "Secrets Management",
                "Hardcoded Credentials and API Keys",
                "Private keys, JWT secrets, or cloud API tokens committed directly in source code.",
                "Full infrastructure or service compromise.",
                "Extract secrets to environment variables, use Secret Managers or .env with strict gitignore.",
                "CWE-798"
            ),
            (
                "SQLI-01",
                "Data Layer",
                "SQL / NoSQL Injection",
                "Direct string concatenation into raw SQL queries.",
                "Database dump, deletion, or arbitrary privilege escalation.",
                "Always use parameterized queries, prepared statements, or modern ORMs like SQLAlchemy/Prisma.",
                "CWE-89"
            ),
            (
                "JWT-01",
                "Authentication",
                "Weak JWT Verification & Algorithm Confusion",
                "Accepting none algorithm or verifying RS256 signatures using HMAC with public key.",
                "Arbitrary token forgery and authentication bypass.",
                "Strictly specify allowed algorithms (e.g., ['HS256']) and enforce asymmetric key verification.",
                "CWE-347"
            )
        ]
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.executemany("""
            INSERT OR IGNORE INTO security_guidelines 
            (id, category, title, description, impact, remediation, cwe_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, defaults)
        conn.commit()
        conn.close()

    def retrieve_guidelines(self, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """Keyword and vector-compatible retrieval for security audits."""
        tokens = re.findall(r'\w+', query.lower())
        if not tokens:
            return []

        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()

        conditions = " OR ".join(["category LIKE ? OR title LIKE ? OR description LIKE ? OR remediation LIKE ?" for _ in tokens])
        params = []
        for t in tokens:
            pattern = f"%{t}%"
            params.extend([pattern, pattern, pattern, pattern])

        c.execute(f"""
            SELECT * FROM security_guidelines 
            WHERE {conditions}
            LIMIT ?
        """, (*params, limit))

        results = [dict(row) for row in c.fetchall()]
        conn.close()
        return results

    def audit_codebase(self, root_dir: str) -> Dict[str, Any]:
        """Scans workspace files for common security flaws and hardcoded secrets."""
        findings = []
        secret_patterns = [
            (r'(?i)(?:api_key|apikey|secret_key|secret|token)\s*=\s*[\'"][a-zA-Z0-9_\-\.]{16,}[\'"]', "Potential Hardcoded API Key / Secret"),
            (r'ghp_[0-9a-zA-Z]{36}', "Hardcoded GitHub Personal Access Token"),
            (r'AIza[0-9A-Za-z-_]{35}', "Hardcoded Google Cloud / Gemini API Key"),
            (r'sk-[a-zA-Z0-9]{32,}', "Hardcoded OpenAI / API Secret Key"),
            (r'(?i)password\s*=\s*[\'"][^\'"]{4,}[\'"]', "Hardcoded Password Variable"),
            (r'(?i)SELECT\s+.*\s+FROM\s+.*\s*(\+|%|\.format|f[\'"])', "Potential Raw SQL String Concatenation (SQLi)")
        ]

        scanned_count = 0
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv", ".venv", ".gemini"}]
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in {".py", ".js", ".ts", ".html", ".json", ".env", ".yaml", ".yml", ".sh", ".bat"}:
                    fp = os.path.join(root, file)
                    scanned_count += 1
                    try:
                        with open(fp, "r", encoding="utf-8", errors="ignore") as f:
                            lines = f.readlines()
                            for idx, line in enumerate(lines, 1):
                                for pattern, title in secret_patterns:
                                    if re.search(pattern, line):
                                        rel_path = os.path.relpath(fp, root_dir).replace("\\", "/")
                                        findings.append({
                                            "file": rel_path,
                                            "line": idx,
                                            "type": title,
                                            "snippet": line.strip()[:100],
                                            "severity": "HIGH" if "Key" in title or "Token" in title else "MEDIUM"
                                        })
                    except Exception:
                        pass

        return {
            "status": "success",
            "scanned_files": scanned_count,
            "total_findings": len(findings),
            "findings": findings[:30]
        }

security_rag = SecurityKnowledgeRAG()
