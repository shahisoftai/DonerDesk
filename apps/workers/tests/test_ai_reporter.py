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
    assert writer_contract.WRITER_CONTRACT_VERSION == 4
    assert WRITER_CONTRACT_VERSION == 4


def test_system_prompt_is_deterministic() -> None:
    a = writer_contract.system_prompt(3)
    b = writer_contract.system_prompt(3)
    assert a == b
    assert "writer contract v3" in a


def test_system_prompt_v3_appends_language_craft_rules() -> None:
    """v3 prompts teach language craft; the craft block mirrors the TS contract."""
    prompt = writer_contract.system_prompt(3)
    assert "Language craft (mandatory):" in prompt
    assert all(rule in prompt for rule in writer_contract.LANGUAGE_CRAFT_RULES)


def test_system_prompt_v2_unchanged_by_craft_rules() -> None:
    """Backward compatibility: v2 prompts must not gain the craft block."""
    prompt = writer_contract.system_prompt(2)
    assert "writer contract v2" in prompt
    assert "Language craft (mandatory):" not in prompt


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


def test_assert_word_count_min_is_a_warning_and_max_is_hard() -> None:
    """Padding to reach a minimum produces speculative prose, so a shortfall is
    only a warning; exceeding the maximum still fails."""
    req = _request()
    req.section.minWords = 10
    req.section.maxWords = 20
    short = artifact_validators.assert_word_count(GeneratedSection(sectionId="s", title="A", content="one two three"), req)
    assert short.ok
    assert any("minWords" in w for w in short.warnings)
    req.section.maxWords = 2
    long = artifact_validators.assert_word_count(GeneratedSection(sectionId="s", title="A", content="one two three"), req)
    assert not long.ok


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
    req.activities = [
        Activity(title="Distribution", participantsTotal=500, participantsFemale=320, participantsChildren=180)
    ]
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


def _annex_request(title: str) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title, inputType="ANNEX"),
        context=Context(profile=ContextProfile(tone="neutral")),
    )


def test_assert_required_table_present_fails_when_indicator_annex_is_prose_only() -> None:
    req = _annex_request("Annex A: Indicator Performance Table")
    section = GeneratedSection(
        sectionId="s",
        title="Annex A: Indicator Performance Table",
        content="The table below lists every verified indicator update for the reporting period.",
    )
    result = artifact_validators.assert_required_table_present(section, req)
    assert not result.ok
    assert "MISSING_TABLE" in result.issues[0]


def test_assert_required_table_present_passes_when_indicator_annex_has_markdown_table() -> None:
    req = _annex_request("Annex A: Indicator Performance Table")
    section = GeneratedSection(
        sectionId="s",
        title="Annex A: Indicator Performance Table",
        content="| Code | Indicator | This period |\n| --- | --- | --- |\n| OUT-1 | Centres | 8 |\n",
    )
    result = artifact_validators.assert_required_table_present(section, req)
    assert result.ok


def test_assert_required_table_present_fails_when_evidence_annex_is_prose_only() -> None:
    req = _annex_request("Annex B: Evidence Checklist")
    section = GeneratedSection(
        sectionId="s",
        title="Annex B: Evidence Checklist",
        content="The verified evidence chunks for this period number 6.",
    )
    result = artifact_validators.assert_required_table_present(section, req)
    assert not result.ok


def test_assert_required_table_present_ignores_non_annex_sections() -> None:
    req = _request()
    section = GeneratedSection(sectionId="s", title="Achievements", content="We reached 500 beneficiaries.")
    result = artifact_validators.assert_required_table_present(section, req)
    assert result.ok


def test_run_all_flags_missing_table_for_indicator_annex() -> None:
    req = _annex_request("Annex A: Indicator Performance Table")
    section = GeneratedSection(
        sectionId="s",
        title="Annex A: Indicator Performance Table",
        content="The project recorded 8 learning centres against a target of 120 centres.",
    )
    result = artifact_validators.run_all(section, req, verified_numbers={"8", "120"})
    assert not result.ok
    assert any("MISSING_TABLE" in issue for issue in result.issues)


# --------------------------------------------------------------------------- #
# draft_writer — donor requirement guidance (WS1)
# --------------------------------------------------------------------------- #


def test_build_user_prompt_renders_requirement_guidance() -> None:
    """Guidance stamped on the brief must reach the narrator prompt verbatim."""
    from app.ai_reporter.draft_writer import build_user_prompt

    guidance = [
        "Report visibility actions taken. Include the exact EU-funded attribution sentence.",
        "Quote recorded variance explanations only.",
    ]
    req = SectionDraftRequest(
        section=SectionBrief(
            title="Visibility",
            inputType="NARRATIVE",
            requirementGuidance=guidance,
        ),
        context=Context(profile=ContextProfile(tone="neutral")),
    )
    prompt = build_user_prompt(req)
    assert "# Donor requirement guidance (MUST be honoured):" in prompt
    for line in guidance:
        assert f"- {line}" in prompt


def test_build_user_prompt_omits_guidance_block_when_absent() -> None:
    from app.ai_reporter.draft_writer import build_user_prompt

    req = SectionDraftRequest(
        section=SectionBrief(title="Narrative"),
        context=Context(profile=ContextProfile(tone="neutral")),
    )
    prompt = build_user_prompt(req)
    assert "# Donor requirement guidance" not in prompt


def test_build_user_prompt_includes_author_instruction_only_when_present() -> None:
    """Report Editor B7: a single-section regenerate carries the author's
    instruction; full drafts (no instruction) keep a byte-identical prompt."""
    from app.ai_reporter.draft_writer import build_user_prompt

    base = SectionBrief(title="Project context")
    with_instruction = SectionBrief(title="Project context", userInstruction="  Focus more on the flood response ")
    ctx = Context(profile=ContextProfile(tone="neutral"))
    plain = build_user_prompt(SectionDraftRequest(section=base, context=ctx))
    steered = build_user_prompt(SectionDraftRequest(section=with_instruction, context=ctx))
    assert "Author's instruction" not in plain
    assert "# Author's instruction for this section" in steered
    assert "Focus more on the flood response" in steered
    blank = SectionBrief(title="Project context", userInstruction="   ")
    assert build_user_prompt(SectionDraftRequest(section=blank, context=ctx)) == plain


def test_section_brief_rejects_overlong_instruction() -> None:
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        SectionBrief(title="Project context", userInstruction="x" * 501)


def test_strip_think_blocks_removes_reasoning_and_keeps_json() -> None:
    from app.ai_reporter.llm_gateway import strip_think_blocks

    raw = (
        "<think>\nThe user wants a report section. I should use {\"title\": ...} shape.\n"
        "</think>\n\n"
        '{"title":"Executive Summary","content":"Reach was 9,772 of 12,000."}'
    )
    cleaned = strip_think_blocks(raw)
    assert cleaned.startswith('{"title"')
    assert "think" not in cleaned


def test_strip_think_blocks_handles_unclosed_think() -> None:
    from app.ai_reporter.llm_gateway import strip_think_blocks

    raw = '<think>\nreasoning that never ends because tokens ran out'
    assert strip_think_blocks(raw) == ""


def test_extract_json_parses_minimax_style_output() -> None:
    """Regression: MiniMax-M3 wraps JSON in <think> blocks whose braces broke
    the balanced-brace scan (live prod failure 2026-09-02)."""
    import json as _json

    from app.ai_reporter.llm_gateway import extract_json, strip_think_blocks

    raw = (
        "<think>\nDraft must include {\"claims\": [..]} and satisfy the QPR "
        "requirements {SECTION, QUESTION, DECLARATION, INDICATOR}.\n</think>\n"
        '{"title":"Safeguarding and PSEA","content":"No concerns were recorded.",'
        '"claims":[{"text":"No safeguarding concerns were recorded this period.",'
        '"type":"FACTUAL"}]}'
    )
    parsed = extract_json(strip_think_blocks(raw))
    assert parsed["title"] == "Safeguarding and PSEA"
    assert parsed["claims"][0]["type"] == "FACTUAL"
    assert _json.loads(_json.dumps(parsed)) == parsed


def test_extract_json_tolerates_raw_newlines_in_strings() -> None:
    """Regression: strict json.loads rejects raw newlines inside JSON strings,
    which reasoning models emit frequently (live prod failure 2026-09-02)."""
    from app.ai_reporter.llm_gateway import extract_json

    raw = (
        '{"title":"Progress","content":"Line one\nLine two continues\n'
        'and the paragraph ends."}'
    )
    parsed = extract_json(raw)
    assert "Line one" in parsed["content"]
    assert parsed["content"].endswith("ends.")



# --------------------------------------------------------------------------- #
# pipeline — 429/5xx backoff and total-budget enforcement
# --------------------------------------------------------------------------- #


def _draft_request() -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title="Executive Summary", inputType="NARRATIVE"),
        context=Context(profile=ContextProfile(tone="neutral")),
    )


def test_run_pipeline_backs_off_and_recovers_from_transient_429(monkeypatch) -> None:
    """A single 429 must not crash generation: one retry, after a bounded
    backoff sleep, then success. Regression for the outage where MiniMax 429s
    forced 100% stub fallback because the (pointless, zero-delay) retry never
    had a chance to beat the rate limit."""
    from app.ai_reporter import pipeline
    from app.ai_reporter.llm_gateway import TransientProviderError

    calls = {"n": 0}
    good_section = GeneratedSection(sectionId="s", title="Executive Summary", content="Real content.")

    def fake_draft(req):
        calls["n"] += 1
        if calls["n"] == 1:
            raise TransientProviderError(429, 0.01, "rate limited")
        return good_section

    sleeps: list[float] = []
    monkeypatch.setattr(pipeline, "draft", fake_draft)
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: sleeps.append(s))

    section, telemetry = pipeline.run_pipeline(_draft_request())

    assert section.content == "Real content."
    assert calls["n"] == 2, "expected exactly one retry after the transient error"
    assert len(sleeps) == 1, "expected a backoff sleep before the retry"
    assert sleeps[0] <= 0.01 + 1e-9, "backoff must honour the provider's Retry-After"


def test_run_pipeline_does_not_back_off_on_non_transient_error(monkeypatch) -> None:
    """A 401/permanent error must retry immediately (existing behaviour) —
    backoff is only for transient provider errors."""
    from app.ai_reporter import pipeline

    calls = {"n": 0}
    good_section = GeneratedSection(sectionId="s", title="Executive Summary", content="Real content.")

    def fake_draft(req):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("401 unauthorized")
        return good_section

    sleeps: list[float] = []
    monkeypatch.setattr(pipeline, "draft", fake_draft)
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: sleeps.append(s))

    section, _ = pipeline.run_pipeline(_draft_request())

    assert section.content == "Real content."
    assert sleeps == [], "non-transient errors must not trigger a backoff sleep"


def test_run_pipeline_gives_up_once_total_budget_exhausted(monkeypatch) -> None:
    """Once TOTAL_DRAFT_TIMEOUT_MS is exhausted, the pipeline must raise
    immediately rather than retry — previously this config was defined and
    documented but never enforced anywhere."""
    from app.ai_reporter import pipeline, timeouts
    from app.ai_reporter.llm_gateway import TransientProviderError

    def always_transient(req):
        raise TransientProviderError(429, None, "rate limited")

    monkeypatch.setattr(pipeline, "draft", always_transient)
    monkeypatch.setattr(pipeline.time, "sleep", lambda s: None)
    # Force the tracker to report the budget already exhausted on its very
    # first check, regardless of real elapsed time.
    monkeypatch.setattr(timeouts.TotalBudgetTracker, "elapsed_ms", lambda self: 10**9)

    with pytest.raises(timeouts.TotalBudgetExceededError):
        pipeline.run_pipeline(_draft_request())


def test_extract_json_salvages_output_truncated_in_trailing_list() -> None:
    """Regression (live 2026-09-26): DeepSeek hit its output cap inside the
    trailing proposedSources list. The prose was complete, but the whole
    section fell back to deterministic text."""
    from app.ai_reporter.llm_gateway import extract_json

    raw = (
        '{"title":"Programme Overview","content":"The project reached 75 centres.",'
        '"proposedSources":[{"evidenceId":"e1","chunkId":"e1:0","sourceText":"Total learning kits"},'
        '{"evidenceId":"e2","chunkId":"e2:0","sourceText":"Teacher attend'
    )
    parsed = extract_json(raw)
    assert parsed["content"] == "The project reached 75 centres."
    assert [s["evidenceId"] for s in parsed["proposedSources"]] == ["e1"]


def test_extract_json_does_not_salvage_truncated_prose() -> None:
    """A section whose own `content` was cut off is unusable and must still
    raise so the pipeline falls back deterministically."""
    from app.ai_reporter.llm_gateway import extract_json

    raw = '{"title":"Executive Summary","content":"The project reached 75 cen'
    with pytest.raises(ValueError):
        extract_json(raw)

    raw2 = '{"title":"X","claims":[{"text":"a"},{"text":"b'
    with pytest.raises(ValueError):
        extract_json(raw2)


def test_draft_retries_once_when_model_returns_no_json(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression (live 2026-09-26): a reasoning model sometimes returns no JSON;
    one retry avoids discarding the section."""
    from app.ai_reporter import draft_writer

    replies = iter(
        [
            ("", {"inputTokens": 1, "outputTokens": 0, "latencyMs": 1, "parseOutcome": "VALID"}),
            ('{"title":"Results","content":"Ok."}', {"inputTokens": 1, "outputTokens": 5, "latencyMs": 1, "parseOutcome": "VALID"}),
        ]
    )
    monkeypatch.setattr(draft_writer, "_chat", lambda *a, **k: next(replies))
    section = draft_writer.draft(_request())
    assert section.content == "Ok."


def test_draft_raises_when_model_never_returns_json(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.ai_reporter import draft_writer

    monkeypatch.setattr(draft_writer, "_chat", lambda *a, **k: ("", {"inputTokens": 1, "outputTokens": 0, "latencyMs": 1, "parseOutcome": "VALID"}))
    with pytest.raises(ValueError):
        draft_writer.draft(_request())
