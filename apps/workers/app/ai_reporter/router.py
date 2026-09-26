"""FastAPI router for the AI Reporter.

Routes:
  GET  /v1/ai-reporter/health
  POST /v1/ai-reporter/section
  POST /v1/ai-reporter/rewrite
"""
from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter

from . import timeouts
from .artifact_validators import find_banned_phrases
from .grounding import normalise_number, ungrounded_numbers, extract_numbers
from .llm_gateway import _chat, extract_json
from .models import RewriteRequest, RewriteResponse, SectionDraftRequest, SectionDraftResponse
from .pipeline import _response_for, run_pipeline
from .writer_contract import system_prompt

router = APIRouter(prefix="/ai-reporter", tags=["ai-reporter"])

_AUDIENCE = {
    "DONOR": "formal, neutral, evidence-proportionate. Do not inflate results or soften caveats.",
    "INTERNAL": "concise, operational",
}
_MODE = {
    "REWRITE": "Improve clarity and donor voice (active voice, result-first sentences, plain words) without changing any fact.",
    "SHORTEN": "Cut length by roughly a third: remove repetition and filler first; keep every figure, caveat, list, and table.",
}


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/section")
def draft_section(req: SectionDraftRequest) -> SectionDraftResponse:
    section, telemetry = run_pipeline(req)
    return _response_for(section, telemetry)


def rewrite_issues(original: str, rewritten: str) -> list[str]:
    """A rewrite may drop numbers (SHORTEN) but never add or alter one, and
    must not introduce inflated phrasing the original did not have."""
    allowed = {normalise_number(n) for n in extract_numbers(original)}
    issues: list[str] = []
    added = ungrounded_numbers(rewritten, allowed)
    if added:
        issues.append(f"Numbers {', '.join(added)} are not in the original text; restore the original figures exactly.")
    new_banned = set(find_banned_phrases(rewritten)) - set(find_banned_phrases(original))
    if new_banned:
        issues.append(f"Remove inflated phrasing: {', '.join(sorted(new_banned))}.")
    return issues


@router.post("/rewrite")
def rewrite_section(req: RewriteRequest) -> RewriteResponse:
    system = system_prompt(req.writerContractVersion)
    audience = _AUDIENCE.get(req.audience, "plain, accessible")
    instructions = f"Editor note: {req.instructions}" if req.instructions else ""
    base_user = (
        f"# Section rewrite request\nSection title: {req.sectionTitle}\nMode: {req.mode}\n"
        f"Goal: {_MODE.get(req.mode, _MODE['REWRITE'])}\n"
        f"Audience: {audience}\n{instructions}\n\n"
        f"# Existing content:\n{req.content}\n\n"
        "Rules: preserve every fact, number, and caveat exactly; never remove a caveat or limitation; "
        "do not add outcomes, impact, or evaluative language not already stated; keep lists and tables intact.\n"
        'Return STRICT JSON: {"content":"rewritten text"}'
    )
    prompt_hash = hashlib.sha256(f"{system}\n\n{base_user}".encode("utf-8")).hexdigest()
    temperature = 0.1 if req.mode == "SHORTEN" else 0.3

    user = base_user
    for attempt in (1, 2):

        def _call() -> tuple[str, dict[str, Any]]:
            return _chat(system, user, model=req.model, temperature=temperature, max_tokens=2048)

        content, _ = timeouts.run_with_section_timeout(_call)
        raw = extract_json(content)
        rewritten = str(raw.get("content") or "").strip() if isinstance(raw, dict) else ""
        if not rewritten:
            raise ValueError("rewrite produced empty content")
        issues = rewrite_issues(req.content, rewritten)
        if not issues:
            return RewriteResponse(
                content=rewritten,
                promptHash=prompt_hash,
                responseHash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
            )
        user = base_user + "\n\n# Your previous rewrite broke the rules:\n" + "\n".join(f"- {i}" for i in issues)
    # Both attempts altered facts: refuse, so the API keeps the editor's text
    # (via its deterministic rewrite fallback) instead of shipping new numbers.
    raise ValueError("rewrite changed figures or added inflated phrasing twice")
