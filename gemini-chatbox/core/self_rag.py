"""
core/self_rag.py — Self-Reflective Retrieval-Augmented Generation & Query Validator for B1
Adheres to Self-RAG paradigms:
1. Query Ambiguity & Intent Validation ([Retrieve] vs [No-Retrieve])
2. Self-Reflective Retrieval & Relevance Scoring ([Relevant] vs [Irrelevant])
3. Query Rewriting for dense retrieval precision
4. Fact Grounding & Hallucination Elimination ([Is-Grounded] vs [Hallucination])
"""

import os
import re
import json
import math
from typing import Dict, List, Any, Tuple, Optional

try:
    from core import intent_disambiguator, grounding_guardian
except ImportError:
    import intent_disambiguator
    import grounding_guardian

class QueryValidator:
    """Validates user queries for clarity, intent, ambiguity, and retrieval requirements."""
    
    RETRIEVAL_PATTERNS = [
        r'\b(what|where|who|when|how|why|which|list|search|find|show|fetch|inspect|check|repo|github|database|file|code|dir)\b',
        r'\b(remember|recall|preference|stack|profile|config|mcp|server|tool)\b'
    ]
    
    AMBIGUOUS_PATTERNS = [
        r'^(it|that|this|do it|fix it|run it|what about that|help|more)$',
        r'^[a-zA-Z\s]{1,4}$'
    ]

    @classmethod
    def validate_query(cls, query: str, recent_messages: List[Dict[str, str]] = None, persona: str = "fullstack") -> Dict[str, Any]:
        q_clean = query.strip()
        if not q_clean:
            return {
                "valid": False,
                "is_ambiguous": True,
                "needs_retrieval": False,
                "intent": "empty",
                "clarification_needed": True,
                "rewritten_query": "",
                "disambiguation": None
            }

        # Run full disambiguation pipeline
        disam = intent_disambiguator.disambiguator.disambiguate(q_clean, recent_messages, persona)
        q_effective = disam.get("cleaned_prompt", q_clean)

        is_ambiguous = disam.get("is_ambiguous", False) or any(re.match(p, q_effective, re.IGNORECASE) for p in cls.AMBIGUOUS_PATTERNS)
        needs_retrieval = any(re.search(p, q_effective, re.IGNORECASE) for p in cls.RETRIEVAL_PATTERNS) or len(q_effective.split()) > 3

        intent = "conversational"
        explicit_visual_requested = bool(re.search(r'\b(visualize|visualization|visual|plot|graph|simulate|simulation|animate|draw|interactive chart|visualizer)\b', q_effective, re.IGNORECASE))
        can_be_visualized = bool(re.search(r'\b(math|calculus|derivative|integral|projectile|motion|fourier|sine|cosine|curve|trigonometry|matrix|geometry|equation|physics|dijkstra|sorting|algorithm|function|pendulum|wave|gravity|orbit|gradient descent|pathfinding|neural network|quartic|parabola|harmonic|optics|electric field|vector|fourier series)\b', q_effective, re.IGNORECASE))
        
        if explicit_visual_requested and can_be_visualized:
            intent = "math_visualization_direct"
        elif can_be_visualized:
            intent = "visualizable_concept"
        elif re.search(r'\b(create|build|write|generate|make|add|fix|refactor|debug)\b', q_effective, re.IGNORECASE):
            intent = "action_build"
        elif re.search(r'\b(search|find|list|inspect|show|where|what)\b', q_effective, re.IGNORECASE):
            intent = "information_retrieval"
        elif re.search(r'\b(run|execute|test|start|kill)\b', q_effective, re.IGNORECASE):
            intent = "system_execution"

        return {
            "valid": True,
            "is_ambiguous": is_ambiguous,
            "needs_retrieval": needs_retrieval,
            "intent": intent,
            "explicit_visual_requested": explicit_visual_requested,
            "can_be_visualized": can_be_visualized,
            "clarification_needed": is_ambiguous,
            "original_query": q_clean,
            "cleaned_query": q_effective,
            "technical_prompt": disam.get("technical_prompt", q_effective),
            "disambiguation": disam,
            "rewritten_query": cls.rewrite_for_search(q_effective)
        }

    @classmethod
    def rewrite_for_search(cls, query: str) -> str:
        """Strips conversational noise and extracts high-density keywords for search."""
        noise_words = {
            "can", "you", "please", "could", "would", "tell", "me", "about", 
            "give", "i", "want", "to", "know", "hey", "b1", "gemini", "assistant"
        }
        tokens = [w for w in re.findall(r'\b[a-zA-Z0-9_-]+\b', query.lower()) if w not in noise_words]
        return " ".join(tokens) if tokens else query


class SelfReflectiveRetriever:
    """Performs self-reflective evaluation of retrieved memory facts and context."""

    @staticmethod
    def compute_relevance_score(query: str, document_text: str) -> float:
        """Computes lexical & semantic keyword overlap score between query and retrieved document."""
        if not query or not document_text:
            return 0.0
        
        q_tokens = set(re.findall(r'\b[a-zA-Z0-9_-]+\b', query.lower()))
        doc_tokens = set(re.findall(r'\b[a-zA-Z0-9_-]+\b', document_text.lower()))

        if not q_tokens or not doc_tokens:
            return 0.0

        overlap = q_tokens.intersection(doc_tokens)
        score = len(overlap) / math.sqrt(len(q_tokens) * len(doc_tokens))
        return min(1.0, score * 2.5) # Normalized threshold

    @classmethod
    def filter_and_rank(cls, query: str, context_items: List[Dict[str, Any]], threshold: float = 0.15) -> List[Dict[str, Any]]:
        """Filters context items through self-reflection relevance scoring."""
        scored_items = []
        for item in context_items:
            content = f"{item.get('category', '')} {item.get('key', '')} {item.get('value', '')} {item.get('text', '')}"
            rel_score = cls.compute_relevance_score(query, content)
            
            # Reflection metadata
            item_copy = dict(item)
            item_copy["reflection_score"] = round(rel_score, 3)
            item_copy["is_relevant"] = rel_score >= threshold
            
            if item_copy["is_relevant"]:
                scored_items.append(item_copy)

        scored_items.sort(key=lambda x: x["reflection_score"], reverse=True)
        return scored_items


class FactGroundingChecker:
    """Ensures responses are factually grounded against retrieved tool executions and RAG memories."""

    @staticmethod
    def verify_grounding(
        response_text: str, 
        evidence_logs: List[str], 
        rag_context_chunks: Optional[List[str]] = None,
        workspace_files: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Checks if key entities in response correspond with verified tool output logs."""
        report = grounding_guardian.grounding_guardian.verify_factual_grounding(
            response_text,
            evidence_logs=evidence_logs,
            rag_context_chunks=rag_context_chunks,
            workspace_files=workspace_files
        )
        return {
            "grounded": report.get("is_grounded", True),
            "confidence": report.get("grounding_score", 1.0),
            "grounding_percentage": report.get("grounding_percentage", "100%"),
            "risk_level": report.get("risk_level", "ZERO"),
            "unsupported_claims": report.get("unsupported_claims", []),
            "verified_claims": report.get("verified_claims", []),
            "evidence_count": report.get("evidence_count", 0)
        }

    @staticmethod
    def validate_code(code_text: str, target_dir: Optional[str] = None) -> Dict[str, Any]:
        """Validates code snippets against hallucinated library imports."""
        return grounding_guardian.grounding_guardian.validate_code_imports(code_text, target_dir)


# Global singleton
self_rag_engine = {
    "validator": QueryValidator,
    "retriever": SelfReflectiveRetriever,
    "grounding": FactGroundingChecker,
    "guardian": grounding_guardian.grounding_guardian
}
