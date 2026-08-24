"""
core/sharing_intent_engine.py — Conversational File Sharing & AI Message Suggestion Engine
Detects intents like:
- "send this doc/file to my whatsapp for John"
- "upload this code to my google drive"
- "suggest me the message and things what I can write"
And synthesizes tailored message suggestions + actionable cards.
"""

import os
import re
import json
from typing import Dict, List, Any, Optional

class SharingIntentEngine:
    """Parses natural language sharing/upload requests and generates suggested messages."""

    PLATFORMS = {
        "whatsapp": ["whatsapp", "what app", "whatapp", "wa", "whats app"],
        "google_drive": ["drive", "google drive", "gdrive", "cloud drive", "google cloud"],
        "telegram": ["telegram", "tg", "telegram bot"],
        "discord": ["discord", "discord server", "discord channel"],
        "slack": ["slack", "slack channel"],
        "email": ["email", "mail", "gmail", "outlook"]
    }

    def detect_sharing_intent(self, text: str) -> Optional[Dict[str, Any]]:
        """Detects if the user prompt is requesting to share, send, or upload a file."""
        lower = text.lower()
        
        # Check action triggers
        share_triggers = ["send", "share", "upload", "forward", "post", "dispatch", "push to"]
        has_trigger = any(t in lower for t in share_triggers)
        if not has_trigger:
            return None

        # Detect platform
        detected_platform = None
        for plat, aliases in self.PLATFORMS.items():
            if any(a in lower for a in aliases):
                detected_platform = plat
                break

        if not detected_platform:
            return None

        # Extract recipient or target
        recipient = ""
        # Match phone numbers: +1234567890 or 10 digits
        phone_match = re.search(r'(\+?\d{8,15})', text)
        if phone_match:
            recipient = phone_match.group(1)
        else:
            # Match "for [Name]" or "to [Name]"
            name_match = re.search(r'(?:to|for)\s+([A-Za-z0-9_@\.\-\s]+?)(?:\s+(?:on|via|at|with|and|\.)|$)', text, re.IGNORECASE)
            if name_match:
                candidate = name_match.group(1).strip()
                # filter out platform names
                if candidate.lower() not in ["whatsapp", "my whatsapp", "drive", "google drive", "telegram", "slack", "discord"]:
                    recipient = candidate

        # Extract file / document mention
        file_target = ""
        file_match = re.search(r'([\w\-\.]+\.(?:py|js|html|css|json|md|pdf|png|jpg|txt|zip|csv))', text, re.IGNORECASE)
        if file_match:
            file_target = file_match.group(1)
        elif "this doc" in lower or "these doc" in lower or "this file" in lower or "the code" in lower or "this code" in lower:
            file_target = "active_workspace_artifact"

        suggestions = self.generate_suggested_messages(detected_platform, recipient, file_target)

        return {
            "is_sharing_request": True,
            "platform": detected_platform,
            "recipient": recipient or ("My Drive" if detected_platform == "google_drive" else "Recipient"),
            "file_target": file_target or "Current Codebase / Artifact",
            "suggested_message": suggestions[0] if suggestions else "Hello, here is the requested file.",
            "suggestions": suggestions
        }

    def generate_suggested_messages(self, platform: str, recipient: str, file_target: str) -> List[str]:
        """Generates 3 contextual, high-impact message suggestions for the user."""
        target_name = recipient if recipient and recipient != "My Drive" else "there"
        f_name = file_target if file_target and file_target != "active_workspace_artifact" else "the project documentation & source code"

        if platform == "whatsapp":
            return [
                f"Hi {target_name}! 👋 Here is {f_name} we worked on. Let me know if you need any adjustments!",
                f"Hey {target_name}, sharing the latest {f_name}. All updates and tests have been verified.",
                f"Hello {target_name}, please find attached {f_name}. Ready for review!"
            ]
        elif platform == "google_drive":
            return [
                f"Uploaded {f_name} to Google Drive for cloud backup and team sharing.",
                f"Archived latest build of {f_name} to Google Drive.",
                f"Synced {f_name} to Google Drive workspace folder."
            ]
        elif platform == "telegram":
            return [
                f"🚀 <b>B1 Agent Alert:</b> New version of {f_name} is ready for review.",
                f"📌 <b>Update:</b> {f_name} successfully built and verified.",
                f"✅ <b>Task Completed:</b> Dispatched {f_name}."
            ]
        elif platform in ["discord", "slack"]:
            return [
                f"🚀 **Build Update:** {f_name} has been processed and is ready for team review.",
                f"📢 **Notification:** Sharing {f_name} with the channel.",
                f"✅ **Release Candidate:** {f_name} uploaded with zero errors."
            ]
        else:
            return [
                f"Hello, here is {f_name} for your review.",
                f"Sharing the latest updates for {f_name}.",
                f"Attached please find {f_name}."
            ]

sharing_intent = SharingIntentEngine()
