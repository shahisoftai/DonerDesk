"""Deterministic artifacts built from verified findings.

Asking the LLM to re-type indicator tables, chart series and period deltas was
the main source of JSON failures, truncation, and paraphrased numbers — and the
writer's typed output was being dropped anyway. These artifacts are pure
functions of the verified findings, so they are grounded by construction:

  - `indicator_table`  → TABLE artifact + the same table as markdown, which is
    appended to INDICATOR_TABLE section content so the editor, preview, and
    DOCX/PDF export all show the exact verified figures.
  - charts are NOT built here: the API derives one chart per table of the final section text
    (`@donordesk/domain` `chartsForSection`), so a chart always sits beside the table it shows.
  - `period_delta`     → DELTA from the first finding with a comparisonValue.

The writer only writes prose; `attach` merges these onto its section.
"""

from __future__ import annotations

import re
from typing import Any

from .grounding import _to_float, normalise_number, percent_of_target
from .models import (
    Artifact,
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


def _is_rate(f: Finding) -> bool:
    """A value that is itself a percentage (coverage, rate): "percent of target" is the wrong
    yardstick; baseline and target are shown instead."""
    return (f.indicatorType or "").strip().lower() == "percentage" or (f.unit or "").strip() == "%"


def _is_lower_better(f: Finding) -> bool:
    """Deaths, stock-out days: the target is a ceiling, so "percent of target" (155 % for 3.1 days against 2) reads as ahead of plan.
    The direction travels in `calculationMethod` ("average:lower-is-better:period")."""
    return ":lower-is-better:" in (f.calculationMethod or "").lower()


def _pct_cell(f: Finding) -> str:
    if _not_calculable(f) or _is_rate(f) or _is_lower_better(f):
        return "—"
    pct = percent_of_target(f.value, f.target)
    return "—" if pct is None else f"{normalise_number(f'{pct:.1f}')}%"


def _status_cell(f: Finding) -> str:
    if _not_calculable(f):
        return "Not calculable"
    kind = (f.performanceEvaluation or {}).get("type")
    return _STATUS_LABEL.get(str(kind), "—")


_LIFE_COLUMNS = [
    ("cumulative", "Cumulative to date"),
    ("pctLife", "% of project target"),
]

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


def _life_value(f: Finding) -> str:
    return "—" if f.lifeOfProject is None else _cell(f.lifeOfProject.value)


def _life_pct_cell(f: Finding) -> str:
    if _is_rate(f) or _is_lower_better(f):
        return "—"
    if f.lifeOfProject is None:
        return "—"
    pct = percent_of_target(f.lifeOfProject.value, f.target)
    return "—" if pct is None else f"{normalise_number(f'{pct:.1f}')}%"


def _has_life_of_project(req: SectionDraftRequest) -> bool:
    return any(f.lifeOfProject is not None for f in req.verifiedFindings)


_OUTCOME_LEVELS = {"GOAL", "OUTCOME"}


_OUTCOME_NUMBER_RE = re.compile(r"\boutcome\s*(\d+)\b")


def _digits(code: str | None) -> str | None:
    """The number inside an outcome code (O1 -> 1, "Outcome 2" -> 2), or None."""
    found = re.findall(r"\d+", code or "")
    return found[0].lstrip("0") or "0" if found else None


def _per_outcome_findings(findings: list[Finding], section_title: str) -> list[Finding] | None:
    """A section named for one outcome ("Outcome 2: ...") shows only that outcome's indicators.

    Both "Outcome 1" and "Outcome 2" sub-sections used to match `"outcome" in title` and print the same rows (demo 8).
    The owning outcome comes from the finding's `outcomeCode`; None means this rule does not apply and the level-based
    split below decides.
    """
    match = _OUTCOME_NUMBER_RE.search(section_title)
    if not match or not any(f.outcomeCode for f in findings):
        return None
    wanted = match.group(1).lstrip("0") or "0"
    own = [f for f in findings if _digits(f.outcomeCode) == wanted]
    return own or None


def _scoped_findings(req: SectionDraftRequest) -> list[Finding]:
    """When a report has both an outcome section and an output section, each table keeps its own level.

    Without this both sections print the same table of every indicator (demo 7). The split needs the indicator's
    logframe level and the list of report sections; with either missing every finding is shown, as before.
    """
    findings = list(req.verifiedFindings)
    if not any(f.logframeLevel for f in findings):
        return findings
    structure = getattr(req.context, "structure", None) if req.context else None
    titles = [t.lower() for t in (structure.sectionTitles if structure else [])]
    mine = (req.section.canonicalTitle or req.section.title or "").lower()
    is_outcome = "outcome" in mine or "impact" in mine
    numbered = _per_outcome_findings(findings, mine)
    if numbered is not None:
        return numbered
    other_outcome = any(("outcome" in t or "impact" in t) and t != mine for t in titles)
    if is_outcome:
        scoped = [f for f in findings if (f.logframeLevel or "").upper() in _OUTCOME_LEVELS]
    elif other_outcome:
        scoped = [f for f in findings if (f.logframeLevel or "").upper() not in _OUTCOME_LEVELS]
    else:
        return findings
    return scoped or findings


def indicator_table(req: SectionDraftRequest) -> tuple[Artifact, str] | None:
    findings = _scoped_findings(req)
    if not findings:
        return None
    life = _has_life_of_project(req)
    columns = [*_COLUMNS[:-2], *_LIFE_COLUMNS, *_COLUMNS[-2:]] if life else _COLUMNS
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
            *([_life_value(f), _life_pct_cell(f)] if life else []),
            _status_cell(f),
            sources.get(f.indicatorCode) or "Project records",
        ]
        rows.append({"cells": cells, "sourceReferences": [_ref(f).model_dump()]})
        md_rows.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
    artifact = Artifact(
        kind="TABLE",
        caption="Indicator performance (verified findings)",
        ordinal=0,
        payload={"columns": [{"key": k, "label": label} for k, label in columns], "rows": rows},
        sourceReferences=[_ref(f) for f in findings],
    )
    header = "| " + " | ".join(label for _, label in columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    return artifact, "\n".join([header, separator, *md_rows])


_GROUP_COLUMNS = [
    ("code", "Code"),
    ("indicator", "Indicator"),
    ("group", "Group"),
    ("target", "Group target"),
    ("value", "This period"),
]
_GROUP_LIFE_COLUMN = ("cumulative", "Cumulative to date")
_DIMENSION_LABEL = {
    "SEX": "Sex",
    "AGE_GROUP": "Age group",
    "DISABILITY": "Disability",
    "LOCATION": "Location",
    "OTHER": "Other",
}


def _group_key(entry: dict[str, Any]) -> tuple[str, str]:
    return (str(entry.get("dimension") or ""), str(entry.get("category") or "").strip().lower())


def _recorded(entries: list[dict[str, Any]] | None) -> dict[tuple[str, str], str]:
    return {_group_key(e): str(e.get("value")) for e in entries or [] if e.get("value") not in (None, "")}


def group_target_table(req: SectionDraftRequest) -> tuple[Artifact, str] | None:
    """Targets set by group beside the figure recorded for that group.

    A group nobody reported reads "Not measured", never 0. Only recorded figures are shown: no percent is derived
    for a group, and a rate's group target is shown as the yardstick it is.
    """
    findings = [f for f in _scoped_findings(req) if f.targetBreakdowns]
    if not findings:
        return None
    life = _has_life_of_project(req)
    columns = [*_GROUP_COLUMNS, *([_GROUP_LIFE_COLUMN] if life else [])]
    rows: list[dict[str, Any]] = []
    md_rows: list[str] = []
    for f in findings:
        period = _recorded(f.disaggregation) if not _not_calculable(f) else {}
        cumulative = _recorded(f.lifeOfProject.disaggregation) if f.lifeOfProject else {}
        for entry in f.targetBreakdowns or []:
            key = _group_key(entry)
            label = f"{_DIMENSION_LABEL.get(key[0], key[0].title())}: {entry.get('category')}"
            cells = [
                f.indicatorCode,
                f.indicatorName or "—",
                label,
                _cell(entry.get("value")),
                period.get(key, "Not measured"),
                *([cumulative.get(key, "Not measured")] if life else []),
            ]
            rows.append({"cells": cells, "sourceReferences": [_ref(f).model_dump()]})
            md_rows.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
    artifact = Artifact(
        kind="TABLE",
        caption="Results by group against group targets (verified findings)",
        ordinal=0,
        payload={"columns": [{"key": k, "label": label} for k, label in columns], "rows": rows},
        sourceReferences=[_ref(f) for f in findings],
    )
    header = "| " + " | ".join(label for _, label in columns) + " |"
    separator = "| " + " | ".join("---" for _ in columns) + " |"
    return artifact, "\n".join([header, separator, *md_rows])


_CUMULATIVE_COLUMNS = [
    ("code", "Code"),
    ("indicator", "Indicator"),
    ("unit", "Unit"),
    ("baseline", "Baseline"),
    ("target", "Project target"),
    ("cumulative", "Cumulative to date"),
    ("pctLife", "% of project target"),
    ("asOf", "As of"),
]


def cumulative_table(req: SectionDraftRequest) -> tuple[Artifact, str] | None:
    """Life-of-project progress table (only indicators with a cumulative figure)."""
    findings = [f for f in req.verifiedFindings if f.lifeOfProject is not None]
    if not findings:
        return None
    rows: list[dict[str, Any]] = []
    md_rows: list[str] = []
    for f in findings:
        cells = [
            f.indicatorCode,
            f.indicatorName or "—",
            _cell(f.unit),
            _cell(f.baseline),
            _cell(f.target),
            _life_value(f),
            _life_pct_cell(f),
            _cell(f.lifeOfProject.asOf if f.lifeOfProject else None),
        ]
        rows.append({"cells": cells, "sourceReferences": [_ref(f).model_dump()]})
        md_rows.append("| " + " | ".join(c.replace("|", "/") for c in cells) + " |")
    artifact = Artifact(
        kind="TABLE",
        caption="Cumulative progress against project targets (verified findings)",
        ordinal=0,
        payload={"columns": [{"key": k, "label": label} for k, label in _CUMULATIVE_COLUMNS], "rows": rows},
        sourceReferences=[_ref(f) for f in findings],
    )
    header = "| " + " | ".join(label for _, label in _CUMULATIVE_COLUMNS) + " |"
    separator = "| " + " | ".join("---" for _ in _CUMULATIVE_COLUMNS) + " |"
    return artifact, "\n".join([header, separator, *md_rows])


_CUMULATIVE_TITLE_RE = re.compile(r"cumulative|life[- ]of[- ]project", re.I)


def is_cumulative_section(req: SectionDraftRequest, kind: str) -> bool:
    """A narrative results section about progress since the project started."""
    if kind != "ACHIEVEMENT" or not _has_life_of_project(req):
        return False
    return bool(_CUMULATIVE_TITLE_RE.search(req.section.canonicalTitle or req.section.title))


def period_delta(req: SectionDraftRequest) -> DeltaPayload | None:
    # A roll-up report (semi-annual, annual, final) states progress since the project started; "change from the previous
    # period" is a monthly or quarterly idea and read oddly at the top of a final report (demo 8).
    if _has_life_of_project(req):
        return None
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
            grouped = group_target_table(req)
            if grouped is not None:
                group_table, group_markdown = grouped
                artifacts.insert(1, group_table)
                markdown = f"{markdown}\n\n{group_markdown}"
            content = f"{markdown}\n\n{prose}".strip() if prose else markdown
    if is_cumulative_section(req, kind):
        built_cumulative = cumulative_table(req)
        if built_cumulative is not None:
            table, markdown = built_cumulative
            artifacts.insert(0, table)
            prose = "\n".join(line for line in content.splitlines() if not line.lstrip().startswith("|")).strip()
            content = f"{markdown}\n\n{prose}".strip() if prose else markdown
    delta = period_delta(req) if kind in DELTA_KINDS else None
    if delta is not None:
        artifacts.append(
            Artifact(
                kind="DELTA",
                caption="Change from previous period",
                ordinal=0,
                payload=delta.model_dump(),
                sourceReferences=delta.sourceReferences,
            )
        )
    for i, art in enumerate(artifacts):
        art.ordinal = i
    return section.model_copy(
        update={
            "content": content,
            "artifacts": artifacts,
            "chartSpec": None,
            "deltaFromPrior": delta,
        }
    )
