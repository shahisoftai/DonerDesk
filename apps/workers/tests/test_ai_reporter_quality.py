"""Regression tests for report-quality v4 (AI Reporter).

Each test pins one defect found in the 2026-09 quality audit:
  - typed Q&A / delta output was dropped by `coerce_section`;
  - the numeric validators never ran (and checked the wrong direction);
  - the retry bypassed the timeout/parser path;
  - tables/charts/deltas were left to the model instead of the verified findings;
  - story context, visibility lines, section guidance, tone never reached the prompt;
  - the executive summary could not synthesise drafted sections;
  - rewrite could silently change figures.
"""
from __future__ import annotations

from app.ai_reporter import artifact_builder, artifact_validators, donor_voice, grounding, pipeline, writer_contract
from app.ai_reporter.draft_writer import build_user_prompt
from app.ai_reporter.llm_gateway import coerce_section
from app.ai_reporter.models import (
    Activity,
    Context,
    ContextProfile,
    ContextStory,
    ContextTemplate,
    Finding,
    GeneratedSection,
    IndicatorUpdate,
    PriorNarrative,
    SectionBrief,
    SectionDraftRequest,
)
from app.ai_reporter.outline import section_kind
from app.ai_reporter.router import rewrite_issues


def _findings() -> list[Finding]:
    return [
        Finding(indicatorCode="OUT-1", indicatorId="ind-1", indicatorName="Centres rehabilitated", baseline="0", target="120",
                value="96", comparisonValue="60", performanceEvaluation={"type": "POSITIVE"}),
        Finding(indicatorCode="OUT-2", indicatorId="ind-2", indicatorName="Caregivers counselled", target="1,000",
                value=None, valueStatus="NOT_CALCULABLE", qualityFlags=["MISSING_DENOMINATOR"]),
    ]


def _req(title: str = "Results and progress", **brief: object) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title, **brief),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=_findings(),
        indicatorUpdates=[IndicatorUpdate(indicatorCode="OUT-1", indicatorId="ind-1", dataSource="Site register")],
        activities=[Activity(title="IYCF counselling", activityId="act-14", participantsTotal=142, participantsFemale=97)],
    )


# --------------------------------------------------------------------------- #
# coerce_section pass-through
# --------------------------------------------------------------------------- #


def test_coerce_section_passes_through_qa_and_drops_malformed_items() -> None:
    raw = {
        "title": "Results",
        "content": "Text.",
        "qa": [
            {"question": "Q1?", "answer": "A1.", "sourceReferences": [{"type": "indicator", "id": "ind-1"}]},
            {"question": "Q2?", "answer": "No verified information was recorded."},
            {"answer": "missing question"},
        ],
        "deltaFromPrior": {"metric": "OUT-1", "fromValue": "60", "toValue": "96", "direction": "UP",
                           "evidenceSummary": "x", "sourceReferences": [{"type": "indicator", "id": "ind-1"}]},
        "artifacts": [{"kind": "LIST", "ordinal": 0, "payload": {"items": []}}, {"bad": True}],
    }
    section = coerce_section(raw, "Results")
    assert [q.question for q in section.qa] == ["Q1?", "Q2?"]
    assert section.deltaFromPrior is not None and section.deltaFromPrior.toValue == "96"
    assert [a.kind for a in section.artifacts] == ["LIST"]


# --------------------------------------------------------------------------- #
# number grounding
# --------------------------------------------------------------------------- #


def test_grounding_allows_recorded_and_percent_of_target_but_not_invented() -> None:
    req = _req()
    allowed = grounding.allowed_numbers(req)
    text = "The project rehabilitated 96 centres (80% of target), up from 60. It counselled 142 caregivers, 97 of them women. It reached 3,400 people."
    assert grounding.ungrounded_numbers(text, allowed) == ["3,400"]


def test_grounding_ignores_codes_list_markers_and_accepts_thousands_separators() -> None:
    req = _req()
    allowed = grounding.allowed_numbers(req)
    text = "1. OUT-1 and OUT-2 are reported under Q3 via ev-1:0.\n2. Target: 1000 caregivers."
    assert grounding.ungrounded_numbers(text, allowed) == []


def test_run_all_flags_invented_number_as_integrity_issue() -> None:
    req = _req()
    section = GeneratedSection(sectionId="s", title="Results", content="The project reached 5,000 households.")
    result = artifact_validators.run_all(section, req)
    assert not result.ok
    assert result.integrity_issues and result.integrity_issues[0].startswith("UNGROUNDED_NUMBER")


# --------------------------------------------------------------------------- #
# validators: tolerant Q&A, word-boundary banned phrases, paraphrase repetition
# --------------------------------------------------------------------------- #


def test_mandatory_questions_match_ignoring_punctuation_and_allow_honest_gaps() -> None:
    req = _req(mandatoryQuestions=["What changed for women?", "Were any complaints received?"])
    section = GeneratedSection(
        sectionId="s",
        title="Results",
        content="x",
        qa=[
            {"question": "what changed for women", "answer": "97 women were counselled.",
             "sourceReferences": [{"type": "activity", "id": "act-14"}]},
            {"question": "Were any complaints received?", "answer": "No complaints data was recorded this period.",
             "sourceReferences": []},
        ],
    )
    assert artifact_validators.assert_mandatory_questions_answered(section, req).ok


def test_banned_phrases_match_whole_words_only() -> None:
    assert artifact_validators.find_banned_phrases("The project hired permanent staff.") == []
    assert artifact_validators.find_banned_phrases("Results were remarkable.") == ["remarkable"]


def test_repetition_catches_paraphrase_with_shared_phrasing() -> None:
    prior = ["The project rehabilitated 96 learning centres across the three districts during the period."]
    section = GeneratedSection(
        sectionId="s",
        title="Achievements",
        content="During the quarter, the project rehabilitated 96 learning centres across the three districts in total.",
    )
    assert not artifact_validators.assert_repetition(section, prior).ok


def test_repetition_is_skipped_for_synthesis_sections() -> None:
    req = _req(title="Executive Summary", synthesis=True,
               priorSectionsSummary=["The project rehabilitated 96 centres against a target of 120 centres this period."])
    section = GeneratedSection(sectionId="s", title="Executive Summary",
                               content="The project rehabilitated 96 centres against a target of 120 centres this period.")
    assert not any(i.startswith("DUPLICATE") for i in artifact_validators.run_all(section, req).issues)


def test_delta_only_required_when_a_comparable_finding_exists() -> None:
    section = GeneratedSection(sectionId="s", title="A", content="x")
    assert artifact_validators.assert_delta_from_prior(section, True, comparable_finding_present=False).ok
    assert not artifact_validators.assert_delta_from_prior(section, True, comparable_finding_present=True).ok


def test_donor_voice_warns_on_passive_topic_opening_and_filler() -> None:
    report = donor_voice.assess(
        "Regarding health, sessions were held in all sites. Caregivers were counselled. "
        "It is worth noting that a number of kits were distributed."
    )
    joined = " ".join(report.warnings)
    assert "VOICE_PASSIVE" in joined and "VOICE_TOPIC_OPENING" in joined and "VOICE_FILLER" in joined
    assert report.score < 1
    assert donor_voice.assess("The project counselled 142 caregivers in Kabul.").warnings == ()


# --------------------------------------------------------------------------- #
# section kind + deterministic artifacts
# --------------------------------------------------------------------------- #


def test_section_kind_classifies_real_template_titles() -> None:
    assert section_kind(SectionBrief(title="Executive Summary")) == "EXECUTIVE_SUMMARY"
    assert section_kind(SectionBrief(title="Annex A: Indicator Performance Table", inputType="ANNEX")) == "INDICATOR_TABLE"
    assert section_kind(SectionBrief(title="Challenges and mitigation measures")) == "CHALLENGE"
    assert section_kind(SectionBrief(title="Progress against results")) == "ACHIEVEMENT"
    assert section_kind(SectionBrief(title="Conclusion", synthesis=True)) == "EXECUTIVE_SUMMARY"


def test_attach_builds_verified_indicator_table_and_replaces_model_table() -> None:
    req = _req(title="Annex A: Indicator Performance", inputType="ANNEX")
    written = GeneratedSection(sectionId="s", title="Annex A", content="| Code | Value |\n| --- | --- |\n| OUT-1 | 99 |\nData quality notes: OUT-2 could not be calculated.")
    section = artifact_builder.attach(written, req, "INDICATOR_TABLE")
    assert "| OUT-1 | Centres rehabilitated | — | 0 | 120 | 96 | 60 | 80% | On track | Site register |" in section.content
    assert "| OUT-2 |" in section.content and "Not calculable" in section.content
    assert "99" not in section.content  # the writer's paraphrased table is gone
    assert section.artifacts[0].kind == "TABLE"
    assert artifact_validators.run_all(section, req).ok, artifact_validators.run_all(section, req).issues


def test_attach_adds_grounded_chart_and_delta_for_results_sections() -> None:
    req = _req()
    section = artifact_builder.attach(GeneratedSection(sectionId="s", title="Results", content="x"), req, "ACHIEVEMENT")
    kinds = [a.kind for a in section.artifacts]
    assert kinds == ["CHART", "DELTA"]
    assert [a.ordinal for a in section.artifacts] == [0, 1]
    assert section.deltaFromPrior is not None and section.deltaFromPrior.direction == "UP"
    assert artifact_validators.assert_chart_data_grounding(section, grounding.allowed_numbers(req)).ok


# --------------------------------------------------------------------------- #
# prompt: context the AI Reporter previously never received
# --------------------------------------------------------------------------- #


def test_prompt_renders_story_visibility_guidance_tone_and_ids() -> None:
    req = _req(sectionGuidance=["Write 2-3 flowing paragraphs."])
    req.context.story = ContextStory(varianceExplanations="Rains delayed construction in two districts.")
    req.context.visibility = ["# Attribution and visibility (mandatory)", "- Use exactly: \"Funded by the European Union.\""]
    prompt = build_user_prompt(req)
    assert "Write 2-3 flowing paragraphs." in prompt
    assert "Why targets were over/under achieved: Rains delayed construction" in prompt
    assert "Funded by the European Union." in prompt
    assert "# Tone: Use formal, professional donor-reporting language." in prompt
    assert '"activityId": "act-14"' in prompt and '"indicatorId": "ind-1"' in prompt
    assert "Outline slots" in prompt and "Attached automatically" in prompt


def test_prompt_synthesis_mode_lists_drafted_sections_to_summarise() -> None:
    req = _req(title="Executive Summary", synthesis=True, priorSectionsSummary=["## Results\nThe project rehabilitated 96 centres."])
    prompt = build_user_prompt(req)
    assert "Drafted report sections to synthesise" in prompt
    assert "Already-written sibling sections" not in prompt


def test_v4_prompt_states_the_rules_validators_enforce() -> None:
    v4 = writer_contract.system_prompt(4)
    assert "percent of target" in v4 and "performanceEvaluation" in v4 and "MISSING_DENOMINATOR" in v4
    assert "do not emit artifacts" in v4
    v3 = writer_contract.system_prompt(3)
    assert "dramatically, permanent, fully achieved" in v3  # v3 byte-stable legacy list


# --------------------------------------------------------------------------- #
# pipeline: feedback retry through the guarded path, fallback only on integrity
# --------------------------------------------------------------------------- #


def test_pipeline_retries_with_feedback_and_keeps_fixed_draft(monkeypatch) -> None:
    calls: list[dict] = []

    def fake_draft(req, **kw):
        calls.append(kw)
        text = "The project reached 5,000 households." if "feedback" not in kw else "The project rehabilitated 96 centres, up from 60."
        return GeneratedSection(sectionId="s", title=req.section.title, content=text)

    monkeypatch.setattr(pipeline, "draft", fake_draft)
    section, telemetry = pipeline.run_pipeline(_req())
    assert len(calls) == 2
    assert any("UNGROUNDED_NUMBER" in f for f in calls[1]["feedback"])
    assert calls[1]["previous_content"] == "The project reached 5,000 households."
    assert "96 centres" in section.content
    assert "usedFallback" not in telemetry
    assert telemetry["parseOutcome"] == "VALID"


def test_pipeline_signals_fallback_when_invented_number_persists(monkeypatch) -> None:
    monkeypatch.setattr(
        pipeline, "draft",
        lambda req, **kw: GeneratedSection(sectionId="s", title="R", content="The project reached 5,000 households."),
    )
    _, telemetry = pipeline.run_pipeline(_req())
    assert telemetry["usedFallback"] is True
    assert telemetry["fallbackReason"] == "VALIDATOR_FAILED"


def test_pipeline_keeps_ai_prose_when_only_style_issues_remain(monkeypatch) -> None:
    monkeypatch.setattr(
        pipeline, "draft",
        lambda req, **kw: GeneratedSection(sectionId="s", title="R", content="The project delivered remarkable results in 96 centres."),
    )
    section, telemetry = pipeline.run_pipeline(_req())
    assert "usedFallback" not in telemetry
    assert telemetry["parseOutcome"] == "VALID_WITH_ISSUES"
    assert any("BANNED_PHRASE" in i for i in telemetry["validatorIssues"])


def test_pipeline_does_not_demand_delta_without_comparable_finding(monkeypatch) -> None:
    req = _req(title="Lessons learned")
    req.priorNarrative = [PriorNarrative(periodLabel="Q1", content="Prior text.", sourceSectionTitle="Lessons")]
    monkeypatch.setattr(
        pipeline, "draft",
        lambda r, **kw: GeneratedSection(sectionId="s", title="Lessons", content="Staff learned to schedule sessions earlier."),
    )
    _, telemetry = pipeline.run_pipeline(req)
    assert telemetry["validatorIssues"] == []


# --------------------------------------------------------------------------- #
# rewrite guard
# --------------------------------------------------------------------------- #


def test_rewrite_issues_flags_changed_numbers_and_new_inflation() -> None:
    original = "The project counselled 142 caregivers (97 women)."
    assert rewrite_issues(original, "The project counselled 142 caregivers, including 97 women.") == []
    assert rewrite_issues(original, "The project counselled 142 caregivers.") == []  # SHORTEN may drop figures
    issues = rewrite_issues(original, "The project counselled 150 caregivers in a remarkable effort.")
    assert any("150" in i for i in issues) and any("remarkable" in i for i in issues)


# --------------------------------------------------------------------------- #
# TS mirror parity
# --------------------------------------------------------------------------- #


def test_ts_contract_mirror_is_string_identical() -> None:
    """contract.ts is generated from this module; any drift fails here."""
    import json
    import pathlib

    ts = (pathlib.Path(__file__).resolve().parents[3] / "packages/infrastructure/src/llm/ai-reporter/contract.ts").read_text()
    assert f"WRITER_CONTRACT_VERSION = {writer_contract.WRITER_CONTRACT_VERSION} as const" in ts
    for items in (writer_contract._WRITER_RULES_V4, writer_contract.BANNED_PHRASES, writer_contract.LANGUAGE_CRAFT_RULES):
        for item in items:
            assert json.dumps(item, ensure_ascii=False) in ts, item


# --------------------------------------------------------------------------- #
# Template Manager v2 — donor template guidance reaches the writer
# --------------------------------------------------------------------------- #


def test_prompt_renders_donor_instructions_tables_and_org_guidance_when_present() -> None:
    req = _req(
        donorInstructions="Report progress against each outcome.\n- Name the districts covered.",
        requiredTables=[{"title": "Outcome table", "columns": ["Indicator", "Target", "Achieved"]}],
        authorInstructions="Lead with the nutrition outcome.",
        pageLimit=2,
    )
    req.context.template = ContextTemplate(
        templateName="ECHO", generalInstructions=["Avoid acronyms."], complianceRequirements=["Use the EU logo."]
    )
    prompt = build_user_prompt(req)
    assert "# Donor instructions for this section" in prompt and "Name the districts covered." in prompt
    assert "- Outcome table: | Indicator | Target | Achieved |" in prompt
    assert "# Organisation guidance for this section" in prompt and "Lead with the nutrition outcome." in prompt
    assert "# Page limit set by the donor: 2 page(s)" in prompt
    assert "# Donor's report-wide instructions (MUST be honoured):\n- Avoid acronyms." in prompt
    assert "# Donor compliance requirements" in prompt and "Use the EU logo." in prompt
    assert "generalInstructions:" not in prompt


def test_prompt_is_unchanged_when_template_guidance_is_absent() -> None:
    prompt = build_user_prompt(_req())
    for marker in ("Donor instructions", "Tables the donor requires", "Organisation guidance", "Page limit set by the donor", "report-wide instructions"):
        assert marker not in prompt
