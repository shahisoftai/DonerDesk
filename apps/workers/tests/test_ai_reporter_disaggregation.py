"""A finding's recorded breakdown (sex, age, ...) reaches the writer and its figures are grounded."""
from __future__ import annotations

from app.ai_reporter import grounding
from app.ai_reporter.models import Context, ContextProfile, Finding, SectionBrief, SectionDraftRequest


def _req(disaggregation: list[dict[str, str]] | None) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title="Results Against the Logframe"),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=[
            Finding(
                indicatorCode="IND-1",
                indicatorName="Children enrolled",
                target="1,200",
                value="1,260",
                qualityFlags=[] if disaggregation else ["MISSING_DISAGGREGATION"],
                disaggregation=disaggregation,
            )
        ],
    )


def test_recorded_breakdown_figures_are_grounded() -> None:
    allowed = grounding.allowed_numbers(
        _req(
            [
                {"dimension": "SEX", "category": "Female", "value": "655"},
                {"dimension": "SEX", "category": "Male", "value": "605"},
            ]
        )
    )
    assert grounding.ungrounded_numbers("655 girls and 605 boys were enrolled.", allowed) == []
    assert grounding.ungrounded_numbers("700 girls were enrolled.", allowed) == ["700"]


def test_without_a_breakdown_the_split_stays_ungrounded() -> None:
    allowed = grounding.allowed_numbers(_req(None))
    assert grounding.ungrounded_numbers("655 girls were enrolled.", allowed) == ["655"]


def test_life_of_project_breakdown_is_accepted_and_grounded() -> None:
    from app.ai_reporter.models import LifeOfProject

    request = SectionDraftRequest(
        section=SectionBrief(title="Results Against the Logframe"),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=[
            Finding(
                indicatorCode="IND-1",
                target="1,200",
                value="240",
                disaggregation=[{"dimension": "SEX", "category": "Female", "value": "125"}],
                lifeOfProject=LifeOfProject(
                    value="1,260",
                    basis="REPORTED_CUMULATIVE",
                    disaggregation=[{"dimension": "SEX", "category": "Female", "value": "655"}],
                ),
            )
        ],
    )
    allowed = grounding.allowed_numbers(request)
    assert grounding.ungrounded_numbers("655 female of 1,260 enrolled; 125 female in the period.", allowed) == []
