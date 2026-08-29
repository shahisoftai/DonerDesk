"""FastAPI router for the AI Reporter.

Routes:
  GET  /v1/ai-reporter/health
  POST /v1/ai-reporter/section
  POST /v1/ai-reporter/rewrite

Behaviour preserved bit-for-bit from `apps/workers/app/ai_reporter.py`. v2
additions are additive and only present when the LLM emits them.
"""
from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter

from . import timeouts
from .llm_gateway import _chat
from .models import RewriteRequest, RewriteResponse, SectionDraftRequest, SectionDraftResponse
from .pipeline import _response_for, run_pipeline
from .writer_contract import system_prompt

router = APIRouter(prefix="/ai-reporter", tags=["ai-reporter"])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/section")
def draft_section(req: SectionDraftRequest) -> SectionDraftResponse:
    section, telemetry = run_pipeline(req)
    return _response_for(section, telemetry)


@router.post("/rewrite")
def rewrite_section(req: RewriteRequest) -> RewriteResponse:
    system = system_prompt(req.writerContractVersion)
    audience = (
        "formal, neutral, evidence-proportionate. Do not inflate results or soften caveats."
        if req.audience == "DONOR"
        else "concise, operational"
        if req.audience == "INTERNAL"
        else "plain, accessible"
    )
    instructions = f"Editor note: {req.instructions}" if req.instructions else ""
    user = (
        f"# Section rewrite request\nSection title: {req.sectionTitle}\nMode: {req.mode}\n"
        f"Audience: {audience}\n{instructions}\n\n"
        f"# Existing content:\n{req.content}\n\n"
        "Rules: preserve every fact, number, and caveat exactly; never remove a caveat or limitation; "
        "do not add outcomes, impact, or evaluative language not already stated; keep lists and tables intact.\n"
        'Return STRICT JSON: {"content":"rewritten text"}'
    )
    prompt_text = f"{system}\n\n{user}"
    prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()
    temperature = 0.1 if req.mode == "SHORTEN" else 0.3

    def _call() -> tuple[str, dict[str, Any]]:
        return _chat(system, user, model=req.model, temperature=temperature, max_tokens=2048)

    content, _ = timeouts.run_with_section_timeout(_call)
    from .llm_gateway import extract_json

    raw = extract_json(content)
    rewritten = str(raw.get("content") or "").strip() if isinstance(raw, dict) else ""
    if not rewritten:
        raise ValueError("rewrite produced empty content")
    return RewriteResponse(
        content=rewritten,
        promptHash=prompt_hash,
        responseHash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
    )
