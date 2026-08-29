"""Deterministic chart suggestion heuristic.

Single source of truth (Python). The TS mirror in
`packages/infrastructure/src/llm/ai-reporter/chart-suggester.ts` is verified by
the worker at startup against this implementation; mismatch raises at build
time (see `chart_suggester_parity_test.py`).

Returns a `ChartPayload` (a suggestion) or `None`. The writer is *required* to
emit a CHART artifact when this returns non-None; otherwise no chart.
"""
from __future__ import annotations

from typing import Any

from .models import ChartPayload, ChartSeries


def _series(name: str, values: list[float | str | None], refs: list[Any] | None = None) -> ChartSeries:
    return ChartSeries(name=name, data=values, sourceReferences=refs or [])


def suggest(finding_summary: dict[str, Any]) -> ChartPayload | None:
    """Apply the deterministic chart heuristic.

    `finding_summary` is a pre-computed dict (built by `SectionBriefBuilder`)
    with these keys (any may be missing):
      - indicators: list of {code, baseline, target, value, unit, periodLabel?}
      - priorValues: dict[indicatorCode -> priorValue] for delta heuristics
      - disaggregations: list[category] (e.g. gender/site)
      - activityOutputVsTarget: (output: float, target: float) | None
      - claimStatusCounts: dict[status -> count]

    The function does not call the LLM; it is a pure heuristic.
    """
    indicators = finding_summary.get("indicators") or []
    prior_values = finding_summary.get("priorValues") or {}
    disaggregations = finding_summary.get("disaggregations") or []
    activity_ratio = finding_summary.get("activityOutputVsTarget")
    claim_status_counts = finding_summary.get("claimStatusCounts") or {}

    # 1. Time-series line when an indicator has a prior period value.
    for ind in indicators:
        code = ind.get("code")
        if code and code in prior_values and ind.get("value") is not None:
            return ChartPayload(
                type="LINE",
                dataBinding="INDICATOR_ACHIEVEMENT",
                unit=ind.get("unit"),
                title=f"{code}: period achievement",
                caption=f"{code} period achievement vs. target",
                categories=["Prior period", "Current period"],
                series=[
                    _series(
                        ind["code"],
                        [_to_number(prior_values.get(code)), _to_number(ind.get("value"))],
                    ),
                    _series(
                        "Target",
                        [_to_number(ind.get("target")), _to_number(ind.get("target"))],
                    ),
                ],
            )

    # 2. Gauge when a single activity output vs target is present.
    if activity_ratio is not None:
        out = _to_number(activity_ratio.get("output"))
        tgt = _to_number(activity_ratio.get("target"))
        if out is not None and tgt:
            return ChartPayload(
                type="GAUGE",
                dataBinding="INDICATOR_COMPARISON",
                title="Activity output vs target",
                caption="Activity output against the planned target",
                categories=["Output"],
                series=[_series("Achievement", [out])],
            )

    # 3. Status distribution pie when there are >=3 distinct statuses.
    if len(claim_status_counts) >= 3:
        categories = sorted(claim_status_counts.keys())
        data = [_to_number(claim_status_counts[k]) for k in categories]
        return ChartPayload(
            type="PIE",
            dataBinding="STATUS_DISTRIBUTION",
            title="Claim verification status",
            caption="Distribution of claim verification status",
            categories=[c.replace("_", " ") for c in categories],
            series=[_series("count", data)],
        )

    # 4. Stacked bar when there are >=3 disaggregation categories.
    if len(disaggregations) >= 3:
        cats = [str(d.get("label") or d.get("category") or "—") for d in disaggregations]
        data = [_to_number(d.get("value")) for d in disaggregations]
        if any(d is not None for d in data):
            return ChartPayload(
                type="BAR",
                dataBinding="INDICATOR_ACHIEVEMENT",
                title="Indicator achievement by category",
                caption="Disaggregated achievement",
                categories=cats,
                series=[_series("Achievement", data)],
            )

    # 5. Indicator comparison bar when one or more indicators have all of baseline/target/value.
    comparable = [i for i in indicators if i.get("baseline") is not None and i.get("target") is not None and i.get("value") is not None]
    if comparable:
        unit = next((i.get("unit") for i in comparable if i.get("unit")), None)
        return ChartPayload(
            type="BAR",
            dataBinding="INDICATOR_COMPARISON",
            unit=unit,
            title="Indicator baseline vs target vs achievement",
            caption="Baseline, target, and current period achievement per indicator",
            categories=[i["code"] for i in comparable],
            series=[
                _series("Baseline", [_to_number(i.get("baseline")) for i in comparable]),
                _series("Target", [_to_number(i.get("target")) for i in comparable]),
                _series("Achievement", [_to_number(i.get("value")) for i in comparable]),
            ],
        )

    return None


def _to_number(value: Any) -> float | str | None:
    """Defensive numeric coercion mirroring TS `parse`."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return s
