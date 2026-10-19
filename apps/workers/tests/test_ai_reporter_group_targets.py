"""Targets set by group are shown beside the recorded figure for that group; a gap is "Not measured", never 0."""
from __future__ import annotations

from app.ai_reporter import artifact_builder, grounding
from app.ai_reporter.models import Context, ContextProfile, Finding, GeneratedSection, LifeOfProject, SectionBrief, SectionDraftRequest

TARGETS = [
    {"dimension": "SEX", "category": "Female", "value": "700"},
    {"dimension": "SEX", "category": "Male", "value": "500"},
]


def _req(finding: Finding) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title="Indicator Performance"),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=[finding],
    )


def _finding(**extra: object) -> Finding:
    return Finding(indicatorCode="IND-1", indicatorName="Children enrolled", target="1,200", value="655", targetBreakdowns=TARGETS, **extra)  # type: ignore[arg-type]


def test_group_target_beside_recorded_value_and_gap_is_not_measured() -> None:
    built = artifact_builder.group_target_table(_req(_finding(disaggregation=[{"dimension": "SEX", "category": "female", "value": "655"}])))
    assert built is not None
    artifact, markdown = built
    rows = [r["cells"] for r in artifact.payload["rows"]]
    assert rows[0] == ["IND-1", "Children enrolled", "Sex: Female", "700", "655"]
    assert rows[1][-1] == "Not measured"
    assert "| Sex: Male | 500 | Not measured |" in markdown


def test_no_group_targets_means_no_table() -> None:
    plain = Finding(indicatorCode="IND-1", value="1")
    assert artifact_builder.group_target_table(_req(plain)) is None


def test_roll_up_report_adds_cumulative_column() -> None:
    finding = _finding(lifeOfProject=LifeOfProject(value="900", basis="REPORTED_CUMULATIVE", disaggregation=[{"dimension": "SEX", "category": "Female", "value": "480"}]))
    artifact, _ = artifact_builder.group_target_table(_req(finding))  # type: ignore[misc]
    assert [c["label"] for c in artifact.payload["columns"]][-1] == "Cumulative to date"
    assert artifact.payload["rows"][0]["cells"][-1] == "480"


def test_attach_adds_group_table_after_indicator_table_and_numbers_are_grounded() -> None:
    req = _req(_finding(disaggregation=[{"dimension": "SEX", "category": "Female", "value": "655"}]))
    section = artifact_builder.attach(GeneratedSection(sectionId="s1", title="Indicator Performance", content="Enrolment went well."), req, "INDICATOR_TABLE")
    assert [a.kind for a in section.artifacts[:2]] == ["TABLE", "TABLE"]
    assert "Results by group" in (section.artifacts[1].caption or "")
    assert "Group target" in section.content
    allowed = grounding.allowed_numbers(req)
    assert grounding.ungrounded_numbers("Female target 700 and 500 male.", allowed) == []
