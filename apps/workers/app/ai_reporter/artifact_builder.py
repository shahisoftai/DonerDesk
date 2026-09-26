"""Deterministic artifacts built from verified findings.

Asking the LLM to re-type indicator tables, chart series and period deltas was
the main source of JSON failures, truncation, and paraphrased numbers — and the
writer's typed output was being dropped anyway. These artifacts are pure
functions of the verified findings, so they are grounded by construction:

  - `indicator_table`  → TABLE artifact + the same table as markdown, which is
    appended to INDICATOR_TABLE section content so the editor, preview, and
    DOCX/PDF export all show the exact verified figures.
  - `indicator_chart`  → CHART artifact via the existing `chart_suggester`.
  - `period_delta`     → DELTA from the first finding with a comparisonValue.

The writer only writes prose; `attach` merges these onto its section.
"""
from __future__ import annotations

from typing import Any

from . import chart_suggester
from .grounding import _to_float, normalise_number, percent_of_target
from .models import (
    Artifact,
    ChartPayload,
    DeltaPayload,
    Finding,
    GeneratedSection,
    SectionDraftRequest,
    SourceRef,
)

_STATUS_LABEL = {"POSITIVE": "On track", "NEGATIVE": "Below expectation", "NEUTRAL": "Descriptive only"}
_RESULT_KINDS = {"ACHIEVEMENT", "INDICATOR_TABLE"}
# Section kinds that carry a deterministic period delta; the validator requires it for these.
DELTA_KINDS = frozenset(_RESULT_KINDS | {"EXECUTIVE_SUMMARY"})


def _ref(f: Finding) -> SourceRef:
    return SourceRef(type="indicator", id=f.indicatorId or f.indicatorCode, label=f.indicatorCode)


def _cell(value: Any) -> str:
    if value is None or value == "":
        return "—"
    return str(value)


def _not_calculable(f: Finding) -> bool:
    return f.valueStatus == "NOT_CALCULABLE" or "MISSING_DENOMINATOR" in f.qualityFlags or f.value is None


def _pct_cell(f: Finding) -> str:
    if _not_calculable(f):
        return "—"
    pct = percent_of_target(f.value, f.target)
    return "—" if pct is None else f"{normalise_number(f'{pct:.1f}')}%"


def _status_cell(f: Finding) -> str:
    if _not_calculable(f):
        return "Not calculable"
    kind = (f.performanceEvaluation or {}).get("type")
    return _STATUS_LABEL.get(str(kind), "—")


_COLUMNS = [
    ("code", "Code"),
    ("indicator", "Indicator"),
    ("unit", "Unit"),
    ("baseline", "Baseline"),
    ("target", "Target"),
    ("value", "This period"),
    ("previous", "Previous"),
    ("pctTarget", "% of target"),
    ("status", "Status"),
    ("source", "Data source"),
]


def indicator_table(req: SectionDraftRequest) -> tuple[Artifact, str] | None:
    findings = req.verifiedFindings
    if not findings:
        return None
    sources = {u.indicatorCode: u.dataSource for u in req.indicatorUpdates if u.dataSource}
    rows: list[dict[str, Any]] = []
    md_rows: list[str] = []
    for f in findings:
        cells = [
            f.indicatorCode,
            f.indicatorName or "—",
            _cell(f.unit),
            _cell(f.baseline),
            _cell(f.target),
            "Not calculable" if _not_calculable(f) else _cell(f.value),
            _cell(f.comparisonValue),
            _pct_cell(f),
            _status_cell(f),
            sources.get(f.indicatorCode) or "Project records",
        ]
        rows.append({"cells": cells, "sourceReferences": [_ref(f).model_dump()]})
        md_rows.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
    artifact = Artifact(
        kind="TABLE",
        caption="Indicator performance (verified findings)",
        ordinal=0,
        payload={"columns": [{"key": k, "label": label} for k, label in _COLUMNS], "rows": rows},
        sourceReferences=[_ref(f) for f in findings],
    )
    header = "| " + " | ".join(label for _, label in _COLUMNS) + " |"
    separator = "| " + " | ".join("---" for _ in _COLUMNS) + " |"
    return artifact, "\n".join([header, separator, *md_rows])


def indicator_chart(req: SectionDraftRequest) -> Artifact | None:
    usable = [f for f in req.verifiedFindings if not _not_calculable(f)]
    if not usable:
        return None
    spec = chart_suggester.suggest(
        {
            "indicators": [
                {"code": f.indicatorCode, "baseline": f.baseline, "target": f.target, "value": f.value, "unit": f.unit}
                for f in usable
            ],
            "priorValues": {f.indicatorCode: f.comparisonValue for f in usable if f.comparisonValue is not None},
        }
    )
    if spec is None:
        return None
    refs = [_ref(f) for f in usable]
    for series in spec.series:
        series.sourceReferences = refs
    spec.sourceReferences = refs
    return Artifact(kind="CHART", caption=spec.caption, ordinal=0, payload=spec.model_dump(), sourceReferences=refs)


def period_delta(req: SectionDraftRequest) -> DeltaPayload | None:
    for f in req.verifiedFindings:
        if _not_calculable(f) or f.comparisonValue is None:
            continue
        now, before = _to_float(f.value), _to_float(f.comparisonValue)
        if now is None or before is None:
            continue
        direction = "UP" if now > before else "DOWN" if now < before else "FLAT"
        label = f"{f.indicatorCode}" + (f" ({f.indicatorName})" if f.indicatorName else "")
        return DeltaPayload(
            metric=label,
            fromValue=str(f.comparisonValue),
            toValue=str(f.value),
            direction=direction,
            evidenceSummary=f"{label}: {f.comparisonValue} in the previous period, {f.value} this period.",
            sourceReferences=[_ref(f)],
        )
    return None


def attach(section: GeneratedSection, req: SectionDraftRequest, kind: str) -> GeneratedSection:
    """Merge deterministic artifacts onto the writer's section (idempotent per call)."""
    artifacts: list[Artifact] = [a for a in section.artifacts if a.kind not in {"TABLE", "CHART", "DELTA"}]
    content = section.content
    if kind == "INDICATOR_TABLE":
        built = indicator_table(req)
        if built is not None:
            table, markdown = built
            artifacts.insert(0, table)
            # The verified table is authoritative: drop any table the writer
            # typed itself (it can only be a paraphrase) and append ours.
            prose = "\n".join(line for line in content.splitlines() if not line.lstrip().startswith("|")).strip()
            content = f"{markdown}\n\n{prose}".strip() if prose else markdown
    chart = None
    if kind in _RESULT_KINDS:
        chart = indicator_chart(req)
        if chart is not None:
            artifacts.append(chart)
    delta = period_delta(req) if kind in DELTA_KINDS else None
    if delta is not None:
        artifacts.append(
            Artifact(kind="DELTA", caption="Change from previous period", ordinal=0, payload=delta.model_dump(), sourceReferences=delta.sourceReferences)
        )
    for i, art in enumerate(artifacts):
        art.ordinal = i
    return section.model_copy(
        update={
            "content": content,
            "artifacts": artifacts,
            "chartSpec": ChartPayload.model_validate(chart.payload) if chart is not None else None,
            "deltaFromPrior": delta,
        }
    )
