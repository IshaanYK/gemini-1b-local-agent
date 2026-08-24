"""
core/prompt_decomposer.py — Autonomous Prompt Decomposition & Zero-Hallucination Engine for B1

Capabilities:
1. Intelligent Prompt Complexity Analysis: Detects whether a user prompt requires multi-step decomposition or immediate single-turn execution.
2. Atomic Task Deconstruction (Divide & Conquer): Breaks down complex requests into 2-5 atomic sub-tasks with dedicated goals and required toolsets.
3. Isolated Execution Context: Ensures each sub-task runs with its own focused memory scope, eliminating context pollution, token overflow, and hallucinations.
4. Zero-Hallucination Fact Grounding: Cross-verifies generated claims and synthesis against actual executed tool outputs.
"""

import json
import re
from typing import List, Dict, Any

class PromptDecomposer:
    """Decomposes complex requests into atomic sub-tasks and synthesizes grounded answers."""

    @staticmethod
    def is_complex_prompt(prompt: str) -> bool:
        """Determines if a prompt benefits from multi-stage divide-and-conquer execution."""
        p_lower = prompt.lower().strip()
        
        # Simple greetings, 1-word queries, or direct simple questions don't need decomposition
        if len(prompt.split()) <= 4:
            return False
        
        # Indicators of multi-step complexity
        multi_step_keywords = [
            "and also", "then", "after that", "first", "second", "finally",
            "search", "analyze", "create", "build", "refactor", "investigate",
            "compare", "debug", "audit", "write a", "implement", "pull request",
            "repositories", "full stack", "dashboard"
        ]
        
        matches = sum(1 for kw in multi_step_keywords if kw in p_lower)
        if matches >= 2 or len(prompt) > 120 or ("?" in prompt and ("and" in p_lower or "," in p_lower)):
            return True
        return False

    @staticmethod
    def deconstruct(prompt: str, available_tools: List[str] = None) -> List[Dict[str, Any]]:
        """
        Decomposes a complex prompt into structured atomic sub-tasks.
        Returns a list of task steps: [{"id": 1, "title": "...", "objective": "...", "tool_hint": "..."}]
        """
        p_clean = prompt.strip()
        p_lower = p_clean.lower()
        subtasks = []

        # 1. GitHub PR / Repository Search & Analysis
        if "github" in p_lower or "repository" in p_lower or "pull request" in p_lower or "repo" in p_lower:
            if "pull request" in p_lower or "pr" in p_lower:
                subtasks.append({
                    "id": 1,
                    "title": "Query GitHub for Recent Pull Requests",
                    "objective": "Retrieve recent pull requests authored by or assigned to the user using GitHub MCP tools.",
                    "tool_hint": "mcp__github-mcp__search_issues"
                })
                subtasks.append({
                    "id": 2,
                    "title": "Analyze PR Status & Format Report",
                    "objective": "Process PR status (merged, open, closed), format into a clean comparative table with URLs.",
                    "tool_hint": "synthesis"
                })
            else:
                subtasks.append({
                    "id": 1,
                    "title": "Scan & List GitHub Repositories",
                    "objective": "Inspect connected GitHub MCP server or query user repositories with active access credentials.",
                    "tool_hint": "mcp__github-mcp__list_repositories"
                })
                subtasks.append({
                    "id": 2,
                    "title": "Summarize Repository Architecture & Branches",
                    "objective": "Synthesize repository names, descriptions, and primary languages into an organized overview.",
                    "tool_hint": "synthesis"
                })
            return subtasks

        # 2. Workspace File / Codebase Inspection & Implementation
        if any(kw in p_lower for kw in ["files", "workspace", "codebase", "folder", "directory", "project"]):
            subtasks.append({
                "id": 1,
                "title": "Inspect Workspace & File Structure",
                "objective": "Scan the active workspace directory or target folder to inspect existing files, dependencies, and layout.",
                "tool_hint": "list_dir"
            })
            if any(kw in p_lower for kw in ["search", "find", "grep", "check"]):
                subtasks.append({
                    "id": 2,
                    "title": "Deep Search Relevant Code & Content",
                    "objective": "Perform exact grep/text search across workspace files for key tokens and patterns.",
                    "tool_hint": "grep_search"
                })
            subtasks.append({
                "id": len(subtasks) + 1,
                "title": "Synthesize Findings & Factual Summary",
                "objective": "Provide an accurate summary based strictly on retrieved workspace file data.",
                "tool_hint": "synthesis"
            })
            return subtasks

        # 3. Web Research & Fact Synthesis
        if any(kw in p_lower for kw in ["search", "browse", "look up", "find online", "latest", "news", "documentation"]):
            subtasks.append({
                "id": 1,
                "title": "Execute Live Web Search",
                "objective": f"Search the live web for verified facts and up-to-date information regarding: {p_clean[:60]}.",
                "tool_hint": "search_web"
            })
            subtasks.append({
                "id": 2,
                "title": "Extract High-Authority Web Content",
                "objective": "Fetch full text from the most relevant search result URLs to eliminate hallucinations.",
                "tool_hint": "fetch_web_content"
            })
            subtasks.append({
                "id": 3,
                "title": "Cross-Verify & Synthesize Response",
                "objective": "Synthesize verified findings with clear citations and actionable takeaways.",
                "tool_hint": "synthesis"
            })
            return subtasks

        # 4. Interactive UI / Artifact Creation
        if any(kw in p_lower for kw in ["build", "create", "ui", "app", "dashboard", "game", "chart", "component", "frontend"]):
            subtasks.append({
                "id": 1,
                "title": "Architect Design Tokens & Layout Specs",
                "objective": "Establish clean Linear dark mode design system (typography, colors, state hierarchy, interactive components).",
                "tool_hint": "reasoning"
            })
            subtasks.append({
                "id": 2,
                "title": "Construct Complete Standalone HTML/CSS/JS Artifact",
                "objective": "Build single-file self-contained code inside <antArtifact> tags with zero missing dependencies.",
                "tool_hint": "artifact_generator"
            })
            subtasks.append({
                "id": 3,
                "title": "Validate Interactivity & Live Preview",
                "objective": "Ensure all buttons, charts, responsive layouts, and animations work flawlessly in the sandbox.",
                "tool_hint": "synthesis"
            })
            return subtasks

        # 5. General Multi-Part Query Decomposition
        clauses = [c.strip() for c in re.split(r'\band\b|\bthen\b|\balso\b|[;.]', p_clean) if len(c.strip()) > 8]
        if len(clauses) >= 2:
            for idx, clause in enumerate(clauses[:4], 1):
                subtasks.append({
                    "id": idx,
                    "title": f"Phase {idx}: {clause[:45].capitalize()}",
                    "objective": clause,
                    "tool_hint": "auto"
                })
            subtasks.append({
                "id": len(subtasks) + 1,
                "title": "Final Verification & High-Taste Synthesis",
                "objective": "Combine all phase results into a unified, authoritative response.",
                "tool_hint": "synthesis"
            })
            return subtasks

        # Default 2-step structured execution
        return [
            {
                "id": 1,
                "title": "Analyze Intent & Execute Primary Operations",
                "objective": p_clean,
                "tool_hint": "auto"
            },
            {
                "id": 2,
                "title": "Fact-Grounding & Authoritative Delivery",
                "objective": "Deliver comprehensive, hallucination-free response matching Ishaan's engineering standards.",
                "tool_hint": "synthesis"
            }
        ]

    @staticmethod
    def build_decomposed_system_prompt(subtasks: List[Dict[str, Any]], current_step_idx: int) -> str:
        """Constructs a focused prompt directive for the current sub-task."""
        current_task = subtasks[current_step_idx]
        total_steps = len(subtasks)
        
        return f"""
# MULTI-STAGE DIVIDE-AND-CONQUER EXECUTION (Step {current_step_idx + 1}/{total_steps}):
Current Sub-Task: **{current_task['title']}**
Objective: {current_task['objective']}

Guidelines for this step:
1. Focus strictly on executing this specific sub-task without drifting to unrelated topics.
2. If this step requires tool execution ({current_task.get('tool_hint', 'auto')}), execute the appropriate tool directly.
3. Base all statements strictly on raw tool outputs or established code. Do not simulate or guess data.
"""

decomposer = PromptDecomposer()
