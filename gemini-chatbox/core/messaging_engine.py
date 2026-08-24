"""
core/messaging_engine.py — Messaging & Notification Integration Engine for B1
Supports:
1. WhatsApp (WhatsApp Cloud API / Twilio WhatsApp / Web wa.me & Desktop protocol)
2. Telegram (Telegram Bot API)
3. Discord (Incoming Webhooks)
4. Slack (Incoming Webhooks)
"""

import os
import sys
import json
import time
import urllib.parse
import urllib.request
import subprocess
from typing import Dict, List, Any, Optional

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) if os.path.basename(os.path.dirname(os.path.abspath(__file__))) == "core" else os.path.dirname(os.path.abspath(__file__))
_CONFIG_FILE = os.path.join(_BASE_DIR, "storage", "messaging_config.json")

class MessagingEngine:
    """Manages WhatsApp, Telegram, Discord, and Slack messaging integrations."""

    def __init__(self, base_dir: str = _BASE_DIR):
        self.base_dir = base_dir
        self.storage_dir = os.path.join(self.base_dir, "storage")
        os.makedirs(self.storage_dir, exist_ok=True)
        self.config_file = _CONFIG_FILE
        self._ensure_config()

    def _ensure_config(self):
        if not os.path.exists(self.config_file):
            default_config = {
                "whatsapp": {
                    "enabled": True,
                    "mode": "deeplink",  # 'deeplink', 'cloud_api'
                    "default_phone": "",
                    "api_token": "",
                    "phone_number_id": ""
                },
                "telegram": {
                    "enabled": False,
                    "bot_token": "",
                    "default_chat_id": ""
                },
                "discord": {
                    "enabled": False,
                    "webhook_url": ""
                },
                "slack": {
                    "enabled": False,
                    "webhook_url": ""
                }
            }
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2)

    def get_config(self) -> Dict[str, Any]:
        """Returns the current messaging integration configuration."""
        try:
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}

    def update_config(self, new_config: Dict[str, Any]) -> Dict[str, Any]:
        """Updates the messaging integration configuration."""
        cfg = self.get_config()
        cfg.update(new_config)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
        return {"status": "success", "message": "Messaging configuration updated.", "config": cfg}

    def get_connectors(self) -> List[Dict[str, Any]]:
        """Returns all supported messaging apps with setup status, step-by-step guides, and quick actions."""
        cfg = self.get_config()
        wa_cfg = cfg.get("whatsapp", {})
        tg_cfg = cfg.get("telegram", {})
        dc_cfg = cfg.get("discord", {})
        sl_cfg = cfg.get("slack", {})

        connectors = [
            {
                "id": "whatsapp",
                "name": "WhatsApp Messenger & Business",
                "icon": "💬",
                "color": "#25D366",
                "category": "Instant Messaging",
                "status": "configured" if (wa_cfg.get("default_phone") or wa_cfg.get("api_token")) else "ready",
                "description": "Send alerts, code snippets, build reports, and chat notifications to WhatsApp.",
                "guide": [
                    "Step 1: Choose mode (Direct wa.me DeepLink or Meta WhatsApp Cloud API)",
                    "Step 2: Enter default recipient phone number in international format (+1234567890)",
                    "Step 3: Test dispatch to verify instant delivery on mobile or web"
                ],
                "settings": wa_cfg,
                "quick_actions": ["Send Code Snippet", "Send Build Success Alert", "Open WhatsApp Web"]
            },
            {
                "id": "telegram",
                "name": "Telegram Bot Alerts",
                "icon": "✈️",
                "color": "#0088cc",
                "category": "Bot & Channels",
                "status": "configured" if tg_cfg.get("bot_token") else "ready",
                "description": "Stream background agent logs, task completions, and security findings to your Telegram channel.",
                "guide": [
                    "Step 1: Open Telegram and message @BotFather to create a bot and get a BOT_TOKEN",
                    "Step 2: Start a chat with your bot, then enter your Numeric Chat ID or @channel username",
                    "Step 3: Click 'Test Telegram Dispatch' to verify instant delivery"
                ],
                "settings": tg_cfg,
                "quick_actions": ["Send Security Audit Report", "Send Task Completed Alert"]
            },
            {
                "id": "discord",
                "name": "Discord Webhook Channel",
                "icon": "🎮",
                "color": "#5865F2",
                "category": "Team Chat",
                "status": "configured" if dc_cfg.get("webhook_url") else "ready",
                "description": "Post rich embed cards to Discord server channels for build status and agent logs.",
                "guide": [
                    "Step 1: In your Discord server settings, go to Integrations -> Webhooks",
                    "Step 2: Create a webhook and copy the Webhook URL",
                    "Step 3: Paste Webhook URL here and test dispatch"
                ],
                "settings": dc_cfg,
                "quick_actions": ["Post Rich Embed to Discord"]
            },
            {
                "id": "slack",
                "name": "Slack Incoming Webhook",
                "icon": "💼",
                "color": "#4A154B",
                "category": "Workplace Team",
                "status": "configured" if sl_cfg.get("webhook_url") else "ready",
                "description": "Post workspace alerts and code reviews to your Slack channels via Incoming Webhooks.",
                "guide": [
                    "Step 1: Create an Incoming Webhook from api.slack.com/apps",
                    "Step 2: Choose target channel and copy Webhook URL",
                    "Step 3: Save URL and test dispatch"
                ],
                "settings": sl_cfg,
                "quick_actions": ["Post Alert to Slack Channel"]
            }
        ]
        # Append custom registered messaging connectors
        connectors.extend(self.list_custom_connectors())
        return connectors

    def send_whatsapp(self, message: str, phone: Optional[str] = None) -> Dict[str, Any]:
        """Dispatches a WhatsApp message via Cloud API or generates a direct web link."""
        cfg = self.get_config().get("whatsapp", {})
        target_phone = (phone or cfg.get("default_phone", "")).strip().replace(" ", "").replace("-", "")
        
        # Mode 1: WhatsApp Cloud API (Graph API)
        token = cfg.get("api_token", "").strip()
        phone_id = cfg.get("phone_number_id", "").strip()

        if token and phone_id and target_phone:
            url = f"https://graph.facebook.com/v18.0/{phone_id}/messages"
            payload = {
                "messaging_product": "whatsapp",
                "to": target_phone.replace("+", ""),
                "type": "text",
                "text": {"body": message}
            }
            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    return {"status": "success", "message": "Dispatched via WhatsApp Cloud API", "response": data}
            except Exception as e:
                return {"status": "error", "message": f"WhatsApp Cloud API Error: {str(e)}"}

        # Mode 2: Deeplink / Web fallback URL
        clean_num = target_phone.replace("+", "")
        encoded_msg = urllib.parse.quote(message)
        wa_url = f"https://wa.me/{clean_num}?text={encoded_msg}" if clean_num else f"https://wa.me/?text={encoded_msg}"

        return {
            "status": "success",
            "mode": "deeplink",
            "message": "Generated WhatsApp direct link",
            "url": wa_url,
            "phone": target_phone
        }

    def send_telegram(self, message: str, chat_id: Optional[str] = None) -> Dict[str, Any]:
        """Dispatches a Telegram message via Bot API."""
        cfg = self.get_config().get("telegram", {})
        token = cfg.get("bot_token", "").strip()
        target_chat = (chat_id or cfg.get("default_chat_id", "")).strip()

        if not token or not target_chat:
            return {
                "status": "error",
                "message": "Telegram bot_token and default_chat_id are required in settings."
            }

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": target_chat,
            "text": message,
            "parse_mode": "HTML"
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                return {"status": "success", "message": "Dispatched to Telegram", "response": data}
        except Exception as e:
            return {"status": "error", "message": f"Telegram API Error: {str(e)}"}

    def send_discord(self, message: str, webhook_url: Optional[str] = None) -> Dict[str, Any]:
        """Dispatches a Discord webhook message."""
        cfg = self.get_config().get("discord", {})
        url = (webhook_url or cfg.get("webhook_url", "")).strip()

        if not url:
            return {"status": "error", "message": "Discord webhook_url is required in settings."}

        payload = {
            "content": message,
            "username": "B1 AI Autonomous Assistant",
            "avatar_url": "https://raw.githubusercontent.com/google/material-design-icons/master/png/action/smart_toy/materialicons/48dp/2x/baseline_smart_toy_black_48dp.png"
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json", "User-Agent": "B1-Agent/2.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"status": "success", "message": "Dispatched to Discord channel"}
        except Exception as e:
            return {"status": "error", "message": f"Discord Webhook Error: {str(e)}"}

    def send_slack(self, message: str, webhook_url: Optional[str] = None) -> Dict[str, Any]:
        """Dispatches a Slack webhook message."""
        cfg = self.get_config().get("slack", {})
        url = (webhook_url or cfg.get("webhook_url", "")).strip()

        if not url:
            return {"status": "error", "message": "Slack webhook_url is required in settings."}

        payload = {"text": message}

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"status": "success", "message": "Dispatched to Slack channel"}
        except Exception as e:
            return {"status": "error", "message": f"Slack Webhook Error: {str(e)}"}

    # ── Dynamic Custom Messaging Connectors ──────────────────────────────────
    def list_custom_connectors(self) -> List[Dict[str, Any]]:
        cfg = self.get_config()
        return cfg.get("custom_connectors", [])

    def add_custom_connector(self, data: Dict[str, Any]) -> Dict[str, Any]:
        cfg = self.get_config()
        custom = cfg.get("custom_connectors", [])
        
        name = data.get("name", "").strip()
        if not name:
            return {"status": "error", "message": "Connector name is required."}

        conn_id = data.get("id") or name.lower().replace(" ", "_")
        conn_id = "".join(c for c in conn_id if c.isalnum() or c == "_")

        custom = [c for c in custom if c.get("id") != conn_id]
        
        new_conn = {
            "id": conn_id,
            "name": name,
            "icon": data.get("icon", "📢"),
            "category": data.get("category", "Custom Webhook / Messaging"),
            "protocol": data.get("protocol", "webhook"), # 'webhook', 'deeplink', 'command'
            "target": data.get("target", "").strip(), # URL, scheme, or CLI template
            "description": data.get("description", f"Custom connector for {name}"),
            "guide": data.get("guide", [f"Configure {name} endpoint", "Test dispatch"]),
            "is_custom": True,
            "status": "configured" if data.get("target") else "ready",
            "created_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }

        custom.append(new_conn)
        cfg["custom_connectors"] = custom
        self.update_config(cfg)
        return {"status": "success", "message": f"Added custom messaging connector: '{name}'", "connector": new_conn}

    def delete_custom_connector(self, conn_id: str) -> Dict[str, Any]:
        cfg = self.get_config()
        custom = cfg.get("custom_connectors", [])
        new_custom = [c for c in custom if c.get("id") != conn_id]
        if len(new_custom) == len(custom):
            return {"status": "error", "message": f"Connector '{conn_id}' not found."}
        cfg["custom_connectors"] = new_custom
        self.update_config(cfg)
        return {"status": "success", "message": f"Deleted connector '{conn_id}'"}

    def send_custom(self, conn_id: str, message: str) -> Dict[str, Any]:
        custom = self.list_custom_connectors()
        target_conn = next((c for c in custom if c.get("id") == conn_id), None)
        if not target_conn:
            return {"status": "error", "message": f"Custom connector '{conn_id}' not found."}

        protocol = target_conn.get("protocol", "webhook")
        target = target_conn.get("target", "").strip()

        if not target:
            return {"status": "error", "message": f"No target endpoint configured for '{target_conn['name']}'."}

        # Protocol 1: Webhook POST
        if protocol == "webhook":
            payload = {
                "text": message,
                "message": message,
                "content": message,
                "timestamp": time.time(),
                "sender": "B1 AI Autonomous Assistant"
            }
            try:
                req = urllib.request.Request(
                    target,
                    data=json.dumps(payload).encode('utf-8'),
                    headers={"Content-Type": "application/json", "User-Agent": "B1-Agent/2.0"}
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    return {"status": "success", "message": f"Dispatched webhook to '{target_conn['name']}'"}
            except Exception as e:
                return {"status": "error", "message": f"Webhook Error: {str(e)}"}

        # Protocol 2: DeepLink / URL Scheme
        elif protocol == "deeplink":
            encoded_msg = urllib.parse.quote(message)
            final_url = target.replace("{message}", encoded_msg).replace("{text}", encoded_msg)
            if "{message}" not in target and "{text}" not in target:
                final_url = f"{target}?text={encoded_msg}" if "?" not in target else f"{target}&text={encoded_msg}"
            return {
                "status": "success",
                "mode": "deeplink",
                "message": f"Generated deep link for '{target_conn['name']}'",
                "url": final_url
            }

        # Protocol 3: Custom Command / CLI
        elif protocol == "command":
            cmd = target.replace("{message}", message)
            try:
                res = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15, encoding="utf-8", errors="replace")
                return {
                    "status": "success" if res.returncode == 0 else "warning",
                    "exit_code": res.returncode,
                    "output": (res.stdout or res.stderr or "").strip(),
                    "message": f"Executed CLI dispatch for '{target_conn['name']}'"
                }
            except Exception as e:
                return {"status": "error", "message": f"Command execution error: {str(e)}"}

        return {"status": "error", "message": f"Unknown protocol: {protocol}"}

messaging = MessagingEngine()
