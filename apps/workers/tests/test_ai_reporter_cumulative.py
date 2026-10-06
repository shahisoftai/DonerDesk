"""Life-of-project (cumulative) figures for semi-annual, annual and final reports."""
from __future__ import annotations

from app.ai_reporter import artifact_builder, grounding
from app.ai_reporter.models import (
    Context,
    ContextProfile,
    Finding,
    GeneratedSection,
    LifeOfProject,
    SectionBrief,
    SectionDraftRequest,
)
from app.ai_reporter.outline import section_kind


def _findings(with_life: bool = True) -> list[Finding]:
    life = (
        LifeOfProject(value="7,000", basis="REPORTED_CUMULATIVE", periodsCovered=3, asOf="2028-06-30")
        if with_life
        else None
    )
    return [
        Finding(
            indicatorCode="OUT-1",
            indicatorId="ind-1",
            indicatorName="Centres rehabilitated",
            baseline="0",
            target="8,000",
            value="2,500",
            performanceEvaluation={"type": "POSITIVE"},
            lifeOfProject=life,
        ),
        Finding(
            indicatorCode="OUT-2",
            indicatorId="ind-2",
            indicatorName="Caregivers counselled",
            target="1,000",
            value="40",
        ),
    ]


def _req(
    title: str = "Cumulative Progress Against Project Targets", with_life: bool = True, **brief: object
) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title, **brief),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=_findings(with_life),
    )


def _section(content: str = "Progress is steady.") -> GeneratedSection:
    return GeneratedSection(sectionId="s1", title="x", content=content)


def test_life_of_project_numbers_are_grounded() -> None:
    allowed = grounding.allowed_numbers(_req())
    assert grounding.normalise_number("7,000") in allowed
    # 7000 / 8000 = 87.5 % — the one derived figure allowed for a cumulative value.
    assert grounding.normalise_number("87.5") in allowed
    assert grounding.ungrounded_numbers("Cumulative 7,000, which is 87.5% of target.", allowed) == []
    assert grounding.ungrounded_numbers("Cumulative 7,400.", allowed) == ["7,400"]


def test_without_life_of_project_cumulative_numbers_stay_ungrounded() -> None:
    allowed = grounding.allowed_numbers(_req(with_life=False))
    assert grounding.ungrounded_numbers("Cumulative 7,000.", allowed) == ["7,000"]


def test_indicator_table_adds_cumulative_columns_only_when_present() -> None:
    with_life = artifact_builder.indicator_table(_req(inputType="INDICATOR_TABLE"))
    assert with_life is not None
    table, markdown = with_life
    labels = [c["label"] for c in table.payload["columns"]]
    assert "Cumulative to date" in labels and "% of project target" in labels
    first = [line for line in markdown.splitlines() if line.startswith("| OUT-1")][0]
    assert "7,000" in first and "87.5%" in first
    second = [line for line in markdown.splitlines() if line.startswith("| OUT-2")][0]
    assert second.count("—") >= 2  # no cumulative figure: shown as a dash, never estimated

    without = artifact_builder.indicator_table(_req(with_life=False, inputType="INDICATOR_TABLE"))
    assert without is not None
    assert "Cumulative to date" not in [c["label"] for c in without[0].payload["columns"]]


def test_cumulative_table_lists_only_indicators_with_a_cumulative_figure() -> None:
    built = artifact_builder.cumulative_table(_req())
    assert built is not None
    table, markdown = built
    assert [r["cells"][0] for r in table.payload["rows"]] == ["OUT-1"]
    assert "2028-06-30" in markdown
    assert artifact_builder.cumulative_table(_req(with_life=False)) is None


def test_cumulative_section_gets_the_table_and_other_sections_do_not() -> None:
    req = _req()
    kind = section_kind(req.section)
    assert artifact_builder.is_cumulative_section(req, kind)
    out = artifact_builder.attach(_section(), req, kind)
    assert out.content.startswith("| Code | Indicator")
    assert any(a.kind == "TABLE" for a in out.artifacts)

    other = _req(title="Activities Implemented")
    assert not artifact_builder.is_cumulative_section(other, section_kind(other.section))


def test_canonical_title_drives_detection_in_translated_reports() -> None:
    req = _req(
        title="Progrès cumulé par rapport aux cibles du projet",
        canonicalTitle="Cumulative Progress Against Project Targets",
    )
    assert artifact_builder.is_cumulative_section(req, section_kind(req.section))


def test_percent_of_target_of_a_recorded_cumulative_value_is_grounded() -> None:
    """D5-2: 'cumulative 7,000, 87.5% of the 8,000 target' came from the indicator update, not the finding, and was rejected."""
    from app.ai_reporter.models import IndicatorUpdate

    req = _req(with_life=False)
    req.indicatorUpdates = [
        IndicatorUpdate(indicatorCode="OUT-1", indicatorId="ind-1", periodAchievement="2,500", cumulativeAchievement="7,000"),
        IndicatorUpdate(indicatorCode="UNKNOWN", indicatorId="x", cumulativeAchievement="9,999"),
    ]
    allowed = grounding.allowed_numbers(req)
    assert grounding.ungrounded_numbers("Cumulative 7,000, which is 87.5% of the target.", allowed) == []
    # the update's own percent is allowed for its own indicator only, and an invented percent still is not
    assert grounding.ungrounded_numbers("Cumulative 7,000, which is 91% of the target.", allowed) == ["91"]
    assert "125" not in allowed
