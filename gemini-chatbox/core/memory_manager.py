"""
core/memory_manager.py — Multi-Tier Personalization & Long-Term Memory Engine for Gemini (B1)
Adheres to the conversation-memory skill architecture:
1. Short-Term / Active Buffer Memory (Current session messages)
2. Long-Term Personalization Memory (User profile, habits, preferences, tech stacks)
3. Entity & Fact Knowledge Memory (SQLite-persisted key-value and semantic facts)
4. Conversational MCP Knowledge Base (Pre-configured catalog of popular MCP packages and requirements)
"""

import os
import json
import sqlite3
import datetime
import time

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == "core" else os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(_BASE_DIR, "storage")
os.makedirs(STORAGE_DIR, exist_ok=True)

PROFILE_FILE = os.path.join(STORAGE_DIR, "user_profile.json") if os.path.exists(os.path.join(STORAGE_DIR, "user_profile.json")) else (os.path.join(_BASE_DIR, "user_profile.json") if os.path.exists(os.path.join(_BASE_DIR, "user_profile.json")) else os.path.join(STORAGE_DIR, "user_profile.json"))
MEMORY_DB = os.path.join(STORAGE_DIR, "long_term_memory.db") if os.path.exists(os.path.join(STORAGE_DIR, "long_term_memory.db")) else (os.path.join(_BASE_DIR, "long_term_memory.db") if os.path.exists(os.path.join(_BASE_DIR, "long_term_memory.db")) else os.path.join(STORAGE_DIR, "long_term_memory.db"))

class MemoryManager:
    def __init__(self):
        self._init_db()
        self.profile = self._load_profile()

    def _init_db(self):
        conn = sqlite3.connect(MEMORY_DB)
        c = conn.cursor()
        c.execute("""
            CREATE TABLE IF NOT EXISTS memory_facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                context TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(category, key)
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS conversation_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                summary TEXT NOT NULL,
                tags TEXT,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()

    def _load_profile(self):
        default_profile = {
            "user_name": "",
            "assistant_name": "B1 (Gemini Studio)",
            "role": "",
            "communication_style": "Clear, concise, highly proactive, senior-level engineering advice",
            "preferred_design_aesthetic": "Linear dark mode (sleek surfaces, subtle hairline borders, lavender accents)",
            "primary_tech_stack": [],
            "mcp_preferences": {
                "auto_connect_enabled": True,
                "preferred_servers": ["mcp-web-search", "chrome-devtools-mcp", "mcp-code-architect", "mcp-visualization"]
            },
            "custom_preferences": [
                "Always be proactive and execute tasks directly when possible without asking redundant questions",
                "If missing an API key or critical token, explain what is needed concisely with exact creation steps",
                "Default to building rich interactive HTML artifacts with live previews when creating UI or tools"
            ],
            "theme": "linear-obsidian",
            "archetype": "Senior Architect",
            "stack": []
        }
        if os.path.exists(PROFILE_FILE):
            try:
                with open(PROFILE_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    default_profile.update(data)
                    return default_profile
            except Exception:
                pass
        return default_profile

    def reset_profile(self):
        """Wipes the stored profile and all long-term memory facts to start fresh from beginning."""
        for p in [PROFILE_FILE, os.path.join(_BASE_DIR, "user_profile.json"), os.path.join(STORAGE_DIR, "user_profile.json")]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except Exception:
                    pass
        empty_profile = {
            "user_name": "",
            "assistant_name": "B1 (Gemini Studio)",
            "role": "",
            "communication_style": "Clear, concise, highly proactive, senior-level engineering advice",
            "preferred_design_aesthetic": "Linear dark mode",
            "primary_tech_stack": [],
            "mcp_preferences": {
                "auto_connect_enabled": True,
                "preferred_servers": ["mcp-web-search", "chrome-devtools-mcp", "mcp-code-architect", "mcp-visualization"]
            },
            "custom_preferences": [],
            "theme": "linear-obsidian",
            "archetype": "Senior Architect",
            "stack": []
        }
        self.profile = empty_profile
        try:
            conn = sqlite3.connect(MEMORY_DB)
            c = conn.cursor()
            c.execute("DELETE FROM memory_facts")
            c.execute("DELETE FROM conversation_summaries")
            conn.commit()
            conn.close()
        except Exception:
            pass
        return empty_profile

    def _save_profile(self, data):
        try:
            with open(PROFILE_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            self.profile = data
        except Exception as e:
            print(f"[MemoryManager] Profile save error: {e}")

    def remember_fact(self, category: str, key: str, value: str, context: str = "") -> str:
        now = datetime.datetime.now().isoformat()
        conn = sqlite3.connect(MEMORY_DB)
        c = conn.cursor()
        c.execute("""
            INSERT INTO memory_facts (category, key, value, context, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(category, key) DO UPDATE SET
                value=excluded.value,
                context=excluded.context,
                updated_at=excluded.updated_at
        """, (category, key, value, context, now, now))
        conn.commit()
        conn.close()
        return f"Successfully saved memory: [{category}] {key} = '{value}'"

    def recall_facts(self, query: str = "") -> list:
        conn = sqlite3.connect(MEMORY_DB)
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        if query:
            q_like = f"%{query.lower()}%"
            c.execute("""
                SELECT category, key, value, context, updated_at 
                FROM memory_facts 
                WHERE LOWER(key) LIKE ? OR LOWER(value) LIKE ? OR LOWER(category) LIKE ?
                ORDER BY updated_at DESC LIMIT 15
            """, (q_like, q_like, q_like))
        else:
            c.execute("SELECT category, key, value, context, updated_at FROM memory_facts ORDER BY updated_at DESC LIMIT 20")
        rows = [dict(r) for r in c.fetchall()]
        conn.close()
        return rows

    def get_personalization_context(self, current_user_query: str = "") -> str:
        """Assembles a high-density personalization context for the system prompt."""
        p = self.profile
        facts = self.recall_facts(current_user_query[:50] if current_user_query else "")

        lines = [
            "# PERSONALIZATION & USER PROFILE:",
            f"- **User**: {p.get('user_name', 'Ishaan')} ({p.get('role', 'Developer')})",
            f"- **Assistant Persona**: {p.get('assistant_name', 'B1')} (Proactive, ultra-competent, paired coding architect)",
            f"- **Collaboration Archetype**: {p.get('archetype', 'Senior Architect')}",
            f"- **Preferred Style**: {p.get('communication_style', 'Clear, concise, highly proactive')}",
            f"- **Active Theme**: {p.get('theme', 'linear-obsidian')}",
            f"- **Primary Tech Stack**: {', '.join(p.get('primary_tech_stack', ['Python', 'JavaScript', 'React']))}"
        ]

        if p.get('b1_perception'):
            lines.append(f"- **B1's Assessment of User**: {p.get('b1_perception')}")

        if p.get('custom_preferences'):
            lines.append("- **User Guidelines**:")
            for pref in p.get('custom_preferences', []):
                lines.append(f"  - {pref}")

        if facts:
            lines.append("\n# LONG-TERM MEMORY & RECALLED CONTEXT:")
            for f in facts[:8]:
                lines.append(f"- [{f['category']}] {f['key']}: {f['value']}")

        return "\n".join(lines)

    def update_full_profile(self, new_data: dict) -> dict:
        """Updates full user profile, theme, communication style, and saves facts."""
        self.profile.update(new_data)
        self.profile["updated_at"] = datetime.datetime.now().isoformat()
        self._save_profile(self.profile)

        # Also store core traits into memory_facts for RAG/semantic recall
        if "user_name" in new_data:
            self.remember_fact("identity", "user_name", new_data["user_name"], "User Profile")
        if "role" in new_data:
            self.remember_fact("identity", "role", new_data["role"], "User Profile")
        if "communication_style" in new_data:
            self.remember_fact("preference", "communication_style", new_data["communication_style"], "Onboarding")
        if "theme" in new_data:
            self.remember_fact("preference", "studio_theme", new_data["theme"], "UI Theme Preference")
        if "b1_perception" in new_data:
            self.remember_fact("b1_insight", "persona_perception", new_data["b1_perception"], "B1 AI Analysis")

        return self.profile

# Pre-packaged MCP Catalog for Conversational 1-Step Installation
MCP_KNOWLEDGE_CATALOG = {
    "github": {
        "name": "GitHub Repository MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "required_env": ["GITHUB_PERSONAL_ACCESS_TOKEN"],
        "token_instructions": "Create a GitHub Personal Access Token (classic) at https://github.com/settings/tokens with 'repo', 'read:org', 'user' permissions.",
        "description": "Full access to GitHub repositories, commits, pull requests, and issues."
    },
    "filesystem": {
        "name": "Local Filesystem MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", os.path.expanduser("~")],
        "required_env": [],
        "description": "Direct read/write access to files and folders on your computer."
    },
    "memory": {
        "name": "Knowledge Graph Memory MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-memory"],
        "required_env": [],
        "description": "Persistent graph memory for entities, facts, and relations across chats."
    },
    "puppeteer": {
        "name": "Puppeteer Browser Automation MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-puppeteer"],
        "required_env": [],
        "description": "Headless browser automation, full-page screenshots, and SPA scraping."
    },
    "brave-search": {
        "name": "Brave Web Search MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-brave-search"],
        "required_env": ["BRAVE_API_KEY"],
        "token_instructions": "Get a free Brave Search API key from https://brave.com/search/api/.",
        "description": "Real-time web search and news indexing."
    },
    "postgres": {
        "name": "PostgreSQL Database MCP",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "required_env": [],
        "description": "Inspect PostgreSQL databases, schemas, and run queries."
    }
}

memory = MemoryManager()
