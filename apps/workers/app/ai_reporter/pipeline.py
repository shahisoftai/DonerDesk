"""Pipeline orchestration — draft -> critique -> refine.

Uses LangGraph when installed; otherwise falls back to a plain sequential
runner. After the refine step, runs the deterministic artifact validators;
on hard failure the worker retries the draft step with validator output
appended, then falls back per-section.
"""
from __future__ import annotations

import hashlib
from typing import Any

from .artifact_validators import run_all
from .critique_writer import critique
from .draft_writer import build_user_prompt, draft
from .models import GeneratedSection, SectionDraftRequest, SectionDraftResponse
from .refiner import refine
from .writer_contract import system_prompt


def _response_for(section: GeneratedSection, telemetry: dict[str, Any]) -> SectionDraftResponse:
    return SectionDraftResponse(
        sectionId=section.sectionId,
        title=section.title,
        content=section.content,
        claims=section.claims,
        sourceReferences=section.sourceReferences,
        artifacts=section.artifacts,
        qa=section.qa,
        chartSpec=section.chartSpec,
        deltaFromPrior=section.deltaFromPrior,
        telemetry=telemetry,
    )


def _pipeline_sequential(req: SectionDraftRequest) -> tuple[GeneratedSection, dict[str, Any]]:
    d = draft(req)
    issues = critique(req, d)
    refined = refine(req, d, issues)
    return refined, {
        "promptHash": hashlib.sha256(system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16],
        "parseOutcome": "VALID",
        "critiqueIssues": len(issues),
    }


def _try_langgraph(req: SectionDraftRequest) -> tuple[GeneratedSection, dict[str, Any]] | None:
    try:
        from langgraph.graph import END, START, StateGraph
    except Exception:
        return None

    def node_draft(state: dict[str, Any]) -> dict[str, Any]:
        return {"draft": draft(req)}

    def node_critique(state: dict[str, Any]) -> dict[str, Any]:
        return {"issues": critique(req, state["draft"])}

    def node_refine(state: dict[str, Any]) -> dict[str, Any]:
        return {"refined": refine(req, state["draft"], state["issues"])}

    graph = StateGraph(dict)
    graph.add_node("draft", node_draft)
    graph.add_node("critique", node_critique)
    graph.add_node("refine", node_refine)
    graph.add_edge(START, "draft")
    graph.add_edge("draft", "critique")
    graph.add_edge("critique", "refine")
    graph.add_edge("refine", END)
    compiled = graph.compile()
    state = compiled.invoke({})
    refined = state["refined"]
    telemetry = {
        "promptHash": hashlib.sha256(system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16],
        "parseOutcome": "VALID",
        "critiqueIssues": len(state.get("issues", [])),
    }
    return refined, telemetry


def run_pipeline(req: SectionDraftRequest) -> tuple[GeneratedSection, dict[str, Any]]:
    """Run draft -> critique -> refine with validator self-check + retry."""
    prompt_hash = hashlib.sha256(system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16]

    last_err: Exception | None = None
    for attempt in (1, 2):
        try:
            result = _try_langgraph(req)
            if result is None:
                refined, telemetry = _pipeline_sequential(req)
            else:
                refined, telemetry = result
            telemetry.setdefault("promptHash", prompt_hash)

            # Deterministic self-check.
            v = run_all(refined, req, prior_narrative_present=bool(req.priorNarrative))
            if v.ok:
                telemetry["validatorIssues"] = []
                telemetry["parseOutcome"] = "VALID"
                return refined, telemetry

            # First hard failure: retry with validator feedback appended to the user prompt.
            telemetry["validatorIssues"] = list(v.issues)
            telemetry["parseOutcome"] = "VALIDATOR_RETRY"
            retry_user = build_user_prompt(req) + "\n\n# Validator feedback:\n" + "\n".join(f"- {i}" for i in v.issues)
            # Force a second attempt via sequential path with explicit user prompt override.
            from .llm_gateway import _chat, coerce_section, extract_json

            system = system_prompt(req.writerContractVersion)
            content, _ = _chat(system, retry_user, model=req.model)
            raw = extract_json(content)
            sections = raw.get("sections") if isinstance(raw, dict) and isinstance(raw.get("sections"), list) else None
            obj = sections[0] if sections else raw
            if isinstance(obj, dict):
                refined2 = coerce_section(obj, req.section.title)
                v2 = run_all(refined2, req, prior_narrative_present=bool(req.priorNarrative))
                if v2.ok:
                    telemetry["parseOutcome"] = "VALID"
                    telemetry["validatorIssues"] = []
                    return refined2, telemetry
                telemetry["validatorIssues"] = list(v2.issues)

            # Both attempts failed validation; degrade per-section with fallback.
            telemetry["parseOutcome"] = "VALIDATOR_FAILED"
            telemetry["usedFallback"] = True
            telemetry["fallbackReason"] = "VALIDATOR_FAILED"
            return refined, telemetry
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempt == 1:
                continue
            raise

    # Should not reach here, but keep mypy happy.
    if last_err:
        raise last_err
    raise RuntimeError("pipeline exhausted without result")
