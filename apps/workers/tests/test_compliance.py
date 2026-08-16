from app.compliance import DetectChecklistRequest, RewriteSectionRequest, detect_checklist, rewrite_section


def test_detects_annex_and_indicator_gaps() -> None:
    body = detect_checklist(
        DetectChecklistRequest(
            reporting_period_id="p1",
            project_id="prj1",
            required_annexes=["Financial Report"],
            total_indicator_count=3,
            verified_indicator_count=1,
        )
    )
    types = {item["type"] for item in body["items"]}
    assert "MISSING_ANNEX" in types
    assert "UNVERIFIED_INDICATOR" in types
    assert body["model"] == "stub-v1"


def test_no_items_when_everything_covered() -> None:
    body = detect_checklist(
        DetectChecklistRequest(
            reporting_period_id="p1",
            project_id="prj1",
            total_indicator_count=2,
            verified_indicator_count=2,
            activities_count=3,
            evidence_count=8,
            required_evidence_count=5,
        )
    )
    assert body["items"] == []


def test_shorten_keeps_first_two_sentences() -> None:
    body = rewrite_section(
        RewriteSectionRequest(
            section_title="Achievements",
            content="We trained forty farmers. They adopted new practices. Follow-up visits were conducted.",
            mode="SHORTEN",
            audience="DONOR",
        )
    )
    assert "Follow-up visits" not in body["content"]
    assert body["unsupportedClaims"] == []


def test_rewrite_flags_verification_needed() -> None:
    body = rewrite_section(
        RewriteSectionRequest(
            section_title="Challenges",
            content="Context worsened this quarter. [Needs verification]",
            mode="REWRITE",
            audience="DONOR",
        )
    )
    assert "[Needs verification]" not in body["content"]
    assert body["unsupportedClaims"] != []
