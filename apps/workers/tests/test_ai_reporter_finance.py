"""Verified financial figures in the AI Reporter request."""
from __future__ import annotations

from app.ai_reporter import grounding
from app.ai_reporter.draft_writer import build_user_prompt_parts
from app.ai_reporter.models import (
    Context,
    ContextFinance,
    ContextProfile,
    FinanceLine,
    SectionBrief,
    SectionDraftRequest,
)


def _finance() -> ContextFinance:
    return ContextFinance(
        currency="USD",
        budget="10000",
        expenditure="3250.5",
        committed="500",
        balance="6749.5",
        burnRatePercent="32.5",
        lines=[
            FinanceLine(
                budgetLine="Staff", budget="6000", expenditure="2000", balance="4000", burnRatePercent="33.3"
            ),
            FinanceLine(
                budgetLine="Supplies", budget="4000", expenditure="1250.5", balance="2749.5", burnRatePercent="31.3"
            ),
        ],
    )


def _req(finance: ContextFinance | None, title: str = "Financial and Procurement Status") -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English"), finance=finance),
    )


def test_finance_figures_and_the_computed_figures_are_grounded() -> None:
    allowed = grounding.allowed_numbers(_req(_finance()))
    for text in ("10,000", "3,250.5", "6,749.5", "32.5", "33.3", "1,250.5"):
        assert grounding.normalise_number(text) in allowed, text
    assert grounding.ungrounded_numbers("Spent 3,250.5 of 10,000 (32.5%), leaving 6,749.5.", allowed) == []
    assert grounding.ungrounded_numbers("Spent 3,300.", allowed) == ["3,300"]


def test_without_finance_no_financial_number_is_grounded() -> None:
    allowed = grounding.allowed_numbers(_req(None))
    assert grounding.ungrounded_numbers("Spent 3,250.5.", allowed) == ["3,250.5"]


def test_finance_block_is_in_the_report_wide_prefix_only_when_present() -> None:
    with_finance = build_user_prompt_parts(_req(_finance()))
    assert "Financial figures (verified" in with_finance[0]
    assert "Financial figures" not in with_finance[1]
    without = build_user_prompt_parts(_req(None))
    assert "Financial figures" not in without[0]
    # The prefix must be identical for every section of the report (provider prefix caching).
    other_section = build_user_prompt_parts(_req(_finance(), title="Lessons Learned"))
    assert with_finance[0] == other_section[0]


def test_unknown_finance_fields_are_rejected() -> None:
    try:
        ContextFinance(currency="USD", budget="1", expenditure="1", balance="0", surprise="x")  # type: ignore[call-arg]
    except Exception as exc:  # pydantic ValidationError
        assert "surprise" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("extra fields must be forbidden")
