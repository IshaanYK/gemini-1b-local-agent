"""
core/local_llm_connector.py — Native Local LLM & Ollama / LM Studio Offline Connector
Discovers and orchestrates local offline AI models (deepseek-coder, llama3, qwen2.5-coder) via REST APIs.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

class LocalLLMConnector:
    def __init__(self, ollama_url: str = "http://127.0.0.1:11434", lm_studio_url: str = "http://127.0.0.1:1234"):
        self.ollama_url = ollama_url.rstrip("/")
        self.lm_studio_url = lm_studio_url.rstrip("/")

    def discover_local_servers(self, timeout: float = 1.0) -> Dict[str, Any]:
        """Probes Ollama and LM Studio endpoints to detect running local models."""
        ollama_status = self._check_ollama(timeout)
        lm_studio_status = self._check_lm_studio(timeout)

        all_models = []
        all_models.extend(ollama_status.get("models", []))
        all_models.extend(lm_studio_status.get("models", []))

        is_any_online = ollama_status.get("online", False) or lm_studio_status.get("online", False)

        return {
            "is_available": is_any_online,
            "active_backend": "ollama" if ollama_status.get("online") else ("lm_studio" if lm_studio_status.get("online") else "none"),
            "ollama": ollama_status,
            "lm_studio": lm_studio_status,
            "all_models": all_models,
            "recommended_local_models": [
                "deepseek-coder:6.7b",
                "qwen2.5-coder:7b",
                "llama3.2:3b",
                "mistral:7b"
            ]
        }

    def _check_ollama(self, timeout: float) -> Dict[str, Any]:
        try:
            req = urllib.request.Request(f"{self.ollama_url}/api/tags", headers={"User-Agent": "B1-Studio/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("name") for m in data.get("models", [])]
                    return {"online": True, "models": models, "url": self.ollama_url}
        except Exception:
            pass
        return {"online": False, "models": [], "url": self.ollama_url}

    def _check_lm_studio(self, timeout: float) -> Dict[str, Any]:
        try:
            req = urllib.request.Request(f"{self.lm_studio_url}/v1/models", headers={"User-Agent": "B1-Studio/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    models = [m.get("id") for m in data.get("data", [])]
                    return {"online": True, "models": models, "url": self.lm_studio_url}
        except Exception:
            pass
        return {"online": False, "models": [], "url": self.lm_studio_url}

    def generate_chat(self, model: str, messages: List[Dict[str, str]], stream: bool = False) -> Dict[str, Any]:
        """Dispatches chat completions to active local server."""
        info = self.discover_local_servers()
        if not info["is_available"]:
            return {
                "status": "offline",
                "content": f"[Local LLM Offline]: Neither Ollama ({self.ollama_url}) nor LM Studio ({self.lm_studio_url}) was detected running. To use local offline models, start `ollama serve` or open LM Studio local server.",
                "model": model
            }

        # If Ollama is active
        if info["ollama"]["online"]:
            try:
                payload = json.dumps({
                    "model": model,
                    "messages": messages,
                    "stream": False
                }).encode("utf-8")
                req = urllib.request.Request(
                    f"{self.ollama_url}/api/chat",
                    data=payload,
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=30.0) as resp:
                    res_data = json.loads(resp.read().decode("utf-8"))
                    return {
                        "status": "success",
                        "content": res_data.get("message", {}).get("content", ""),
                        "model": model,
                        "backend": "ollama"
                    }
            except Exception as e:
                return {"status": "error", "error": str(e), "model": model}

        return {"status": "offline", "content": "No local inference backend responded.", "model": model}

local_llm = LocalLLMConnector()
