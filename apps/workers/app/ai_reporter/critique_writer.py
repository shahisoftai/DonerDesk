"""Critique writer — emits typed CritiqueIssue[].

Behaviour preserved from v1 `_critique`: returns `list[str]` (issue strings).
The new typed `IssueKind` enum allows the deterministic validator to route
each issue to the right downstream check. Issues are plain strings on the
wire (compatible with v1) but we annotate each with a `kind` for routing.
"""
from __future__ import annotations

from enum import Enum

from .draft_writer import build_user_prompt
from .llm_gateway import _chat
from .models import GeneratedSection, SectionDraftRequest
from .writer_contract import system_prompt
from . import timeouts


class IssueKind(str, Enum):
    BANNED_PHRASE = "BANNED_PHRASE"
    NUMERIC_PARAPHRASE = "NUMERIC_PARAPHRASE"
    MISSING_TABLE = "MISSING_TABLE"
    MISSING_CHART = "MISSING_CHART"
    MISSING_QA = "MISSING_QA"
    MISSING_DELTA = "MISSING_DELTA"
    DUPLICATE = "DUPLICATE"
    WORD_LIMIT = "WORD_LIMIT"
    UNSUPPORTED_CLAIM = "UNSUPPORTED_CLAIM"
    MISSING_CAVEAT = "MISSING_CAVEAT"
    OTHER = "OTHER"


_CRITIQUE_PROMPT = (
    "You are a precise report reviewer. Critique the drafted section against the provided evidence manifest. "
    "Focus ONLY on evidence-conformance and factual integrity, NOT style. Identify: (1) any number that is not "
    "exactly present in the findings/evidence, (2) any claim about causes, outcomes, targets, dates, partners, "
    "incidents, or future plans not supported by the inputs, (3) any caveat/limitation that was dropped, "
    "(4) any cross-section repetition that should be removed, (5) any missing caveat required by quality flags. "
    'Return STRICT JSON: {"issues":["..."]}. Return {"issues":[]} if the draft is fully grounded.'
)


def _classify_issue(text: str) -> IssueKind:
    """Best-effort routing of an LLM-emitted issue string into a typed kind."""
    t = text.lower()
    if "banned" in t or "clich" in t or "transformative" in t or "life-changing" in t:
        return IssueKind.BANNED_PHRASE
    if "numeric" in t or "number" in t or "paraphrased" in t:
        return IssueKind.NUMERIC_PARAPHRASE
    if "table" in t and ("missing" in t or "absent" in t):
        return IssueKind.MISSING_TABLE
    if "chart" in t and ("missing" in t or "absent" in t):
        return IssueKind.MISSING_CHART
    if "qa" in t or "mandatory question" in t or "answer" in t:
        return IssueKind.MISSING_QA
    if "delta" in t or "prior" in t:
        return IssueKind.MISSING_DELTA
    if "repeat" in t or "duplicate" in t:
        return IssueKind.DUPLICATE
    if "word" in t and ("limit" in t or "exceed" in t):
        return IssueKind.WORD_LIMIT
    if "unsupported" in t or "invent" in t:
        return IssueKind.UNSUPPORTED_CLAIM
    if "caveat" in t or "limitation" in t:
        return IssueKind.MISSING_CAVEAT
    return IssueKind.OTHER


def critique(req: SectionDraftRequest, draft_section: GeneratedSection) -> list[str]:
    """Run one critique pass; return a list of issue strings (may be empty)."""
    system = system_prompt(req.writerContractVersion) + "\n" + _CRITIQUE_PROMPT
    user = build_user_prompt(req) + "\n\n# Draft to critique:\n" + draft_section.content
    try:
        content, _ = timeouts.run_with_section_timeout(
            lambda: _chat(system, user, model=req.model)
        )
    except Exception:
        # Critique failures are non-fatal: return empty so the refine step
        # receives the original draft.
        return []
    try:
        from .llm_gateway import extract_json  # local import to keep imports tidy

        raw = extract_json(content)
    except Exception:
        return []
    issues = raw.get("issues", []) if isinstance(raw, dict) else []
    if not isinstance(issues, list):
        return []
    # Tag each issue with its kind for downstream routing; keep the wire shape
    # as a list of strings so v1 callers are unchanged.
    out: list[str] = []
    for item in issues:
        if isinstance(item, str) and item.strip():
            kind = _classify_issue(item)
            out.append(f"[{kind.value}] {item.strip()}")
    return out
