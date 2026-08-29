"""Refiner — apply critique issues under the same retrieval manifest.

Behaviour preserved from v1 `_refine`. Exactly one pass; if no issues the
draft is returned unchanged.
"""
from __future__ import annotations

from .draft_writer import build_user_prompt
from .llm_gateway import _chat, coerce_section, extract_json
from .models import GeneratedSection, SectionDraftRequest
from .writer_contract import system_prompt
from . import timeouts


_REFINE_PROMPT = (
    "You are a precise report editor. Fix the drafted section according to the reviewer's issues. "
    "Preserve every fact, number, caveat, and source reference that is already correct. Do NOT add new facts "
    "beyond what the inputs support. Return STRICT JSON matching the section schema."
)


def refine(
    req: SectionDraftRequest,
    draft_section: GeneratedSection,
    issues: list[str],
) -> GeneratedSection:
    """Single refine pass. Returns the original draft unchanged if no issues."""
    if not issues:
        return draft_section
    system = system_prompt(req.writerContractVersion) + "\n" + _REFINE_PROMPT
    user = (
        build_user_prompt(req)
        + "\n\n# Draft to refine:\n"
        + draft_section.content
        + "\n\n# Reviewer issues:\n"
        + "\n".join(f"- {i}" for i in issues)
    )
    content, _ = timeouts.run_with_section_timeout(
        lambda: _chat(system, user, model=req.model)
    )
    try:
        raw = extract_json(content)
    except Exception:
        return draft_section
    sections = raw.get("sections") if isinstance(raw, dict) and isinstance(raw.get("sections"), list) else None
    obj = sections[0] if sections else raw
    if not isinstance(obj, dict):
        return draft_section
    try:
        return coerce_section(obj, req.section.title)
    except Exception:
        return draft_section
