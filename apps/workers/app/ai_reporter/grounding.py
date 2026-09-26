"""Deterministic number grounding.

The writer contract forbids any number that is not in the inputs. This module
makes that rule checkable: it extracts numeric tokens from a draft and verifies
each one against the set of numbers present anywhere in the section request
(findings, updates, activities, evidence text, story/project/period context,
prior narrative, brief), plus the single derived figure the contract allows —
a finding's percent of target, at 0–2 decimals.

This is the inverse of the legacy `assert_numeric_exactness` ("every verified
number must appear in this section"), which is wrong for any section that does
not restate every indicator; that check is kept only for explicit callers.

Mirrored in TypeScript at `packages/infrastructure/src/ai/number-grounding.ts`.
"""
from __future__ import annotations

import json
import re
from typing import Any, Iterable

from .models import SectionDraftRequest

# A number not glued to a code/identifier: "OUT-1", "ev-1:0", "Q3", "COVID-19",
# "2026-01-31" (the date tail) are skipped. Thousands separators are kept as one
# token ("3,251"), decimals are kept ("85.5").
_NUMBER_RE = re.compile(r"(?<![\w\-:/.])(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\w])")
# Ordered-list markers / numbered headings are layout, not claims.
_LIST_MARKER_RE = re.compile(r"^(\s*(?:#+\s*)?)\d+[.)](?=\s)", re.MULTILINE)


def normalise_number(token: str) -> str:
    """Canonical form: no thousands separators, no trailing decimal zeros."""
    s = token.replace(",", "").strip()
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    s = s.lstrip("0") or "0"
    if s.startswith("."):
        s = "0" + s
    return s


def extract_numbers(text: str) -> list[str]:
    """Numeric tokens (raw spelling) in `text`, excluding list markers and codes."""
    if not text:
        return []
    cleaned = _LIST_MARKER_RE.sub(r"\1", text)
    return [m.group(1) for m in _NUMBER_RE.finditer(cleaned)]


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _rounded_variants(value: float) -> Iterable[str]:
    for digits in (0, 1, 2):
        yield normalise_number(f"{round(value, digits):.{digits}f}")


def percent_of_target(value: Any, target: Any) -> float | None:
    v, t = _to_float(value), _to_float(target)
    if v is None or t is None or t == 0:
        return None
    return v / t * 100.0


def _walk_values(value: Any) -> Iterable[str]:
    if isinstance(value, dict):
        for v in value.values():
            yield from _walk_values(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _walk_values(v)
    elif isinstance(value, bool) or value is None:
        return
    elif isinstance(value, (int, float)):
        yield json.dumps(value)
    else:
        yield str(value)


def allowed_numbers(req: SectionDraftRequest) -> set[str]:
    """Every number a grounded draft for `req` may contain, normalised."""
    allowed: set[str] = set()
    for text in _walk_values(req.model_dump(exclude={"model", "writerContractVersion"}, exclude_none=True)):
        allowed.update(normalise_number(n) for n in extract_numbers(text))
    for f in req.verifiedFindings:
        for raw in (f.value, f.baseline, f.target, f.comparisonValue):
            num = _to_float(raw)
            if num is not None:
                allowed.update(_rounded_variants(num))
        if f.valueStatus != "NOT_CALCULABLE":
            pct = percent_of_target(f.value, f.target)
            if pct is not None:
                allowed.update(_rounded_variants(pct))
    return allowed


def ungrounded_numbers(text: str, allowed: set[str]) -> list[str]:
    """Numbers in `text` (raw spelling, de-duplicated, in order) absent from `allowed`."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in extract_numbers(text):
        norm = normalise_number(raw)
        if norm in allowed or norm in seen:
            continue
        seen.add(norm)
        out.append(raw)
    return out
