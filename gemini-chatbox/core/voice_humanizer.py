"""
core/voice_humanizer.py — Conversational Speech Humanizer & Disfluency Engine
=============================================================================
Transforms technical AI responses into lifelike, natural spoken language
for an authentic, expressive AI voice companion (Ava / Ana).

Features:
1. Dynamic Conversational Fillers & Disfluencies ("Hmm...", "Umm, let's see...", "Oh, wait!", "Aha, gotcha!").
2. Code & Markdown Sanitization (replaces syntax/backticks with natural spoken summaries).
3. Sentence Chunking for Sub-300ms Low-Latency Audio Streaming.
4. Emotion & Cadence Modulation (natural micro-pauses with commas and ellipsis).
"""

import re
import random
from typing import List, Dict, Any

# Persona: Expressive Conversational AI (warm, articulate, emotionally authentic with laughs and feelings)
OPENING_FILLERS_LAUGH_JOY = [
    "Haha, oh absolutely! ",
    "Hehe, I love that! ",
    "Haha, totally! ",
    "Oh haha, wow! ",
    "Hehe, that's so cool! ",
    "Haha, fair enough! ",
    "Hehe, you know it! ",
]

OPENING_FILLERS_EMPATHY = [
    "Aww, I completely get that! ",
    "Oh, I hear you, Ishaan. ",
    "Aww, take your time! ",
    "No worries at all! ",
    "Aww, don't worry about it! ",
]

OPENING_FILLERS_CASUAL = [
    "Oh hey! ",
    "Haha, let's see... ",
    "Umm, let's see... ",
    "Hmm... you know, ",
    "Oh, gotcha! ",
    "Umm, so basically, ",
    "Well, you know, ",
    "Oh, wow! Okay, so, ",
    "Aha, alright! ",
    "Oh, totally! ",
]

OPENING_FILLERS_CODING = [
    "Umm, alright! I've written that code in your workspace. ",
    "Hmm, got it! The script is ready for you right now. ",
    "Oh, nice! I implemented that clean logic in the editor. ",
    "Umm, sure thing! Let me cook up that code for you real quick. ",
]

OPENING_FILLERS_THINKING = [
    "Hmm... let's see! ",
    "Umm, well, let me think about that... ",
    "Oh, that's a great question! ",
    "Umm, you know what? ",
    "Hmm, okay, so basically... ",
    "Well, look... ",
]

TRANSITION_FILLERS = [
    ", you know? ",
    ", like, ",
    "... and yeah, ",
    "... so basically, ",
    "... and, you know, ",
]


class VoiceHumanizer:
    """Conversational text humanizer for lifelike voice synthesis."""

    def __init__(self, default_persona: str = "ava", disfluency_level: str = "natural"):
        """
        disfluency_level: 'natural' (default), 'subtle', 'off'
        """
        self.default_persona = default_persona
        self.disfluency_level = disfluency_level

    def sanitize_for_speech(self, raw_text: str) -> str:
        """
        Strips markdown code blocks, tables, math symbols, and technical formatting
        to ensure speech sounds 100% natural rather than reading out syntax symbols.
        """
        if not raw_text:
            return ""

        text = raw_text

        # 1. Handle tool / thoughts / suggestion call blocks
        text = re.sub(r'\[(?:SUGGESTIONS?|PROMPTS?|OPTIONS?|NEXT STEPS?|TOOL_CALL|VISUALIZE_OFFER)[^\]]*\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'<thought>.*?</thought>', '', text, flags=re.DOTALL)
        text = re.sub(r'```[\s\S]*?```', ' I have written the code in the workspace panel for you. ', text)
        text = re.sub(r'`([^`]+)`', r'\1', text)  # inline code to plain text

        # 2. Strip Executive Summary / TL;DR / Section headers completely
        text = re.sub(r'(?:###|##|#)\s*(?:Executive Summary|TL;DR|TLDR|Context & Intent|Proactive Action|Next Steps)[:\s]*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(?:Executive Summary|TL;DR|TLDR)\b[:\s]*', '', text, flags=re.IGNORECASE)
        # Convert remaining markdown headers to plain text with periods
        text = re.sub(r'^#{1,6}\s+(.+)$', r'\1.', text, flags=re.MULTILINE)

        # 3. Clean markdown links: [text](url) -> text
        text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)

        # 4. Clean bold/italic asterisks & underscores
        text = re.sub(r'[*_]{1,3}([^*_]+)[*_]{1,3}', r'\1', text)

        # 5. Clean forward slashes so TTS does not say "slash"
        text = re.sub(r'\bw/\b', 'with ', text, flags=re.IGNORECASE)
        text = re.sub(r'(\b\w+)/(\w+\b)', r'\1 or \2', text)
        text = re.sub(r'/', ' ', text)

        # 6. Strip ALL remaining asterisks, hashes, tildes, backticks, pipes
        text = re.sub(r'[*#~>`|]+', ' ', text)

        # 7. Clean markdown bullet points and numbered lists
        text = re.sub(r'^\s*[-*+•▪▫►▸]\s+', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*\d+\.\s+', '', text, flags=re.MULTILINE)

        # 8. Clean mathematical LaTeX formulas ($E=mc^2$ or $$...$$)
        text = re.sub(r'\$\$(.*?)\$\$', r'\1', text, flags=re.DOTALL)
        text = re.sub(r'\$(.*?)\$', r'\1', text)

        # 9. Clean table pipes, horizontal rules, dashes
        text = re.sub(r'^[-\s|:=_]{3,}$', '', text, flags=re.MULTILINE)
        text = re.sub(r'\s*---\s*', ' ', text)

        # 10. Clean URLs to readable domain or "the link"
        text = re.sub(r'https?://(?:www\.)?([a-zA-Z0-9.-]+)(?:/[^\s]*)?', r'\1', text)

        # 11. Clean UI icons / emojis that TTS reads awkwardly
        text = re.sub(r'[✨👤🤖💡🚀⚠️✅❌🔥💬🎧🎙️*#]', '', text)

        # 12. Clean excessive punctuation or whitespace
        text = re.sub(r'\n+', ' ', text)
        text = re.sub(r'\s{2,}', ' ', text)
        text = text.strip()

        return text

    def inject_human_disfluencies(self, text: str, context_prompt: str = "") -> str:
        """
        Injects conversational markers, fillers ('Hmm...', 'Umm...', 'Oh!')
        matching a natural, expressive conversational AI tone.
        """
        if self.disfluency_level == "off" or not text:
            return text

        cleaned = self.sanitize_for_speech(text)
        if not cleaned:
            return ""

        # Check if text already starts with an authentic conversational filler or emotional vocalization
        has_filler = any(cleaned.lower().startswith(f.strip().lower()) for f in ["hmm", "umm", "uh", "oh", "aha", "yeah", "haha", "hehe", "aww", "yay", "well", "right", "sure", "got it"])

        if not has_filler:
            is_laugh_humor = bool(re.search(r'\b(haha|hehe|lol|lmao|funny|joke|laugh|chill|relax|bored|fun)\b', context_prompt.lower()))
            is_empathy = bool(re.search(r'\b(tired|sad|down|stress|anxious|confused|sorry|upset|exhausted)\b', context_prompt.lower()))
            is_code_related = bool(re.search(r'\b(code|function|script|python|javascript|class|bug|error|fix)\b', context_prompt.lower()))
            is_question = bool(re.search(r'\b(why|how|what|explain|can you|tell me|who|where)\b', context_prompt.lower()))

            if is_laugh_humor:
                prefix = random.choice(OPENING_FILLERS_LAUGH_JOY)
            elif is_empathy:
                prefix = random.choice(OPENING_FILLERS_EMPATHY)
            elif is_code_related and "code in the code window" in cleaned:
                prefix = random.choice(OPENING_FILLERS_CODING)
            elif is_question:
                prefix = random.choice(OPENING_FILLERS_THINKING)
            else:
                prefix = random.choice(OPENING_FILLERS_CASUAL)

            if self.disfluency_level == "subtle":
                prefix = random.choice(["Haha, ", "Hmm... ", "Oh, okay! ", "Umm, so, "])

            cleaned = prefix + cleaned

        # Natural cadence improvements: collapse repeated periods into a single clean pause
        cleaned = re.sub(r'\.{2,}', '... ', cleaned)
        # Avoid double punctuation like '! ...' or '? ...'
        cleaned = re.sub(r'([!?])\s*\.{2,}\s*', r'\1 ', cleaned)
        # Ensure clean single spaces around pauses
        cleaned = re.sub(r'\s{2,}', ' ', cleaned).strip()
        return cleaned

    def chunk_sentences_for_streaming(self, text: str, max_chars_per_chunk: int = 240) -> List[str]:
        """
        Splits text into bite-sized natural sentences so audio generation
        can start immediately on the first sentence (< 300ms latency).
        """
        if not text:
            return []

        # Split on sentence boundaries: period, exclamation, question mark, or newline
        raw_sentences = re.split(r'(?<=[.?!])\s+(?=[A-Z0-9"\'\b])', text)

        chunks: List[str] = []
        current_chunk = ""

        for sent in raw_sentences:
            sent = sent.strip()
            if not sent:
                continue

            if not current_chunk:
                current_chunk = sent
            elif len(current_chunk) + len(sent) + 1 <= max_chars_per_chunk:
                current_chunk += " " + sent
            else:
                chunks.append(current_chunk)
                current_chunk = sent

        if current_chunk:
            chunks.append(current_chunk)

        return chunks

    def process_for_voice(self, raw_text: str, context_prompt: str = "") -> Dict[str, Any]:
        """
        Full pipeline: sanitizes, humanizes with disfluencies, and returns
        both full spoken text and streaming sentence chunks.
        """
        humanized = self.inject_human_disfluencies(raw_text, context_prompt)
        chunks = self.chunk_sentences_for_streaming(humanized)

        return {
            "original_length": len(raw_text),
            "spoken_text": humanized,
            "chunks": chunks,
            "chunk_count": len(chunks),
            "persona": self.default_persona,
            "disfluency_level": self.disfluency_level,
        }


# Global singleton instance
humanizer = VoiceHumanizer()
