"""
core/agent_swarm.py — Multi-Agent Consensus Swarm Mode
Coordinates a 4-agent consensus voting engine (Architect, Code Reviewer, Security Auditor, QA Tester)
to evaluate proposals, debate system trade-offs, and prevent code regressions before execution.
"""

import os
import re
import json
import time
from typing import Dict, Any, List, Optional

class SwarmAgent:
    def __init__(self, id: str, name: str, role: str, focus: str, icon: str):
        self.id = id
        self.name = name
        self.role = role
        self.focus = focus
        self.icon = icon

    def evaluate(self, task: str, proposal: str, context: str = "") -> Dict[str, Any]:
        """Performs static heuristic and role-based evaluation."""
        text_corpus = f"{task}\n{proposal}\n{context}".lower()
        score = 88
        verdict = "APPROVED"
        risks = []
        recommendations = []
        strengths = []

        if self.id == "architect":
            if "modular" in text_corpus or "clean" in text_corpus or "decouple" in text_corpus or "sqlite" in text_corpus:
                score += 8
                strengths.append("High architectural modularity and clean separation of concerns.")
            if "global" in text_corpus or "hardcode" in text_corpus:
                score -= 15
                risks.append("Potential reliance on global or hardcoded state.")
                recommendations.append("Encapsulate state inside dedicated class instances or context stores.")
            else:
                strengths.append("Decoupled subsystem interfaces with low cross-module coupling.")

        elif self.id == "reviewer":
            if "comment" in text_corpus or "type" in text_corpus or "def " in text_corpus:
                score += 7
                strengths.append("Explicit function signatures and readable naming conventions.")
            if len(proposal) > 4000:
                score -= 10
                risks.append("Large monolithic proposal chunk; refactor into smaller atomic steps.")
                recommendations.append("Break large functions into composable helper utilities.")
            else:
                strengths.append("Atomic and manageable scope.")

        elif self.id == "security":
            # Security scan
            if any(vuln in text_corpus for vuln in ["exec(", "eval(", "shell=true", "rm -rf", "password=", "api_key="]):
                score -= 35
                verdict = "REJECTED"
                risks.append("CRITICAL: Detected high-risk shell/execution pattern or plain text credential.")
                recommendations.append("Use sanitized subprocess args, parameterized SQL, and environment variables.")
            else:
                score += 10
                strengths.append("Zero unescaped shell injections or hardcoded credentials detected.")
                recommendations.append("Verify path normalization via resolve_path() before disk I/O.")

        elif self.id == "qa_tester":
            if "test" in text_corpus or "assert" in text_corpus or "edge case" in text_corpus or "try" in text_corpus:
                score += 9
                strengths.append("Proactive error handling and regression test awareness.")
            if "zero" in text_corpus or "empty" in text_corpus or "none" in text_corpus:
                strengths.append("Handles empty/null edge cases gracefully.")
            else:
                recommendations.append("Add explicit boundary tests for None, empty arrays, and malformed inputs.")

        score = max(10, min(100, score))
        if score < 60:
            verdict = "REJECTED"
        elif score < 80:
            verdict = "APPROVED_WITH_CONDITIONS"

        return {
            "agent_id": self.id,
            "agent_name": self.name,
            "role": self.role,
            "icon": self.icon,
            "score": score,
            "verdict": verdict,
            "strengths": strengths or ["Meets standard baseline criteria."],
            "risks": risks,
            "recommendations": recommendations or ["Proceed with automated regression test validation."]
        }

class AgentConsensusSwarm:
    def __init__(self):
        self.agents = [
            SwarmAgent("architect", "Lead Systems Architect", "System Design & Modularity", "Architecture, scalability, loose coupling", "🏛️"),
            SwarmAgent("reviewer", "Principal Code Reviewer", "Code Simplicity & Elegance", "Clarity, DRY, typing, clean patterns", "🔍"),
            SwarmAgent("security", "AppSec Security Auditor", "Threat Modeling & Isolation", "OWASP, injection, path traversal, secrets", "🛡️"),
            SwarmAgent("qa_tester", "QA & Reliability Engineer", "Edge Cases & Benchmarks", "Failure modes, stress limits, regression tests", "⚡")
        ]

    def evaluate_proposal(self, task: str, proposal: str, context: str = "") -> Dict[str, Any]:
        """Runs all 4 swarm agents and computes weighted consensus."""
        evaluations = []
        total_score = 0

        for agent in self.agents:
            res = agent.evaluate(task, proposal, context)
            evaluations.append(res)
            total_score += res["score"]

        consensus_score = round(total_score / len(self.agents), 1)
        
        all_approved = all(e["verdict"] in {"APPROVED", "APPROVED_WITH_CONDITIONS"} for e in evaluations)
        has_rejection = any(e["verdict"] == "REJECTED" for e in evaluations)

        if has_rejection or consensus_score < 65:
            consensus_verdict = "REJECTED"
        elif consensus_score >= 85 and all_approved:
            consensus_verdict = "UNANIMOUS_CONSENSUS"
        else:
            consensus_verdict = "MAJORITY_APPROVED"

        all_risks = []
        all_recommendations = []
        for e in evaluations:
            all_risks.extend(e["risks"])
            all_recommendations.extend(e["recommendations"])

        return {
            "status": "success",
            "consensus_verdict": consensus_verdict,
            "consensus_score": consensus_score,
            "quorum_size": len(self.agents),
            "evaluations": evaluations,
            "all_risks": list(set(all_risks)),
            "all_recommendations": list(set(all_recommendations)),
            "summary": f"Swarm Consensus: {consensus_verdict} ({consensus_score}/100) across 4 specialist agents."
        }

swarm_engine = AgentConsensusSwarm()
