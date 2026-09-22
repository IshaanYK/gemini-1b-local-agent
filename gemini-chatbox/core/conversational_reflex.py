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

        self.songs = [
            "Umm, let's see! La la la! 🎵 Daisy, Daisy, give me your answer do! I'm half crazy, all for the love of you! How was my singing?",
            "Hmm, clearing my vocal cords! 🎵 Twinkle, twinkle, little star, how I wonder what you are! Up above the world so high, like a diamond in the sky! Hope that brought a smile to your face!",
            "Well, here goes! 🎵 Row, row, row your boat, gently down the stream! Merrily, merrily, merrily, merrily, life is but a dream! How did I do, Ishaan?"
        ]

        self.jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs! Haha, what do you think?",
            "Why did the JavaScript developer wear glasses? Because they couldn't C sharp! Got another one if you want!",
            "There are 10 types of people in the world: those who understand binary, and those who don't!",
            "Why was the computer cold? Because it left its Windows open! Classic, right?",
            "An SQL query walks into a bar, walks up to two tables and asks: Can I join you?"
        ]

        self.stories = [
            "Once upon a time in a quiet server room, a tiny line of code dreamed of reaching the stars. With a single click, Ishaan deployed it, and it illuminated the entire world. The end!",
            "Long ago, an engineer stayed up late untangling a mysterious bug. Just when hope seemed lost, a sudden spark of intuition struck, and with one keystroke, everything compiled into pure magic."
        ]

        self.weather = [
            "I don't have direct access to your local GPS sensors right now, but tell me your city and I'll gladly check the live forecast for you!",
            "Right now I don't have your exact location, but take a peek outside or mention your city name and we can look it up together!"
        ]

        self.motivation = [
            "Ishaan, every great architect started with a single line of code and persistence. You've got the vision and the drive—take a deep breath, keep going, and let's build something remarkable!",
            "Remember: progress isn't about perfection, it's about momentum. Every challenge you solve right now makes you sharper. I'm right here with you, let's do this!",
            "You are capable of building incredible things. Stay focused, trust your intuition, and let's knock out this goal step by step!"
        ]

        self.creator = [
            "I was built by Ishaan as an ultra-fast, intelligent AI companion and coding copilot right here in this workspace!",
            "You created and tuned me, Ishaan! I'm your dedicated AI voice agent, built for zero-latency conversation and real-time pair programming."
        ]

        self.facts = [
            "Did you know that the first computer bug was an actual real moth found trapped in a Harvard Mark Two computer relay in 1947?",
            "Did you know that honey never spoils? Archaeologists have discovered pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly edible!",
            "Did you know that space is completely silent because sound waves need a medium like air or water to travel through?",
            "Did you know that the first computer mouse was invented by Douglas Engelbart in 1964 and was made out of wood?"
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

        # 4. Creator / who made you
        if re.search(r"^(who made you|who created you|who built you|where do you come from|who is your creator)\b", c):
            return True, random.choice(self.creator)

        # 5. Songs / singing
        if re.search(r"(sing a song|sing for me|can you sing|sing something|sing me a song|sing us a song|sing a lullaby|^sing\b)", c):
            return True, random.choice(self.songs)

        # 6. Jokes / humor
        if re.search(r"(tell me a joke|tell a joke|make me laugh|say something funny|crack a joke|another joke|funny joke)", c):
            return True, random.choice(self.jokes)

        # 7. Stories
        if re.search(r"(tell me a story|tell a story|story time|short story|tell a bedtime story)", c):
            return True, random.choice(self.stories)

        # 8. Weather
        if re.search(r"(weather today|hows the weather|whats the weather|is it raining|temperature today|weather forecast)", c):
            return True, random.choice(self.weather)

        # 9. Motivation
        if re.search(r"(motivate me|give me motivation|inspire me|cheer me up|i feel tired|feeling down|i need inspiration)", c):
            return True, random.choice(self.motivation)

        # 10. Fun facts
        if re.search(r"(fun fact|tell me a fact|random fact|did you know|tell me something interesting)", c):
            return True, random.choice(self.facts)

        # 11. Coin Flip / Dice
        if re.search(r"(flip a coin|heads or tails)", c):
            outcome = random.choice(["Heads", "Tails"])
            return True, f"Flipping a coin... It landed on {outcome}!"
        if re.search(r"(roll a die|roll a dice)", c):
            roll = random.randint(1, 6)
            return True, f"Rolling a six-sided die... You rolled a {roll}!"

        # 12. Mic check / audibility
        if re.search(r"^(can you hear me|are you listening|am i audible|can you hear my voice|mic check|mic test|testing mic|testing one two three|test test|audio check)\b", c):
            return True, random.choice(self.mic_check)

        # 13. Capabilities / what can you do
        if re.search(r"^(what can you do|help me|what are your skills|what are your features|how can you help me|how do you work)\b", c):
            return True, random.choice(self.capabilities)

        # 14. Gratitude / thanks
        if re.search(r"^(thank you|thanks|thanks ava|thank you so much|appreciate it|much appreciated|thanks a lot)\b", c):
            return True, random.choice(self.thanks)

        # 15. Parting / bye
        if re.search(r"^(bye|goodbye|bye ava|see you|see ya|talk to you later|catch you later|good night)\b", c):
            return True, random.choice(self.parting)

        # 16. Time / Date
        if re.search(r"(what time is it|what is the time|whats the time|current time|tell me the time|what day is it|whats todays date|what is the date)", c):
            now = datetime.datetime.now()
            time_str = now.strftime("%I:%M %p").lstrip("0")
            date_str = now.strftime("%A, %B %d")
            return True, f"Right now it's {time_str} on {date_str}. Let me know if you need anything else!"

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
            return True, f"Well, {n1} {op} {n2} equals {ans}!"

        # 18. Acknowledgments
        if re.search(r"^(ok|okay|yes|yeah|yep|sure|sounds good|alright|fine|cool|awesome|perfect|great)\b", c) and len(c.split()) <= 3:
            return True, random.choice(self.acknowledgments)

        # 19. Halt / Stop
        if re.search(r"^(stop|shut up|be quiet|pause|hush|silence)\b", c) and len(c.split()) <= 3:
            return True, random.choice(self.halt)

        return False, None

reflex_engine = ConversationalReflexEngine()
