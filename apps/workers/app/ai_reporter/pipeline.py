"""Pipeline orchestration — draft, attach deterministic artifacts, validate, retry once.

Flow per section:
  1. `draft()` — one LLM call for prose/claims/Q&A (writer contract v4).
  2. `artifact_builder.attach()` — indicator table / chart / period delta built
     from verified findings (grounded by construction).
  3. `artifact_validators.run_all()` — number grounding, Q&A coverage, banned
     phrases, repetition, word limit, required tables, donor-voice warnings.
  4. On hard issues: ONE retry through the same guarded `draft()` path (same
     per-call timeout, same parser) with the previous draft + every issue and
     warning as feedback. The better of the two attempts is kept.
  5. If the kept attempt still has an *integrity* issue (an ungrounded number),
     the response sets `usedFallback`/`fallbackReason=VALIDATOR_FAILED` so the
     API substitutes the deterministic section. Style-only issues (banned
     phrase, length, repetition, missing Q&A) keep the AI prose and are
     reported as `qualityIssues` for the reviewer.

Worst case is 2 LLM calls per section, typical case 1.
"""
from __future__ import annotations

import hashlib
import time
from typing import Any

from . import artifact_builder
from .artifact_validators import ValidationResult, run_all
from .draft_writer import draft, pop_last_telemetry
from .llm_gateway import TransientProviderError
from .models import GeneratedSection, SectionDraftRequest, SectionDraftResponse
from .outline import section_kind
from .timeouts import SectionTimeoutError, TotalBudgetExceededError, TotalBudgetTracker
from .writer_contract import system_prompt

# Cap on any single backoff sleep, independent of a provider's Retry-After
# header — a provider misreporting a very long Retry-After must not stall a
# request far beyond what the operator configured.
_MAX_BACKOFF_S = 20.0


def _response_for(section: GeneratedSection, telemetry: dict[str, Any]) -> SectionDraftResponse:
    return SectionDraftResponse(
        sectionId=section.sectionId,
        title=section.title,
        content=section.content,
        claims=section.claims,
        sourceReferences=section.sourceReferences,
        artifacts=section.artifacts,
        qa=section.qa,
        chartSpec=section.chartSpec,
        deltaFromPrior=section.deltaFromPrior,
        telemetry=telemetry,
    )


def _rank(result: ValidationResult) -> tuple[int, int, int]:
    """Lower is better: integrity issues first, then hard issues, then warnings."""
    return (len(result.integrity_issues), len(result.issues), len(result.warnings))


def run_pipeline(req: SectionDraftRequest) -> tuple[GeneratedSection, dict[str, Any]]:
    """Draft one section with deterministic artifacts, validation, and one feedback retry."""
    prompt_hash = hashlib.sha256(system_prompt(req.writerContractVersion).encode("utf-8")).hexdigest()[:16]
    budget = TotalBudgetTracker()
    kind = section_kind(req.section)
    prior_present = bool(req.priorNarrative)

    attempts: list[tuple[GeneratedSection, ValidationResult]] = []
    tokens = {"inputTokens": 0, "outputTokens": 0}
    feedback: list[str] | None = None
    previous: str | None = None
    last_err: Exception | None = None

    for attempt in (1, 2):
        if attempts and budget.remaining_s() <= 0:
            break  # no time for the feedback retry; keep the first attempt
        budget.check()
        try:
            written = draft(req) if feedback is None else draft(req, feedback=feedback, previous_content=previous)
        except (TotalBudgetExceededError, SectionTimeoutError):
            # Never retry once the total budget is gone, and never re-run the
            # same slow call into the same deadline. A slow feedback retry
            # keeps the first attempt; a slow first attempt hands over to the
            # caller's deterministic fallback immediately.
            if attempts:
                break
            raise
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            if attempts or attempt == 2:
                break  # keep the attempt we already have
            if isinstance(exc, TransientProviderError):
                # An immediate retry into the same rate-limit window almost
                # always fails again for nothing. Back off — but never past
                # the remaining total budget.
                delay = exc.retry_after if exc.retry_after is not None else 2.0
                delay = min(delay, _MAX_BACKOFF_S, budget.remaining_s())
                if delay > 0:
                    time.sleep(delay)
            continue
        finally:
            call_telemetry = pop_last_telemetry()
            tokens["inputTokens"] += int(call_telemetry.get("inputTokens", 0) or 0)
            tokens["outputTokens"] += int(call_telemetry.get("outputTokens", 0) or 0)

        section = artifact_builder.attach(written, req, kind)
        result = run_all(section, req, prior_narrative_present=prior_present)
        attempts.append((section, result))
        if result.ok:
            break
        feedback = list(result.issues) + list(result.warnings)
        previous = written.content

    if not attempts:
        if last_err is not None:
            raise last_err
        raise RuntimeError("pipeline exhausted without result")

    best_index = min(range(len(attempts)), key=lambda i: (_rank(attempts[i][1]), -i))
    section, result = attempts[best_index]
    telemetry: dict[str, Any] = {
        **tokens,
        "promptHash": prompt_hash,
        "sectionKind": kind,
        "attempts": len(attempts),
        "validatorIssues": list(result.issues),
        "qualityWarnings": list(result.warnings),
        "parseOutcome": "VALID" if result.ok else ("VALIDATOR_FAILED" if result.integrity_issues else "VALID_WITH_ISSUES"),
    }
    if result.integrity_issues:
        telemetry["usedFallback"] = True
        telemetry["fallbackReason"] = "VALIDATOR_FAILED"
    return section, telemetry
