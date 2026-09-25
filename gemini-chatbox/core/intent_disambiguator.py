"""
core/intent_disambiguator.py — Intelligent Prompt Disambiguation & Semantic RAG Pipeline for B1
Empowers B1 to parse messy, typo-ridden, vague, slang-heavy, and underspecified prompts by:
1. Phonetic & typographical normalization (e.g. "vishualize", "woking", "habve", "undestand").
2. Coreference resolution (resolving "it", "that", "the button", "this thing" via recent session context).
3. Technical Intent Synthesis: Reconstructing messy prompts into high-precision engineering objectives.
4. Explicit Assumption Formulation: Stating exact assumptions so the user can verify interpretation.
"""

import re
from typing import Dict, List, Any, Optional

COMMON_CORRECTIONS = {
    r'\bmakea\b': 'make a',
    r'\bbuilda\b': 'build a',
    r'\bcreatea\b': 'create a',
    r'\bcodea\b': 'code a',
    r'\bvizualize\b': 'visualize',
    r'\bvizualise\b': 'visualize',
    r'\bvisualise\b': 'visualize',
    r'\bvisulize\b': 'visualize',
    r'\bvisulaize\b': 'visualize',
    r'\bvisualize me\b': 'visualize',
    r'\bshow me\b': 'visualize',
    r'\bsimulat\b': 'simulate',
    r'\bvishualize\b': 'visualize',
    r'\bvishualization\b': 'visualization',
    r'\bsomethings\b': 'something',
    r'\bhabve\b': 'have',
    r'\bwoking\b': 'working',
    r'\bworiing\b': 'working',
    r'\bundestand\b': 'understand',
    r'\bintelligente\b': 'intelligent',
    r'\bpannel\b': 'panel',
    r'\bloop hole\b': 'loophole / security vulnerability',
    r'\bmaths\b': 'mathematics',
    r'\bprobelm\b': 'problem',
    r'\bdevelope\b': 'develop',
    r'\bimplment\b': 'implement',
    r'\balogorithm\b': 'algorithm',
    r'\barchitechture\b': 'architecture',
    r'\bdatbase\b': 'database',
    r'\bconfg\b': 'config',
    r'\brbca\b': 'RBAC',
    r'\bauthenticaion\b': 'authentication',
    r'\baddn\b': 'and',
    r'\bcamra\b': 'camera',
    r'\bwebcam\b': 'webcam / camera stream',
    r'\binteract with hand\b': 'interactive hand tracking & gesture computer vision',
    r'\bml code\b': 'machine learning & computer vision model'
}

class PromptDisambiguator:
    """Intelligent pipeline to clean, contextualize, and reconstruct unclear user prompts."""

    @classmethod
    def clean_text(cls, text: str) -> str:
        """Applies typographical normalization and cleans redundant whitespace."""
        if not text:
            return ""
        cleaned = text.strip()
        for pattern, replacement in COMMON_CORRECTIONS.items():
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)
        # Clean extra spaces/punctuation repetitions
        cleaned = re.sub(r'\s+', ' ', cleaned)
        cleaned = re.sub(r'[\?!]{2,}', '?', cleaned)
        return cleaned

    @classmethod
    def resolve_coreferences(cls, prompt: str, recent_messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """Resolves pronouns like 'it', 'this', 'that', 'the button' against recent conversation context."""
        cleaned = cls.clean_text(prompt)
        last_assistant_topic = ""
        last_user_topic = ""

        for m in reversed(recent_messages):
            if m.get('role') == 'assistant' and not last_assistant_topic:
                # Extract first meaningful heading or topic
                content = m.get('content', '')
                h_match = re.search(r'#+\s*(.+)', content)
                if h_match:
                    last_assistant_topic = h_match.group(1).strip()
                elif len(content) > 10:
                    last_assistant_topic = content.split('\n')[0][:80].strip()
            elif m.get('role') == 'user' and not last_user_topic:
                last_user_topic = m.get('content', '')[:80].strip()

        is_vague = bool(re.search(r'^(it|this|that|do it|fix it|run it|continue|add more|preview|show me|explain)$', cleaned, re.IGNORECASE)) or len(cleaned.split()) <= 3
        
        assumptions = []
        inferred_subject = ""

        if is_vague:
            if last_assistant_topic:
                inferred_subject = last_assistant_topic
                assumptions.append(f"Interpreting request in reference to previous topic: '{last_assistant_topic}'")
            elif last_user_topic:
                inferred_subject = last_user_topic
                assumptions.append(f"Continuing focus on prior prompt: '{last_user_topic}'")

        return {
            "cleaned_prompt": cleaned,
            "is_vague": is_vague,
            "inferred_subject": inferred_subject,
            "assumptions": assumptions
        }

    @classmethod
    def disambiguate(cls, raw_prompt: str, recent_messages: Optional[List[Dict[str, str]]] = None, active_persona: str = "fullstack") -> Dict[str, Any]:
        """Full pipeline: cleans prompt, infers technical intent, formulates assumptions, and structures output."""
        recent_messages = recent_messages or []
        ref_data = cls.resolve_coreferences(raw_prompt, recent_messages)
        cleaned = ref_data["cleaned_prompt"]
        assumptions = ref_data["assumptions"]
        
        # Analyze specific intent vectors
        is_cv_ml = bool(re.search(r'\b(camera|webcam|hand gesture|gesture|track hand|color track|computer vision|opencv|mediapipe|optical flow|color tracking|motion detect)\b', cleaned, re.IGNORECASE))
        is_visualization = bool(re.search(r'\b(visualize|simulation|simulate|canvas|plot|curve|slider|interactive|black hole|astronomy|physics|gravity|orbit|lensing|pendulum|wave|fourier|sorting|algorithm|particles|particles simulation|solar system)\b', cleaned, re.IGNORECASE))
        is_app_build = bool(re.search(r'\b(make a|build a|create a|develop a|code a|write a|app|application|game|tool|calculator|timer|stopwatch|clock|dashboard|mixer|dj|player|synth|editor|widget|ui|frontend|component)\b', cleaned, re.IGNORECASE))
        is_security = bool(re.search(r'\b(security|audit|vulnerability|loophole|idor|sqli|token|jwt|owasp|secret)\b', cleaned, re.IGNORECASE))
        is_refactor_fix = bool(re.search(r'\b(fix|bug|broken|error|not working|overlapping|button|clean)\b', cleaned, re.IGNORECASE))
        is_architecture = bool(re.search(r'\b(architecture|blueprint|schema|database|system design|microservice)\b', cleaned, re.IGNORECASE))

        refined_intent = "General Software Engineering"
        technical_prompt = cleaned

        if is_cv_ml:
            refined_intent = "Computer Vision & Interactive Webcam ML"
            assumptions.append("User seeks in-browser real-time camera processing, motion tracking, or gesture interaction using native Canvas/MediaDevices.")
            technical_prompt = f"Build a complete in-browser interactive Computer Vision / Webcam application for: {cleaned} inside <antArtifact> tags."
        elif is_visualization:
            refined_intent = "STEM & Dynamic Canvas Simulation"
            assumptions.append("User requests an interactive, runnable HTML5 Canvas visual simulation with dynamic animation, interactive parameter sliders, and real-time controls.")
            technical_prompt = f"Build a complete, standalone, interactive HTML5 Canvas simulation of: {cleaned} with dynamic animation and UI controls inside <antArtifact> tags (do not generate static images, write full code)."
        elif is_app_build:
            refined_intent = "Interactive Web Application & Tool Builder"
            assumptions.append("User requests an immediate, fully working, standalone browser application with interactive UI inside an artifact.")
            technical_prompt = f"Build a complete, standalone, interactive HTML5/CSS/JavaScript application for: {cleaned} inside <antArtifact> tags with Linear-grade dark UI."
        elif is_security:
            refined_intent = "Security Auditing & Defensive Hardening"
            assumptions.append("User is conducting educational security analysis and defensive vulnerability remediation.")
        elif is_refactor_fix:
            refined_intent = "UI/UX & Code Quality Repair"
            assumptions.append("User requires pinpoint diagnosis, bug resolution, and high-clarity output.")
        elif is_architecture:
            refined_intent = "System Architecture & Schema Design"
            assumptions.append("User needs end-to-end multi-tier architecture with concrete diagrams and schemas.")

        # If prompt was very short or vague, generate an explicit structured prompt
        if ref_data["is_vague"] and ref_data["inferred_subject"]:
            technical_prompt = f"{cleaned} regarding {ref_data['inferred_subject']}"

        return {
            "original_prompt": raw_prompt,
            "cleaned_prompt": cleaned,
            "technical_prompt": technical_prompt,
            "refined_intent": refined_intent,
            "is_ambiguous": ref_data["is_vague"],
            "assumptions": assumptions,
            "persona_aligned": active_persona
        }


disambiguator = PromptDisambiguator()
disambiguate_intent = PromptDisambiguator.disambiguate
