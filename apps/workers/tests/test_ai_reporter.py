"""Tests for the AI Reporter v2 package — writer contract, validators, outline, chart suggester.

These run without an LLM. They exercise the deterministic surfaces that the
worker relies on.
"""
from __future__ import annotations

import pytest

from app.ai_reporter import (
    BANNED_PHRASES,
    WRITER_CONTRACT_VERSION,
    artifact_validators,
    chart_suggester,
    outline,
    writer_contract,
)
from app.ai_reporter.models import (
    Activity,
    Context,
    ContextProfile,
    Finding,
    GeneratedSection,
    SectionBrief,
    SectionDraftRequest,
)


# --------------------------------------------------------------------------- #
# writer_contract
# --------------------------------------------------------------------------- #


def test_writer_contract_version_matches_python_and_typescript() -> None:
    """Python and TypeScript contract versions must agree."""
    assert writer_contract.WRITER_CONTRACT_VERSION == 2
    assert WRITER_CONTRACT_VERSION == 2


def test_system_prompt_is_deterministic() -> None:
    a = writer_contract.system_prompt(2)
    b = writer_contract.system_prompt(2)
    assert a == b
    assert "writer contract v2" in a


def test_banned_phrases_list_is_stable() -> None:
    assert "transformative" in BANNED_PHRASES
    assert "life-changing" in BANNED_PHRASES
    assert "in these challenging times" in BANNED_PHRASES
    assert writer_contract.donor_token_blocklist() == list(BANNED_PHRASES)


# --------------------------------------------------------------------------- #
# outline
# --------------------------------------------------------------------------- #


def test_outline_indicator_table_requires_table_slot() -> None:
    slots = outline.outline_for("INDICATOR_TABLE")
    ids = {s.id for s in slots}
    assert "table" in ids
    assert all(s.required for s in slots)


def test_outline_unknown_input_type_falls_back_to_narrative() -> None:
    slots = outline.outline_for(None)
    ids = {s.id for s in slots}
    assert ids == {"context", "evidence", "interpretation"}


def test_outline_achievement_includes_caveat_slot() -> None:
    slots = outline.outline_for("ACHIEVEMENT")
    ids = {s.id for s in slots}
    assert "caveat" in ids


# --------------------------------------------------------------------------- #
# chart_suggester
# --------------------------------------------------------------------------- #


def test_chart_suggester_returns_none_when_no_indicators() -> None:
    assert chart_suggester.suggest({}) is None
    assert chart_suggester.suggest({"indicators": []}) is None


def test_chart_suggester_picks_line_when_prior_value_present() -> None:
    spec = chart_suggester.suggest({
        "indicators": [{"code": "IND-1", "value": "1200", "target": "1500", "baseline": "0"}],
        "priorValues": {"IND-1": "900"},
    })
    assert spec is not None
    assert spec.type == "LINE"
    assert spec.dataBinding == "INDICATOR_ACHIEVEMENT"
    assert spec.categories == ["Prior period", "Current period"]


def test_chart_suggester_picks_pie_when_three_statuses() -> None:
    spec = chart_suggester.suggest({
        "claimStatusCounts": {"VERIFIED": 12, "NEEDS_REVIEW": 3, "DRAFT": 1},
    })
    assert spec is not None
    assert spec.type == "PIE"


def test_chart_suggester_picks_bar_when_three_disaggregations() -> None:
    spec = chart_suggester.suggest({
        "disaggregations": [
            {"label": "Female", "value": 600},
            {"label": "Male", "value": 500},
            {"label": "Other", "value": 100},
        ],
    })
    assert spec is not None
    assert spec.type == "BAR"


def test_chart_suggester_picks_comparison_bar_for_baseline_target_value() -> None:
    spec = chart_suggester.suggest({
        "indicators": [
            {"code": "IND-1", "baseline": "100", "target": "500", "value": "480"},
        ],
    })
    assert spec is not None
    assert spec.type == "BAR"
    assert spec.dataBinding == "INDICATOR_COMPARISON"


def test_chart_suggester_picks_gauge_for_activity_output_vs_target() -> None:
    spec = chart_suggester.suggest({
        "activityOutputVsTarget": {"output": 80, "target": 100},
    })
    assert spec is not None
    assert spec.type == "GAUGE"


# --------------------------------------------------------------------------- #
# artifact_validators
# --------------------------------------------------------------------------- #


def _request(mandatory_questions: list[str] | None = None) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(
            title="Achievements",
            inputType="ACHIEVEMENT",
            mandatoryQuestions=mandatory_questions or [],
        ),
        context=Context(profile=ContextProfile(tone="neutral")),
    )


def test_assert_numeric_exactness_passes_when_value_present() -> None:
    section = GeneratedSection(sectionId="s", title="A", content="We reached 500 beneficiaries.")
    result = artifact_validators.assert_numeric_exactness(section, {"500"})
    assert result.ok


def test_assert_numeric_exactness_fails_when_value_missing() -> None:
    section = GeneratedSection(sectionId="s", title="A", content="Approx. five hundred beneficiaries.")
    result = artifact_validators.assert_numeric_exactness(section, {"500"})
    assert not result.ok
    assert "NUMERIC_PARAPHRASE" in result.issues[0]


def test_assert_banned_phrases_detects_transformative() -> None:
    section = GeneratedSection(sectionId="s", title="A", content="The workshop was transformative.")
    result = artifact_validators.assert_banned_phrases(section)
    assert not result.ok
    assert "BANNED_PHRASE" in result.issues[0]


def test_assert_banned_phrases_passes_clean_content() -> None:
    section = GeneratedSection(sectionId="s", title="A", content="The workshop was well attended.")
    result = artifact_validators.assert_banned_phrases(section)
    assert result.ok


def test_assert_word_count_enforces_min_and_max() -> None:
    req = _request()
    section = GeneratedSection(sectionId="s", title="A", content="one two three")
    req.section.minWords = 10
    req.section.maxWords = 20
    result = artifact_validators.assert_word_count(section, req)
    assert not result.ok


def test_assert_word_count_passes_when_in_band() -> None:
    req = _request()
    section = GeneratedSection(sectionId="s", title="A", content="one two three four five six seven eight nine ten")
    req.section.minWords = 5
    req.section.maxWords = 20
    result = artifact_validators.assert_word_count(section, req)
    assert result.ok


def test_assert_repetition_flags_duplicate_sentence() -> None:
    prior = ["Expenditure reached EUR 240,000 against a budget of EUR 300,000."]
    section = GeneratedSection(
        sectionId="s",
        title="A",
        content="Expenditure reached EUR 240,000 against a budget of EUR 300,000. Other facts follow here.",
    )
    result = artifact_validators.assert_repetition(section, prior)
    assert not result.ok


def test_assert_artifact_ordering_passes_for_strictly_increasing() -> None:
    section = GeneratedSection(
        sectionId="s",
        title="A",
        content="x",
        artifacts=[
            {"kind": "LIST", "ordinal": 0, "payload": {"ordered": False, "items": []}},
            {"kind": "LIST", "ordinal": 1, "payload": {"ordered": False, "items": []}},
        ],
    )
    result = artifact_validators.assert_artifact_ordering(section)
    assert result.ok


def test_assert_artifact_ordering_fails_on_gap() -> None:
    section = GeneratedSection(
        sectionId="s",
        title="A",
        content="x",
        artifacts=[
            {"kind": "LIST", "ordinal": 0, "payload": {"ordered": False, "items": []}},
            {"kind": "LIST", "ordinal": 5, "payload": {"ordered": False, "items": []}},
        ],
    )
    result = artifact_validators.assert_artifact_ordering(section)
    assert not result.ok


def test_run_all_returns_ok_for_compliant_section() -> None:
    req = _request()
    section = GeneratedSection(
        sectionId="s",
        title="Achievements",
        content="We reached 500 beneficiaries. 320 women and 180 children were reached. Coverage is preliminary.",
        artifacts=[
            {
                "kind": "TABLE",
                "ordinal": 0,
                "payload": {
                    "columns": [
                        {"key": "indicator", "label": "Indicator"},
                        {"key": "value", "label": "Value"},
                    ],
                    "rows": [
                        {
                            "cells": ["Reach", "500"],
                            "sourceReferences": [{"type": "evidence", "id": "ev-1", "label": "Field report"}],
                        },
                        {
                            "cells": ["Female", "320"],
                            "sourceReferences": [{"type": "evidence", "id": "ev-1", "label": "Field report"}],
                        },
                        {
                            "cells": ["Male", "180"],
                            "sourceReferences": [{"type": "evidence", "id": "ev-1", "label": "Field report"}],
                        },
                    ],
                },
            }
        ],
    )
    result = artifact_validators.run_all(section, req, verified_numbers={"500", "320", "180"})
    assert result.ok, result.issues


def test_run_all_aggregates_multiple_issues() -> None:
    req = _request()
    section = GeneratedSection(
        sectionId="s",
        title="Achievements",
        content="The workshop was transformative. Approximately twelve hundred people attended.",
    )
    result = artifact_validators.run_all(section, req, verified_numbers={"1,200"})
    assert not result.ok
    joined = " ".join(result.issues)
    assert "BANNED_PHRASE" in joined
    assert "NUMERIC_PARAPHRASE" in joined
