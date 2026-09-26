"""Per-inputType outline slot templates.

A small, pure, deterministic function: `outline_for(input_type, brief) -> list[OutlineSlot]`.
The writer is given the slot list in the user prompt and is required to address
each `required: true` slot. The same function is mirrored in TypeScript at
`packages/infrastructure/src/llm/ai-reporter/outline.ts` (compiled from the
single Python source via a build-time generator — for the in-repo scope we
hand-mirror and verify parity via the test suite).
"""
from __future__ import annotations

import re
from typing import Any

from .models import OutlineSlot, SectionBrief

# Title patterns → outline kind. Donor templates only carry the coarse
# `SectionInputType` (NARRATIVE | TABLE | ANNEX | INDICATOR_TABLE | COMPLIANCE),
# so the editorial kind (achievement, challenge, …) must come from the title.
# Order matters: the first match wins.
_KIND_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("EXECUTIVE_SUMMARY", re.compile(r"executive summary|summary of (results|progress)|overview|abstract", re.I)),
    ("INDICATOR_TABLE", re.compile(r"annex.*(indicator|performance)|indicator (table|matrix)|logframe (table|matrix)", re.I)),
    ("ANNEX", re.compile(r"\bannex|appendix|attachment", re.I)),
    ("CHALLENGE", re.compile(r"challenge|constraint|risk|mitigation|issue|delay", re.I)),
    ("LESSON", re.compile(r"lesson|learning|recommendation|good practice|best practice", re.I)),
    ("NEXT_PERIOD", re.compile(r"next (period|quarter|steps|phase)|work ?plan|planned activit|way forward|outlook", re.I)),
    ("COMPLIANCE", re.compile(r"complian|safeguard|psea|visibility|declaration|audit", re.I)),
    ("ACHIEVEMENT", re.compile(r"achievement|result|progress|outcome|output|indicator|performance|impact|reach|beneficiar", re.I)),
]


def section_kind(brief: SectionBrief) -> str:
    """Editorial kind of a section, from its synthesis flag, title, and input type."""
    if brief.synthesis:
        return "EXECUTIVE_SUMMARY"
    input_type = (brief.inputType or "NARRATIVE").upper()
    if input_type == "INDICATOR_TABLE":
        return "INDICATOR_TABLE"
    for kind, pattern in _KIND_PATTERNS:
        if pattern.search(brief.title or ""):
            return kind
    if input_type in {"ANNEX", "COMPLIANCE"}:
        return input_type
    return "NARRATIVE"


def outline_for(input_type: str | None, brief: dict[str, Any] | None = None) -> list[OutlineSlot]:
    """Return the outline slots for a given section `input_type`.

    Args:
        input_type: One of `INDICATOR_TABLE | ACHIEVEMENT | CHALLENGE | LESSON
          | NEXT_PERIOD | ANNEX | COMPLIANCE | NARRATIVE | EXECUTIVE_SUMMARY`
          (unknown / None defaults to NARRATIVE).
        brief: Optional brief dict for context (used to inject brief-derived hints
          for sections with mandatory questions or chart suggestions).

    Returns:
        A list of `OutlineSlot`s in render order. The `required` flag is hard;
        missing a required slot fails the deterministic post-validator.
    """
    slots: list[OutlineSlot]
    normalized = (input_type or "NARRATIVE").upper()

    if normalized == "INDICATOR_TABLE":
        slots = [
            OutlineSlot(id="table", intent="The verified indicator table is attached automatically; do not re-type it.", required=True),
            OutlineSlot(id="narrative", intent="Summarise the table in 2-4 sentences: strongest results, results below expectation, indicators not calculable.", required=True),
            OutlineSlot(id="caveat", intent="Surface every data-quality flag and limitation as 'Data quality notes'.", required=True),
        ]
    elif normalized == "ACHIEVEMENT":
        slots = [
            OutlineSlot(id="claim", intent="Lead with the most important verified result and its number.", required=True),
            OutlineSlot(id="evidence", intent="Support each result with the activity records or evidence that ground it.", required=True),
            OutlineSlot(id="change", intent="Compare with the previous period where a comparisonValue exists.", required=False),
            OutlineSlot(id="disaggregation", intent="Quote recorded sex/age/disability breakdowns verbatim per activity; never total them.", required=False),
            OutlineSlot(id="caveat", intent="State any data-quality limitation.", required=False),
        ]
    elif normalized == "CHALLENGE":
        slots = [
            OutlineSlot(id="context", intent="Describe the context of the challenge (one sentence).", required=True),
            OutlineSlot(id="evidence", intent="Cite the evidence chunk(s) recording the challenge.", required=True),
            OutlineSlot(id="mitigation", intent="State mitigation steps taken; if none, say so.", required=True),
        ]
    elif normalized == "LESSON":
        slots = [
            OutlineSlot(id="observation", intent="Describe what was observed.", required=True),
            OutlineSlot(id="implication", intent="Describe what was learned.", required=True),
            OutlineSlot(id="action", intent="Describe what changes as a result.", required=True),
        ]
    elif normalized == "NEXT_PERIOD":
        slots = [
            OutlineSlot(id="plan", intent="State planned activities for the next reporting period.", required=True),
            OutlineSlot(id="rationale", intent="Explain the rationale grounded in evidence.", required=True),
        ]
    elif normalized == "ANNEX":
        slots = [
            OutlineSlot(id="list", intent="List annexed files with type and reference.", required=True),
        ]
    elif normalized == "COMPLIANCE":
        slots = [
            OutlineSlot(id="status", intent="State compliance status (e.g. compliant / partial / non-compliant).", required=True),
            OutlineSlot(id="evidence", intent="Cite the evidence recording compliance.", required=True),
            OutlineSlot(id="remediation", intent="If non-compliant, state remediation steps.", required=False),
        ]
    elif normalized == "EXECUTIVE_SUMMARY":
        slots = [
            OutlineSlot(id="headline", intent="State the single most important result of the period.", required=True),
            OutlineSlot(id="scope", intent="State the project, donor, location, and period in one sentence.", required=True),
            OutlineSlot(id="key-numbers", intent="Reference 2-4 verified numbers, including any result below expectation.", required=True),
            OutlineSlot(id="challenge", intent="Name the main recorded challenge and how it was addressed, if recorded.", required=False),
            OutlineSlot(id="outlook", intent="One sentence of outlook drawn only from recorded next steps.", required=False),
        ]
    else:  # NARRATIVE
        slots = [
            OutlineSlot(id="context", intent="State the context of the section.", required=True),
            OutlineSlot(id="evidence", intent="Cite the relevant evidence.", required=True),
            OutlineSlot(id="interpretation", intent="Interpret the evidence without inventing facts.", required=True),
        ]

    return slots
