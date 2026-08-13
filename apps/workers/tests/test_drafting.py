from app.drafting import DraftSectionRequest, draft_section


def test_draft_executive_summary() -> None:
    req = DraftSectionRequest(
        section_title="Executive Summary",
        project_name="Project A",
        donor_name="Donor",
        report_type="NARRATIVE_REPORT",
        activities=[{"id": "a1", "title": "Training"}],
    )
    body = draft_section(req)
    assert "Project A" in body["content"]
    assert body["source_references"][0]["id"] == "a1"
    assert body["unsupported_claims"] == []


def test_draft_unknown_section_returns_placeholder() -> None:
    req = DraftSectionRequest(
        section_title="Anything Else",
        project_name="P",
        donor_name="D",
        report_type="NARRATIVE_REPORT",
    )
    body = draft_section(req)
    assert body["content"] == "[Section content will be drafted from logframe, indicators, activities, and evidence.]"
