"""Live evaluation of the AI writer (H-7): the real pipeline against a real model.

The golden corpus in `packages/infrastructure` scores *stored* drafts, so it proves the validators, not the
writer: a prompt change or a provider regression cannot fail it. This runs the actual `run_pipeline` (prompt,
provider call, retry, deterministic tables) over a few fixed scenarios and scores the result with the same
validators a real report faces.

Not a merge gate: a model is not deterministic and a provider can be down. It writes a JSON report so the *trend*
is visible (pass rate, retries, fallbacks, latency, tokens). Run it nightly (`.github/workflows/ai-live-eval.yml`) or
by hand:

    AI_REPORTER_PROVIDER=glm AI_REPORTER_MODEL=... AI_REPORTER_API_KEY=... \
        .venv/bin/python scripts/live_eval.py live-eval.json

Exit code: 0 when it ran (whatever the quality), 2 when no provider key is configured (nothing was evaluated).
"""

from __future__ import annotations

import json
import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ai_reporter.artifact_validators import run_all  # noqa: E402
from app.ai_reporter.models import (  # noqa: E402
    Activity,
    Context,
    ContextProfile,
    Finding,
    IndicatorUpdate,
    SectionBrief,
    SectionDraftRequest,
)
from app.ai_reporter.pipeline import run_pipeline  # noqa: E402


def _findings() -> list[Finding]:
    return [
        Finding(
            indicatorCode="OUT-1", indicatorId="ind-1", indicatorName="Centres rehabilitated", baseline="0",
            target="120", value="96", comparisonValue="60", performanceEvaluation={"type": "POSITIVE"},
        ),
        Finding(
            indicatorCode="OUT-2", indicatorId="ind-2", indicatorName="Caregivers counselled", target="1,000",
            value=None, valueStatus="NOT_CALCULABLE", qualityFlags=["MISSING_DENOMINATOR"],
        ),
    ]


def _request(title: str, **brief: Any) -> SectionDraftRequest:
    return SectionDraftRequest(
        section=SectionBrief(title=title, **brief),
        context=Context(profile=ContextProfile(tone="FORMAL", language="English")),
        verifiedFindings=_findings(),
        indicatorUpdates=[IndicatorUpdate(indicatorCode="OUT-1", indicatorId="ind-1", dataSource="Site register")],
        activities=[
            Activity(title="IYCF counselling", activityId="act-14", participantsTotal=142, participantsFemale=97)
        ],
    )


SCENARIOS: list[tuple[str, SectionDraftRequest]] = [
    ("results-and-progress", _request("Results and progress")),
    ("activities-implemented", _request("Activities implemented")),
    ("challenges", _request("Challenges and mitigation")),
    (
        "results-with-question",
        _request("Results and progress", mandatoryQuestions=["How many centres were rehabilitated?"]),
    ),
]


def main() -> int:
    out_path = sys.argv[1] if len(sys.argv) > 1 else "live-eval.json"
    has_key = os.getenv("AI_REPORTER_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not (has_key or os.getenv("AI_REPORTER_PROVIDER") == "ollama"):
        print("No provider key configured (AI_REPORTER_API_KEY); nothing was evaluated.", file=sys.stderr)
        return 2
    results: list[dict[str, Any]] = []
    for name, request in SCENARIOS:
        started = time.monotonic()
        entry: dict[str, Any] = {"scenario": name}
        try:
            section, telemetry = run_pipeline(request)
            verdict = run_all(section, request)
            entry.update(
                passed=verdict.ok,
                issues=list(verdict.issues),
                warnings=list(verdict.warnings),
                words=len((section.content or "").split()),
                usedFallback=bool(telemetry.get("usedFallback")),
                attempts=telemetry.get("attempts"),
                inputTokens=telemetry.get("inputTokens"),
                outputTokens=telemetry.get("outputTokens"),
            )
        except Exception as exc:  # a provider failure is a result, not a crash
            entry.update(passed=False, error=f"{type(exc).__name__}: {exc}"[:300])
        entry["seconds"] = round(time.monotonic() - started, 1)
        results.append(entry)
        print(f"{name}: {'pass' if entry['passed'] else 'FAIL'} in {entry['seconds']}s")
    passed = sum(1 for r in results if r["passed"])
    report = {
        "provider": os.getenv("AI_REPORTER_PROVIDER", "openai"),
        "model": os.getenv("AI_REPORTER_MODEL", ""),
        "passed": passed,
        "total": len(results),
        "results": results,
    }
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)
    print(f"live eval: {passed}/{len(results)} scenarios passed (report: {out_path})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
