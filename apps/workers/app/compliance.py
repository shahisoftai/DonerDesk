"""Compliance checklist detection + section rewrite mirrors.

These mirror the TypeScript stubs (StubChecklistDetector /
StubReportDraftGenerator.rewriteSection) so Kestra flows can call the same
logic over HTTP. Rules here are heuristic; a real LLM provider replaces them
later without changing the request/response contract.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DetectChecklistRequest(BaseModel):
    reporting_period_id: str
    project_id: str
    required_annexes: list[str] = Field(default_factory=list)
    total_indicator_count: int = 0
    verified_indicator_count: int = 0
    activities_count: int = 0
    evidence_count: int = 0
    required_evidence_count: int = 0
    section_statuses: list[dict[str, Any]] = Field(default_factory=list)


class RewriteSectionRequest(BaseModel):
    section_title: str
    content: str
    mode: str = "REWRITE"
    audience: str = "DONOR"
    instructions: str | None = None


def detect_checklist(req: DetectChecklistRequest) -> dict[str, Any]:
    items: list[dict[str, Any]] = []

    for annex in req.required_annexes:
        items.append(
            {
                "type": "MISSING_ANNEX",
                "title": f"Annex required: {annex}",
                "description": f'Donor template requires annex "{annex}". Confirm attachment before submission.',
                "severity": "MEDIUM",
            }
        )

    remaining = req.total_indicator_count - req.verified_indicator_count
    if req.total_indicator_count > 0 and remaining > 0:
        items.append(
            {
                "type": "UNVERIFIED_INDICATOR",
                "title": f"{remaining} indicator update(s) pending verification",
                "description": "M&E officer must verify indicator data before submission.",
                "severity": "HIGH",
            }
        )

    if req.activities_count == 0:
        items.append(
            {
                "type": "LATE_ACTIVITY_UPDATE",
                "title": "No activity updates submitted for this period",
                "description": "Field officers should submit at least one activity update per reporting period.",
                "severity": "HIGH",
            }
        )

    if req.evidence_count < req.required_evidence_count:
        items.append(
            {
                "type": "MISSING_EVIDENCE",
                "title": f"Only {req.evidence_count} evidence file(s) uploaded",
                "description": "Donor template and logframe require approximately {0} evidence files.".format(
                    req.required_evidence_count
                ),
                "severity": "HIGH",
            }
        )

    for sec in req.section_statuses:
        if sec.get("hasUnsupportedClaims"):
            items.append(
                {
                    "type": "UNSUPPORTED_REPORT_CLAIM",
                    "title": "Report section contains unsupported claims",
                    "description": "Review claims flagged as 'Needs source verification' before approval.",
                    "severity": "MEDIUM",
                    "relatedEntityType": "report_section",
                    "relatedEntityId": sec.get("sectionId"),
                }
            )
        if sec.get("status") == "NEEDS_EVIDENCE":
            items.append(
                {
                    "type": "INCOMPLETE_EVIDENCE_METADATA",
                    "title": "Section blocked on evidence",
                    "description": "Section cannot be drafted until supporting evidence is uploaded.",
                    "severity": "MEDIUM",
                    "relatedEntityType": "report_section",
                    "relatedEntityId": sec.get("sectionId"),
                }
            )

    return {"items": items, "model": "stub-v1"}


def _needs_verification(content: str) -> bool:
    return "[Needs verification]" in content or "[Needs source verification]" in content


def _shorten(content: str, audience: str) -> str:
    paragraphs = [p.strip() for p in content.split("\n\n")]
    out: list[str] = []
    for p in paragraphs:
        if not p:
            continue
        if p.startswith("|") or p.startswith("-") or p.startswith("1."):
            out.append(p)
            continue
        sentences = _split_sentences(p)
        if len(sentences) <= 1:
            out.append(p)
            continue
        out.append(" ".join(sentences[:2]))
    joined = "\n\n".join(out)
    if audience == "DONOR" and not joined.endswith("."):
        return f"{joined}."
    return joined


def _split_sentences(paragraph: str) -> list[str]:
    import re

    return [s for s in re.split(r"(?<=[.!?])\s+", paragraph) if s]


def rewrite_section(req: RewriteSectionRequest) -> dict[str, Any]:
    source = (req.content or "").strip()
    if not source:
        return {"content": "", "unsupportedClaims": ["Section is empty; nothing to rewrite"]}

    unsupported = (
        ["Review claims flagged for source verification"] if _needs_verification(source) else []
    )

    if req.mode == "SHORTEN":
        return {"content": _shorten(source, req.audience), "unsupportedClaims": unsupported}

    import re

    text = re.sub(r"\[Needs verification\]", "", source)
    text = re.sub(r"\[Needs source verification\]", "", text).strip()
    if req.audience == "DONOR":
        text = text.replace(" got ", " received ")
    if req.instructions and req.instructions.strip():
        text = f"{text}\n\n[Editor note: {req.instructions.strip()}]"
    return {"content": text, "unsupportedClaims": unsupported}
