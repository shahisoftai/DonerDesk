"""Section draft writer.

Composes the user prompt from the brief and the verified inputs, calls the LLM
gateway, and coerces the response into a `GeneratedSection`.

Quality v4: the prompt now carries everything the legacy TS narrator already
gave the model — section-specific editorial guidance, the officer's "Tell the
Story" context, exact donor attribution lines, tone — plus outline slots and a
synthesis mode for the executive summary. The output schema is prose-only
(content, claims, sourceReferences, qa): tables/charts/deltas are attached
deterministically by `artifact_builder`, so the model no longer re-types them.
"""
from __future__ import annotations

import json
import os
import threading
from typing import Any

from .llm_gateway import _chat, coerce_section, extract_json
from .models import GeneratedSection, SectionDraftRequest
from .outline import outline_for, section_kind
from .writer_contract import WRITER_EXCLUDED_PERIOD_KEYS, system_prompt

_TONE = {
    "FORMAL": "Use formal, professional donor-reporting language.",
    "CONCISE": "Be concise and to the point.",
    "NARRATIVE": "Write in a flowing narrative style.",
    "TECHNICAL": "Use precise technical language appropriate for a donor audience.",
}
_STORY_LABELS = {
    "achievements": "What went well",
    "challenges": "What challenges were faced",
    "varianceExplanations": "Why targets were over/under achieved",
    "adaptations": "What changed or was adapted",
    "lessons": "Lessons and notable observations",
}
_ATTACHED_BY_KIND = {
    "INDICATOR_TABLE": "the full verified indicator table (placed above your text)",
    "ACHIEVEMENT": "a chart of the verified indicator figures and the period-on-period change",
    "EXECUTIVE_SUMMARY": "the period-on-period change figure",
}

_OUTPUT_SCHEMA = (
    '{"title":"string","content":"string (markdown prose)",'
    '"claims":[{"text":"string","type":"NUMERIC|FACTUAL|CAUSAL|QUALITATIVE",'
    '"proposedSources":[{"evidenceId":"string","chunkId":"string","sourceText":"string"}]}],'
    '"sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}],'
    '"qa":[{"question":"string (copied exactly)","answer":"string",'
    '"sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}]}]}'
)

# Telemetry of the last `draft()` call on this thread (pipeline reads it).
_local = threading.local()


def pop_last_telemetry() -> dict[str, Any]:
    telemetry = getattr(_local, "telemetry", None) or {}
    _local.telemetry = None
    return telemetry


def _bullets(title: str, items: list[str]) -> str:
    return f"# {title}\n" + "\n".join(f"- {i}" for i in items)


def _json_block(title: str, rows: list[Any]) -> str:
    return f"# {title} (JSON):\n" + json.dumps([r.model_dump(exclude_none=True) for r in rows], ensure_ascii=False)


def _object_block(title: str, obj: Any) -> str:
    return f"# {title} (JSON):\n" + json.dumps(obj.model_dump(exclude_none=True), ensure_ascii=False)


def build_user_prompt_parts(req: SectionDraftRequest) -> tuple[str, str]:
    """(report-wide prefix, section-specific suffix) of the user prompt.

    The prefix (profile, project/period/template context, story, verified
    findings, indicator updates, activity records) is byte-identical for every
    section of a report, so it comes first: providers with prefix caching
    (DeepSeek, GLM, OpenAI automatically; Claude via `cache_prefix`) reuse it
    for sections 2..N instead of re-reading ~10k tokens each time.
    """
    return _shared_prompt(req), _section_prompt(req)


def build_user_prompt(req: SectionDraftRequest) -> str:
    shared, specific = build_user_prompt_parts(req)
    return shared + "\n\n" + specific if shared else specific


def _shared_prompt(req: SectionDraftRequest) -> str:
    """Report-wide part: identical for every section of one report."""
    parts: list[str] = []
    ctx = req.context
    profile = ctx.profile
    if profile and profile.tone:
        parts.append(f"# Tone: {_TONE.get(profile.tone.upper(), _TONE['FORMAL'])}")
    if profile and profile.language:
        parts.append(f"# Language: write in {profile.language}")
    if profile and profile.formattingRules:
        parts.append(_bullets("Formatting rules:", profile.formattingRules))
    if ctx.visibility:
        parts.append("\n".join(ctx.visibility))
    if ctx.project:
        parts.append(_bullets("Project context:", [f"{k}: {v}" for k, v in ctx.project.model_dump(exclude_none=True).items()]))
    if ctx.period:
        parts.append(_bullets("Reporting period:", [f"{k}: {v}" for k, v in ctx.period.model_dump(exclude_none=True, exclude=set(WRITER_EXCLUDED_PERIOD_KEYS)).items()]))
    if ctx.template:
        template_lists = {
            "generalInstructions": "Donor's report-wide instructions (MUST be honoured):",
            "formattingRules": "Donor formatting rules:",
            "submissionInstructions": "Donor submission instructions (for awareness; do not restate unless asked):",
            "complianceRequirements": "Donor compliance requirements (the report must not contradict these):",
            "indicatorRequirements": "Donor indicator reporting requirements:",
        }
        info = ctx.template.model_dump(exclude_none=True)
        parts.append(_bullets("Donor template:", [f"{k}: {v}" for k, v in info.items() if k not in template_lists]))
        for key, title in template_lists.items():
            items = info.get(key)
            if items:
                parts.append(_bullets(title, items))
    if ctx.story:
        story = [f"{_STORY_LABELS[k]}: {v.strip()}" for k, v in ctx.story.model_dump(exclude_none=True).items() if v and v.strip()]
        if story:
            parts.append(
                _bullets("Tell the Story (officer's narrative context — the ONLY permitted source of explanations beyond activity records):", story)
            )

    if ctx.finance:
        parts.append(
            _object_block("Financial figures (verified; the only financial numbers you may quote)", ctx.finance)
        )

    parts.append(_json_block("Verified findings", req.verifiedFindings))
    parts.append(_json_block("Indicator updates", req.indicatorUpdates))
    parts.append(_json_block("Activity records", req.activities))
    return "\n\n".join(parts)


def _section_prompt(req: SectionDraftRequest) -> str:
    """Section-specific part: the brief, its retrieved evidence and the schema."""
    s = req.section
    kind = section_kind(s)
    parts: list[str] = [
        f"# Section to draft: {s.title}",
        f"# Input type: {s.inputType or 'NARRATIVE'} (editorial kind: {kind})",
    ]
    if s.minWords is not None or s.maxWords is not None:
        parts.append(f"# Length: {s.minWords or 0}-{s.maxWords or 'no limit'} words of prose (never pad; tables do not count)")
    if s.pageLimit is not None:
        parts.append(f"# Page limit set by the donor: {s.pageLimit} page(s)")
    if s.donorInstructions and s.donorInstructions.strip():
        parts.append(
            "# Donor instructions for this section (from the donor's template; follow them, "
            "but never invent facts or numbers to satisfy them):\n" + s.donorInstructions.strip()
        )
    if s.requiredTables:
        parts.append(
            "# Tables the donor requires in this section (render each as a markdown table in `content` with exactly "
            "these columns; fill cells only from the inputs and write 'Not reported' where no verified value exists):\n"
            + "\n".join(
                f"- {t.title}: | {' | '.join(t.columns)} |" + (f" ({t.notes})" if t.notes else "") for t in s.requiredTables
            )
        )
    if s.authorInstructions and s.authorInstructions.strip():
        parts.append(
            "# Organisation guidance for this section (follow it unless it conflicts with the rules):\n"
            + s.authorInstructions.strip()
        )

    slots = s.outlineSlots or outline_for(kind)
    parts.append(
        "# Outline slots (address every required slot, in order):\n"
        + "\n".join(f"- [{x.id}] (required={x.required}) {x.intent}" + (f" Hint: {x.hint}" if x.hint else "") for x in slots)
    )
    if s.sectionGuidance:
        parts.append(_bullets("Section-specific guidance (mandatory):", s.sectionGuidance))
    if s.requirementGuidance:
        parts.append(_bullets("Donor requirement guidance (MUST be honoured):", s.requirementGuidance))
    if s.mandatoryQuestions:
        parts.append(
            _bullets("Mandatory questions (answer each in the prose AND in `qa`, question text copied exactly):", s.mandatoryQuestions)
        )
    if s.evidenceNeeds:
        parts.append(_bullets("Evidence needs:", s.evidenceNeeds))
    if s.relatedLogframeElement:
        parts.append(f"# Related logframe element: {s.relatedLogframeElement}")

    if s.priorSectionsSummary:
        if s.synthesis:
            parts.append(
                "# Drafted report sections to synthesise (your summary MUST be consistent with these; "
                "select the most important results; do not introduce facts they do not contain):\n"
                + "\n\n".join(s.priorSectionsSummary)
            )
        else:
            parts.append(_bullets("Already-written sibling sections (do NOT restate their facts; refer to them by name):", s.priorSectionsSummary))

    if s.userInstruction and s.userInstruction.strip():
        parts.append(
            "# Author's instruction for this section (follow it unless it conflicts with the rules; "
            "never invent facts or numbers):\n" + s.userInstruction.strip()
        )

    attached = _ATTACHED_BY_KIND.get(kind)
    if attached:
        parts.append(f"# Attached automatically: {attached}. Do not reproduce it; interpret it in prose.")

    # Legacy v2 briefs may still send these; keep them visible as ground truth.
    if s.numericTable:
        parts.append(
            "# Pre-extracted numeric rows (ground truth):\n"
            + json.dumps([r.model_dump(exclude_none=True) for r in s.numericTable], ensure_ascii=False)
        )

    parts.append(_json_block("Evidence chunks", req.retrievedEvidence))
    if req.priorNarrative:
        parts.append(_json_block("Prior approved narrative (for consistency)", req.priorNarrative))

    parts.append("# Output schema (STRICT JSON, exactly one section):\n" + _OUTPUT_SCHEMA)
    parts.append(
        f'Draft ONLY the section "{s.title}". Quote every number verbatim from the inputs. '
        "Do not invent numbers, records, causes, or quotes. Return only JSON."
    )
    return "\n\n".join(parts)


def _temperature() -> float:
    try:
        return float(os.getenv("AI_REPORTER_TEMPERATURE", "0.2"))
    except ValueError:
        return 0.2


def draft(
    req: SectionDraftRequest,
    *,
    feedback: list[str] | None = None,
    previous_content: str | None = None,
    max_wait_s: float | None = None,
) -> GeneratedSection:
    """Run one draft pass (exactly one provider call) and return the coerced
    GeneratedSection.

    With `feedback`, this is the validator retry: the previous draft and every
    issue are shown so the model makes targeted corrections instead of
    rewriting from scratch (which tends to trade one defect for another).

    A reply with no JSON raises `ValueError`; the pipeline owns the retry, so
    it stays inside the section's time budget and call cap. `max_wait_s`
    bounds how long the call may queue for a provider slot.
    """
    from . import timeouts  # late import to avoid cycles

    system = system_prompt(req.writerContractVersion)
    shared, specific = build_user_prompt_parts(req)
    user = shared + "\n\n" + specific if shared else specific
    temperature = _temperature()
    if feedback:
        user += (
            "\n\n# Your previous draft:\n"
            + (previous_content or "")
            + "\n\n# Validator feedback — fix every item below and keep everything else that is correct:\n"
            + "\n".join(f"- {i}" for i in feedback)
        )
        temperature = min(temperature, 0.1)

    def _call() -> tuple[str, dict[str, Any]]:
        return _chat(system, user, model=req.model, temperature=temperature, cache_prefix=shared or None)

    content, telemetry = timeouts.run_with_section_timeout(_call, max_wait_s=max_wait_s)
    _local.telemetry = telemetry
    raw = extract_json(content)
    sections = raw.get("sections") if isinstance(raw, dict) and isinstance(raw.get("sections"), list) else None
    obj = sections[0] if sections else raw
    if not isinstance(obj, dict):
        raise ValueError("model returned a non-object section")
    return coerce_section(obj, req.section.title)
