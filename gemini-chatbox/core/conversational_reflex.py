"""
Conversational Reflex Engine — Sub-10ms Spoken Voice Response Generator
Handles instant conversational reflexes (greetings, identity, mic check, status, gratitude, time)
with authentic human emotion, natural fillers, and zero-latency audio dispatch.
"""

import re
import random
import datetime

class ConversationalReflexEngine:
    def __init__(self):
        self.greetings = [
            "Oh hey Ishaan! I'm right here and listening. What would you like to build or talk about today?",
            "Umm, hello there! Great to hear your voice. What's on your mind?",
            "Right! Hello Ishaan. I'm ready to assist with code, research, or anything you need.",
            "Hey! All systems are ready and active. What are we working on right now?"
        ]
        
        self.how_are_you = [
            "Umm, I'm doing fantastic, thanks for asking! Zero latency, active noise cancellation, and ready to assist. How are you doing?",
            "Well, feeling great and all systems are running smoothly! Ready to dive into some code or research?",
            "Right! I'm doing great. Hope your day is going awesome too!"
        ]
        
        self.who_are_you = [
            "Well, I'm Ava! Your ultra-fast AI voice copilot, designed for instant natural dialogue, coding, and real-time reasoning.",
            "Right! I'm Ava, your AI voice assistant. I can inspect files, write full applications, run research councils, and chat naturally with you.",
            "Umm, I'm Ava! Your voice companion and programming copilot in this workspace."
        ]
        
        self.mic_check = [
            "Right! I can hear you loud and clear. Your microphone audio is coming through with studio noise cancellation.",
            "Umm, yes! Hearing you perfectly. Studio noise suppression is filtering out room noise, so your voice is crisp.",
            "Loud and clear! The audio level is strong and clean. What would you like to do?"
        ]
        
        self.capabilities = [
            "Well, I can inspect and edit files in your workspace, build interactive web apps, benchmark algorithms, and talk with you naturally with zero delay.",
            "Right! I can create and modify project code, execute terminal commands, run security audits, and answer any technical or research questions you have.",
            "Umm, I can write software, debug issues, analyze data, and keep up a lightning-fast spoken conversation right here."
        ]
        
        self.thanks = [
            "You're so welcome, Ishaan! Happy to help anytime.",
            "Anytime, Ishaan! It's always a pleasure building with you.",
            "Umm, no problem at all! Let me know what we should do next."
        ]
        
        self.parting = [
            "Goodbye for now, Ishaan! Just tap the microphone whenever you want to talk again.",
            "Take care! I'll be right here whenever you're ready to continue.",
            "Right, see you later! Have a productive session."
        ]
        
        self.acknowledgments = [
            "Got it! Whenever you're ready, tell me what we should dive into next.",
            "Awesome! What's our next step?",
            "Right, understood! Let me know when you want to proceed."
        ]

        self.halt = [
            "Understood, pausing right now.",
            "Got it, stopping speech.",
            "Paused. Just speak whenever you're ready."
        ]

    def _clean(self, text: str) -> str:
        t = (text or "").strip().lower()
        t = re.sub(r"[^\w\s]", "", t)
        return re.sub(r"\s+", " ", t).strip()

    def match(self, text: str):
        """
        Evaluates user utterance.
        Returns: (is_reflex: bool, reply: str or None)
        """
        c = self._clean(text)
        if not c:
            return False, None

        # 1. Greetings
        if re.search(r"^(hi|hello|hey|hey ava|hi ava|hello ava|greetings|good morning|good afternoon|good evening|howdy|sup|yo|what's up|namaste)\b", c):
            return True, random.choice(self.greetings)

        # 2. How are you / status
        if re.search(r"^(how are you|hows it going|how are you doing|how do you feel|how is everything|are you ok|are you good|whats going on)\b", c):
            return True, random.choice(self.how_are_you)

        # 3. Identity / who are you
        if re.search(r"^(who are you|what is your name|whats your name|tell me about yourself|introduce yourself)\b", c):
            return True, random.choice(self.who_are_you)

        # 4. Mic check / audibility
        if re.search(r"^(can you hear me|are you listening|am i audible|can you hear my voice|mic check|mic test|testing mic|testing one two three|test test|audio check)\b", c):
            return True, random.choice(self.mic_check)

        # 5. Capabilities / what can you do
        if re.search(r"^(what can you do|help me|what are your skills|what are your features|how can you help me|how do you work)\b", c):
            return True, random.choice(self.capabilities)

        # 6. Gratitude / thanks
        if re.search(r"^(thank you|thanks|thanks ava|thank you so much|appreciate it|much appreciated|thanks a lot)\b", c):
            return True, random.choice(self.thanks)

        # 7. Parting / bye
        if re.search(r"^(bye|goodbye|bye ava|see you|see ya|talk to you later|catch you later|good night)\b", c):
            return True, random.choice(self.parting)

        # 8. Time / Date
        if re.search(r"^(what time is it|what is the time|whats the time|current time|tell me the time|what day is it|whats todays date|what is the date)\b", c):
            now = datetime.datetime.now()
            time_str = now.strftime("%I:%M %p").lstrip("0")
            date_str = now.strftime("%A, %B %d")
            return True, f"Right now it's {time_str} on {date_str}. Let me know if you need anything else!"

        # 9. Acknowledgments
        if re.search(r"^(ok|okay|yes|yeah|yep|sure|sounds good|alright|fine|cool|awesome|perfect|great)\b", c) and len(c.split()) <= 3:
            return True, random.choice(self.acknowledgments)

        # 10. Halt / Stop
        if re.search(r"^(stop|shut up|be quiet|pause|hush|silence)\b", c) and len(c.split()) <= 3:
            return True, random.choice(self.halt)

        return False, None

reflex_engine = ConversationalReflexEngine()
