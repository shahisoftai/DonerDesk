"""Deterministic artifact validators (Python mirror of TS).

Pure, side-effect-free validators that mirror
`packages/infrastructure/src/ai/artifact-validators.ts`. The worker runs these
on every response before returning; on a hard failure it retries once with the
validator output (and donor-voice warnings) appended to the prompt.

Results separate three severities:
  - `issues`   — hard failures that trigger the retry;
  - of those, *integrity* issues (see `INTEGRITY_ISSUE_PREFIXES`) mean the prose
    may state something the inputs do not support, so a section that still
    carries one after the retry is demoted to the deterministic fallback;
  - `warnings` — craft signals (donor voice, word minimum) that never fail a
    section but are fed back to the writer on a retry.

Parity with the TS mirror is verified by `test_ai_reporter.py` and
`packages/infrastructure/test/artifact-validators.test.mjs`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from . import donor_voice
from .grounding import allowed_numbers, normalise_number, ungrounded_numbers
from .artifact_builder import DELTA_KINDS
from .models import GeneratedSection, SectionDraftRequest
from .outline import section_kind
from .writer_contract import BANNED_PHRASES

# Issues whose presence after the retry means the prose cannot be trusted.
INTEGRITY_ISSUE_PREFIXES: tuple[str, ...] = (
    "UNGROUNDED_NUMBER",
    "CHART_UNGROUNDED",
    "NUMERIC_PARAPHRASE",
    "TABLE row",
)


@dataclass(frozen=True)
class ValidationResult:
    ok: bool
    issues: tuple[str, ...]
    warnings: tuple[str, ...] = field(default=())

    @property
    def integrity_issues(self) -> tuple[str, ...]:
        return tuple(i for i in self.issues if i.startswith(INTEGRITY_ISSUE_PREFIXES))


def _ok() -> ValidationResult:
    return ValidationResult(ok=True, issues=())


def _words(text: str) -> list[str]:
    return [w for w in re.split(r"\s+", text.strip()) if w]


def _prose(text: str) -> str:
    """Section content without markdown table rows (tables are counted as structure)."""
    return "\n".join(line for line in (text or "").splitlines() if not line.lstrip().startswith("|"))


def _artifacts_as_dicts(section: GeneratedSection) -> list[dict[str, Any]]:
    """Convert Pydantic Artifact objects to plain dicts for homogeneous access."""
    out: list[dict[str, Any]] = []
    for art in section.artifacts or []:
        if hasattr(art, "model_dump"):
            out.append(art.model_dump())
        elif isinstance(art, dict):
            out.append(art)
    return out


def _qa_as_dicts(section: GeneratedSection) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in section.qa or []:
        if hasattr(item, "model_dump"):
            out.append(item.model_dump())
        elif isinstance(item, dict):
            out.append(item)
    return out


def assert_numeric_exactness(section: GeneratedSection, verified_numbers: set[str]) -> ValidationResult:
    """Every verified number must appear verbatim in `content` or any artifact payload.

    Only meaningful for sections that must restate every figure; the general
    grounding rule is `assert_numbers_grounded`.
    """
    if not verified_numbers:
        return _ok()
    content = section.content or ""
    artifact_text = _collect_artifact_text(section)
    haystack = (content + "\n" + artifact_text).lower()
    missing = sorted(n for n in verified_numbers if n.lower() not in haystack)
    if missing:
        return ValidationResult(ok=False, issues=(f"NUMERIC_PARAPHRASE missing: {', '.join(missing)}",))
    return _ok()


def assert_numbers_grounded(section: GeneratedSection, allowed: set[str]) -> ValidationResult:
    """Every number in the prose and Q&A answers must exist in the inputs."""
    text = section.content + "\n" + "\n".join(str(q.get("answer", "")) for q in _qa_as_dicts(section))
    bad = ungrounded_numbers(text, allowed)
    if bad:
        return ValidationResult(
            ok=False,
            issues=(
                "UNGROUNDED_NUMBER: "
                + ", ".join(bad[:8])
                + " do not appear in the verified inputs; quote only recorded figures (percent of target is the only derived figure allowed)",
            ),
        )
    return _ok()


def assert_table_citation(section: GeneratedSection) -> ValidationResult:
    """Every non-empty TABLE row cell must have >=1 sourceReference."""
    for art in _artifacts_as_dicts(section):
        if art.get("kind") != "TABLE":
            continue
        payload = art.get("payload") or {}
        rows = payload.get("rows") or []
        for i, row in enumerate(rows):
            refs = row.get("sourceReferences") or []
            cells = row.get("cells") or []
            non_empty = [c for c in cells if c not in (None, "")]
            if non_empty and len(refs) < 1:
                return ValidationResult(ok=False, issues=(f"TABLE row {i} missing sourceReferences",))
    return _ok()


def assert_chart_data_grounding(section: GeneratedSection, verified_numbers: set[str]) -> ValidationResult:
    """Every chart series data point must equal a verified/allowed number (when set is non-empty)."""
    if not verified_numbers:
        return _ok()
    allowed = {normalise_number(v) for v in verified_numbers}
    for art in _artifacts_as_dicts(section):
        if art.get("kind") != "CHART":
            continue
        payload = art.get("payload") or {}
        for series in payload.get("series") or []:
            for j, point in enumerate(series.get("data") or []):
                if point is None or point == "":
                    continue
                token = f"{point:f}" if isinstance(point, float) else str(point)
                if normalise_number(token) not in allowed:
                    return ValidationResult(
                        ok=False,
                        issues=(f"CHART_UNGROUNDED: series '{series.get('name')}' data[{j}]={point} not in verified numbers",),
                    )
    return _ok()


# "No complaints data was recorded", "was not reported", "no verified information".
_HONEST_GAP_RE = re.compile(
    r"\b(?:no|not|none)\b[^.]{0,80}?\b(?:recorded|reported|available|collected|captured|documented|verified)\b",
    re.IGNORECASE,
)


def _question_key(text: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", str(text).lower()))


def assert_mandatory_questions_answered(section: GeneratedSection, req: SectionDraftRequest) -> ValidationResult:
    """Each mandatory question needs a non-empty Q&A answer.

    Matching is punctuation/case-insensitive, and falls back to position when
    the writer answered every question in order but reworded one. An honest
    "not recorded" answer needs no source; a substantive one does.
    """
    questions = list(req.section.mandatoryQuestions or [])
    if not questions:
        return _ok()
    qa = [item for item in _qa_as_dicts(section) if str(item.get("answer", "")).strip()]
    by_key = {_question_key(item.get("question", "")): item for item in qa}
    missing: list[str] = []
    matched: list[dict[str, Any]] = []
    for i, q in enumerate(questions):
        item = by_key.get(_question_key(q))
        if item is None and len(qa) == len(questions):
            item = qa[i]
        if item is None:
            missing.append(q)
        else:
            matched.append(item)
    if missing:
        return ValidationResult(ok=False, issues=(f"MISSING_QA: {' | '.join(missing)}",))
    for i, item in enumerate(matched):
        honest_gap = bool(_HONEST_GAP_RE.search(str(item.get("answer", ""))))
        if not item.get("sourceReferences") and not honest_gap:
            return ValidationResult(ok=False, issues=(f"MISSING_QA_SOURCE: answer {i + 1} has no sourceReferences",))
    return _ok()


def assert_delta_from_prior(
    section: GeneratedSection,
    prior_narrative_present: bool,
    comparable_finding_present: bool = True,
) -> ValidationResult:
    """A delta is required only when there is both a prior period and a comparable figure."""
    if not (prior_narrative_present and comparable_finding_present):
        return _ok()
    if section.deltaFromPrior is None:
        return ValidationResult(ok=False, issues=("MISSING_DELTA: deltaFromPrior is required when prior narrative exists",))
    return _ok()


def assert_word_count(section: GeneratedSection, req: SectionDraftRequest) -> ValidationResult:
    """maxWords is a hard limit; a shortfall against minWords is only a warning
    (padding to hit a minimum is exactly what produces speculative prose)."""
    count = len(_words(_prose(section.content or "")))
    issues: list[str] = []
    warnings: list[str] = []
    if req.section.minWords is not None and count < req.section.minWords:
        warnings.append(f"WORD_LIMIT: {count} words < minWords={req.section.minWords} (add only grounded detail; never pad)")
    if req.section.maxWords is not None and count > req.section.maxWords:
        issues.append(f"WORD_LIMIT: {count} words > maxWords={req.section.maxWords}")
    return ValidationResult(ok=not issues, issues=tuple(issues), warnings=tuple(warnings))


def _sentences(text: str) -> list[str]:
    return [s for s in re.split(r"(?<=[.!?])\s+", _prose(text).strip()) if s]


def _trigrams(tokens: list[str]) -> set[tuple[str, ...]]:
    return {tuple(tokens[i : i + 3]) for i in range(len(tokens) - 2)}


def assert_repetition(section: GeneratedSection, prior_summary: list[str] | None) -> ValidationResult:
    """No sentence may restate a sibling-section sentence.

    Two signals: >=70% token Jaccard (verbatim-ish copies) or >=60% of the
    sentence's word trigrams contained in the sibling sentence (paraphrases that
    keep the same phrasing core). Short sentences (<8 tokens) are ignored.
    """
    if not prior_summary:
        return _ok()
    new_sents = _sentences(section.content or "")
    prior_sents: list[str] = []
    for blob in prior_summary:
        prior_sents.extend(_sentences(str(blob)))
    if not (new_sents and prior_sents):
        return _ok()
    prior_tokens = [(_normalise_tokens(ps)) for ps in prior_sents]
    for ns in new_sents:
        ns_list = _normalise_tokens(ns)
        if len(ns_list) < 8:
            continue
        ns_tokens = set(ns_list)
        ns_tri = _trigrams(ns_list)
        for ps_list in prior_tokens:
            if not ps_list:
                continue
            ps_tokens = set(ps_list)
            jaccard = len(ns_tokens & ps_tokens) / max(1, len(ns_tokens | ps_tokens))
            contained = len(ns_tri & _trigrams(ps_list)) / max(1, len(ns_tri)) if ns_tri else 0.0
            if jaccard >= 0.7 or contained >= 0.6:
                return ValidationResult(ok=False, issues=(f"DUPLICATE: sentence restates a sibling section: \"{ns[:90]}\"",))
    return _ok()


_INDICATOR_ANNEX_TITLE_RE = re.compile(r"annex", re.IGNORECASE)
_INDICATOR_ANNEX_KIND_RE = re.compile(r"indicator|performance", re.IGNORECASE)
_EVIDENCE_ANNEX_KIND_RE = re.compile(r"evidence|document|file", re.IGNORECASE)
_MARKDOWN_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|.*\|\s*$", re.MULTILINE)


def assert_required_table_present(section: GeneratedSection, req: SectionDraftRequest) -> ValidationResult:
    """Annex sections that the writer prompt tells to "produce a markdown
    table" (indicator-performance annex, evidence-checklist annex) must
    actually contain one — otherwise the model silently substitutes prose
    describing the table, which is unusable in the exported document (see
    `buildSectionSpecificGuidance` in `llm-report-draft-generator.ts`, the TS
    mirror of this instruction). A markdown table is recognised heuristically
    as at least two `|`-delimited rows (header + at least one data or
    separator row); this deliberately does not require exact column counts,
    since indicator counts vary per project.
    """
    title = req.section.title or ""
    if not _INDICATOR_ANNEX_TITLE_RE.search(title):
        return _ok()
    if not (_INDICATOR_ANNEX_KIND_RE.search(title) or _EVIDENCE_ANNEX_KIND_RE.search(title)):
        return _ok()
    rows = _MARKDOWN_TABLE_ROW_RE.findall(section.content or "")
    if len(rows) < 2:
        return ValidationResult(ok=False, issues=("MISSING_TABLE: annex section requires a markdown table (header + rows) but content contains prose only",))
    return _ok()


def find_banned_phrases(text: str) -> list[str]:
    """Banned phrases present as whole words/phrases (case-insensitive)."""
    lower = (text or "").lower()
    return [p for p in BANNED_PHRASES if re.search(r"(?<![a-z])" + re.escape(p.lower()) + r"(?![a-z])", lower)]


def assert_banned_phrases(section: GeneratedSection) -> ValidationResult:
    hits = find_banned_phrases(section.content or "")
    if hits:
        return ValidationResult(ok=False, issues=(f"BANNED_PHRASE: {', '.join(hits)}",))
    return _ok()


def assert_artifact_ordering(section: GeneratedSection) -> ValidationResult:
    """Ordinals strictly increasing, no gaps > 1."""
    ordinals = [int(art.get("ordinal", 0)) for art in _artifacts_as_dicts(section)]
    for prev, curr in zip(ordinals, ordinals[1:]):
        if curr <= prev:
            return ValidationResult(ok=False, issues=(f"ARTIFACT_ORDER: ordinal not strictly increasing ({prev}->{curr})",))
        if curr - prev > 1:
            return ValidationResult(ok=False, issues=(f"ARTIFACT_ORDER: ordinal gap > 1 ({prev}->{curr})",))
    return _ok()


def assert_donor_voice(section: GeneratedSection) -> ValidationResult:
    """Language-craft signals; warnings only."""
    report = donor_voice.assess(section.content or "")
    return ValidationResult(ok=True, issues=(), warnings=report.warnings)


def run_all(
    section: GeneratedSection,
    req: SectionDraftRequest,
    *,
    verified_numbers: set[str] | None = None,
    prior_narrative_present: bool = False,
    check_grounding: bool = True,
) -> ValidationResult:
    """Run every validator and aggregate hard issues and warnings.

    `verified_numbers` (explicit) additionally enforces the legacy
    "every figure restated" rule; `check_grounding` enforces that no figure is
    invented (derived from the request itself).
    """
    allowed = allowed_numbers(req) if check_grounding else set()
    # A delta is only meaningful (and only attached) for results sections that
    # have a finding with both a current and a previous-period value.
    comparable = section_kind(req.section) in DELTA_KINDS and any(
        f.comparisonValue is not None and f.value is not None for f in req.verifiedFindings
    )
    results = [
        assert_numeric_exactness(section, verified_numbers or set()),
        assert_numbers_grounded(section, allowed) if check_grounding else _ok(),
        assert_table_citation(section),
        assert_chart_data_grounding(section, allowed | set(verified_numbers or set())),
        assert_mandatory_questions_answered(section, req),
        assert_delta_from_prior(section, prior_narrative_present, comparable),
        assert_word_count(section, req),
        _ok() if req.section.synthesis else assert_repetition(section, list(req.section.priorSectionsSummary or [])),
        assert_banned_phrases(section),
        assert_artifact_ordering(section),
        assert_required_table_present(section, req),
        assert_donor_voice(section),
    ]
    issues: list[str] = []
    warnings: list[str] = []
    for r in results:
        issues.extend(r.issues)
        warnings.extend(r.warnings)
    return ValidationResult(ok=not issues, issues=tuple(issues), warnings=tuple(warnings))


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _normalise_tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _collect_artifact_text(section: GeneratedSection) -> str:
    """Flatten every artifact payload into a single lowercased text blob for numeric search."""
    bits: list[str] = []
    for art in _artifacts_as_dicts(section):
        payload = art.get("payload") or {}
        kind = art.get("kind")
        if kind == "TABLE":
            for row in payload.get("rows") or []:
                bits.extend(str(c) for c in (row.get("cells") or []) if c is not None)
        elif kind == "CHART":
            bits.extend(str(c) for c in (payload.get("categories") or []))
            for series in payload.get("series") or []:
                bits.extend(str(d) for d in (series.get("data") or []) if d is not None)
        elif kind == "LIST":
            for item in payload.get("items") or []:
                if isinstance(item, dict):
                    bits.append(str(item.get("text") or ""))
        elif kind == "KEY_VALUE":
            for entry in payload.get("entries") or []:
                if isinstance(entry, dict):
                    bits.append(str(entry.get("value") or ""))
        elif kind == "QA":
            bits.append(str(payload.get("answer") or ""))
        elif kind == "DELTA":
            bits.append(str(payload.get("fromValue") or ""))
            bits.append(str(payload.get("toValue") or ""))
    return "\n".join(bits)
