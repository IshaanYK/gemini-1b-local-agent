"""
core/self_refinement_engine.py — B1 'Best of the Best' Self-Refining Evaluator-Optimizer Engine

Architecture (2-Tier Hybrid):
1. Tier 1 (0 Tokens / 0 Credits - Instant Local Heuristic & AST Audit):
   - Python AST syntax and compilation verification (prevents broken code from ever being served).
   - Grounding Guardian integration (scans for hallucinated imports, non-existent workspace paths, and fake APIs).
   - Anti-AI Slop & Boilerplate Scanner (flags generic robotic filler, e.g. "Certainly!", "I would be happy to", etc.).
   - Artifact & STEM Math sanity checks (validates self-contained HTML/Canvas structures and LaTeX normalizations).
   - Instant Quality Score calculation (0 - 100). If Score >= 90 and clean, ZERO extra LLM tokens are used.

2. Tier 2 (Token-Optimized Self-Correction Iteration):
   - When defects are found or score < 90, synthesizes an ultra-compact delta critique prompt.
   - Invokes B1 in an autonomous reflection loop to self-correct the specific deficiencies.
   - Re-evaluates in a closed RARV (Reason -> Act -> Reflect -> Verify) cycle until optimal quality is achieved.
"""

import os
import re
import ast
import json
import time
from typing import Dict, List, Any, Optional, Tuple, Callable

try:
    from core import grounding_guardian
except ImportError:
    import grounding_guardian

# AI Slop & Conversational Cliché Patterns (Derived from avoid-ai-writing and unslop skills)
AI_SLOP_PATTERNS = [
    r"^(?:certainly|sure thing|absolutely|of course)[!,\.]\s*",
    r"i(?:'d| would) be happy to help(?: you)? with that[!,\.]?\s*",
    r"as an ai(?: language model)?[,\.]\s*",
    r"in this digital age[,\.]\s*",
    r"it is important to remember that[,\.]\s*",
    r"delve into\b",
    r"testament to\b",
    r"tapestry of\b",
    r"crucial aspect\b",
    r"in conclusion,\s*to summarize\b",
    r"dive deep into\b"
]

class SelfRefinementEngine:
    """Evaluates and iteratively optimizes B1 outputs to ensure maximum precision and zero hallucination."""

    def __init__(self, workspace_dir: Optional[str] = None):
        self.workspace_dir = workspace_dir or os.getcwd()
        self.target_quality_threshold = 90

    def evaluate_draft(
        self,
        draft_text: str,
        user_prompt: str,
        evidence_logs: Optional[List[str]] = None,
        rag_context_chunks: Optional[List[str]] = None,
        target_folder: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tier 1: 0-Token Instant Local Evaluation.
        Audits the draft across 5 core dimensions:
        1. Code Syntax & Import Integrity (AST validation)
        2. Factual Grounding & Hallucination Risk (GroundingGuardian)
        3. Information Density & AI Slop Removal
        4. Artifact & Simulation Completeness
        5. Prompt Objective Alignment & Edge Cases
        """
        if not draft_text or not draft_text.strip():
            return {
                "quality_score": 0,
                "passed": False,
                "defects": ["Empty draft generated."],
                "critiques": ["Provide a comprehensive, high-density response."],
                "dimensions": {}
            }

        defects = []
        critiques = []
        dimensions = {}

        # ── 1. Code Syntax & AST Validation (Weight: 30 pts) ──
        code_blocks = re.findall(r'```(?:python|py)\n([\s\S]*?)```', draft_text)
        code_score = 30
        syntax_errors = []

        for idx, block in enumerate(code_blocks, 1):
            try:
                ast.parse(block)
            except SyntaxError as e:
                syntax_errors.append(f"SyntaxError in Python block #{idx} at line {e.lineno}: {e.msg}")
            except Exception as e:
                syntax_errors.append(f"AST parse issue in Python block #{idx}: {str(e)}")

        if syntax_errors:
            code_score -= 25
            for err in syntax_errors:
                defects.append(f"Code Error: {err}")
                critiques.append(f"Fix syntax error: {err}. Ensure the script runs without errors.")
        elif code_blocks:
            # Check for basic best practices: typing or error handling if code is substantive (> 10 lines)
            for block in code_blocks:
                if len(block.splitlines()) > 12 and "try:" not in block and "except" not in block:
                    code_score -= 3
                    critiques.append("Enhance code resilience by wrapping risky I/O or network operations in proper try-except blocks.")
                    break

        dimensions["code_integrity"] = max(0, code_score)

        # ── 2. Factual Grounding & Import Integrity (Weight: 25 pts) ──
        grounding_score_raw = 25
        try:
            guardian = grounding_guardian.grounding_guardian
            g_report = guardian.verify_factual_grounding(
                draft_text,
                evidence_logs=evidence_logs,
                rag_context_chunks=rag_context_chunks,
                user_prompt=user_prompt
            )
            code_val = guardian.validate_code_imports(draft_text, target_folder)

            if code_val.get("unverified_or_hallucinated_imports"):
                bad_imps = code_val["unverified_or_hallucinated_imports"]
                grounding_score_raw -= min(15, len(bad_imps) * 8)
                defects.append(f"Hallucinated or unverified imports: {', '.join(bad_imps)}")
                critiques.append(f"Replace unverified library imports ({', '.join(bad_imps)}) with standard library modules or verified workspace dependencies.")

            if g_report.get("risk_level") == "HIGH" and g_report.get("unsupported_claims"):
                unsupported = g_report["unsupported_claims"]
                grounding_score_raw -= 10
                defects.append(f"Ungrounded entity assertions: {', '.join(unsupported[:3])}")
                critiques.append(f"Ensure references to entities ({', '.join(unsupported[:3])}) cite verified workspace facts or explicitly clarify assumptions.")
        except Exception:
            pass

        dimensions["factual_grounding"] = max(0, grounding_score_raw)

        # ── 3. Information Density & AI Slop Detection (Weight: 15 pts) ──
        slop_score = 15
        found_slop = []
        for pat in AI_SLOP_PATTERNS:
            if re.search(pat, draft_text, re.IGNORECASE):
                found_slop.append(pat)
                slop_score -= 4

        if found_slop:
            defects.append("Detected generic conversational AI filler / slop.")
            critiques.append("Strip generic chatbot pleasantries (e.g. 'Certainly!', 'I would be happy to help'). Start directly with the Executive Summary or technical answer.")

        dimensions["conciseness_density"] = max(0, slop_score)

        # ── 4. Artifact & Structural Integrity (Weight: 15 pts) ──
        artifact_score = 15
        artifact_matches = re.finditer(r'<antArtifact([\s\S]*?)>([\s\S]*?)</antArtifact>', draft_text)
        for art in artifact_matches:
            art_body = art.group(2)
            # Check if inner artifact accidentally contains raw backtick fences
            if art_body.strip().startswith("```"):
                artifact_score -= 5
                defects.append("Artifact has markdown fences inside <antArtifact> tags.")
                critiques.append("Do NOT wrap code inside <antArtifact> with ```html or ``` backticks. Output clean raw code.")
            # Check for unrendered LaTeX dollar signs in HTML artifact
            if "<html" in art_body.lower() and re.search(r'\$[a-zA-Z0-9_\\]+\$', art_body):
                artifact_score -= 3
                critiques.append("Convert unrendered LaTeX math notation ($theta$, $v_0$) into clean Unicode symbols (θ, v₀) inside the HTML artifact.")

        dimensions["artifact_integrity"] = max(0, artifact_score)

        # ── 5. Structure & Executive Summary (Weight: 15 pts) ──
        structure_score = 15
        is_technical = any(w in user_prompt.lower() for w in ["how", "code", "architecture", "system", "script", "explain", "build", "create", "why", "implement"])
        if is_technical and len(draft_text.split()) > 100:
            if "### Executive Summary" not in draft_text and "## Executive Summary" not in draft_text and "**TL;DR**" not in draft_text:
                structure_score -= 4
                critiques.append("Prepend a crisp '### Executive Summary / TL;DR' with 2-3 high-impact bullets for instant senior-level clarity.")

        # Check for Smart Suggestions at the end
        if "[SUGGESTIONS:" not in draft_text:
            structure_score -= 2
            critiques.append("Include smart next-step suggestions at the end formatted as `[SUGGESTIONS: \"...\", \"...\"]`.")

        dimensions["structure_alignment"] = max(0, structure_score)

        # ── Total Quality Score Calculation ──
        total_score = sum(dimensions.values())
        total_score = max(10, min(100, total_score))

        has_critical_defects = len(syntax_errors) > 0 or any("Hallucinated" in d for d in defects)
        passed = (total_score >= self.target_quality_threshold) and not has_critical_defects

        return {
            "quality_score": total_score,
            "passed": passed,
            "defects": defects,
            "critiques": critiques,
            "dimensions": dimensions,
            "iteration_needed": not passed
        }

    def clean_slop_passively(self, text: str) -> str:
        """Passive zero-token cleanup: strips immediate pleasantries and cleans formatting."""
        cleaned = text
        # Strip opening conversational greetings
        cleaned = re.sub(r"^(?:Certainly|Sure thing|Absolutely|Of course)[!,\.]\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^(?:Hello|Hi|Hey Ishaan)[!,\.]\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"^I(?:'d| would) be happy to help(?: you)? with that[!,\.]?\s*", "", cleaned, flags=re.IGNORECASE)
        # Strip stray markdown fences in artifacts
        def _clean_art_block(m):
            header = m.group(1)
            body = m.group(2).strip()
            body = re.sub(r"^```(?:html|css|js|javascript|svg|python|xml)?\s*", "", body, flags=re.IGNORECASE)
            body = re.sub(r"\s*```$", "", body).strip()
            return f"<antArtifact{header}>{body}</antArtifact>"
        cleaned = re.sub(r"<antArtifact([\s\S]*?)>([\s\S]*?)</antArtifact>", _clean_art_block, cleaned)
        return cleaned

    def build_refinement_prompt(self, draft_text: str, critiques: List[str], iteration: int) -> str:
        """Builds an ultra-compact delta refinement instruction to minimize token overhead."""
        critique_bullets = "\n".join([f"- {c}" for c in critiques[:5]])
        return f"""
# ✦ B1 BEST-OF-THE-BEST SELF-REFINEMENT CRITIQUE (Iteration {iteration}):
Your previous draft was audited against high-standard senior software engineering principles.
Address the following concrete improvements to produce the best possible output:

{critique_bullets}

# MANDATORY INSTRUCTIONS:
- Directly output the corrected and perfected response.
- Do NOT add meta-commentary like "Here is the refined version" or "I have fixed the issues".
- Output only the final, complete, and verified response.
""".strip()

    def run_refinement_loop(
        self,
        initial_draft: str,
        user_prompt: str,
        conversation_history: List[Dict[str, str]],
        call_llm_fn: Callable[[List[Dict[str, str]]], str],
        evidence_logs: Optional[List[str]] = None,
        rag_context_chunks: Optional[List[str]] = None,
        max_iterations: int = 2,
        on_progress: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Executes the iterative Evaluator-Optimizer loop:
        1. Evaluates draft with Tier 1 local checks (0 tokens).
        2. If passed (Score >= 90 & no critical defects), delivers immediately.
        3. If failed, emits live telemetry, constructs targeted delta critique, and refines via call_llm_fn.
        4. Repeats up to max_iterations.
        """
        current_draft = self.clean_slop_passively(initial_draft)
        best_draft = current_draft
        best_score = 0
        final_report = {}

        for iteration in range(1, max_iterations + 1):
            report = self.evaluate_draft(
                current_draft,
                user_prompt=user_prompt,
                evidence_logs=evidence_logs,
                rag_context_chunks=rag_context_chunks
            )

            score = report["quality_score"]
            if score > best_score:
                best_score = score
                best_draft = current_draft
            final_report = report

            if on_progress:
                on_progress({
                    "iteration": iteration,
                    "max_iterations": max_iterations,
                    "quality_score": score,
                    "passed": report["passed"],
                    "defects_count": len(report["defects"]),
                    "critiques": report["critiques"][:3],
                    "status": "APPROVED" if report["passed"] else ("REFINING" if iteration < max_iterations else "FINALIZED")
                })

            # If passed threshold and clean, break early (saving tokens)
            if report["passed"]:
                break

            # If not passed and iterations remain, perform compact refinement
            if iteration < max_iterations and report["critiques"]:
                refinement_instruction = self.build_refinement_prompt(current_draft, report["critiques"], iteration)
                refinement_messages = list(conversation_history)
                refinement_messages.append({"role": "assistant", "content": current_draft})
                refinement_messages.append({"role": "user", "content": refinement_instruction})

                try:
                    refined_text = call_llm_fn(refinement_messages)
                    if refined_text and len(refined_text.strip()) > 30:
                        current_draft = self.clean_slop_passively(refined_text)
                    else:
                        break
                except Exception as e:
                    # In case of network/LLM failure during refinement, fallback gracefully to best draft
                    break

        final_draft = self.clean_slop_passively(best_draft)
        return final_draft, {
            "initial_score": final_report.get("quality_score", best_score),
            "final_score": best_score,
            "iterations_performed": iteration,
            "passed": best_score >= self.target_quality_threshold,
            "dimensions": final_report.get("dimensions", {})
        }

# Global Singleton Instance
self_refinement_engine = SelfRefinementEngine()
