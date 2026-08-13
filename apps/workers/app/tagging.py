"""Heuristic evidence tagging, mirroring the TypeScript StubEvidenceTagger.

Rules (keywords, confidences, sensitive terms, match prefixes) are loaded from
the shared strategy so this service cannot drift from the TypeScript API.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from ._strategy_data import (
    ACTIVITY_TITLE_MATCH_PREFIX,
    EVIDENCE_KEYWORDS,
    INDICATOR_NAME_MATCH_PREFIX,
    SENSITIVE_KEYWORDS,
)


class SuggestTagsRequest(BaseModel):
    file_name: str
    file_type: str
    extracted_text: str | None = None
    existing_activities: list[dict[str, Any]] = Field(default_factory=list)
    existing_indicators: list[dict[str, Any]] = Field(default_factory=list)


def suggest_tags(req: SuggestTagsRequest) -> dict[str, Any]:
    haystack = f"{req.file_name}\n{req.extracted_text or ''}".lower()
    matched: tuple[str, str] | None = None
    for rule in EVIDENCE_KEYWORDS:
        if rule["keyword"] in haystack:
            if matched is None or rule["confidence"] == "HIGH":
                matched = (rule["evidenceType"], rule["confidence"])

    tags: list[dict[str, Any]] = [
        {
            "field": "evidenceType",
            "value": matched[0] if matched else "OTHER",
            "confidence": matched[1] if matched else "LOW",
            "accepted": False,
        }
    ]

    for activity in req.existing_activities[:5]:
        if (activity.get("title") or "").lower()[:ACTIVITY_TITLE_MATCH_PREFIX] in haystack:
            tags.append({"field": "activityId", "value": activity["id"], "confidence": "MEDIUM", "accepted": False})
            break

    for ind in req.existing_indicators[:5]:
        code = (ind.get("code") or "").lower()
        name = (ind.get("name") or "").lower()[:INDICATOR_NAME_MATCH_PREFIX]
        if (code and code in haystack) or (name and name in haystack):
            tags.append({"field": "indicatorId", "value": ind["id"], "confidence": "MEDIUM", "accepted": False})
            break

    hits = [kw for kw in SENSITIVE_KEYWORDS if kw in haystack]
    warning = (
        "This file may contain sensitive personal data ("
        + ", ".join(hits[:3])
        + "). Please verify access level before sharing or exporting."
    ) if hits else None

    return {
        "summary": "Suggested classification based on filename and extracted text.",
        "tags": tags,
        "sensitivityWarning": warning,
        "model": "stub-v1",
    }
