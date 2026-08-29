"""Per-inputType outline slot templates.

A small, pure, deterministic function: `outline_for(input_type, brief) -> list[OutlineSlot]`.
The writer is given the slot list in the user prompt and is required to address
each `required: true` slot. The same function is mirrored in TypeScript at
`packages/infrastructure/src/llm/ai-reporter/outline.ts` (compiled from the
single Python source via a build-time generator — for the in-repo scope we
hand-mirror and verify parity via the test suite).
"""
from __future__ import annotations

from typing import Any

from .models import OutlineSlot


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
            OutlineSlot(id="table", intent="Emit a TABLE artifact with >=3 rows of disaggregated indicators.", required=True),
            OutlineSlot(id="narrative", intent="Narrate the table contents in plain prose.", required=True),
            OutlineSlot(id="caveat", intent="Surface every data-quality flag and limitation.", required=True),
        ]
    elif normalized == "ACHIEVEMENT":
        slots = [
            OutlineSlot(id="claim", intent="State the achievement in one sentence.", required=True),
            OutlineSlot(id="evidence", intent="Cite the evidence chunks that ground the claim.", required=True),
            OutlineSlot(id="disaggregation", intent="Disaggregate by gender / district / donor when available.", required=False),
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
            OutlineSlot(id="scope", intent="State the period and scope.", required=True),
            OutlineSlot(id="key-numbers", intent="Reference 1-3 verified numbers.", required=True),
        ]
    else:  # NARRATIVE
        slots = [
            OutlineSlot(id="context", intent="State the context of the section.", required=True),
            OutlineSlot(id="evidence", intent="Cite the relevant evidence.", required=True),
            OutlineSlot(id="interpretation", intent="Interpret the evidence without inventing facts.", required=True),
        ]

    return slots
