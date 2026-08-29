"""Artifact draft writer.

Composes the user prompt from the brief and the verified inputs, calls the LLM
gateway, and coerces the response into a `GeneratedSection`. Behaviour preserved
from v1 `_draft`; v2 adds brief injection of `priorSectionsSummary`,
`numericTable`, `chartSuggestion`, and `outlineSlots` so the writer has
deterministic ground truth for the new artifact payloads.
"""
from __future__ import annotations

import json
from typing import Any

from .llm_gateway import _chat, coerce_section, extract_json
from .models import (
    Activity,
    Context,
    Evidence,
    Finding,
    GeneratedSection,
    IndicatorUpdate,
    PriorNarrative,
    SectionDraftRequest,
    SourceRef,
)
from .writer_contract import system_prompt


def build_user_prompt(req: SectionDraftRequest) -> str:
    parts: list[str] = [
        f"# Section to draft: {req.section.title}",
        f"# Input type: {req.section.inputType or 'NARRATIVE'}",
    ]
    if req.section.minWords is not None:
        parts.append(f"# Minimum words: {req.section.minWords}")
    if req.section.maxWords is not None:
        parts.append(f"# Maximum words: {req.section.maxWords}")
    if req.section.mandatoryQuestions:
        parts.append("# Mandatory questions:\n" + "\n".join(f"- {q}" for q in req.section.mandatoryQuestions))
    if req.section.evidenceNeeds:
        parts.append("# Evidence needs:\n" + "\n".join(f"- {n}" for n in req.section.evidenceNeeds))
    if req.section.relatedLogframeElement:
        parts.append(f"# Related logframe element: {req.section.relatedLogframeElement}")

    # v2: outline slots
    if req.section.outlineSlots:
        lines = [
            f"- [{s.id}] (required={s.required}) {s.intent}" + (f" Hint: {s.hint}" if s.hint else "")
            for s in req.section.outlineSlots
        ]
        parts.append("# Outline slots (you MUST address every required slot):\n" + "\n".join(lines))

    # v2: prior sections summary (repetition guard)
    if req.section.priorSectionsSummary:
        parts.append(
            "# Already-written sibling sections (do NOT repeat; reference by section name):\n"
            + "\n".join(f"- {s}" for s in req.section.priorSectionsSummary)
        )

    # v2: numeric table (ground truth)
    if req.section.numericTable:
        parts.append(
            "# Pre-extracted numeric rows (ground truth; cite by evidenceId):\n"
            + json.dumps([r.model_dump(exclude_none=True) for r in req.section.numericTable], ensure_ascii=False)
        )

    # v2: chart suggestion
    if req.section.chartSuggestion is not None:
        parts.append(
            "# Suggested chart (you MUST emit a CHART artifact matching this suggestion):\n"
            + json.dumps(req.section.chartSuggestion, ensure_ascii=False)
        )

    ctx = req.context
    if ctx.project:
        parts.append(
            "# Project context:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.project.model_dump(exclude_none=True).items())
        )
    if ctx.period:
        parts.append(
            "# Reporting period:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.period.model_dump(exclude_none=True).items())
        )
    if ctx.template:
        parts.append(
            "# Donor template:\n"
            + "\n".join(f"- {k}: {v}" for k, v in ctx.template.model_dump(exclude_none=True).items())
        )
    if ctx.profile and ctx.profile.language:
        parts.append(f"# Language: {ctx.profile.language}")
    if ctx.profile and ctx.profile.formattingRules:
        parts.append("# Formatting rules:\n" + "\n".join(f"- {r}" for r in ctx.profile.formattingRules))

    parts.append(
        "# Verified findings (JSON):\n"
        + json.dumps([f.model_dump(exclude_none=True) for f in req.verifiedFindings], ensure_ascii=False)
    )
    parts.append(
        "# Indicator updates (JSON):\n"
        + json.dumps([u.model_dump(exclude_none=True) for u in req.indicatorUpdates], ensure_ascii=False)
    )
    parts.append(
        "# Activity records (JSON):\n"
        + json.dumps([a.model_dump(exclude_none=True) for a in req.activities], ensure_ascii=False)
    )
    parts.append(
        "# Evidence chunks (JSON):\n"
        + json.dumps([e.model_dump(exclude_none=True) for e in req.retrievedEvidence], ensure_ascii=False)
    )
    if req.priorNarrative:
        parts.append(
            "# Prior approved narrative (for consistency):\n"
            + json.dumps([p.model_dump(exclude_none=True) for p in req.priorNarrative], ensure_ascii=False)
        )

    # v2 output schema (additive over v1).
    schema = (
        '{"sectionId":"string","title":"string","content":"string",'
        '"claims":[{"text":"string","type":"NUMERIC|FACTUAL|CAUSAL|QUALITATIVE",'
        '"proposedSources":[{"evidenceId":"string","chunkId":"string","sourceText":"string"}]}],'
        '"sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}],'
        '"artifacts":[{"kind":"TABLE|CHART|LIST|KEY_VALUE|QA|DELTA",'
        '"caption":"string","ordinal":0,'
        '"payload":{},'
        '"sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}]}],'
        '"qa":[{"question":"string","answer":"string","sourceReferences":[{"type":"indicator|evidence|activity|template","id":"string","label":"string"}]}],'
        '"chartSpec":null|"object","deltaFromPrior":null|"object"}'
    )
    parts.append("# Output schema (STRICT JSON, exactly one section):\n" + schema)
    parts.append(
        "Draft ONLY the requested section. Preserve every number verbatim. "
        "Do not invent numbers or records. Return only JSON."
    )
    return "\n\n".join(parts)


def draft(req: SectionDraftRequest) -> GeneratedSection:
    """Run one draft pass against the LLM and return the coerced GeneratedSection."""
    from . import timeouts  # late import to avoid cycles

    system = system_prompt(req.writerContractVersion)
    user = build_user_prompt(req)

    def _call() -> tuple[str, dict[str, Any]]:
        return _chat(system, user, model=req.model)

    content, _telemetry = timeouts.run_with_section_timeout(_call)
    raw = extract_json(content)
    sections = raw.get("sections") if isinstance(raw, dict) and isinstance(raw.get("sections"), list) else None
    obj = sections[0] if sections else raw
    if not isinstance(obj, dict):
        raise ValueError("model returned a non-object section")
    return coerce_section(obj, req.section.title)
