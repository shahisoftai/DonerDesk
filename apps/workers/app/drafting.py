"""Report section drafting stub for the DonorDesk workers."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DraftSectionRequest(BaseModel):
    section_title: str
    project_name: str
    donor_name: str
    report_type: str
    template_sections: list[dict[str, Any]] = Field(default_factory=list)
    logframe_summary: str = ""
    indicator_summary: list[dict[str, Any]] = Field(default_factory=list)
    activities: list[dict[str, Any]] = Field(default_factory=list)
    evidence_by_activity: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    evidence_by_indicator: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)


def draft_section(req: DraftSectionRequest) -> dict[str, Any]:
    title = req.section_title.lower()
    if "executive summary" in title:
        content = (
            f"This {req.report_type.lower().replace('_', ' ')} report summarises the implementation "
            f"progress of {req.project_name} funded by {req.donor_name}. "
            f"During the reporting period, {len(req.activities)} activities were completed."
        )
        refs: list[dict[str, str]] = []
        if req.activities:
            first = req.activities[0]
            refs.append({"type": "activity", "id": str(first.get("id", "")), "label": str(first.get("title", ""))})
        return {"title": req.section_title, "content": content, "source_references": refs, "unsupported_claims": []}
    if "indicator progress" in title:
        rows = [
            "| Code | Indicator | Baseline | Target | Period | Cumulative |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for ind in req.indicator_summary:
            rows.append(
                f"| {ind.get('code', '')} | {ind.get('name', '')} | {ind.get('baseline', '')} | "
                f"{ind.get('target', '')} | {ind.get('periodAchievement', '')} {ind.get('unit', '') or ''} | "
                f"{ind.get('cumulativeAchievement', '')} {ind.get('unit', '') or ''} |"
            )
        content = "\n".join(rows) if len(rows) > 1 else "No indicators yet."
        refs = [
            {"type": "indicator", "id": str(ind.get("code", "")), "label": str(ind.get("name", ""))}
            for ind in req.indicator_summary
        ]
        return {"title": req.section_title, "content": content, "source_references": refs, "unsupported_claims": []}
    if "annex" in title:
        refs = []
        for items in req.evidence_by_activity.values():
            for e in items:
                refs.append({"type": "evidence", "id": str(e.get("id", "")), "label": str(e.get("title", ""))})
        return {
            "title": req.section_title,
            "content": "Refer to the evidence pack attached to this report for the full annex list.",
            "source_references": refs,
            "unsupported_claims": ["No evidence attached yet"] if not refs else [],
        }
    return {
        "title": req.section_title,
        "content": "[Section content will be drafted from logframe, indicators, activities, and evidence.]",
        "source_references": [],
        "unsupported_claims": [],
    }
