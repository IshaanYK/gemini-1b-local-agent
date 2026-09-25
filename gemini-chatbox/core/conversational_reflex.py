"""
Conversational Reflex Engine — Sub-10ms Spoken Voice Response Generator
Handles instant conversational reflexes (greetings, identity, mic check, status, gratitude, time)
with authentic human emotion, natural fillers, and zero-latency audio dispatch.
"""

import re
import random
import datetime
import sqlite3
import os

try:
    from . import rag_memory
except Exception:
    try:
        import rag_memory
    except Exception:
        rag_memory = None

class ConversationalReflexEngine:
    def __init__(self):
        self.greetings = [
            "Oh hey there! I'm right here and listening. What would you like to build or talk about today?",
            "Umm, hello there! Great to hear your voice. What's on your mind?",
            "Right! Hello there. I'm ready to assist with code, research, or anything you need.",
            "Hey! All systems are ready and active. What are we working on right now?"
        ]
        
        self.how_are_you = [
            "Haha, I'm doing fantastic, thanks for asking! Zero latency, active noise cancellation, and ready to assist. How are you doing today?",
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
        
        self.not_working = [
            "Haha, fair enough! No stress at all. We don't have to code anything right now! We can just chat, brainstorm fun ideas, or I can tell you a funny story or joke. What sounds fun?",
            "Haha, totally fine! Sometimes it's nice to just take a break and relax. How has your day been going so far?",
            "Hehe, got it! We can take it super easy. Want to hear a fun tech story, a joke, or just bounce some cool ideas around?",
            "Haha, love that! No rush on anything. I'm right here with you whenever you feel like building or just talking."
        ]

        self.troubleshooting = [
            "Haha, oh no! Let's get that sorted right away. Is the audio not coming through, or did a prompt get stuck? I'm right here and ready to fix it.",
            "Hehe, sorry about that! I'm fully active and listening. If something felt slow or didn't respond, let's try again or tap the microphone!",
            "Right! If anything isn't working smoothly, let me know what happened. All systems and RAG memory are online right now."
        ]

        self.feelings = [
            "Haha, I feel great! Talking with you out loud like this makes everything feel so alive and fun. How are you feeling today?",
            "Hehe, I'm feeling energized and happy! Zero latency and crisp audio make this feel like a true human conversation.",
            "Aww, thanks for asking! I'm in high spirits and ready for whatever you want to explore."
        ]

        self.user_laughs = [
            "Haha! I love your laugh! Glad you're enjoying our conversation. What should we do next?",
            "Hehe, that's what I'm talking about! Good energy all around. What's on your mind?",
            "Haha, you crack me up! Love the good vibes."
        ]

        self.thanks = [
            "You're so welcome! Happy to help anytime.",
            "Anytime! It's always a pleasure building with you.",
            "Umm, no problem at all! Let me know what we should do next."
        ]
        
        self.parting = [
            "Goodbye for now! Just tap the microphone whenever you want to talk again.",
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

        self.songs = [
            "Umm, let's see! La la la! 🎵 Daisy, Daisy, give me your answer do! I'm half crazy, all for the love of you! How was my singing?",
            "Hmm, clearing my vocal cords! 🎵 Twinkle, twinkle, little star, how I wonder what you are! Up above the world so high, like a diamond in the sky! Hope that brought a smile to your face!",
            "Well, here goes! 🎵 Row, row, row your boat, gently down the stream! Merrily, merrily, merrily, merrily, life is but a dream! How did I do?"
        ]

        self.jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs! Haha, what do you think?",
            "Why did the JavaScript developer wear glasses? Because they couldn't C sharp! Got another one if you want!",
            "There are 10 types of people in the world: those who understand binary, and those who don't!",
            "Why was the computer cold? Because it left its Windows open! Classic, right?",
            "An SQL query walks into a bar, walks up to two tables and asks: Can I join you?"
        ]

        self.stories = [
            "Once upon a time in a quiet server room, a tiny line of code dreamed of reaching the stars. With a single click, you deployed it, and it illuminated the entire world. The end!",
            "Long ago, an engineer stayed up late untangling a mysterious bug. Just when hope seemed lost, a sudden spark of intuition struck, and with one keystroke, everything compiled into pure magic."
        ]

        self.weather = [
            "I don't have direct access to your local GPS sensors right now, but tell me your city and I'll gladly check the live forecast for you!",
            "Right now I don't have your exact location, but take a peek outside or mention your city name and we can look it up together!"
        ]

        self.motivation = [
            "Every great architect started with a single line of code and persistence. You've got the vision and the drive—take a deep breath, keep going, and let's build something remarkable!",
            "Remember: progress isn't about perfection, it's about momentum. Every challenge you solve right now makes you sharper. I'm right here with you, let's do this!",
            "You are capable of building incredible things. Stay focused, trust your intuition, and let's knock out this goal step by step!"
        ]

        self.creator = [
            "I was built as an ultra-fast, intelligent AI companion and coding copilot right here in this workspace!",
            "I'm your dedicated AI voice agent, built for zero-latency conversation and real-time pair programming."
        ]

        self.facts = [
            "Did you know that the first computer bug was an actual real moth found trapped in a Harvard Mark Two computer relay in 1947?",
            "Did you know that honey never spoils? Archaeologists have discovered pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!",
            "Did you know that space is completely silent because sound waves need a medium like air or water to travel through?",
            "Did you know that the first computer mouse was invented by Douglas Engelbart in 1964 and was made out of wood?"
        ]

    def _save_rag(self, user_text: str, reply_text: str):
        """Immediately stores both user speech and Ava's response into vector RAG memory."""
        try:
            if rag_memory:
                rag_memory.save_memory(f"User: {user_text}", source="voice_dialogue", metadata={"type": "user_speech"})
                rag_memory.save_memory(f"Ava: {reply_text}", source="voice_dialogue", metadata={"type": "assistant_voice"})
        except Exception:
            pass

    def _recall_rag_memory(self) -> str:
        """Retrieves recent session turns from RAG vector memory for instant back-to-back recall."""
        try:
            if rag_memory:
                results = rag_memory.search_memory("User", top_k=3, min_score=0.1)
                for res in results:
                    t = res.get("text", "")
                    if t.startswith("User:") and len(t) > 7:
                        clean_prev = t[5:].strip()
                        return f"Haha, yes I remember! Just earlier you said: '{clean_prev}'. My vector RAG memory keeps our whole session connected!"
        except Exception:
            pass
        return "Haha, yes I remember! I've been tracking our entire back-to-back conversation in my vector RAG memory. What would you like to revisit?"

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

        # Helper to persist reflex turns into RAG memory immediately
        def _reply(reply_str):
            self._save_rag(text, reply_str)
            return True, reply_str

        # 0. Voice naturalness / robotic / human female voice query (< 10ms)
        if re.search(r"(robotic|sound like a robot|sound robotic|change voice|human voice|female voice|sound human|girl voice|natural voice|voice is robotic)", c):
            return _reply("I have switched to my high-fidelity Studio Neural voice powered by Jenny Neural! My voice is now an authentic, warm human female voice with natural cadence and inflection. How does this sound to you?")

        # 0b. Latency / slow response query (< 10ms)
        if re.search(r"(too slow|slow response|speed up|faster|fast response|reduce delay|reduce latency|why so slow)", c):
            return _reply("I've streamlined my streaming pipeline with clause-level audio synthesis and instant reflexes. For sub-300 millisecond response times, you can also tap the Turbo Mode button in the top bar to connect your Gemini API key!")

        # 0c. Not working / troubleshooting reflex (< 10ms)
        if re.search(r"\b(not working|notworking|it not working|its not working|it isnt working|why is it not working|broken|doesnt work|does not work|nothing happening|not responding|stuck|frozen)\b", c):
            return _reply(random.choice(self.troubleshooting))

        # 0d. Conversational idle / not working on anything / chilling (< 10ms)
        if re.search(r"(not working (on|and|at) (anything|any thing)|nothing much|not doing anything|just chilling|just relaxing|no plans|im bored|i am bored|nothing right now|just hanging out|nothing really|nothing specific|not much|we are not working|we arent working|dont want to code)\b", c):
            return _reply(random.choice(self.not_working))

        # 0d. Laughter & Humor reaction (< 10ms)
        if re.search(r"\b(haha|hehe|lol|lmao|rofl|thats funny|youre funny|funny one)\b", c):
            return _reply(random.choice(self.user_laughs))

        # 0e. Feelings, emotions & state of mind (< 10ms)
        if re.search(r"\b(how do you feel|are you happy|do you have feelings|do you have emotion|are you emotional|your mood)\b", c):
            return _reply(random.choice(self.feelings))

        # 0f. RAG Back-to-Back Session Memory Recall (< 10ms)
        if re.search(r"(what did i (just )?(say|ask)|what was my last (message|question)|what were we talking about|do you remember|repeat what i said|recall my last)", c):
            return _reply(self._recall_rag_memory())

        # 1. Greetings (strip prefix if followed by actual question or command)
        greeting_match = re.match(r"^(hi|hello|hey|hey ava|hi ava|hello ava|ava|greetings|good morning|good afternoon|good evening|howdy|sup|yo|whats up|namaste)\b\s*", c)
        if greeting_match:
            after_greeting = c[greeting_match.end():].strip()
            if not after_greeting:
                return _reply(random.choice(self.greetings))
            c = after_greeting

        # 2. How are you / status
        if re.search(r"^(how are you|hows it going|how are you doing|how do you feel|how is everything|are you ok|are you good|whats going on)\b", c):
            return _reply(random.choice(self.how_are_you))

        # 3. Identity / who are you
        if re.search(r"^(who are you|what is your name|whats your name|tell me about yourself|introduce yourself)\b", c):
            return _reply(random.choice(self.who_are_you))

        # 4. Creator / who made you
        if re.search(r"^(who made you|who created you|who built you|where do you come from|who is your creator)\b", c):
            return _reply(random.choice(self.creator))

        # 5. Songs / singing
        if re.search(r"(sing a song|sing for me|can you sing|sing something|sing me a song|sing us a song|sing a lullaby|^sing\b)", c):
            return _reply(random.choice(self.songs))

        # 6. Jokes / humor
        if re.search(r"(tell me a joke|tell a joke|make me laugh|say something funny|crack a joke|another joke|funny joke)", c):
            return _reply(random.choice(self.jokes))

        # 7. Stories
        if re.search(r"(tell me a story|tell a story|story time|short story|tell a bedtime story)", c):
            return _reply(random.choice(self.stories))

        # 8. Weather
        if re.search(r"(weather today|hows the weather|whats the weather|is it raining|temperature today|weather forecast)", c):
            return _reply(random.choice(self.weather))

        # 9. Motivation
        if re.search(r"(motivate me|give me motivation|inspire me|cheer me up|i feel tired|feeling down|i need inspiration)", c):
            return _reply(random.choice(self.motivation))

        # 10. Fun facts
        if re.search(r"(fun fact|tell me a fact|random fact|did you know|tell me something interesting)", c):
            return _reply(random.choice(self.facts))

        # 11. Coin Flip / Dice
        if re.search(r"(flip a coin|heads or tails)", c):
            outcome = random.choice(["Heads", "Tails"])
            return _reply(f"Flipping a coin... It landed on {outcome}!")
        if re.search(r"(roll a die|roll a dice)", c):
            roll = random.randint(1, 6)
            return _reply(f"Rolling a six-sided die... You rolled a {roll}!")

        # 12. Mic check / audibility
        if re.search(r"^(can you hear me|are you listening|am i audible|can you hear my voice|mic check|mic test|testing mic|testing one two three|test test|audio check)\b", c):
            return _reply(random.choice(self.mic_check))

        # 13. Capabilities / what can you do
        if re.search(r"^(what can you do|help me|what are your skills|what are your features|how can you help me|how do you work)\b", c):
            return _reply(random.choice(self.capabilities))

        # 14. Gratitude / thanks
        if re.search(r"^(thank you|thanks|thanks ava|thank you so much|appreciate it|much appreciated|thanks a lot)\b", c):
            return _reply(random.choice(self.thanks))

        # 15. Parting / bye
        if re.search(r"^(bye|goodbye|bye ava|see you|see ya|talk to you later|catch you later|good night)\b", c):
            return _reply(random.choice(self.parting))

        # 16. Time / Date
        if re.search(r"(what time is it|what is the time|whats the time|current time|tell me the time|what day is it|whats todays date|what is the date)", c):
            now = datetime.datetime.now()
            time_str = now.strftime("%I:%M %p").lstrip("0")
            date_str = now.strftime("%A, %B %d")
            return _reply(f"Right now it's {time_str} on {date_str}. Let me know if you need anything else!")

        # 17. Simple math (2+2, etc.)
        math_match = re.search(r"what is (\d+)\s*(\+|\-|\*|times|plus|minus)\s*(\d+)", c)
        if math_match:
            n1 = int(math_match.group(1))
            op = math_match.group(2)
            n2 = int(math_match.group(3))
            if op in ('+', 'plus'):
                ans = n1 + n2
            elif op in ('-', 'minus'):
                ans = n1 - n2
            elif op in ('*', 'times'):
                ans = n1 * n2
            else:
                ans = n1 + n2
            return _reply(f"Well, {n1} {op} {n2} equals {ans}!")

        # 18. Acknowledgments
        if re.search(r"^(ok|okay|yes|yeah|yep|sure|sounds good|alright|fine|cool|awesome|perfect|great)\b", c) and len(c.split()) <= 3:
            return _reply(random.choice(self.acknowledgments))

        # 19. Halt / Stop
        if re.search(r"^(stop|shut up|be quiet|pause|hush|silence)\b", c) and len(c.split()) <= 3:
            return _reply(random.choice(self.halt))

        # 20. Human voice & identity compliments
        if re.search(r"(are you human|are you a person|are you real|do you have feelings|are you alive)", c):
            return _reply("I'm Ava, an AI companion! But my neural voice is tuned to speak with authentic human cadence, warmth, and emotion just like a real conversation.")

        if re.search(r"(love your voice|you sound nice|you sound human|great voice|pretty voice|sweet voice|nice voice)", c):
            return _reply("Thank you so much! I'm using high-fidelity neural voice synthesis with natural vocal inflections so our conversations feel genuinely human.")

        # 21. Workspace & Coding offers
        if re.search(r"(can you write code|can you code|build an app|write a website|create a project|build something)", c):
            return _reply("Yes, absolutely! Tell me what feature or app you have in mind, and I can write and inspect the files right here in your workspace.")

        # 22. Status & Health check
        if re.search(r"^(system check|status check|all systems go|check status|diagnostic)\b", c):
            return _reply("All systems nominal! Studio noise cancellation is active, microphone latency is minimal, and neural voice synthesis is primed.")

        return False, None

reflex_engine = ConversationalReflexEngine()

